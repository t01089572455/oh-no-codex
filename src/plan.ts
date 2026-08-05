import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

import {
  assertFrozenTasksMatchBasis,
  loadStructuredAcceptanceBasis,
  sha256Text,
} from "./acceptance-basis.js";
import {
  assertPlanDiscipline,
  planSoftWarnings,
} from "./discipline.js";
import { assertSafeProjectRelativePath } from "./paths.js";
import { readGitHead } from "./subject-digest.js";
import { provenPrefixForPlan } from "./plan-proof.js";
import {
  compareAndSwapStateAtomic,
  needsAcceptanceBasisMigration,
  planRevisionFor,
  readState,
} from "./state.js";
import type {
  AcceptanceBasis,
  FrozenPlanTask,
  PendingPlan,
  PlanTask,
  ProjectState,
} from "./state.js";
import {
  assertPlanTaskCount,
  normalizeAuthorTask,
} from "./task-normalize.js";

export const DEFAULT_ACCEPTANCE_BASIS_PATH = ".ohno/acceptance-basis.json";

export interface PlanProposalFile {
  cursor: number;
  ordered_tasks: PlanTask[];
  /**
   * Project-relative path to structured acceptance basis JSON (Truth target).
   * Omitted in authoring → harness materializes DEFAULT_ACCEPTANCE_BASIS_PATH.
   */
  acceptance_source: string;
}
export interface PlanProposalEvidence {
  planRevision: string;
  diffDigest: string;
  head: string;
  proposedAt: string;
  exactDiff: string;
  acceptanceSourcePath: string;
  acceptanceSourceDigest: string;
  warnings: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeSourcePath(projectPath: string, input: string): {
  relativePath: string;
  absolutePath: string;
} {
  const absolutePath = resolve(projectPath, input);
  const relativePath = relative(projectPath, absolutePath).replaceAll("\\", "/");
  if (
    relativePath === ""
    || relativePath.startsWith("../")
    || relativePath === ".."
    || /^[A-Za-z]:/u.test(relativePath)
  ) {
    throw new Error("--file must name one project-relative plan proposal");
  }
  return {
    relativePath,
    absolutePath,
  };
}

/** Parse a plan proposal file body (same rules as plan propose/accept). */
export function parsePlan(
  bytes: string,
  options: { allowLongPlan?: boolean } = {},
): PlanProposalFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes);
  } catch {
    throw new Error("plan proposal file must be valid JSON");
  }
  if (
    !isRecord(parsed)
    || !Number.isSafeInteger(parsed.cursor)
    || (parsed.cursor as number) < 0
    || !Array.isArray(parsed.ordered_tasks)
    || parsed.ordered_tasks.length === 0
  ) {
    throw new Error(
      "plan proposal must contain cursor and non-empty ordered_tasks",
    );
  }
  const keys = Object.keys(parsed);
  const allowed = new Set(["cursor", "ordered_tasks", "acceptance_source"]);
  if (
    !keys.includes("cursor")
    || !keys.includes("ordered_tasks")
    || !keys.every((key) => allowed.has(key))
  ) {
    throw new Error(
      "plan proposal must contain cursor and ordered_tasks "
        + "(acceptance_source optional; defaults to "
        + `${DEFAULT_ACCEPTANCE_BASIS_PATH})`,
    );
  }
  const acceptanceSource = parsed.acceptance_source === undefined
    ? DEFAULT_ACCEPTANCE_BASIS_PATH
    : assertSafeProjectRelativePath(
      parsed.acceptance_source,
      "acceptance_source",
    );
  const orderedTasks = parsed.ordered_tasks.map(normalizeAuthorTask);
  assertPlanTaskCount(orderedTasks.length, {
    allowLongPlan: options.allowLongPlan === true,
  });
  if ((parsed.cursor as number) > orderedTasks.length) {
    throw new Error("plan cursor cannot exceed ordered_tasks length");
  }
  const ids = orderedTasks.map(({ id }) => id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("duplicate stable task id in ordered_tasks");
  }
  return {
    cursor: parsed.cursor as number,
    ordered_tasks: orderedTasks,
    acceptance_source: acceptanceSource,
  };
}

