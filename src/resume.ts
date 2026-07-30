import type { ReadModel } from "./read-model.js";

function completedLine(model: ReadModel): string {
  if (model.completed.length === 0) {
    return "NONE";
  }
  return model.completed
    .map((entry) => `${entry.id}: ${entry.expected_behavior}`)
    .join(" | ");
}

export function serializeResume(model: ReadModel): string {
  const task = model.current_task;
  return [
    `AVAILABILITY: ${model.availability}`,
    `GOAL: ${model.goal ?? "NONE"}`,
    `STATUS: ${model.status}`,
    `COMPLETED: ${model.completed_count}`,
    `COMPLETED_RECENT: ${completedLine(model)}`,
    `TASK: ${task?.id ?? "NONE"}`,
    `EXPECTED: ${task?.expected_behavior ?? "NONE"}`,
    `TEST: ${task?.test_command ?? "NONE"}`,
    `PROOF: ${model.proof_freshness}`,
    `BLOCKER: ${model.blocker}`,
    `NEXT: ${model.next_action}`,
    "",
  ].join("\n");
}
