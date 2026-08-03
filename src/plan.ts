import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

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
import {
  compareAndSwapStateAtomic,
  isPlanTask,
  needsAcceptanceBasisMigration,
  planRevisionFor,
  readState,
} from "./state.js";
import type {
  AcceptanceBasis,
  PendingPlan,
  PlanTask,
  ProjectState,
} from "./state.js";

export interface PlanProposalFile {
  cursor: number;
  ordered_tasks: PlanTask[];
  /** Project-relative path to structured acceptance basis JSON (Truth target). */
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

function normalizeTask(value: unknown): PlanTask {
  if (!isRecord(value)) {
    throw new Error("every ordered task must be one object");
  }
  if (value.status === "OUTLINE") {
    if (
      Object.keys(value).length !== 4
      || value.id === undefined
      || value.title === undefined
      || value.goal === undefined
    ) {
      throw new Error(
        "OUTLINE tasks contain only stable task id, title, goal, and status",
      );
    }
    const task = {
      id: value.id,
      title: value.title,
      goal: value.goal,
      status: value.status,
    };
    if (!isPlanTask(task)) {
      throw new Error("invalid stable task id, title, or goal");
    }
    return task;
  }
  if (value.status === "FROZEN") {
    const frozenKeys = [
      "id",
      "title",
      "goal",
      "status",
      "expected_behavior",
      "test_command",
      "allowed_files",
      "stop_condition",
      "time_budget_minutes",
    ] as const;
    const actualKeys = Object.keys(value);
    const unknown = actualKeys.filter(
      (key) => !(frozenKeys as readonly string[]).includes(key),
    );
    if (unknown.length > 0) {
      throw new Error(
        `ACCEPTANCE_UNKNOWN_FIELD: FROZEN task has unsupported field(s): `
          + `${unknown.join(", ")} (silent drop forbidden)`,
      );
    }
    if (actualKeys.length !== frozenKeys.length) {
      throw new Error(
        "FROZEN cursor contract must bind behavior, test, files, stop, and budget",
      );
    }
    const task = {
      id: value.id,
      title: value.title,
      goal: value.goal,
      status: value.status,
      expected_behavior: value.expected_behavior,
      test_command: value.test_command,
      allowed_files: value.allowed_files,
      stop_condition: value.stop_condition,
      time_budget_minutes: value.time_budget_minutes,
    };
    if (!isPlanTask(task)) {
      throw new Error(
        "invalid FROZEN task; stable task id and bounded contract are required"
        + "; allowed_files must use bounded non-root globs or concrete paths",
      );
    }
    return task;
  }
  throw new Error("ordered task status must be FROZEN or OUTLINE");
}

/** Parse a plan proposal file body (same rules as plan propose/accept). */
export function parsePlan(bytes: string): PlanProposalFile {
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
    || !keys.includes("acceptance_source")
    || !keys.every((key) => allowed.has(key))
  ) {
    throw new Error(
      "ACCEPTANCE_BASIS_REQUIRED: plan proposal must contain cursor, "
        + "ordered_tasks, and acceptance_source (structured basis JSON path)",
    );
  }
  const acceptanceSource = assertSafeProjectRelativePath(
    parsed.acceptance_source,
    "acceptance_source",
  );
  const orderedTasks = parsed.ordered_tasks.map(normalizeTask);
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

/**
 * Cursor is only advanced by fresh PASS (verify). Plan propose/accept may
 * restate any cursor in `0..ordered_tasks.length`, except it must never jump
 * *ahead* of proven work (`cursor > completed.length`) — that forges board DONE
 * / PROJECT_COMPLETE without PASS. Rewinding below completed.length is allowed
 * (historical receipts remain; board DONE is receipt-based, not bare cursor).
 */
export function assertPlanCursorHonest(
  cursor: number,
  completedCount: number,
  orderedTaskCount: number,
): void {
  if (cursor > orderedTaskCount) {
    throw new Error("plan cursor cannot exceed ordered_tasks length");
  }
  if (cursor > completedCount) {
    throw new Error(
      "plan cursor cannot exceed completed task count "
        + `(cursor=${cursor}, completed=${completedCount}); `
        + "only ohno verify may advance past proven work — "
        + "accepting a higher cursor would forge DONE without PASS",
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
): Promise<{
  sourcePath: string;
  sourceDigest: string;
  proposal: PlanProposalFile;
}> {
  const path = safeSourcePath(projectPath, sourcePath);
  let bytes: string;
  try {
    bytes = await readFile(path.absolutePath, "utf8");
  } catch {
    throw new Error(`cannot read plan proposal ${path.relativePath}`);
  }
  return {
    sourcePath: path.relativePath,
    sourceDigest: sha256(bytes),
    proposal: parsePlan(bytes),
  };
}

export async function proposePlan(
  projectPath: string,
  sourcePath: string,
): Promise<PlanProposalEvidence> {
  const state = await readState(projectPath);
  if (needsAcceptanceBasisMigration(state)) {
    throw new Error(
      "ACCEPTANCE_BASIS_MIGRATE_REQUIRED: next is MIGRATE_ACCEPTANCE_BASIS; "
        + "run `ohno migrate acceptance-basis --file <structured-basis.json>` "
        + "before proposing a new plan",
    );
  }
  const source = await readSource(projectPath, sourcePath);
  if (!isTruthTarget(state, source.proposal.acceptance_source)) {
    throw new Error(
      "ACCEPTANCE_BASIS_NOT_IN_TRUTH: acceptance_source must be a Truth "
        + `target (truth_target=true): ${source.proposal.acceptance_source}`,
    );
  }

  assertPlanCursorHonest(
    source.proposal.cursor,
    state.completed.length,
    source.proposal.ordered_tasks.length,
  );

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
  options: { allowWeakPlan?: boolean } = {},
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
    state.completed.length,
    pending.ordered_tasks.length,
  );
  const currentHead = readGitHead(projectPath);
  if (currentHead !== pending.head) {
    throw new Error(
      "proposal HEAD changed; record a new exact local plan review",
    );
  }
  const source = await readSource(projectPath, pending.source_path);
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
  return (
    `${weakNote}LOCAL_REVIEW_RECORDED: ${pending.plan_revision}\n`
    + `ACCEPTANCE_SOURCE: ${pending.acceptance_source_path}\n`
    + `ACCEPTANCE_DIGEST: ${pending.acceptance_source_digest}\n`
  );
}

// Re-export for tests that may import sha256 of basis prose.
export { sha256Text };
