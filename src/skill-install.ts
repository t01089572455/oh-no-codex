import {
  access,
  copyFile,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import {
  dirname,
  join,
  resolve,
} from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const packageRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
);

export const skillPackageId = "oh-no-control";

function skillSourcePath(): string {
  return resolve(packageRoot, "skills", skillPackageId, "SKILL.md");
}

/** Primary Codex user skill dir on this machine. */
export function codexSkillDir(home = homedir()): string {
  return join(home, ".codex", "skills", skillPackageId);
}

/** Optional OpenAgent / shared skills dir when present. */
export function agentsSkillDir(home = homedir()): string {
  return join(home, ".agents", "skills", skillPackageId);
}

export interface SkillInstallTarget {
  id: "codex" | "agents";
  dir: string;
  skillMd: string;
  status: "MISSING" | "INSTALLED" | "DRIFT";
}

async function classifyTarget(
  id: "codex" | "agents",
  dir: string,
  sourceBody: string,
): Promise<SkillInstallTarget> {
  const skillMd = join(dir, "SKILL.md");
  try {
    const existing = await readFile(skillMd, "utf8");
    return {
      id,
      dir,
      skillMd,
      status: existing === sourceBody ? "INSTALLED" : "DRIFT",
    };
  } catch {
    return {
      id,
      dir,
      skillMd,
      status: "MISSING",
    };
  }
}

export async function skillInstallStatus(
  home = homedir(),
): Promise<{
  source: string;
  targets: SkillInstallTarget[];
}> {
  const source = skillSourcePath();
  let body = "";
  try {
    body = await readFile(source, "utf8");
  } catch {
    throw new Error(
      `bundled skill missing at ${source} — reinstall oh-no-codex package`,
    );
  }
  const targets = [
    await classifyTarget("codex", codexSkillDir(home), body),
  ];
  // Only report agents path if parent skills dir exists or skill already there.
  const agentsParent = join(home, ".agents", "skills");
  try {
    await access(agentsParent);
    targets.push(await classifyTarget("agents", agentsSkillDir(home), body));
  } catch {
    try {
      await access(join(agentsSkillDir(home), "SKILL.md"));
      targets.push(await classifyTarget("agents", agentsSkillDir(home), body));
    } catch {
      // optional
    }
  }
  return { source, targets };
}

export async function installOhNoSkill(
  home = homedir(),
): Promise<{
  source: string;
  installed: string[];
  updated: string[];
}> {
  const source = skillSourcePath();
  const body = await readFile(source, "utf8");
  const dirs = [codexSkillDir(home)];
  const agentsParent = join(home, ".agents", "skills");
  try {
    await access(agentsParent);
    dirs.push(agentsSkillDir(home));
  } catch {
    // codex-only is enough
  }

  const installed: string[] = [];
  const updated: string[] = [];
  for (const dir of dirs) {
    const dest = join(dir, "SKILL.md");
    await mkdir(dir, { recursive: true });
    let prior: string | null = null;
    try {
      prior = await readFile(dest, "utf8");
    } catch {
      prior = null;
    }
    if (prior === body) {
      continue;
    }
    await writeFile(dest, body, "utf8");
    // Keep a copy of package path marker for support
    await writeFile(
      join(dir, "SOURCE.txt"),
      `oh-no-codex skill\nsource=${source}\n`,
      "utf8",
    );
    if (prior === null) {
      installed.push(dest);
    } else {
      updated.push(dest);
    }
  }

  // Always ensure file exists even if identical (touch classification)
  if (installed.length === 0 && updated.length === 0) {
    await access(join(codexSkillDir(home), "SKILL.md"));
  }

  return { source, installed, updated };
}

export function serializeSkillStatus(
  report: Awaited<ReturnType<typeof skillInstallStatus>>,
): string {
  const lines = [
    `SKILL_SOURCE: ${report.source}`,
    ...report.targets.map(
      (t) =>
        `${t.status}: ${t.id} → ${t.skillMd}`,
    ),
    "",
  ];
  return lines.join("\n");
}

export function serializeSkillInstallResult(
  result: Awaited<ReturnType<typeof installOhNoSkill>>,
): string {
  const lines = [
    "Installed Oh No control skill for Codex discovery.",
    `  source: ${result.source}`,
  ];
  if (result.installed.length === 0 && result.updated.length === 0) {
    lines.push("  already up to date under ~/.codex/skills/oh-no-control/");
  }
  for (const path of result.installed) {
    lines.push(`  created: ${path}`);
  }
  for (const path of result.updated) {
    lines.push(`  updated: ${path}`);
  }
  lines.push(
    "  Restart or open a new Codex session so skill discovery can pick it up.",
    "",
  );
  return lines.join("\n");
}

/** Test helper: copy without reading package tree twice. */
export async function copySkillFile(
  from: string,
  toDir: string,
): Promise<void> {
  await mkdir(toDir, { recursive: true });
  await copyFile(from, join(toDir, "SKILL.md"));
}
