import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

export interface SiblingOhnoWorktree {
  path: string;
  branch: string | null;
}

/**
 * List other git worktrees that also carry .ohno/state.json (FT-13/17).
 */
export async function listSiblingOhnoWorktrees(
  projectPath: string,
): Promise<SiblingOhnoWorktree[]> {
  const result = spawnSync(
    "git",
    ["-C", projectPath, "worktree", "list", "--porcelain"],
    { encoding: "utf8", windowsHide: true },
  );
  if (result.status !== 0 || !result.stdout) {
    return [];
  }
  const blocks = result.stdout.split(/\n\n/u).filter((b) => b.trim() !== "");
  const self = resolve(projectPath);
  const out: SiblingOhnoWorktree[] = [];
  for (const block of blocks) {
    const pathLine = /^worktree (.+)$/mu.exec(block);
    if (pathLine?.[1] === undefined) {
      continue;
    }
    const wtPath = resolve(pathLine[1]);
    if (wtPath === self) {
      continue;
    }
    try {
      await access(resolve(wtPath, ".ohno", "state.json"));
    } catch {
      continue;
    }
    const branchLine = /^branch refs\/heads\/(.+)$/mu.exec(block);
    out.push({
      path: wtPath,
      branch: branchLine?.[1] ?? null,
    });
  }
  return out;
}

export function formatSiblingWorktreesNote(
  siblings: SiblingOhnoWorktree[],
): string | null {
  if (siblings.length === 0) {
    return null;
  }
  const body = siblings
    .map((s) => `${s.path}${s.branch ? ` (${s.branch})` : ""}`)
    .join(" | ");
  return (
    `SIBLING_OHNO_WORKTREES: ${siblings.length} other worktree(s) have `
    + `.ohno/state.json: ${body}. Cockpit/resume only read THIS cwd (FT-13).`
  );
}