function basisDocumentFromTasks(tasks: readonly PlanTask[]): {
  schema_version: 1;
  tasks: Array<{
    id: string;
    expected_behavior: string;
    test_command: string;
    stop_condition: string;
  }>;
} {
  const frozen = tasks.filter(
    (task): task is FrozenPlanTask => task.status === "FROZEN",
  );
  return {
    schema_version: 1,
    tasks: frozen.map((task) => ({
      id: task.id,
      expected_behavior: task.expected_behavior,
      test_command: task.test_command,
      stop_condition: task.stop_condition,
    })),
  };
}

/**
 * When the plan omits a hand-maintained basis, materialize it from FROZEN
 * expect/test/stop so agents do not double-author the same three strings.
 */
async function ensureAcceptanceBasisFile(
  projectPath: string,
  relativePath: string,
  tasks: readonly PlanTask[],
): Promise<void> {
  const absolute = resolve(projectPath, relativePath);
  const body = `${JSON.stringify(basisDocumentFromTasks(tasks), null, 2)}\n`;
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, body, "utf8");
}

/**
 * Cursor is only advanced by fresh PASS (verify) on *this* plan revision.
 * Plan propose/accept may restate cursor up to the proven prefix of the
 * proposal's own plan_revision — never reuse unrelated historical completions
 * (different revision / contract) to forge PROJECT_COMPLETE.
 */
export function assertPlanCursorHonest(
  cursor: number,
  provenPrefix: number,
  orderedTaskCount: number,
): void {
  if (cursor > orderedTaskCount) {
    throw new Error("plan cursor cannot exceed ordered_tasks length");
  }
  if (cursor > provenPrefix) {
    throw new Error(
      "plan cursor cannot exceed proven prefix of this plan revision "
        + `(cursor=${cursor}, proven_prefix=${provenPrefix}); `
        + "only ohno verify may advance past PASS receipts bound to this plan — "
        + "historical completions from other plans do not count",
    );
  }
}

