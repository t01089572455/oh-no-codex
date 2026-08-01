import { createHash, randomUUID } from "node:crypto";
import {
  access,
  mkdir,
  open,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";

import {
  assertFrozenTasksMatchBasis,
  loadStructuredAcceptanceBasis,
} from "./acceptance-basis.js";
import {
  exactPlanDiff,
  parsePlan,
} from "./plan.js";
import { assertSafeProjectRelativePath } from "./paths.js";
import { readGitHead } from "./subject-digest.js";
import {
  compareAndSwapStateWithSideEffects,
  needsAcceptanceBasisMigration,
  planRevisionFor,
  readState,
  truthInventoryDigestFor,
} from "./state.js";
import type {
  AnyPendingPlan,
  PendingPlan,
  ProjectState,
  TruthClassificationEntry,
  TruthInventory,
} from "./state.js";
import type { TruthDocument } from "./truth.js";
import { readTruth } from "./truth.js";
import { classifyWithTruthDocument } from "./truth-inventory.js";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

const truthRelativePath = ".ohno/truth.json";

export interface MigrateApplyOptions {
  /** Exact DIFF_DIGEST from a prior zero-write preview. */
  diffDigest: string;
  /** Exact HEAD from that same preview. */
  head: string;
}

interface PlannedTruth {
  action: "create" | "update" | "unchanged";
  before: TruthDocument | null;
  after: TruthDocument;
  serialized: string;
  /** Prior file bytes for rollback (null if create / missing). */
  previousBytes: string | null;
}

type PendingDisposition =
  | "none"
  | "rebind_schema3"
  | "clear_stale_alongside_accepted_plan"
  | "clear_pending_source_unavailable";

interface MigratePlan {
  expectedState: ProjectState;
  basisPath: string;
  basisDigest: string;
  head: string;
  exactDiff: string;
  diffDigest: string;
  plannedTruth: PlannedTruth;
  hasAcceptedPlan: boolean;
  /** Semantic after (no wall-clock); plan_review uses apply-metadata markers. */
  semanticAfter: Record<string, unknown>;
  buildAppliedState(now: string, recordedDiffDigest: string): ProjectState;
}

/**
 * Load Truth fail-closed: only ENOENT is "missing". Corrupt/invalid refuses.
 */
async function loadTruthStrict(
  projectPath: string,
): Promise<{ document: TruthDocument | null; previousBytes: string | null }> {
  const truthPath = resolve(projectPath, ".ohno", "truth.json");
  try {
    await access(truthPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { document: null, previousBytes: null };
    }
    throw new Error(
      `cannot access Truth document at ${truthRelativePath}; repair before migrate`,
    );
  }
  let previousBytes: string;
  try {
    previousBytes = await readFile(truthPath, "utf8");
  } catch {
    throw new Error(
      `cannot read Truth document at ${truthRelativePath}; repair before migrate`,
    );
  }
  try {
    const document = await readTruth(projectPath);
    return { document, previousBytes };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      "invalid Truth document; repair before migrate (fail-closed, will not "
        + `overwrite): ${message}`,
    );
  }
}

function truthWithBasisTarget(
  previous: TruthDocument | null,
  previousBytes: string | null,
  basisPath: string,
): PlannedTruth {
  const basisTarget = {
    path: basisPath,
    concerns: ["acceptance-basis", "black-box"],
  };
  if (previous === null) {
    const after: TruthDocument = {
      schema_version: 1,
      targets: [basisTarget],
    };
    return {
      action: "create",
      before: null,
      after,
      serialized: `${JSON.stringify(after, null, 2)}\n`,
      previousBytes: null,
    };
  }
  const existing = previous.targets.find((t) => t.path === basisPath);
  if (existing !== undefined) {
    const concerns = new Set(existing.concerns);
    concerns.add("acceptance-basis");
    const nextConcerns = [...concerns];
    const sameConcerns = nextConcerns.length === existing.concerns.length
      && nextConcerns.every((c) => existing.concerns.includes(c));
    if (sameConcerns) {
      return {
        action: "unchanged",
        before: previous,
        after: previous,
        serialized: `${JSON.stringify(previous, null, 2)}\n`,
        previousBytes,
      };
    }
    const after: TruthDocument = {
      schema_version: 1,
      targets: previous.targets.map((t) => (
        t.path === basisPath
          ? { path: basisPath, concerns: nextConcerns }
          : t
      )),
    };
    return {
      action: "update",
      before: previous,
      after,
      serialized: `${JSON.stringify(after, null, 2)}\n`,
      previousBytes,
    };
  }
  const after: TruthDocument = {
    schema_version: 1,
    targets: [...previous.targets, basisTarget],
  };
  return {
    action: "update",
    before: previous,
    after,
    serialized: `${JSON.stringify(after, null, 2)}\n`,
    previousBytes,
  };
}

