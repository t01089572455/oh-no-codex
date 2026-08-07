import { effectiveHarness } from "./harness.js";
import { formatOwnerPromptRailsStamp } from "./prompt-rails.js";
import type { ReadModel } from "./read-model.js";
import { readState } from "./state.js";
import {
  formatSiblingWorktreesNote,
  listSiblingOhnoWorktrees,
} from "./worktree-authority.js";

/** A07 / P04: resume capsule hard budget (UTF-8 bytes). */
export const RESUME_CAPSULE_BYTE_LIMIT = 4096;

function completedLine(model: ReadModel): string {
  if (model.completed.length === 0) {
    return "NONE";
  }
  return model.completed
    .map((entry) => `${entry.id}: ${entry.expected_behavior}`)
    .join(" | ");
}

function boardLine(model: ReadModel, byteLimit: number): string {
  if (model.plan_board.length === 0) {
    return "NONE";
  }
  const compact = model.plan_board
    .map((entry) => `${entry.index}:${entry.id}:${entry.phase}`)
    .join(" | ");
  if (Buffer.byteLength(compact, "utf8") <= byteLimit) {
    return compact;
  }
  let result = "";
  for (const entry of model.plan_board) {
    const piece = `${entry.index}:${entry.id}:${entry.phase}`;
    const next = result.length === 0 ? piece : `${result} | ${piece}`;
    if (Buffer.byteLength(`${next} | …`, "utf8") > byteLimit) {
      return result.length === 0 ? "…" : `${result} | …`;
    }
    result = next;
  }
  return result;
}