/** Exact plan diff body used by propose/accept (and migrate pending rebind). */
export function exactPlanDiff(
  state: ProjectState,
  proposal: PlanProposalFile,
  planRevision: string,
  basis: AcceptanceBasis,
): string {
  const beforeBasis = state.plan_review !== null
    && "acceptance_source_path" in state.plan_review
    ? {
      path: state.plan_review.acceptance_source_path,
      digest: state.plan_review.acceptance_source_digest,
    }
    : null;
  return `${JSON.stringify({
    format: "ohno-linear-plan-diff-v3",
    before: {
      plan_revision: state.plan_revision,
      ordered_tasks: state.ordered_tasks,
      cursor: state.cursor,
      acceptance_basis: beforeBasis,
    },
    after: {
      plan_revision: planRevision,
      ordered_tasks: proposal.ordered_tasks,
      cursor: proposal.cursor,
      acceptance_basis: basis,
    },
  }, null, 2)}\n`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function isTruthTarget(state: ProjectState, path: string): boolean {
  return state.truth_inventory.classification.some(
    (entry) => entry.path === path && entry.truth_target === true,
  );
}

async function readSource(
  projectPath: string,
  sourcePath: string,
  options: { allowLongPlan?: boolean } = {},
): Promise<{
  sourcePath: string;
  sourceDigest: string;
  proposal: PlanProposalFile;
  authorOmittedAcceptanceSource: boolean;
}> {
  const path = safeSourcePath(projectPath, sourcePath);
  let bytes: string;
  try {
    bytes = await readFile(path.absolutePath, "utf8");
  } catch {
    throw new Error(`cannot read plan proposal ${path.relativePath}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes);
  } catch {
    throw new Error("plan proposal file must be valid JSON");
  }
  const authorOmittedAcceptanceSource = isRecord(parsed)
    && parsed.acceptance_source === undefined;
  return {
    sourcePath: path.relativePath,
    sourceDigest: sha256(bytes),
    proposal: parsePlan(bytes, options),
    authorOmittedAcceptanceSource,
  };
}

export async function proposePlan(
  projectPath: string,
  sourcePath: string,
  options: { allowLongPlan?: boolean } = {},
): Promise<PlanProposalEvidence> {
  const state = await readState(projectPath);
  if (needsAcceptanceBasisMigration(state)) {
    throw new Error(
      "ACCEPTANCE_BASIS_MIGRATE_REQUIRED: next is MIGRATE_ACCEPTANCE_BASIS; "
        + "run `ohno migrate acceptance-basis --file <structured-basis.json>` "
        + "before proposing a new plan",
    );
  }
  const source = await readSource(projectPath, sourcePath, options);
  if (source.authorOmittedAcceptanceSource
    || source.proposal.acceptance_source === DEFAULT_ACCEPTANCE_BASIS_PATH
  ) {
    // Materialize basis from frozen tasks when author uses the default path or
    // omits acceptance_source entirely (harness 0.2 less copy-paste tax).
    if (source.authorOmittedAcceptanceSource) {
      await ensureAcceptanceBasisFile(
        projectPath,
        source.proposal.acceptance_source,
        source.proposal.ordered_tasks,
      );
    }
  }
  if (!isTruthTarget(state, source.proposal.acceptance_source)) {
    throw new Error(
      "ACCEPTANCE_BASIS_NOT_IN_TRUTH: acceptance_source must be a Truth "
        + `target (truth_target=true): ${source.proposal.acceptance_source}`,
    );
  }

  // If basis file is missing but path is the default, write from tasks once.
  try {
    await loadStructuredAcceptanceBasis(
      projectPath,
      source.proposal.acceptance_source,
    );
  } catch {
    if (source.proposal.acceptance_source === DEFAULT_ACCEPTANCE_BASIS_PATH) {
      await ensureAcceptanceBasisFile(
        projectPath,
        source.proposal.acceptance_source,
        source.proposal.ordered_tasks,
      );
    } else {
      throw new Error(
        `cannot read acceptance_source ${source.proposal.acceptance_source}`,
      );
    }
  }

  const loaded = await loadStructuredAcceptanceBasis(
    projectPath,
    source.proposal.acceptance_source,
  );
  assertFrozenTasksMatchBasis(source.proposal.ordered_tasks, loaded.document);
  const basis: AcceptanceBasis = {
    path: loaded.path,
    digest: loaded.digest,
  };
  const planRevision = planRevisionFor(source.proposal.ordered_tasks, basis);
  assertPlanCursorHonest(
    source.proposal.cursor,
    provenPrefixForPlan(
      state.completed,
      source.proposal.ordered_tasks,
      planRevision,
    ),
    source.proposal.ordered_tasks.length,
  );
  const exactDiff = exactPlanDiff(
    state,
    source.proposal,
    planRevision,
    basis,
  );
  const diffDigest = sha256(exactDiff);
  const head = readGitHead(projectPath);
  const proposedAt = new Date().toISOString();
  const pendingPlan: PendingPlan = {
    plan_revision: planRevision,
    ordered_tasks: source.proposal.ordered_tasks,
    cursor: source.proposal.cursor,
    diff_digest: diffDigest,
    head,
    proposed_at: proposedAt,
    source_path: source.sourcePath,
    source_digest: source.sourceDigest,
    acceptance_source_path: basis.path,
    acceptance_source_digest: basis.digest,
  };
  const recorded = await compareAndSwapStateAtomic(projectPath, state, {
    ...state,
    schema_version: 3,
    pending_plan: pendingPlan,
  });
  if (!recorded) {
    throw new Error("current state changed while recording the plan proposal");
  }

  const warnings = planSoftWarnings(source.proposal.ordered_tasks, {
    skipDenominator: true,
  });

  return {
    planRevision,
    diffDigest,
    head,
    proposedAt,
    exactDiff,
    acceptanceSourcePath: basis.path,
    acceptanceSourceDigest: basis.digest,
    warnings,
  };
}

export async function acceptPlan(
  projectPath: string,
  revision: string,
  diffDigest: string,
  options: { allowWeakPlan?: boolean; allowLongPlan?: boolean } = {},
): Promise<string> {
  const state = await readState(projectPath);
  if (needsAcceptanceBasisMigration(state)) {
    throw new Error(
      "ACCEPTANCE_BASIS_MIGRATE_REQUIRED: next is MIGRATE_ACCEPTANCE_BASIS",
    );
  }
  const pending = state.pending_plan;
  if (pending === null) {
    throw new Error("no pending plan proposal to review");
  }
  if (!("acceptance_source_path" in pending)) {
    throw new Error(
      "ACCEPTANCE_BASIS_MIGRATE_REQUIRED: pending proposal predates structured "
        + "basis; migrate or re-propose under schema 3",
    );
  }
  if (
    revision !== pending.plan_revision
    || diffDigest !== pending.diff_digest
  ) {
    throw new Error("review must name the exact proposed revision and diff digest");
  }
  assertPlanCursorHonest(
    pending.cursor,
    provenPrefixForPlan(
      state.completed,
      pending.ordered_tasks,
      pending.plan_revision,
    ),
    pending.ordered_tasks.length,
  );
  const currentHead = readGitHead(projectPath);
  if (currentHead !== pending.head) {
    throw new Error(
      "proposal HEAD changed; record a new exact local plan review",
    );
  }
  const source = await readSource(projectPath, pending.source_path, {
    allowLongPlan: options.allowLongPlan === true,
  });
  if (source.sourceDigest !== pending.source_digest) {
    throw new Error(
      "plan proposal file changed; record a new exact local plan review",
    );
  }
  if (source.proposal.acceptance_source !== pending.acceptance_source_path) {
    throw new Error(
      "ACCEPTANCE_BASIS_DRIFT: acceptance_source path changed after propose",
    );
  }
  if (!isTruthTarget(state, pending.acceptance_source_path)) {
    throw new Error(
      "ACCEPTANCE_BASIS_NOT_IN_TRUTH: acceptance_source must remain a Truth target",
    );
  }

  const loaded = await loadStructuredAcceptanceBasis(
    projectPath,
    pending.acceptance_source_path,
  );
  if (loaded.digest !== pending.acceptance_source_digest) {
    throw new Error(
      "ACCEPTANCE_BASIS_DRIFT: acceptance_source content changed after propose; "
        + "record a new plan propose",
    );
  }
  assertFrozenTasksMatchBasis(source.proposal.ordered_tasks, loaded.document);

  const basis: AcceptanceBasis = {
    path: loaded.path,
    digest: loaded.digest,
  };
  const currentRevision = planRevisionFor(source.proposal.ordered_tasks, basis);
  const currentDiff = exactPlanDiff(
    state,
    source.proposal,
    currentRevision,
    basis,
  );
  if (
    currentRevision !== pending.plan_revision
    || sha256(currentDiff) !== pending.diff_digest
  ) {
    throw new Error(
      "plan proposal base or exact diff changed; record a new local review",
    );
  }

  assertPlanDiscipline(source.proposal.ordered_tasks, {
    allowWeakPlan: options.allowWeakPlan === true,
  });
  assertPlanTaskCount(source.proposal.ordered_tasks.length, {
    allowLongPlan: options.allowLongPlan === true,
  });

  const recordedAt = new Date().toISOString();
  const accepted = await compareAndSwapStateAtomic(projectPath, state, {
    ...state,
    schema_version: 3,
    status: state.document_sync.status === "PENDING_REVIEW"
      ? "BLOCKED_DOC_SYNC"
      : "IDLE",
    plan_revision: pending.plan_revision,
    ordered_tasks: pending.ordered_tasks,
    cursor: pending.cursor,
    plan_review: {
      status: "LOCAL_REVIEW_RECORDED",
      plan_revision: pending.plan_revision,
      diff_digest: pending.diff_digest,
      head: pending.head,
      proposed_at: pending.proposed_at,
      recorded_at: recordedAt,
      acceptance_source_path: pending.acceptance_source_path,
      acceptance_source_digest: pending.acceptance_source_digest,
    },
    pending_plan: null,
    active_task: null,
    last_verification: null,
  });
  if (!accepted) {
    throw new Error("current state changed while recording the local plan review");
  }
  const weakNote = options.allowWeakPlan
    ? "WEAK_PLAN_OVERRIDE: Owner passed --allow-weak-plan\n"
    : "";
  const longNote = options.allowLongPlan
    ? "LONG_PLAN_OVERRIDE: Owner passed --allow-long-plan\n"
    : "";
  return (
    `${weakNote}${longNote}LOCAL_REVIEW_RECORDED: ${pending.plan_revision}\n`
    + `ACCEPTANCE_SOURCE: ${pending.acceptance_source_path}\n`
    + `ACCEPTANCE_DIGEST: ${pending.acceptance_source_digest}\n`
  );
}

// Re-export for tests that may import sha256 of basis prose.
export { sha256Text };
