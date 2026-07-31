import {
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";

/**
 * Owner working-method preferences.
 *
 * Defaults encode recurring Owner rules mined from VibeTether-era intent,
 * long-task anti-drift practice, and Oh No product rules — not a second
 * runtime authority. Agents must read enabled rules; users may disable or
 * rewrite any rule for their project.
 */
export interface WorkingRule {
  id: string;
  enabled: boolean;
  text: string;
}

export interface PreferencesFile {
  schema_version: 1;
  rules: WorkingRule[];
}

export const preferencesRelativePath = ".ohno/preferences.json";

/** Default ON — the Owner's preferred long-project craft. */
export const defaultWorkingRules: readonly WorkingRule[] = Object.freeze([
  {
    id: "research_before_implement",
    enabled: true,
    text:
      "Before consequential implementation, survey discoverable open-source "
      + "options and existing project assets. Write a short candidate list "
      + "(paths, licenses, fit) into Owner notes or a research doc before coding.",
  },
  {
    id: "prefer_existing_oss",
    enabled: true,
    text:
      "Prefer maintained packages, templates, or reference implementations over "
      + "greenfield rewrites when license and fit allow. Use them as-is when "
      + "possible; do not rewrite usable upstream for style alone.",
  },
  {
    id: "frontend_adapt_not_invent",
    enabled: true,
    text:
      "For UI work: start from a real reference (open template, approved mock, "
      + "or screenshot). Adapt copy, labels, buttons, and project-specific "
      + "details. Do not invent a whole UI language from scratch unless the "
      + "Owner disables this rule or freezes a design contract that requires it.",
  },
  {
    id: "design_or_reference_before_ui_code",
    enabled: true,
    text:
      "Do not write product UI code before a locked design contract or an "
      + "explicit visual reference is named in the active task. Browser "
      + "acceptance is required for user-facing UI slices.",
  },
  {
    id: "owner_semantics_minimum",
    enabled: true,
    text:
      "Preserve the Owner's wording. Ambiguity selects the smallest behavior "
      + "that satisfies the frozen public acceptance.",
  },
  {
    id: "freeze_blackbox_first",
    enabled: true,
    text:
      "Before mutation, freeze one user-visible black-box test, allowed files, "
      + "stop condition, and time budget for the active task.",
  },
  {
    id: "stop_after_pass",
    enabled: true,
    text:
      "A fresh PASS closes the task. `next` is a locator, not permission to "
      + "start a new phase without an authorized plan slice.",
  },
  {
    id: "no_second_authority",
    enabled: true,
    text:
      "`.ohno/state.json` is the sole current runtime authority. PROGRESS, "
      + "REQUIREMENTS projections, resume text, and chat summaries cannot "
      + "outrank it.",
  },
  {
    id: "reference_repos_readonly",
    enabled: true,
    text:
      "External reference repositories are read-only inspiration. Do not adopt "
      + "them as a long-lived runtime or copy proprietary/private assets.",
  },
] as const);

function preferencesPath(projectPath: string): string {
  return resolve(projectPath, ".ohno", "preferences.json");
}

function cloneDefaults(): PreferencesFile {
  return {
    schema_version: 1,
    rules: defaultWorkingRules.map((rule) => ({ ...rule })),
  };
}

function normalize(raw: unknown): PreferencesFile {
  if (
    raw === null
    || typeof raw !== "object"
    || Array.isArray(raw)
  ) {
    return cloneDefaults();
  }
  const body = raw as { schema_version?: unknown; rules?: unknown };
  if (body.schema_version !== 1 || !Array.isArray(body.rules)) {
    return cloneDefaults();
  }
  const byId = new Map<string, WorkingRule>();
  for (const entry of body.rules) {
    if (
      entry === null
      || typeof entry !== "object"
      || Array.isArray(entry)
    ) {
      continue;
    }
    const row = entry as {
      id?: unknown;
      enabled?: unknown;
      text?: unknown;
    };
    if (typeof row.id !== "string" || row.id.trim() === "") {
      continue;
    }
    if (typeof row.text !== "string" || row.text.trim() === "") {
      continue;
    }
    byId.set(row.id.trim(), {
      id: row.id.trim(),
      enabled: row.enabled !== false,
      text: row.text.trim(),
    });
  }

  // Merge: keep Owner custom ids; ensure every default id exists.
  const merged: WorkingRule[] = [];
  const seen = new Set<string>();
  for (const fallback of defaultWorkingRules) {
    const custom = byId.get(fallback.id);
    merged.push(custom ?? { ...fallback });
    seen.add(fallback.id);
  }
  for (const [id, rule] of byId) {
    if (!seen.has(id)) {
      merged.push(rule);
    }
  }
  return { schema_version: 1, rules: merged };
}

export async function ensurePreferences(
  projectPath: string,
): Promise<PreferencesFile> {
  await mkdir(resolve(projectPath, ".ohno"), { recursive: true });
  const path = preferencesPath(projectPath);
  try {
    const raw = JSON.parse(await readFile(path, "utf8")) as unknown;
    const prefs = normalize(raw);
    // Rewrite if missing keys so defaults stay discoverable after upgrades.
    await writeFile(path, `${JSON.stringify(prefs, null, 2)}\n`, "utf8");
    return prefs;
  } catch {
    const prefs = cloneDefaults();
    await writeFile(path, `${JSON.stringify(prefs, null, 2)}\n`, "utf8");
    return prefs;
  }
}

export async function loadPreferences(
  projectPath: string,
): Promise<PreferencesFile> {
  try {
    const raw = JSON.parse(
      await readFile(preferencesPath(projectPath), "utf8"),
    ) as unknown;
    return normalize(raw);
  } catch {
    return cloneDefaults();
  }
}

export async function resetPreferences(
  projectPath: string,
): Promise<PreferencesFile> {
  await mkdir(resolve(projectPath, ".ohno"), { recursive: true });
  const prefs = cloneDefaults();
  await writeFile(
    preferencesPath(projectPath),
    `${JSON.stringify(prefs, null, 2)}\n`,
    "utf8",
  );
  return prefs;
}

export async function setPreferenceRule(
  projectPath: string,
  id: string,
  patch: { enabled?: boolean; text?: string },
): Promise<PreferencesFile> {
  const trimmedId = id.trim();
  if (trimmedId === "") {
    throw new Error("--id cannot be blank");
  }
  if (patch.enabled === undefined && patch.text === undefined) {
    throw new Error("provide --enabled and/or --text");
  }
  if (patch.text !== undefined) {
    const text = patch.text.trim();
    if (text === "") {
      throw new Error("--text cannot be blank");
    }
    if (/[\r\n]/u.test(text)) {
      throw new Error("--text must be a single line");
    }
    if (Buffer.byteLength(text, "utf8") > 512) {
      throw new Error("--text must be at most 512 UTF-8 bytes");
    }
  }

  const prefs = await ensurePreferences(projectPath);
  const existing = prefs.rules.find((rule) => rule.id === trimmedId);
  if (existing === undefined) {
    if (patch.text === undefined) {
      throw new Error(
        `unknown preference id "${trimmedId}" — pass --text to create a custom rule`,
      );
    }
    prefs.rules.push({
      id: trimmedId,
      enabled: patch.enabled ?? true,
      text: patch.text.trim(),
    });
  } else {
    if (patch.enabled !== undefined) {
      existing.enabled = patch.enabled;
    }
    if (patch.text !== undefined) {
      existing.text = patch.text.trim();
    }
  }
  await writeFile(
    preferencesPath(projectPath),
    `${JSON.stringify(prefs, null, 2)}\n`,
    "utf8",
  );
  return prefs;
}

export function enabledRules(prefs: PreferencesFile): WorkingRule[] {
  return prefs.rules.filter((rule) => rule.enabled);
}

export function renderWorkingMethodMarkdown(prefs: PreferencesFile): string {
  const lines = [
    "### Working method (Owner-configurable)",
    "",
    "Defaults favor research-first reuse and frontend adapt-not-invent. "
    + "Change with `ohno preferences set|reset`. Not a second authority.",
    "",
  ];
  for (const rule of prefs.rules) {
    const flag = rule.enabled ? "ON" : "OFF";
    lines.push(`- **[${flag}]** \`${rule.id}\` — ${rule.text}`);
  }
  lines.push("");
  return lines.join("\n");
}

export function serializePreferences(prefs: PreferencesFile): string {
  return [
    `PREFERENCES: ${preferencesRelativePath}`,
    `RULES: ${prefs.rules.length} (${enabledRules(prefs).length} enabled)`,
    ...prefs.rules.map(
      (rule) =>
        `${rule.enabled ? "ON" : "OFF"}: ${rule.id} — ${rule.text}`,
    ),
    "",
  ].join("\n");
}
