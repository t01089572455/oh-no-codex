import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  lstat,
  readFile,
  readlink,
} from "node:fs/promises";
import { posix, resolve } from "node:path";

function runGit(projectPath: string, args: string[]): string {
  const result = spawnSync("git", args, {
    cwd: projectPath,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error !== undefined || result.status !== 0) {
    throw new Error("Git subject is unreadable");
  }
  return result.stdout;
}

export function readGitHead(projectPath: string): string {
  const head = spawnSync(
    "git",
    ["rev-parse", "--verify", "HEAD"],
    {
      cwd: projectPath,
      encoding: "utf8",
      windowsHide: true,
    },
  );
  if (head.error === undefined && head.status === 0) {
    return head.stdout.trim();
  }

  runGit(projectPath, ["rev-parse", "--git-dir"]);
  return "UNBORN";
}

function listedPaths(projectPath: string): string[] {
  const visible = runGit(projectPath, [
    "ls-files",
    "-z",
    "--cached",
    "--others",
    "--exclude-standard",
  ]);
  const ignored = runGit(projectPath, [
    "ls-files",
    "-z",
    "--others",
    "--ignored",
    "--exclude-standard",
  ]);

  return [...new Set(
    `${visible}${ignored}`
      .split("\0")
      .filter((entry) => entry !== ""),
  )].sort();
}

function addFramed(
  hash: ReturnType<typeof createHash>,
  label: string,
  value: string | Buffer,
): void {
  const bytes = typeof value === "string" ? Buffer.from(value) : value;
  hash.update(`${label}:${bytes.length}:`);
  hash.update(bytes);
  hash.update("\0");
}

export async function digestAllowedFiles(
  projectPath: string,
  allowedFiles: string[],
): Promise<string> {
  const hash = createHash("sha256");
  addFramed(hash, "format", "ohno-allowed-files-v1");
  for (const pattern of allowedFiles) {
    addFramed(hash, "pattern", pattern);
  }

  const matches = listedPaths(projectPath).filter((candidate) =>
    allowedFiles.some((pattern) => posix.matchesGlob(candidate, pattern))
  );
  for (const relativePath of matches) {
    addFramed(hash, "path", relativePath);
    const absolutePath = resolve(projectPath, ...relativePath.split("/"));
    let stats;
    try {
      stats = await lstat(absolutePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        addFramed(hash, "absence", "missing");
        continue;
      }
      throw new Error(`matched subject is unreadable: ${relativePath}`);
    }

    if (stats.isSymbolicLink()) {
      try {
        addFramed(hash, "symlink", await readlink(absolutePath));
      } catch {
        throw new Error(`matched subject is unreadable: ${relativePath}`);
      }
      continue;
    }

    if (!stats.isFile()) {
      throw new Error(`matched subject is unreadable: ${relativePath}`);
    }

    try {
      addFramed(hash, "file", await readFile(absolutePath));
    } catch {
      throw new Error(`matched subject is unreadable: ${relativePath}`);
    }
  }

  return hash.digest("hex");
}
