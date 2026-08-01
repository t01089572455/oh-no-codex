import type { ProjectState } from "./state.js";

export function nextActionFromPlan(state: ProjectState): string {
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
  const current = state.ordered_tasks[state.cursor];
  if (current === undefined) {
    return "PROJECT_COMPLETE";
  }
  return current.status === "OUTLINE"
    ? `FREEZE_TASK:${current.id}`
    : `START_TASK:${current.id}`;
}
