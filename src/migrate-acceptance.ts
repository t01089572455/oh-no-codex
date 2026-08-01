import { readGitHead } from "./subject-digest.js";
import {
  loadStructuredAcceptanceBasis,
  assertFrozenTasksMatchBasis,
} from "./acceptance-basis.js";
import {
  compareAndSwapStateAtomic,
  needsAcceptanceBasisMigration,
  planRevisionFor,
  readState,
} from "./state.js";
import type { ProjectState } from "./state.js";

function isTruthTarget(state: ProjectState, path: string): boolean {
  return state.truth_inventory.classification.some(
    (entry) => entry.path === path && entry.truth_target === true,
  );
}

/**
 * Explicit migration from schema 2 (pre–structured-basis) to schema 3.
 * Preserves goal, ordered_tasks, cursor, completed, truth_inventory.
 * Clears active_task, last_verification, and pending_plan (re-bind required).
 */
export async function migrateAcceptanceBasis(
  projectPath: string,
  acceptanceSourcePath: string,
): Promise<string> {
  const state = await readState(projectPath);
  if (!needsAcceptanceBasisMigration(state)) {
    throw new Error(
      "acceptance basis migration is not required "
        + `(schema_version=${state.schema_version})`,
    );
  }
  if (state.plan_revision === null || state.ordered_tasks.length === 0) {
    // Idle schema 2 with no plan: just bump schema.
    const bumped: ProjectState = {
      ...state,
      schema_version: 3,
      pending_plan: null,
      active_task: null,
      // keep last_verification/completed as-is for empty plans
    };
    if (!await compareAndSwapStateAtomic(projectPath, state, bumped)) {
      throw new Error("state changed during schema bump");
    }
    return "MIGRATED: schema_version=3 (no plan to re-bind)\n";
  }

  if (!isTruthTarget(state, acceptanceSourcePath)) {
    throw new Error(
      "ACCEPTANCE_BASIS_NOT_IN_TRUTH: acceptance_source must be listed as a "
        + `Truth target (truth_target=true): ${acceptanceSourcePath}`,
    );
  }

  const basis = await loadStructuredAcceptanceBasis(
    projectPath,
    acceptanceSourcePath,
  );
  assertFrozenTasksMatchBasis(state.ordered_tasks, basis.document);

  const planRevision = planRevisionFor(state.ordered_tasks, {
    path: basis.path,
    digest: basis.digest,
  });
  const now = new Date().toISOString();
  const head = readGitHead(projectPath);
  const previousReview = state.plan_review;

  const next: ProjectState = {
    ...state,
    schema_version: 3,
    plan_revision: planRevision,
    pending_plan: null,
    active_task: null,
    last_verification: null,
    status: state.document_sync.status === "PENDING_REVIEW"
      ? "BLOCKED_DOC_SYNC"
      : "IDLE",
    plan_review: {
      status: "LOCAL_REVIEW_RECORDED",
      plan_revision: planRevision,
      diff_digest: previousReview !== null
        && "diff_digest" in previousReview
        ? previousReview.diff_digest
        : planRevision,
      head: previousReview !== null && "head" in previousReview
        ? previousReview.head
        : head,
      proposed_at: previousReview !== null && "proposed_at" in previousReview
        ? previousReview.proposed_at
        : now,
      recorded_at: now,
      acceptance_source_path: basis.path,
      acceptance_source_digest: basis.digest,
    },
  };

  if (!await compareAndSwapStateAtomic(projectPath, state, next)) {
    throw new Error("state changed during acceptance basis migration");
  }

  return [
    "MIGRATED: schema_version=3",
    `ACCEPTANCE_SOURCE: ${basis.path}`,
    `ACCEPTANCE_DIGEST: ${basis.digest}`,
    `PLAN_REVISION: ${planRevision}`,
    `CURSOR: ${next.cursor}`,
    `COMPLETED: ${next.completed.length}`,
    "NOTE: active_task and last_verification cleared; re-run task start/verify",
    "",
  ].join("\n");
}
