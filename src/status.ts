import type { ReadModel } from "./read-model.js";
import { serializeResume } from "./resume.js";

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
      "do: ohno init   # once per git repo",
      "    ohno install",
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

  let doLine = "ohno verify          # only claim done after this passes";
  if (model.next_action === "PROPOSE_PLAN") {
    doLine = "short plan (≤5): id+expect+test+scope → plan accept → task start";
  } else if (model.next_action.startsWith("START_TASK:")) {
    doLine = "ohno task start      # then work in scope, then ohno verify";
  } else if (model.next_action.startsWith("FREEZE_TASK:")) {
    doLine = "freeze outline with expect+test+scope, then task start + verify";
  } else if (model.next_action.startsWith("REOPEN_TASK:")) {
    doLine = "ohno task reopen     # then fix, then ohno verify";
  } else if (model.next_action === "PROJECT_COMPLETE") {
    doLine = "this linear plan is done (not whole product)";
  } else if (
    model.proof_freshness === "FAIL"
    || model.proof_freshness === "UNKNOWN"
    || model.proof_freshness === "STALE"
  ) {
    doLine =
      "REPAIR in scope (expect+test) → ohno verify — do not ask Owner to invent scope";
  }

  return [
    "Oh No harness — reins only (not a second product)",
    "",
    `status:  ${model.status}`,
    `task:    ${task}`,
    `proof:   ${model.proof_freshness}`,
    `blocker: ${model.blocker}`,
    `next:    ${model.next_action}`,
    `board:   ${model.cursor}/${model.task_count} of THIS plan`,
    "",
    "loop:  freeze short slice → work in scope → ohno verify → next",
    `do:    ${doLine}`,
    "",
    "daily: ohno | ohno next | ohno task start | ohno verify",
    "task:  id + expect + test + scope   (other fields default)",
    "more:  ohno --help",
    "",
  ].join("\n");
}
