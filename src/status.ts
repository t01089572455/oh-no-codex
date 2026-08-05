import { effectiveHarness, formatPipelineNext } from "./harness.js";
import type { ReadModel } from "./read-model.js";
import { serializeResume } from "./resume.js";
import { readState } from "./state.js";

export function serializeStatus(
  model: ReadModel,
  json: boolean,
): string {
  return json
    ? `${JSON.stringify(model)}\n`
    : serializeResume(model);
}

/**
 * Human-first one-screen harness view (simple control mode).
 * Agents that need the full capsule still use `ohno resume` / `ohno status`.
 */
export function serializeHarnessBrief(model: ReadModel): string {
  if (model.availability === "UNAVAILABLE") {
    return [
      "Oh No harness",
      "",
      "status: UNAVAILABLE",
      "do: ohno setup   # once per git repo",
      "",
      "more: ohno --help",
      "",
    ].join("\n");
  }

  const task = model.current_task?.id
    ?? (model.next_action.startsWith("START_TASK:")
      ? model.next_action.slice("START_TASK:".length)
      : model.next_action.startsWith("FREEZE_TASK:")
      ? model.next_action.slice("FREEZE_TASK:".length)
      : "—");

  return [
    "Oh No harness — Truth-bound",
    "",
    `status:  ${model.status}`,
    `task:    ${task}`,
    `proof:   ${model.proof_freshness}`,
    `blocker: ${model.blocker}`,
    `next:    ${model.next_action}`,
    `board:   ${model.cursor}/${model.task_count} of THIS plan`,
    "",
    "owner: ohno setup | ohno | ohno pipeline",
    "agent: ohno pipeline   # exact next commands",
    "",
  ].join("\n");
}

/** Async brief with live phase pipeline (preferred for bare `ohno`). */
export async function serializeHarnessBriefAsync(
  projectPath: string,
  model: ReadModel,
): Promise<string> {
  const head = serializeHarnessBrief(model);
  if (model.availability === "UNAVAILABLE") {
    return head;
  }
  try {
    const state = await readState(projectPath);
    const phase = effectiveHarness(state).phase;
    return (
      head
      + `phase: ${phase}\n`
      + "\n"
      + formatPipelineNext(state, model.next_action)
    );
  } catch {
    return head;
  }
}