/**
 * Apply runs projectors after CAS, which creates/updates AGENTS.md. Bind that
 * path into the migrate inventory so digest is stable and change begin does
 * not see a new high-risk entry.
 */
function inventoryWithProjectedAgents(
  inventory: TruthInventory,
): TruthInventory {
  if (inventory.classification.some((entry) => entry.path === "AGENTS.md")) {
    return inventory;
  }
  const agents: TruthClassificationEntry = {
    path: "AGENTS.md",
    classification: "AGENT_INSTRUCTIONS",
    governing: true,
    truth_target: false,
  };
  const classification = [...inventory.classification, agents].toSorted(
    (left, right) => (
      left.path < right.path ? -1 : left.path > right.path ? 1 : 0
    ),
  );
  return {
    inventory_digest: truthInventoryDigestFor(classification),
    classification,
  };
}

/**
 * Rebind schema-2 pending to schema-3 with a v3 exactPlanDiff that accept
 * will recompute. Returns null when source is unreadable → clear pending.
 */
async function rebindLegacyPending(
  projectPath: string,
  pending: AnyPendingPlan,
  basisPath: string,
  basisDigest: string,
  head: string,
  migrateCursor: number,
): Promise<PendingPlan | null> {
  const basis = { path: basisPath, digest: basisDigest };

  // Base state accept sees after migrate (no accepted plan yet).
  // exactPlanDiff only reads plan_revision, ordered_tasks, cursor, plan_review.
  const stateForDiff = {
    plan_revision: null,
    ordered_tasks: [] as ProjectState["ordered_tasks"],
    cursor: migrateCursor,
    plan_review: null,
  } as unknown as ProjectState;

  // Source must parse with the same normalize path accept uses.
  let proposal: ReturnType<typeof parsePlan>;
  let sourceDigest: string;
  try {
    const absolute = resolve(projectPath, ...pending.source_path.split("/"));
    const bytes = await readFile(absolute, "utf8");
    sourceDigest = sha256(bytes);
    proposal = parsePlan(bytes);
  } catch {
    return null;
  }
  if (proposal.cursor !== pending.cursor) {
    return null;
  }
  if (proposal.acceptance_source !== basisPath) {
    // Schema-2 sources without basis path cannot rebind to an accept-able pending.
    return null;
  }
  // Recompute revision/diff from normalized proposal (accept's authority).
  const normalizedRevision = planRevisionFor(proposal.ordered_tasks, basis);
  const normalizedDiff = exactPlanDiff(
    stateForDiff,
    proposal,
    normalizedRevision,
    basis,
  );
  return {
    plan_revision: normalizedRevision,
    ordered_tasks: proposal.ordered_tasks,
    cursor: proposal.cursor,
    diff_digest: sha256(normalizedDiff),
    head,
    proposed_at: pending.proposed_at,
    source_path: pending.source_path,
    source_digest: sourceDigest,
    acceptance_source_path: basisPath,
    acceptance_source_digest: basisDigest,
  };
}

function sideEffectSlice(state: ProjectState) {
  return {
    schema_version: state.schema_version,
    status: state.status,
    plan_revision: state.plan_revision,
    ordered_tasks: state.ordered_tasks,
    cursor: state.cursor,
    completed: state.completed,
    plan_review: state.plan_review,
    pending_plan: state.pending_plan,
    active_task: state.active_task,
    last_verification: state.last_verification,
    truth_inventory: state.truth_inventory,
    document_sync: state.document_sync,
  };
}

