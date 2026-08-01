import { createHash } from "node:crypto";
import {
  access,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";

import {
  assertFrozenTasksMatchBasis,
  loadStructuredAcceptanceBasis,
} from "./acceptance-basis.js";
import { assertSafeProjectRelativePath } from "./paths.js";
import { readGitHead } from "./subject-digest.js";
import {
  compareAndSwapStateAtomic,
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
}

interface MigratePlan {
  expectedState: ProjectState;
  basisPath: string;
  basisDigest: string;
  head: string;
  exactDiff: string;
  diffDigest: string;
  plannedTruth: PlannedTruth;
  hasAcceptedPlan: boolean;
  buildAppliedState(now: string, recordedDiffDigest: string): ProjectState;
}

/**
 * Load Truth fail-closed: only ENOENT is "missing". Corrupt/invalid refuses.
 */
async function loadTruthStrict(
  projectPath: string,
): Promise<TruthDocument | null> {
  const truthPath = resolve(projectPath, ".ohno", "truth.json");
  try {
    await access(truthPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw new Error(
      `cannot access Truth document at ${truthRelativePath}; repair before migrate`,
    );
  }
  try {
    await readFile(truthPath, "utf8");
  } catch {
    throw new Error(
      `cannot read Truth document at ${truthRelativePath}; repair before migrate`,
    );
  }
  try {
    return await readTruth(projectPath);
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

function rebindLegacyPending(
  pending: AnyPendingPlan,
  basisPath: string,
  basisDigest: string,
  head: string,
): PendingPlan {
  const ordered = pending.ordered_tasks;
  const planRevision = planRevisionFor(ordered, {
    path: basisPath,
    digest: basisDigest,
  });
  return {
    plan_revision: planRevision,
    ordered_tasks: ordered,
    cursor: pending.cursor,
    diff_digest: pending.diff_digest,
    head,
    proposed_at: pending.proposed_at,
    source_path: pending.source_path,
    source_digest: pending.source_digest,
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
 * Deterministic migrate exact diff — no wall-clock. plan_review embeds path/
 * digest/revision/head but not diff_digest or recorded_at (filled at apply).
 */
function buildExactMigrateDiff(input: {
  before: ProjectState;
  after: unknown;
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
    after: input.after,
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

  // Validate basis BEFORE any Truth mutation plan.
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

  const previousTruth = await loadTruthStrict(projectPath);
  const plannedTruth = truthWithBasisTarget(previousTruth, basisPath);
  // Full rebuild as if Truth were on disk, plus AGENTS.md which apply-time
  // projectors materialize (must be pre-classified so change begin does not
  // self-lock on UNCLASSIFIED_HIGH_RISK).
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
  let pendingDisposition:
    | "none"
    | "rebind_schema3"
    | "clear_stale_alongside_accepted_plan" = "none";

  if (hasAcceptedPlan) {
    if (state.pending_plan !== null) {
      pendingDisposition = "clear_stale_alongside_accepted_plan";
      nextPending = null;
    }
  } else if (hasPendingOnly && state.pending_plan !== null) {
    pendingDisposition = "rebind_schema3";
    nextPending = rebindLegacyPending(
      state.pending_plan,
      basisPath,
      basisDigest,
      head,
    );
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

  const afterForDigest = {
    schema_version: 3 as const,
    status: nextStatus,
    plan_revision: nextPlanRevision,
    ordered_tasks: nextOrdered,
    cursor: state.cursor,
    completed: state.completed,
    plan_review: hasAcceptedPlan && planRevision !== null
      ? {
        status: "LOCAL_REVIEW_RECORDED" as const,
        plan_revision: planRevision,
        head,
        acceptance_source_path: basisPath,
        acceptance_source_digest: basisDigest,
      }
      : null,
    pending_plan: nextPending,
    pending_disposition: pendingDisposition,
    active_task: null,
    last_verification: null,
    truth_inventory: nextInventory,
    document_sync: state.document_sync,
  };

  const exactDiff = buildExactMigrateDiff({
    before: state,
    after: afterForDigest,
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
    "NOTE: apply re-validates basis, rebuilds full inventory, CAS-writes state;",
    "      LOCAL_REVIEW_RECORDED is recorded only on successful apply.",
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
    "REVIEW: LOCAL_REVIEW_RECORDED after Owner-returned digest/HEAD apply "
      + "(not self-approved before display)",
    "NOTE: active_task and last_verification cleared; inventory fully rebuilt",
    "",
  ].join("\n");
}

async function writePlannedTruth(
  projectPath: string,
  planned: PlannedTruth,
): Promise<void> {
  if (planned.action === "unchanged") {
    return;
  }
  const truthPath = resolve(projectPath, ".ohno", "truth.json");
  if (planned.action === "create") {
    try {
      await access(truthPath);
      throw new Error(
        "Truth appeared during migrate apply; refuse to overwrite — re-preview",
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
    await mkdir(resolve(projectPath, ".ohno"), { recursive: true });
    await writeFile(truthPath, planned.serialized, "utf8");
    return;
  }
  // update: never create from this branch
  try {
    await access(truthPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        "Truth disappeared during migrate apply; refuse create-via-update — re-preview",
      );
    }
    throw error;
  }
  await writeFile(truthPath, planned.serialized, "utf8");
}

/**
 * Two-phase migration schema 2 → 3:
 * - Without --diff/--head: zero-write preview of full side-effect exact diff.
 * - With --diff/--head: re-validate, write Truth only if planned, CAS state.
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

  await writePlannedTruth(projectPath, plan.plannedTruth);

  const liveInventory = inventoryWithProjectedAgents(
    await classifyWithTruthDocument(projectPath, plan.plannedTruth.after),
  );
  const next = plan.buildAppliedState(new Date().toISOString(), plan.diffDigest);
  if (liveInventory.inventory_digest !== next.truth_inventory.inventory_digest) {
    throw new Error(
      "migrate apply refused: inventory digest drifted during apply — re-preview",
    );
  }

  if (!await compareAndSwapStateAtomic(projectPath, plan.expectedState, next)) {
    throw new Error("state changed during acceptance basis migration apply");
  }

  return formatApplied(plan, next);
}
