import {
  access,
  copyFile,
  mkdir,
  readdir,
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

function skillsBundleRoot(): string {
  return resolve(packageRoot, "skills");
}

export async function listBundledSkillIds(): Promise<string[]> {
  const root = skillsBundleRoot();
  const entries = await readdir(root, { withFileTypes: true });
  const ids: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    try {
      await access(join(root, entry.name, "SKILL.md"));
      ids.push(entry.name);
    } catch {
      // skip
    }
  }
  return ids.toSorted();
}

function skillSourcePath(skillId: string): string {
  return resolve(skillsBundleRoot(), skillId, "SKILL.md");
}

export function codexSkillsRoot(home = homedir()): string {
  return join(home, ".codex", "skills");
}

export function agentsSkillsRoot(home = homedir()): string {
  return join(home, ".agents", "skills");
}

export interface SkillSlotStatus {
  skillId: string;
  root: "codex" | "agents";
  path: string;
  status: "MISSING" | "INSTALLED" | "DRIFT";
}

async function classifySlot(
  skillId: string,
  root: "codex" | "agents",
  destDir: string,
  sourceBody: string,
): Promise<SkillSlotStatus> {
  const path = join(destDir, "SKILL.md");
  try {
    const existing = await readFile(path, "utf8");
    return {
      skillId,
      root,
      path,
      status: existing === sourceBody ? "INSTALLED" : "DRIFT",
    };
  } catch {
    return {
      skillId,
      root,
      path,
      status: "MISSING",
    };
  }
}

async function rootsToInstall(home: string): Promise<Array<{
  id: "codex" | "agents";
  root: string;
}>> {
  const roots: Array<{ id: "codex" | "agents"; root: string }> = [
    { id: "codex", root: codexSkillsRoot(home) },
  ];
  try {
    await access(agentsSkillsRoot(home));
    roots.push({ id: "agents", root: agentsSkillsRoot(home) });
  } catch {
    // optional
  }
  return roots;
}

export async function skillInstallStatus(
  home = homedir(),
): Promise<{
  bundle: string;
  skills: string[];
  slots: SkillSlotStatus[];
}> {
  const skills = await listBundledSkillIds();
  if (skills.length === 0) {
    throw new Error(
      `no bundled skills under ${skillsBundleRoot()} — reinstall oh-no-codex`,
    );
  }
  const roots = await rootsToInstall(home);
  const slots: SkillSlotStatus[] = [];
  for (const skillId of skills) {
    const body = await readFile(skillSourcePath(skillId), "utf8");
    for (const { id, root } of roots) {
      slots.push(
        await classifySlot(skillId, id, join(root, skillId), body),
      );
    }
  }
  return {
    bundle: skillsBundleRoot(),
    skills,
    slots,
  };
}

export async function installOhNoSkill(
  home = homedir(),
): Promise<{
  bundle: string;
  skills: string[];
  installed: string[];
  updated: string[];
}> {
  const skills = await listBundledSkillIds();
  if (skills.length === 0) {
    throw new Error(
      `no bundled skills under ${skillsBundleRoot()} — reinstall oh-no-codex`,
    );
  }
  const roots = await rootsToInstall(home);
  const installed: string[] = [];
  const updated: string[] = [];

  for (const skillId of skills) {
    const source = skillSourcePath(skillId);
    const body = await readFile(source, "utf8");
    for (const { root } of roots) {
      const destDir = join(root, skillId);
      const dest = join(destDir, "SKILL.md");
      await mkdir(destDir, { recursive: true });
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
      await writeFile(
        join(destDir, "SOURCE.txt"),
        `oh-no-codex skill bundle\nid=${skillId}\nsource=${source}\n`,
        "utf8",
      );
      if (prior === null) {
        installed.push(dest);
      } else {
        updated.push(dest);
      }
    }
  }

  return {
    bundle: skillsBundleRoot(),
    skills,
    installed,
    updated,
  };
}

export function serializeSkillStatus(
  report: Awaited<ReturnType<typeof skillInstallStatus>>,
): string {
  const lines = [
    `SKILL_BUNDLE: ${report.bundle}`,
    `SKILLS: ${report.skills.join(", ")} (${report.skills.length})`,
  ];
  for (const slot of report.slots) {
    lines.push(
      `${slot.status}: ${slot.root}/${slot.skillId} → ${slot.path}`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

export function serializeSkillInstallResult(
  result: Awaited<ReturnType<typeof installOhNoSkill>>,
): string {
  const lines = [
    "Installed Oh No skill suite for Codex discovery.",
    `  bundle: ${result.bundle}`,
    `  skills: ${result.skills.join(", ")}`,
  ];
  if (result.installed.length === 0 && result.updated.length === 0) {
    lines.push("  already up to date under ~/.codex/skills/oh-no-*/");
  }
  for (const path of result.installed) {
    lines.push(`  created: ${path}`);
  }
  for (const path of result.updated) {
    lines.push(`  updated: ${path}`);
  }
  lines.push(
    "  New Codex session recommended so skill discovery picks them up.",
    "",
  );
  return lines.join("\n");
}

export async function copySkillFile(
  from: string,
  toDir: string,
): Promise<void> {
  await mkdir(toDir, { recursive: true });
  await copyFile(from, join(toDir, "SKILL.md"));
}
