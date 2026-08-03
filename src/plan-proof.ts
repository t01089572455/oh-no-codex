import type { PlanTask, TaskContract } from "./state.js";

/**
 * A PASS receipt authorizes only the same plan revision and frozen contract
 * fields — never a different plan that merely shares a task id or a length.
 */
export function receiptMatchesFrozenTask(
  receipt: TaskContract,
  task: PlanTask,
  planRevision: string,
): boolean {
  if (task.status !== "FROZEN") {
    return false;
  }
  return receipt.id === task.id
    && receipt.plan_revision === planRevision
    && receipt.expected_behavior === task.expected_behavior
    && receipt.test_command === task.test_command
    && receipt.stop_condition === task.stop_condition;
}

/**
 * Longest proven prefix of the *current* plan: consecutive FROZEN tasks that
 * each have a PASS receipt bound to this plan_revision and contract.
 * OUTLINE stops the prefix (cannot be proven done).
 */
export function provenPrefixForPlan(
  completed: readonly TaskContract[],
  orderedTasks: readonly PlanTask[],
  planRevision: string | null,
): number {
  if (planRevision === null || orderedTasks.length === 0) {
    return 0;
  }
  let proven = 0;
  for (const task of orderedTasks) {
    if (task.status !== "FROZEN") {
      break;
    }
    const matched = completed.some((receipt) =>
      receiptMatchesFrozenTask(receipt, task, planRevision)
    );
    if (!matched) {
      break;
    }
    proven += 1;
  }
  return proven;
}
