import type { ReadModel } from "./read-model.js";

function completedLine(model: ReadModel): string {
  if (model.completed.length === 0) {
    return "NONE";
  }
  return model.completed
    .map((entry) => `${entry.id}: ${entry.expected_behavior}`)
    .join(" | ");
}

function boardLine(model: ReadModel): string {
  if (model.plan_board.length === 0) {
    return "NONE";
  }
  // Compact form keeps the resume capsule under 4 KiB on large plans.
  const compact = model.plan_board
    .map((entry) => `${entry.index}:${entry.id}:${entry.phase}`)
    .join(" | ");
  const byteLimit = 1_200;
  if (Buffer.byteLength(compact, "utf8") <= byteLimit) {
    return compact;
  }
  let result = "";
  for (const entry of model.plan_board) {
    const piece = `${entry.index}:${entry.id}:${entry.phase}`;
    const next = result.length === 0 ? piece : `${result} | ${piece}`;
    if (Buffer.byteLength(`${next} | …`, "utf8") > byteLimit) {
      return `${result} | …`;
    }
    result = next;
  }
  return result;
}

export function serializeResume(model: ReadModel): string {
  const task = model.current_task;
  return [
    `AVAILABILITY: ${model.availability}`,
    `GOAL: ${model.goal ?? "NONE"}`,
    `STATUS: ${model.status}`,
    `PLAN: ${model.plan_revision ?? "NONE"}`,
    `CURSOR: ${model.cursor}/${model.task_count}`,
    `BOARD: ${boardLine(model)}`,
    `COMPLETED: ${model.completed_count}`,
    `COMPLETED_RECENT: ${completedLine(model)}`,
    `TASK: ${task?.id ?? "NONE"}`,
    `EXPECTED: ${task?.expected_behavior ?? "NONE"}`,
    `TEST: ${task?.test_command ?? "NONE"}`,
    `PROOF: ${model.proof_freshness}`,
    `BLOCKER: ${model.blocker}`,
    `DOC_SYNC: ${model.document_sync_status}`,
    `TRUTH_TARGETS: ${model.truth_target_count}`,
    `TRUTH_PATHS: ${
      model.truth_targets.length === 0
        ? "NONE"
        : model.truth_targets.join(" | ")
    }`,
    `HANDOFF_PATH: ${model.handoff.path}`,
    `HANDOFF_BRANCH: ${model.handoff.branch ?? "NONE"}`,
    `HANDOFF_HEAD: ${model.handoff.head ?? "NONE"}`,
    `HANDOFF_DIRTY: ${model.handoff.dirty ? "YES" : "NO"}`,
    `NEXT: ${model.next_action}`,
    "",
  ].join("\n");
}
