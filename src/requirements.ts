import {
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";

import {
  ensurePreferences,
  enabledRules,
  type PreferencesFile,
} from "./preferences.js";
import {
  type ReadModel,
  readModel,
} from "./read-model.js";
import { displayFieldByteLimits, displayTextIssue } from "./state.js";

export const requirementsProjectionBegin =
  "<!-- ohno:requirements-projection-begin -->";
export const requirementsProjectionEnd =
  "<!-- ohno:requirements-projection-end -->";

const notesHeader = "## Owner notes (append-only)";

function requirementsPath(projectPath: string): string {
  return resolve(projectPath, ".ohno", "REQUIREMENTS.md");
}

function renderProjection(
  model: ReadModel,
  prefs: PreferencesFile,
): string {
  const board = model.plan_board.length === 0
    ? "- (no reviewed plan yet)"
    : model.plan_board
      .map(
        (entry) =>
          `- [${entry.phase}] ${entry.index}. \`${entry.id}\` — ${entry.title}`,
      )
      .join("\n");
  const truth = model.truth_targets.length === 0
    ? "- (no truth targets classified)"
    : model.truth_targets.map((path) => `- \`${path}\``).join("\n");
  const method = enabledRules(prefs).length === 0
    ? "- (all working-method rules disabled — configure with `ohno preferences`)"
    : enabledRules(prefs)
      .map((rule) => `- \`${rule.id}\`: ${rule.text}`)
      .join("\n");
  return [
    requirementsProjectionBegin,
    "",
    "## Live projection (from `.ohno/state.json`)",
    "",
    "> Not a second authority. Regenerate: `ohno projectors refresh`.",
    "",
    `- **Goal:** ${model.goal ?? "NONE"}`,
    `- **Status:** ${model.status}`,
    `- **Cursor:** ${model.cursor}/${model.task_count}`,
    `- **Proof:** ${model.proof_freshness}`,
    `- **Blocker:** ${model.blocker}`,
    `- **Next:** \`${model.next_action}\``,
    "",
    "### Plan board",
    "",
    board,
    "",
    "### Truth targets",
    "",
    truth,
    "",
    "### Working method (enabled rules)",
    "",
    method,
    "",
    "### Discipline (eighteen sins pressure)",
    "",
    "- One current goal; one active frozen task.",
    "- Prefer narrow `allowed_files` and a user-visible black box.",
    "- Do not expand into infrastructure-only work without a new Owner plan revision.",
    "",
    requirementsProjectionEnd,
  ].join("\n");
}

function upsertProjection(existing: string, projection: string): string {
  const begin = existing.indexOf(requirementsProjectionBegin);
  const end = existing.indexOf(requirementsProjectionEnd);
  if (begin !== -1 && end !== -1 && end > begin) {
    const afterEnd = end + requirementsProjectionEnd.length;
    const prefix = existing.slice(0, begin).replace(/\s*$/u, "\n\n");
    const suffix = existing.slice(afterEnd).replace(/^\s*/u, "\n");
    return `${prefix}${projection}${suffix}`;
  }
  const base = existing.replace(/\s*$/u, "");
  if (base.length === 0) {
    return `${projection}\n`;
  }
  return `${base}\n\n${projection}\n`;
}

function ensureScaffold(existing: string): string {
  if (existing.trim() !== "") {
    return existing;
  }
  return [
    "# Owner requirements log",
    "",
    "Collect Owner-stated goals and decisions here so every session sees the",
    "same requirement history. The projection block below is generated from",
    "`.ohno/state.json` and is **not** a second authority.",
    "",
    "Use `ohno requirements note --text \"...\"` to append notes.",
    "",
    notesHeader,
    "",
    "_No owner notes yet._",
    "",
  ].join("\n");
}

export async function refreshRequirementsProjection(
  projectPath: string,
  model?: ReadModel,
  prefs?: PreferencesFile,
): Promise<string> {
  const resolved = model ?? await readModel(projectPath);
  const resolvedPrefs = prefs ?? await ensurePreferences(projectPath);
  await mkdir(resolve(projectPath, ".ohno"), { recursive: true });
  const path = requirementsPath(projectPath);
  let existing = "";
  try {
    existing = await readFile(path, "utf8");
  } catch {
    existing = "";
  }
  const scaffolded = ensureScaffold(existing);
  const next = upsertProjection(
    scaffolded,
    renderProjection(resolved, resolvedPrefs),
  );
  await writeFile(path, next, "utf8");
  return ".ohno/REQUIREMENTS.md";
}

export async function appendRequirementsNote(
  projectPath: string,
  text: string,
  source = "owner-note",
): Promise<string> {
  const issue = displayTextIssue(text, displayFieldByteLimits.changeSummary);
  if (issue === "LINE_BREAK") {
    throw new Error("--text must be a single line");
  }
  if (issue === "TOO_LARGE") {
    throw new Error(
      `--text exceeds ${displayFieldByteLimits.changeSummary} UTF-8 bytes`,
    );
  }
  const trimmed = text.trim();
  if (trimmed === "") {
    throw new Error("--text cannot be blank");
  }

  await mkdir(resolve(projectPath, ".ohno"), { recursive: true });
  const path = requirementsPath(projectPath);
  let existing = "";
  try {
    existing = await readFile(path, "utf8");
  } catch {
    existing = "";
  }
  let body = ensureScaffold(existing);
  body = body.replace(/\n_No owner notes yet\._\n/u, "\n");
  if (!body.includes(notesHeader)) {
    body = `${body.replace(/\s*$/u, "")}\n\n${notesHeader}\n`;
  }
  const stamp = new Date().toISOString();
  const entry = [
    "",
    `### ${stamp}`,
    "",
    `- source: \`${source}\``,
    `- text: ${trimmed}`,
    "",
  ].join("\n");
  const headerIndex = body.indexOf(notesHeader);
  if (headerIndex === -1) {
    body = `${body}${entry}`;
  } else {
    // Append notes after the notes header section, before projection if needed.
    const projectionAt = body.indexOf(requirementsProjectionBegin);
    if (projectionAt !== -1 && projectionAt > headerIndex) {
      body = `${body.slice(0, projectionAt).replace(/\s*$/u, "")}${entry}\n${
        body.slice(projectionAt)
      }`;
    } else {
      body = `${body.replace(/\s*$/u, "")}${entry}`;
    }
  }
  await writeFile(path, body, "utf8");
  await refreshRequirementsProjection(projectPath);
  return ".ohno/REQUIREMENTS.md";
}

export async function showRequirements(projectPath: string): Promise<string> {
  try {
    return await readFile(requirementsPath(projectPath), "utf8");
  } catch {
    throw new Error(
      ".ohno/REQUIREMENTS.md missing — run ohno init or ohno projectors refresh",
    );
  }
}