/**
 * Semantic migrate exact diff. plan_review lists apply_metadata for fields
 * filled only at apply (diff_digest, wall-clock); all other after fields match
 * the state that will be written (modulo those apply_metadata values).
 */
function buildExactMigrateDiff(input: {
  before: ProjectState;
  semanticAfter: unknown;
  plannedTruth: PlannedTruth;
  head: string;
  basisPath: string;
  basisDigest: string;
}): string {
  return `${JSON.stringify({
    format: "ohno-acceptance-basis-migrate-v2",
    head: input.head,
    acceptance_basis: {
      path: input.basisPath,
      digest: input.basisDigest,
    },
    truth: {
      path: truthRelativePath,
      action: input.plannedTruth.action,
      before: input.plannedTruth.before,
      after: input.plannedTruth.after,
    },
    before: sideEffectSlice(input.before),
    after: input.semanticAfter,
    apply_metadata: {
      plan_review_fields_at_apply: [
        "diff_digest",
        "proposed_at",
        "recorded_at",
      ],
      diff_digest_binding:
        "plan_review.diff_digest equals DIFF_DIGEST of this exact migrate document",
      timestamps: "proposed_at and recorded_at are wall-clock RFC3339 at apply",
      review_provenance: "caller-returned local review (not Owner identity)",
    },
  }, null, 2)}\n`;
}

async function planMigration(
  projectPath: string,
  acceptanceSourcePath: string,
): Promise<MigratePlan> {
  const state = await readState(projectPath);
  if (!needsAcceptanceBasisMigration(state)) {
    throw new Error(
      "acceptance basis migration is not required "
        + `(schema_version=${state.schema_version})`,
    );
  }

  const basisPath = assertSafeProjectRelativePath(
    acceptanceSourcePath,
    "acceptance_source",
  );

  const hasAcceptedPlan = state.plan_revision !== null
    && state.ordered_tasks.length > 0;
  const hasPendingOnly = !hasAcceptedPlan && state.pending_plan !== null;

  const orderedForBind = hasAcceptedPlan
    ? state.ordered_tasks
    : hasPendingOnly
    ? state.pending_plan!.ordered_tasks
    : [];
  const loaded = await loadStructuredAcceptanceBasis(projectPath, basisPath);
  if (orderedForBind.length > 0) {
    assertFrozenTasksMatchBasis(orderedForBind, loaded.document);
  }
  const basisDigest = loaded.digest;

  const { document: previousTruth, previousBytes } = await loadTruthStrict(
    projectPath,
  );
  const plannedTruth = truthWithBasisTarget(
    previousTruth,
    previousBytes,
    basisPath,
  );
  const scannedInventory = await classifyWithTruthDocument(
    projectPath,
    plannedTruth.after,
  );
  const nextInventory = inventoryWithProjectedAgents(scannedInventory);

  const head = readGitHead(projectPath);
  const planRevision = orderedForBind.length > 0
    ? planRevisionFor(orderedForBind, { path: basisPath, digest: basisDigest })
    : null;

  let nextPending: AnyPendingPlan | null = null;
  let pendingDisposition: PendingDisposition = "none";

  if (hasAcceptedPlan) {
    if (state.pending_plan !== null) {
      pendingDisposition = "clear_stale_alongside_accepted_plan";
      nextPending = null;
    }
  } else if (hasPendingOnly && state.pending_plan !== null) {
    const rebound = await rebindLegacyPending(
      projectPath,
      state.pending_plan,
      basisPath,
      basisDigest,
      head,
      state.cursor,
    );
    if (rebound === null) {
      pendingDisposition = "clear_pending_source_unavailable";
      nextPending = null;
    } else {
      pendingDisposition = "rebind_schema3";
      nextPending = rebound;
    }
  }

  const nextStatus: ProjectState["status"] =
    state.document_sync.status === "PENDING_REVIEW"
      ? "BLOCKED_DOC_SYNC"
      : "IDLE";

  const nextPlanRevision = hasAcceptedPlan ? planRevision : state.plan_revision;
  const nextOrdered = hasAcceptedPlan
    ? state.ordered_tasks
    : hasPendingOnly
    ? []
    : state.ordered_tasks;

  // Semantic plan_review: all fields that exist at rest except apply metadata.
  const planReviewSemantic = hasAcceptedPlan && planRevision !== null
    ? {
      status: "LOCAL_REVIEW_RECORDED" as const,
      plan_revision: planRevision,
      head,
      acceptance_source_path: basisPath,
      acceptance_source_digest: basisDigest,
      // Explicit markers — filled at apply; not hidden omissions.
      diff_digest: "<apply: equals EXACT_MIGRATE_DIFF digest>",
      proposed_at: "<apply: wall-clock RFC3339>",
      recorded_at: "<apply: wall-clock RFC3339>",
    }
    : null;

  const semanticAfter = {
    schema_version: 3 as const,
    status: nextStatus,
    plan_revision: nextPlanRevision,
    ordered_tasks: nextOrdered,
    cursor: state.cursor,
    completed: state.completed,
    plan_review: planReviewSemantic,
    pending_plan: nextPending,
    pending_disposition: pendingDisposition,
    active_task: null,
    last_verification: null,
    truth_inventory: nextInventory,
    document_sync: state.document_sync,
  };

  const exactDiff = buildExactMigrateDiff({
    before: state,
    semanticAfter,
    plannedTruth,
    head,
    basisPath,
    basisDigest,
  });
  const diffDigest = sha256(exactDiff);

  const nextBase: ProjectState = {
    ...state,
    schema_version: 3,
    status: nextStatus,
    plan_revision: nextPlanRevision,
    ordered_tasks: nextOrdered,
    cursor: state.cursor,
    completed: state.completed,
    pending_plan: nextPending,
    active_task: null,
    last_verification: null,
    truth_inventory: nextInventory,
    plan_review: null,
  };

  return {
    expectedState: state,
    basisPath,
    basisDigest,
    head,
    exactDiff,
    diffDigest,
    plannedTruth,
    hasAcceptedPlan,
    semanticAfter,
    buildAppliedState(now: string, recordedDiffDigest: string): ProjectState {
      if (!hasAcceptedPlan || planRevision === null) {
        return nextBase;
      }
      return {
        ...nextBase,
        plan_review: {
          status: "LOCAL_REVIEW_RECORDED",
          plan_revision: planRevision,
          diff_digest: recordedDiffDigest,
          head,
          proposed_at: now,
          recorded_at: now,
          acceptance_source_path: basisPath,
          acceptance_source_digest: basisDigest,
        },
      };
    },
  };
}