function honestyLines(model: ReadModel): string[] {
  const lines: string[] = [];
  lines.push(
    "PROOF: only `ohno verify` closes a task — Gate/skill/self-review is not proof",
  );
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
    lines.push(
      "RECOVERY: do not stop to ask the Owner — re-open Truth paths "
        + "(playbook/matrix when listed), re-read the frozen contract, "
        + "adjust inside allowed_files, then ohno verify",
    );
  }
  if (
    model.next_action.startsWith("CONTINUE_ACTIVE:")
    && (model.proof_freshness === "FAIL"
      || model.proof_freshness === "UNKNOWN"
      || model.proof_freshness === "STALE")
  ) {
    lines.push(
      "RECOVERY: stuck under accepted plan — re-bind Truth docs + contract, "
        + "do not hand off to Owner chat",
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
      "GOAL_NOTE: no project-level slogan; use plan task goals, "
        + "OWNER-INPUTS, and requirements notes for Owner intent",
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

/** Keep TRUTH_PATHS from dominating the capsule. */
function formatTruthPaths(paths: string[], budget: number): string {
  if (paths.length === 0) {
    return "NONE";
  }
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
  if (kept.length === 0) {
    return `…(+${paths.length} paths)`;
  }
  return `${kept.join(" | ")} | …(+${omitted} more)`;
}

function utf8Bytes(text: string): number {
  return Buffer.byteLength(text, "utf8");
}

/**
 * Hard-cap any resume text to RESUME_CAPSULE_BYTE_LIMIT, keeping the trailing
 * NEXT line when present.
 */
export function clampResumeCapsule(
  text: string,
  limit = RESUME_CAPSULE_BYTE_LIMIT,
): string {
  const normalized = text.endsWith("\n") ? text : `${text}\n`;
  if (utf8Bytes(normalized) <= limit) {
    return normalized;
  }
  const marker = "CAPSULE_TRUNCATED: true\n";
  const nextMatch = /\nNEXT: [^\n]*\n/u.exec(normalized);
  const nextLine = nextMatch?.[0] ?? "\nNEXT: NONE\n";
  const headBudget = limit - utf8Bytes(marker) - utf8Bytes(nextLine);
  if (headBudget < 64) {
    // Extreme: keep only NEXT.
    const tiny = `CAPSULE_TRUNCATED: true${nextLine}`;
    if (utf8Bytes(tiny) <= limit) {
      return tiny;
    }
    return "CAPSULE_TRUNCATED: true\nNEXT: NONE\n";
  }
  const withoutNext = nextMatch === null
    ? normalized
    : normalized.slice(0, nextMatch.index);
  let end = withoutNext.length;
  while (end > 0 && utf8Bytes(withoutNext.slice(0, end)) > headBudget) {
    end -= 64;
  }
  if (end < 0) {
    end = 0;
  }
  // Avoid cutting mid-codepoint: walk back to a newline when possible.
  const slice = withoutNext.slice(0, end);
  const lastNl = slice.lastIndexOf("\n");
  const head = lastNl > 32 ? slice.slice(0, lastNl + 1) : slice;
  return `${head}${marker.replace(/\n$/u, "")}${nextLine}`;
}

export function serializeResume(model: ReadModel): string {
  const task = model.current_task;
  const planProgress = model.task_count > 0
    ? `${model.cursor}/${model.task_count} plan-tasks `
      + `(${Math.round((model.cursor / model.task_count) * 100)}% of THIS plan)`
    : "0/0 (no reviewed plan)";

  // Core fields first; optional density reduced until under hard limit.
  let boardBudget = 1_200;
  let truthBudget = 900;
  let includeHonesty = true;
  let includeCompletedDetail = true;
  let includeTruthPaths = true;

  const build = (): string => {
    const lines = [
      `AVAILABILITY: ${model.availability}`,
      `GOAL: ${model.goal ?? "NONE"}`,
      `STATUS: ${model.status}`,
      `PLAN: ${model.plan_revision ?? "NONE"}`,
      `CURSOR: ${model.cursor}/${model.task_count}`,
      `PLAN_PROGRESS: ${planProgress}`,
      `BOARD: ${boardLine(model, boardBudget)}`,
      `COMPLETED: ${model.completed_count}`,
      `COMPLETED_RECENT: ${
        includeCompletedDetail ? completedLine(model) : "…"
      }`,
      `TASK: ${task?.id ?? "NONE"}`,
      `EXPECTED: ${task?.expected_behavior ?? "NONE"}`,
      `TEST: ${task?.test_command ?? "NONE"}`,
      `PROOF: ${model.proof_freshness}`,
      `BLOCKER: ${model.blocker}`,
      `DOC_SYNC: ${model.document_sync_status}`,
      `TRUTH_TARGETS: ${model.truth_target_count}`,
      `TRUTH_PATHS: ${
        includeTruthPaths
          ? formatTruthPaths(model.truth_targets, truthBudget)
          : "…"
      }`,
      `HANDOFF_PATH: ${model.handoff.path}`,
      `HANDOFF_BRANCH: ${model.handoff.branch ?? "NONE"}`,
      `HANDOFF_HEAD: ${model.handoff.head ?? "NONE"}`,
      `HANDOFF_TREE: ${model.handoff.tree ?? "NONE"}`,
      `HANDOFF_DIRTY: ${model.handoff.dirty ? "YES" : "NO"}`,
      `AUTHORITY_NOTE: resume/cockpit read only this cwd's .ohno/state.json `
        + "(other git worktrees may have a different board — FT-13)",
    ];
    if (includeHonesty) {
      lines.push(...honestyLines(model));
    }
    lines.push(`NEXT: ${model.next_action}`, "");
    return lines.join("\n");
  };

  let text = build();
  if (utf8Bytes(text) > RESUME_CAPSULE_BYTE_LIMIT) {
    truthBudget = 200;
    boardBudget = 400;
    includeTruthPaths = true;
    text = build();
  }
  if (utf8Bytes(text) > RESUME_CAPSULE_BYTE_LIMIT) {
    includeCompletedDetail = false;
    includeHonesty = false;
    truthBudget = 80;
    boardBudget = 200;
    text = build();
  }
  if (utf8Bytes(text) > RESUME_CAPSULE_BYTE_LIMIT) {
    includeTruthPaths = false;
    boardBudget = 80;
    text = build();
  }
  return clampResumeCapsule(text);
}

/** Async resume with sibling worktree discovery (FT-13), still ≤ 4 KiB. */
export async function serializeResumeWithWorktrees(
  model: ReadModel,
  projectPath: string,
): Promise<string> {
  const base = serializeResume(model).replace(/\n$/u, "");
  const extras: string[] = [];
  try {
    const state = await readState(projectPath);
    const phase = effectiveHarness(state).phase;
    extras.push(`HARNESS_PHASE: ${phase} | agent: ohno pipeline`);
    // Prompt-only branch: stamp points at full OHNO_PROMPT_RAILS on Stop/Owner turns.
    extras.push(formatOwnerPromptRailsStamp());
  } catch {
    // state unreadable — omit phase line
  }
  try {
    const siblings = await listSiblingOhnoWorktrees(projectPath);
    const note = formatSiblingWorktreesNote(siblings);
    if (note !== null) {
      extras.push(note.replace(/\n$/u, ""));
    }
  } catch {
    // ignore git/worktree probe failures
  }
  if (extras.length === 0) {
    return clampResumeCapsule(`${base}\n`);
  }
  return clampResumeCapsule(`${base}\n${extras.join("\n")}\n`);
}
