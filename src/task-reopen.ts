import {
  compareAndSwapStateAtomic,
  contractDigestFor,
  readState,
  type ProjectState,
  type TaskContract,
} from "./state.js";

export interface ReopenResult {
  task_id: string;
  test_command: string;
  message: string;
}

/**
 * Re-open the most recently completed task for patch + re-verify (FT-24).
 * Rolls the cursor back to that task and drops it from completed so the
 * normal verify PASS path can advance again. Avoids inventing a micro-plan.
 */
export async function reopenLastCompletedTask(
  projectPath: string,
): Promise<ReopenResult> {
  const state = await readState(projectPath);
  if (state.document_sync.status === "PENDING_REVIEW") {
    throw new Error("document sync is pending review; finish ohno change first");
  }
  if (state.active_task !== null) {
    throw new Error(
      `task ${state.active_task.id} is already ACTIVE; finish verify before reopen`,
    );
  }
  if (state.completed.length === 0) {
    throw new Error("no completed task to reopen");
  }
  const last = state.completed[state.completed.length - 1]!;
  if (
    state.plan_revision !== null
    && last.plan_revision !== state.plan_revision
  ) {
    throw new Error(
      "last completed task belongs to a different plan_revision; propose a new plan",
    );
  }

  const planIndex = state.ordered_tasks.findIndex((task) => task.id === last.id);
  if (planIndex < 0) {
    throw new Error(
      `completed task ${last.id} is not in ordered_tasks; propose a new plan`,
    );
  }
  const fromPlan = state.ordered_tasks[planIndex]!;
  if (fromPlan.status !== "FROZEN") {
    throw new Error(
      `task ${last.id} is not FROZEN in the plan; freeze it before reopen`,
    );
  }

  const unsigned = {
    id: fromPlan.id,
    expected_behavior: fromPlan.expected_behavior,
    test_command: fromPlan.test_command,
    stop_condition: fromPlan.stop_condition,
    allowed_files: fromPlan.allowed_files,
    time_budget_minutes: fromPlan.time_budget_minutes,
    plan_revision: state.plan_revision ?? last.plan_revision,
  };
  const contract: TaskContract = {
    ...unsigned,
    contract_digest: contractDigestFor(unsigned),
  };

  const nextState: ProjectState = {
    ...state,
    status: "ACTIVE",
    cursor: planIndex,
    active_task: contract,
    completed: state.completed.slice(0, -1),
    // Keep last_verification so proof may show STALE until re-verify.
  };

  const swapped = await compareAndSwapStateAtomic(projectPath, state, nextState);
  if (!swapped) {
    throw new Error("state changed during reopen; retry ohno task reopen");
  }

  return {
    task_id: contract.id,
    test_command: contract.test_command,
    message:
      `REOPENED: ${contract.id} is ACTIVE at cursor ${planIndex}/`
      + `${state.ordered_tasks.length}. Fix allowed_files, then ohno verify. `
      + `Removed from completed until a fresh PASS.`,
  };
}
