import {
  assertFrozenTasksMatchBasis,
  loadStructuredAcceptanceBasis,
} from "./acceptance-basis.js";
import { assertMigrationNotRequired } from "./migration-guard.js";
import {
  compareAndSwapStateAtomic,
  contractDigestFor,
  readState,
} from "./state.js";
import type {
  ProjectState,
  TaskContract,
} from "./state.js";

export async function startTask(
  projectPath: string,
  args: string[],
): Promise<TaskContract> {
  if (args.length !== 0) {
    throw new Error(
      "ohno task start takes no arguments; caller overrides cannot replace "
      + "the frozen plan contract",
    );
  }
  const state = await readState(projectPath);
  assertMigrationNotRequired(state);
  if (state.active_task !== null) {
    throw new Error(`active task ${state.active_task.id} already exists`);
  }
  if (state.document_sync.status === "PENDING_REVIEW") {
    throw new Error(
      "document sync is pending; next action is SYNC_GOVERNING_DOCUMENTS",
    );
  }
  if (state.plan_revision === null || state.plan_review === null) {
    throw new Error("no locally reviewed plan; next action is PROPOSE_PLAN");
  }
  if (
    !("acceptance_source_path" in state.plan_review)
  ) {
    throw new Error(
      "plan review lacks acceptance basis; next is MIGRATE_ACCEPTANCE_BASIS",
    );
  }
  // Re-read structured basis: post-review edits must not silently drift the
  // acceptance denominator away from the frozen plan (change-path hole).
  const loaded = await loadStructuredAcceptanceBasis(
    projectPath,
    state.plan_review.acceptance_source_path,
  );
  if (loaded.digest !== state.plan_review.acceptance_source_digest) {
    throw new Error(
      "ACCEPTANCE_BASIS_STALE: acceptance_source changed after plan review; "
        + "re-run plan propose/accept (or change + replacement plan) before "
        + "task start",
    );
  }
  assertFrozenTasksMatchBasis(state.ordered_tasks, loaded.document);

  const task = state.ordered_tasks[state.cursor];
  if (task === undefined) {
    throw new Error("linear plan is complete; next action is PROJECT_COMPLETE");
  }
  if (task.status === "OUTLINE") {
    throw new Error(
      `current task is OUTLINE; next action is FREEZE_TASK:${task.id}`,
    );
  }

  const unsigned = {
    id: task.id,
    expected_behavior: task.expected_behavior,
    test_command: task.test_command,
    stop_condition: task.stop_condition,
    allowed_files: task.allowed_files,
    time_budget_minutes: task.time_budget_minutes,
    plan_revision: state.plan_revision,
  };
  const contract: TaskContract = {
    ...unsigned,
    contract_digest: contractDigestFor(unsigned),
  };
  const nextState: ProjectState = {
    ...state,
    status: "ACTIVE",
    active_task: contract,
  };
  if (!await compareAndSwapStateAtomic(projectPath, state, nextState)) {
    throw new Error("current state changed while starting the frozen task");
  }
  return contract;
}
