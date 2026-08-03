import {
  needsAcceptanceBasisMigration,
  type ProjectState,
} from "./state.js";

export function nextActionFromPlan(state: ProjectState): string {
  if (needsAcceptanceBasisMigration(state)) {
    return "MIGRATE_ACCEPTANCE_BASIS";
  }
  if (state.document_sync.status === "PENDING_REVIEW") {
    return "SYNC_GOVERNING_DOCUMENTS";
  }
  // ACTIVE work is not "no next action". NONE was a protocol gap that read
  // like completion or idle; it must not license the next plan task.
  if (state.active_task !== null) {
    return `CONTINUE_ACTIVE:${state.active_task.id}`;
  }
  if (state.plan_revision === null) {
    return state.pending_plan === null
      ? "PROPOSE_PLAN"
      : `REVIEW_PLAN:${state.pending_plan.plan_revision}`;
  }
  // Cursor past proven work is not completion — repair toward completed frontier.
  if (state.cursor > state.completed.length) {
    const repair = state.ordered_tasks[state.completed.length];
    if (repair === undefined) {
      return "PROPOSE_PLAN";
    }
    return repair.status === "OUTLINE"
      ? `FREEZE_TASK:${repair.id}`
      : `START_TASK:${repair.id}`;
  }
  const current = state.ordered_tasks[state.cursor];
  if (current === undefined) {
    // PROJECT_COMPLETE only when every ordered task has a PASS receipt.
    if (state.completed.length >= state.ordered_tasks.length) {
      return "PROJECT_COMPLETE";
    }
    return "PROPOSE_PLAN";
  }
  return current.status === "OUTLINE"
    ? `FREEZE_TASK:${current.id}`
    : `START_TASK:${current.id}`;
}
