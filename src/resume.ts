import type { ReadModel } from "./read-model.js";
import {
  formatSiblingWorktreesNote,
  listSiblingOhnoWorktrees,
} from "./worktree-authority.js";

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

function honestyLines(model: ReadModel): string[] {
  const lines: string[] = [];
  if (model.next_action === "PROJECT_COMPLETE") {
    lines.push(
      "PLAN_COMPLETE_NOTE: linear plan cursor finished "
        + `(${model.cursor}/${model.task_count}) — not product-finished; `
        + "propose next phase with ohno plan propose",
    );
  }
  if (model.next_action.startsWith("CONTINUE_ACTIVE:")) {
    lines.push(
      "ACTIVE_NOTE: next means continue this task then ohno verify "
        + "(not permission to start another task)",
    );
  }
  if (model.next_action.startsWith("RUN_EXACT_TEST:")) {
    lines.push(
      "PROOF_NOTE: re-run ohno verify for the active contract "
        + "(FAIL/UNKNOWN/STALE proof)",
    );
  }
  if (model.next_action.startsWith("REOPEN_TASK:")) {
    lines.push(
      "STALE_NOTE: last closed task proof is STALE — "
        + "ohno task reopen then fix then ohno verify",
    );
  }
  if (
    model.blocker === "STALE_PASS"
    && model.current_task === null
    && model.completed_count > 0
  ) {
    lines.push(
      "RECOVERY: STALE after close — ohno task reopen then fix then ohno verify",
    );
  }
  if (model.goal === null) {
    lines.push(
      "GOAL_NOTE: project Owner goal is empty; "
        + "new projects require ohno init --goal (A01)",
    );
  }
  if (model.next_action === "MIGRATE_ACCEPTANCE_BASIS") {
    lines.push(
      "MIGRATE_NOTE: schema predates structured acceptance basis — "
        + "preview with ohno migrate acceptance-basis --file <basis.json>, "
        + "then apply with returned --diff and --head "
        + "(cursor/completed preserved)",
    );
  }
  return lines;
}

export function serializeResume(model: ReadModel): string {
  const task = model.current_task;
  const planProgress = model.task_count > 0
    ? `${model.cursor}/${model.task_count} plan-tasks `
      + `(${Math.round((model.cursor / model.task_count) * 100)}% of THIS plan)`
    : "0/0 (no reviewed plan)";
  return [
    `AVAILABILITY: ${model.availability}`,
    `GOAL: ${model.goal ?? "NONE"}`,
    `STATUS: ${model.status}`,
    `PLAN: ${model.plan_revision ?? "NONE"}`,
    `CURSOR: ${model.cursor}/${model.task_count}`,
    `PLAN_PROGRESS: ${planProgress}`,
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
    `TRUTH_PATHS: ${formatTruthPaths(model.truth_targets)}`,
    `HANDOFF_PATH: ${model.handoff.path}`,
    `HANDOFF_BRANCH: ${model.handoff.branch ?? "NONE"}`,
    `HANDOFF_HEAD: ${model.handoff.head ?? "NONE"}`,
    `HANDOFF_DIRTY: ${model.handoff.dirty ? "YES" : "NO"}`,
    `AUTHORITY_NOTE: resume/cockpit read only this cwd's .ohno/state.json `
      + "(other git worktrees may have a different board — FT-13)",
    ...honestyLines(model),
    `NEXT: ${model.next_action}`,
    "",
  ].join("\n");
}

/** Keep TRUTH_PATHS from blowing the 4 KiB resume capsule budget. */
function formatTruthPaths(paths: string[]): string {
  if (paths.length === 0) {
    return "NONE";
  }
  const budget = 900;
  const joined = paths.join(" | ");
  if (Buffer.byteLength(joined, "utf8") <= budget) {
    return joined;
  }
  const kept: string[] = [];
  let used = 0;
  for (const path of paths) {
    const extra = Buffer.byteLength(path, "utf8") + (kept.length > 0 ? 3 : 0);
    if (used + extra > budget - 24) {
      break;
    }
    kept.push(path);
    used += extra;
  }
  const omitted = paths.length - kept.length;
  return `${kept.join(" | ")} | …(+${omitted} more)`;
}

/** Async resume with sibling worktree discovery (FT-13). */
export async function serializeResumeWithWorktrees(
  model: ReadModel,
  projectPath: string,
): Promise<string> {
  const base = serializeResume(model).replace(/\n$/u, "");
  try {
    const siblings = await listSiblingOhnoWorktrees(projectPath);
    const note = formatSiblingWorktreesNote(siblings);
    if (note !== null) {
      return `${base}\n${note}\n`;
    }
  } catch {
    // ignore git/worktree probe failures
  }
  return `${base}\n`;
}
