import {
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";

import { renderControlProtocolMarkdown } from "./control-protocol.js";
import {
  ensurePreferences,
  renderWorkingMethodMarkdown,
  type PreferencesFile,
} from "./preferences.js";
import {
  type PlanBoardEntry,
  type ReadModel,
  readModel,
} from "./read-model.js";
import { refreshRequirementsProjection } from "./requirements.js";

export const agentsBeginMarker = "<!-- ohno:managed-begin -->";
export const agentsEndMarker = "<!-- ohno:managed-end -->";
export const progressBeginMarker = "<!-- ohno:generated-progress-v1 -->";

function phaseCounts(board: PlanBoardEntry[]): Record<string, number> {
  const counts: Record<string, number> = {
    DONE: 0,
    ACTIVE: 0,
    HALF: 0,
    READY: 0,
    QUEUED: 0,
    OUTLINE: 0,
  };
  for (const entry of board) {
    counts[entry.phase] = (counts[entry.phase] ?? 0) + 1;
  }
  return counts;
}

function boardMarkdown(board: PlanBoardEntry[]): string {
  if (board.length === 0) {
    return "_No reviewed plan yet. Next: `PROPOSE_PLAN`._\n";
  }
  const lines = [
    "| # | ID | Title | Phase | Kind |",
    "| ---: | --- | --- | --- | --- |",
  ];
  for (const entry of board) {
    const title = entry.title.replaceAll("|", "\\|");
    lines.push(
      `| ${entry.index} | \`${entry.id}\` | ${title} | **${entry.phase}** | ${entry.kind} |`,
    );
  }
  return `${lines.join("\n")}\n`;
}

export function renderProgressMarkdown(model: ReadModel): string {
  const counts = phaseCounts(model.plan_board);
  return [
    "# Oh No, Codex! Progress",
    "",
    progressBeginMarker,
    "",
    "> Generated projection of `.ohno/state.json`. Not a second authority.",
    "> Regenerate: `ohno projectors refresh`",
    "",
    `- Goal: ${model.goal ?? "NONE"}`,
    `- Availability: ${model.availability}`,
    `- Status: ${model.status}`,
    `- Plan revision: ${model.plan_revision ?? "NONE"}`,
    `- Cursor: ${model.cursor} / ${model.task_count}`,
    `- Plan progress: ${
      model.task_count > 0
        ? `${model.cursor}/${model.task_count} of THIS linear plan `
          + `(not product completion)`
        : "no reviewed plan"
    }`,
    `- Proof: ${model.proof_freshness}`,
    `- Blocker: ${model.blocker}`,
    `- Document sync: ${model.document_sync_status}`,
    `- Truth targets: ${model.truth_target_count}`,
    `- Authority cwd: \`${model.handoff.path}\``,
    `- Next: \`${model.next_action}\`${
      model.next_action === "PROJECT_COMPLETE"
        ? " — this plan only; propose next phase with `ohno plan propose`"
        : ""
    }`,
    "",
    "## Phase counts",
    "",
    `- DONE: ${counts.DONE}`,
    `- ACTIVE: ${counts.ACTIVE}`,
    `- HALF (in progress with failed/unknown/stale proof): ${counts.HALF}`,
    `- READY: ${counts.READY}`,
    `- QUEUED: ${counts.QUEUED}`,
    `- OUTLINE: ${counts.OUTLINE}`,
    "",
    "## Plan board",
    "",
    boardMarkdown(model.plan_board),
    model.current_task
      ? [
        "## Current task",
        "",
        `- ID: \`${model.current_task.id}\``,
        `- Expected: ${model.current_task.expected_behavior}`,
        `- Test: \`${model.current_task.test_command}\``,
        "",
      ].join("\n")
      : "",
    "Do not hand-edit this file. Edit the plan via `ohno plan` / `ohno change`.",
    "",
  ].join("\n");
}

export function renderAgentsManagedBlock(
  model: ReadModel,
  prefs: PreferencesFile,
): string {
  const board = model.plan_board.length === 0
    ? "- (no reviewed plan)"
    : model.plan_board
      .map(
        (entry) =>
          `- [${entry.phase}] ${entry.index}. \`${entry.id}\` — ${entry.title}`,
      )
      .join("\n");
  return [
    agentsBeginMarker,
    "",
    "## Oh No, Codex! live capsule (generated)",
    "",
    "This block is a **projection** of `.ohno/state.json`.",
    "It is not authorization and not a second source of truth.",
    "Owner requirement history: `.ohno/REQUIREMENTS.md`.",
    "Working method: `.ohno/preferences.json` (`ohno preferences show`).",
    "Refresh with `ohno projectors refresh`.",
    "",
    `- **Goal:** ${model.goal ?? "NONE"}`,
    `- **Status:** ${model.status}`,
    `- **Cursor:** ${model.cursor}/${model.task_count}`,
    `- **Proof:** ${model.proof_freshness}`,
    `- **Blocker:** ${model.blocker}`,
    `- **Doc sync:** ${model.document_sync_status}`,
    `- **Next:** \`${model.next_action}\``,
    model.next_action === "PROPOSE_PLAN"
      ? "\n**STOP free-build:** capture Owner decisions with "
        + "`ohno requirements note`, then multi-slice `ohno plan propose` "
        + "(not brainstorm-only). Weak micro-plans are refused on accept."
      : "",
    model.next_action === "PROJECT_COMPLETE"
      ? "\n**This linear plan is done** (not product-finished). "
        + "Propose the next phase with `ohno plan propose`."
      : "",
    "",
    "### Plan board (done / half / ready / outline)",
    "",
    board,
    "",
    renderControlProtocolMarkdown().trimEnd(),
    "",
    renderWorkingMethodMarkdown(prefs).trimEnd(),
    "",
    agentsEndMarker,
  ].join("\n");
}

export function upsertAgentsManagedBlock(
  existing: string,
  block: string,
): string {
  const begin = existing.indexOf(agentsBeginMarker);
  const end = existing.indexOf(agentsEndMarker);
  if (begin !== -1 && end !== -1 && end > begin) {
    const afterEnd = end + agentsEndMarker.length;
    const prefix = existing.slice(0, begin).replace(/\s*$/u, "\n\n");
    const suffix = existing.slice(afterEnd).replace(/^\s*/u, "\n");
    return `${prefix}${block}${suffix}`;
  }
  const base = existing.replace(/\s*$/u, "");
  if (base.length === 0) {
    return `${block}\n`;
  }
  return `${base}\n\n${block}\n`;
}

export interface ProjectorResult {
  progress_path: string;
  requirements_path: string;
  agents_path: string | null;
  agents_updated: boolean;
  model: ReadModel;
}

export async function refreshProjectors(
  projectPath: string,
  options: { agents?: boolean } = {},
): Promise<ProjectorResult> {
  const model = await readModel(projectPath);
  const prefs = await ensurePreferences(projectPath);
  const ohnoDir = resolve(projectPath, ".ohno");
  await mkdir(ohnoDir, { recursive: true });
  const progressPath = resolve(ohnoDir, "PROGRESS.md");
  await writeFile(progressPath, renderProgressMarkdown(model), "utf8");
  const requirementsPath = await refreshRequirementsProjection(
    projectPath,
    model,
    prefs,
  );

  let agentsPath: string | null = null;
  let agentsUpdated = false;
  if (options.agents !== false) {
    agentsPath = resolve(projectPath, "AGENTS.md");
    let existing = "";
    try {
      existing = await readFile(agentsPath, "utf8");
    } catch {
      existing = [
        "# Agent instructions",
        "",
        "Owner-authored rules live outside the Oh No managed block.",
        "",
      ].join("\n");
    }
    const next = upsertAgentsManagedBlock(
      existing,
      renderAgentsManagedBlock(model, prefs),
    );
    if (next !== existing) {
      await writeFile(agentsPath, next, "utf8");
      agentsUpdated = true;
    } else {
      agentsUpdated = true;
    }
  }

  return {
    progress_path: ".ohno/PROGRESS.md",
    requirements_path: requirementsPath,
    agents_path: agentsPath === null ? null : "AGENTS.md",
    agents_updated: agentsUpdated,
    model,
  };
}