function formatPreview(plan: MigratePlan): string {
  return [
    "MIGRATE_PREVIEW: zero-write — no state or Truth written",
    `ACCEPTANCE_SOURCE: ${plan.basisPath}`,
    `ACCEPTANCE_DIGEST: ${plan.basisDigest}`,
    `DIFF_DIGEST: ${plan.diffDigest}`,
    `HEAD: ${plan.head}`,
    `TRUTH_ACTION: ${plan.plannedTruth.action}`,
    "APPLY: re-run with the same --file and returned digests:",
    `  ohno migrate acceptance-basis --file ${plan.basisPath} `
      + `--diff ${plan.diffDigest} --head ${plan.head}`,
    "NOTE: apply re-validates under state.cas.lock, atomically replaces Truth,",
    "      then CAS-writes state; LOCAL_REVIEW_RECORDED only on successful apply.",
    "NOTE: plan_review.diff_digest/proposed_at/recorded_at are apply_metadata",
    "      (see EXACT_MIGRATE_DIFF.apply_metadata); other after fields are final.",
    "REVIEW_PROVENANCE: caller-returned local review (not Owner identity)",
    "",
    "EXACT_MIGRATE_DIFF:",
    plan.exactDiff,
  ].join("\n");
}

function formatApplied(plan: MigratePlan, next: ProjectState): string {
  return [
    "MIGRATED: schema_version=3",
    `ACCEPTANCE_SOURCE: ${plan.basisPath}`,
    `ACCEPTANCE_DIGEST: ${plan.basisDigest}`,
    `PLAN_REVISION: ${next.plan_revision ?? "null"}`,
    `DIFF_DIGEST: ${plan.diffDigest}`,
    `HEAD: ${plan.head}`,
    `CURSOR: ${next.cursor}`,
    `COMPLETED: ${next.completed.length}`,
    `TRUTH_ACTION: ${plan.plannedTruth.action}`,
    "REVIEW: LOCAL_REVIEW_RECORDED after caller-returned digest/HEAD apply "
      + "(local review evidence, not Owner identity)",
    "NOTE: active_task and last_verification cleared; inventory fully rebuilt",
    "",
  ].join("\n");
}

