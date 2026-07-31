import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";

export function findProjectRoot(startPath: string): string {
  const result = spawnSync(
    "git",
    ["rev-parse", "--show-toplevel"],
    {
      cwd: startPath,
      encoding: "utf8",
      windowsHide: true,
    },
  );
  if (
    result.error !== undefined
    || result.status !== 0
    || result.stdout.trim() === ""
  ) {
    throw new Error("cannot locate the Git project root");
  }
  const toplevel = resolve(result.stdout.trim());
  try {
    return realpathSync(toplevel);
  } catch {
    return toplevel;
  }
}
