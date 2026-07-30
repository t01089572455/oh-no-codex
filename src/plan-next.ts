import type { ProjectState } from "./state.js";

export function nextActionFromPlan(state: ProjectState): string {
  if (state.document_sync.status === "PENDING_REVIEW") {
    return "SYNC_GOVERNING_DOCUMENTS";
  }
  if (state.active_task !== null) {
    return "NONE";
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