async function writeTruthAtomic(
  projectPath: string,
  serialized: string,
): Promise<void> {
  const directory = resolve(projectPath, ".ohno");
  const truthPath = resolve(directory, "truth.json");
  const temporaryPath = resolve(
    directory,
    `truth.json.${process.pid}.${randomUUID()}.tmp`,
  );
  await mkdir(directory, { recursive: true });
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(temporaryPath, "wx", 0o600);
    await handle.writeFile(serialized, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporaryPath, truthPath);
  } finally {
    await handle?.close().catch(() => undefined);
    await rm(temporaryPath, { force: true }).catch(() => undefined);
  }
}

async function rollbackTruth(
  projectPath: string,
  planned: PlannedTruth,
): Promise<void> {
  const truthPath = resolve(projectPath, ".ohno", "truth.json");
  if (planned.action === "create") {
    await rm(truthPath, { force: true }).catch(() => undefined);
    return;
  }
  if (planned.action === "update" && planned.previousBytes !== null) {
    await writeTruthAtomic(projectPath, planned.previousBytes);
  }
}

/**
 * Two-phase migration schema 2 → 3:
 * - Without --diff/--head: zero-write preview of semantic exact diff.
 * - With --diff/--head: under state.cas.lock, atomic Truth then state CAS.
 */
export async function migrateAcceptanceBasis(
  projectPath: string,
  acceptanceSourcePath: string,
  apply: MigrateApplyOptions | null = null,
): Promise<string> {
  const plan = await planMigration(projectPath, acceptanceSourcePath);

  if (apply === null) {
    return formatPreview(plan);
  }

  if (apply.diffDigest !== plan.diffDigest) {
    throw new Error(
      "migrate apply refused: DIFF_DIGEST does not match current zero-write "
        + "preview (basis, Truth, inventory, HEAD, or state changed) — re-preview",
    );
  }
  if (apply.head !== plan.head) {
    throw new Error(
      "migrate apply refused: HEAD does not match preview — re-preview",
    );
  }
  const liveHead = readGitHead(projectPath);
  if (liveHead !== plan.head) {
    throw new Error(
      "migrate apply refused: repository HEAD moved since preview — re-preview",
    );
  }

  const next = plan.buildAppliedState(new Date().toISOString(), plan.diffDigest);

  // Re-check inventory before lock (cheap fail); lock path re-reads state.
  const liveInventory = inventoryWithProjectedAgents(
    await classifyWithTruthDocument(projectPath, plan.plannedTruth.after),
  );
  if (liveInventory.inventory_digest !== next.truth_inventory.inventory_digest) {
    throw new Error(
      "migrate apply refused: inventory digest drifted during apply — re-preview",
    );
  }

  const swapped = await compareAndSwapStateWithSideEffects(
    projectPath,
    plan.expectedState,
    next,
    {
      commit: async () => {
        if (plan.plannedTruth.action === "unchanged") {
          return;
        }
        if (plan.plannedTruth.action === "create") {
          try {
            await access(resolve(projectPath, ".ohno", "truth.json"));
            throw new Error(
              "Truth appeared during migrate apply; refuse to overwrite — re-preview",
            );
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
              throw error;
            }
          }
        } else {
          try {
            await access(resolve(projectPath, ".ohno", "truth.json"));
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") {
              throw new Error(
                "Truth disappeared during migrate apply; refuse create-via-update "
                  + "— re-preview",
              );
            }
            throw error;
          }
        }
        await writeTruthAtomic(projectPath, plan.plannedTruth.serialized);
      },
      rollback: async () => {
        await rollbackTruth(projectPath, plan.plannedTruth);
      },
    },
  );

  if (!swapped) {
    // Equality failed under lock — no Truth commit ran.
    throw new Error("state changed during acceptance basis migration apply");
  }

  return formatApplied(plan, next);
}
