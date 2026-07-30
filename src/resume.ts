import type { ReadModel } from "./read-model.js";

function oneLine(value: string): string {
  return value.replaceAll(/\r?\n/g, " ");
}

function completedLine(model: ReadModel): string {
  if (model.completed.length === 0) {
    return "NONE";
  }
  return model.completed
    .map((entry) =>
      `${oneLine(entry.id)}: ${oneLine(entry.expected_behavior)}`
    )
    .join(" | ");
}

export function serializeResume(model: ReadModel): string {
  const task = model.current_task;
  return [
    `AVAILABILITY: ${model.availability}`,
    `GOAL: ${oneLine(model.goal ?? "NONE")}`,
    `STATUS: ${model.status}`,
    `COMPLETED: ${model.completed_count}`,
    `COMPLETED_RECENT: ${completedLine(model)}`,
    `TASK: ${oneLine(task?.id ?? "NONE")}`,
    `EXPECTED: ${oneLine(task?.expected_behavior ?? "NONE")}`,
    `TEST: ${oneLine(task?.test_command ?? "NONE")}`,
    `PROOF: ${model.proof_freshness}`,
    `BLOCKER: ${model.blocker}`,
    `NEXT: ${oneLine(model.next_action)}`,
    "",
  ].join("\n");
}
