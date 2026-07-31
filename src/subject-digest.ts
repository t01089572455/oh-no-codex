import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  lstat,
  readFile,
  readlink,
} from "node:fs/promises";
import { posix, resolve } from "node:path";

function runGitResult(projectPath: string, args: string[]) {
  return spawnSync("git", args, {
    cwd: projectPath,
    encoding: "utf8",
    windowsHide: true,
  });
}

function runGit(projectPath: string, args: string[]): string {
  const result = runGitResult(projectPath, args);
  if (result.error !== undefined || result.status !== 0) {
    throw new Error("Git subject is unreadable");
  }
  return result.stdout;
}

function runGitBuffer(projectPath: string, args: string[]): Buffer {
  const result = spawnSync("git", args, {
    cwd: projectPath,
    windowsHide: true,
  });
  if (
    result.error !== undefined
    || result.status !== 0
    || !Buffer.isBuffer(result.stdout)
  ) {
    throw new Error("Git subject is unreadable");
  }
  return result.stdout;
}

export function readGitHead(projectPath: string): string {
  const head = runGitResult(
    projectPath,
    ["rev-parse", "--verify", "HEAD^{commit}"],
  );
  if (head.error === undefined && head.status === 0) {
    const value = head.stdout.trim();
    if (/^[a-f0-9]{40,64}$/.test(value)) {
      return value;
    }
    throw new Error("Git HEAD is unreadable");
  }

  const symbolicHead = runGitResult(
    projectPath,
    ["symbolic-ref", "--quiet", "HEAD"],
  );
  if (symbolicHead.error !== undefined || symbolicHead.status !== 0) {
    throw new Error("Git HEAD is unreadable");
  }
  const reference = symbolicHead.stdout.trim();
  const validReference = runGitResult(
    projectPath,
    ["check-ref-format", reference],
  );
  if (validReference.error !== undefined || validReference.status !== 0) {
    throw new Error("Git HEAD is unreadable");
  }

  const existingReference = runGitResult(
    projectPath,
    ["show-ref", "--verify", "--quiet", reference],
  );
  if (existingReference.error === undefined && existingReference.status === 1) {
    return "UNBORN";
  }
  throw new Error("Git HEAD is unreadable");
}

function staticRoot(pattern: string): string {
  const normalized = pattern.replaceAll("\\", "/").replace(/^\.\/+/, "");
  if (
    normalized === ""
    || normalized.startsWith("/")
    || normalized.split("/").includes("..")
  ) {
    return ".";
  }

  const magicIndex = [...normalized].findIndex((character) =>
    "*?[]{}".includes(character)
  );
  if (magicIndex === -1) {
    return normalized;
  }

  const prefix = normalized.slice(0, magicIndex);
  const lastSeparator = prefix.lastIndexOf("/");
  return lastSeparator === -1
    ? "."
    : prefix.slice(0, lastSeparator) || ".";
}

function enumerationRoots(allowedFiles: string[]): string[] {
  const roots = [...new Set(allowedFiles.map(staticRoot))]
    .sort((left, right) => left.length - right.length);
  if (roots.includes(".")) {
    return ["."];
  }
  return roots.filter((root, index) =>
    !roots
      .slice(0, index)
      .some((parent) => root.startsWith(`${parent}/`))
  );
}

function listedPaths(
  projectPath: string,
  allowedFiles: string[],
): string[] {
  const roots = enumerationRoots(allowedFiles);
  const visible = runGit(projectPath, [
    "ls-files",
    "-z",
    "--cached",
    "--others",
    "--exclude-standard",
    "--",
    ...roots,
  ]);
  const ignored = runGit(projectPath, [
    "ls-files",
    "-z",
    "--others",
    "--ignored",
    "--exclude-standard",
    "--",
    ...roots,
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

function assertBoundedAllowedFiles(allowedFiles: string[]): void {
  for (const pattern of allowedFiles) {
    if (staticRoot(pattern) === ".") {
      throw new Error(
        `allowed_files pattern is unbounded at repository root: ${pattern}`,
      );
    }
  }
}

export async function digestAllowedFiles(
  projectPath: string,
  allowedFiles: string[],
): Promise<string> {
  assertBoundedAllowedFiles(allowedFiles);
  const hash = createHash("sha256");
  addFramed(hash, "format", "ohno-allowed-files-v1");
  for (const pattern of allowedFiles) {
    addFramed(hash, "pattern", pattern);
  }

  const matches = listedPaths(projectPath, allowedFiles).filter((candidate) =>
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

interface IndexEntry {
  mode: string;
  object: string;
  path: string;
}

function indexEntries(
  projectPath: string,
  allowedFiles: string[],
): IndexEntry[] {
  const output = runGitBuffer(projectPath, [
    "ls-files",
    "--stage",
    "-z",
    "--",
    ...enumerationRoots(allowedFiles),
  ]);
  const entries = output
    .toString("utf8")
    .split("\0")
    .filter((entry) => entry !== "")
    .map((entry) => {
      const tab = entry.indexOf("\t");
      if (tab === -1) {
        throw new Error("Git index subject is unreadable");
      }
      const [mode, object, stage, extra] = entry.slice(0, tab).split(" ");
      const path = entry.slice(tab + 1);
      if (
        mode === undefined
        || object === undefined
        || stage !== "0"
        || extra !== undefined
        || path === ""
      ) {
        throw new Error("Git index subject is unreadable");
      }
      return {
        mode,
        object,
        path,
      };
    })
    .filter(({ path }) =>
      allowedFiles.some((pattern) => posix.matchesGlob(path, pattern))
    )
    .sort((left, right) =>
      left.path < right.path ? -1 : left.path > right.path ? 1 : 0
    );

  if (new Set(entries.map(({ path }) => path)).size !== entries.length) {
    throw new Error("Git index subject is unreadable");
  }
  return entries;
}

export function digestAllowedIndex(
  projectPath: string,
  allowedFiles: string[],
): string {
  assertBoundedAllowedFiles(allowedFiles);
  const hash = createHash("sha256");
  addFramed(hash, "format", "ohno-allowed-files-v1");
  for (const pattern of allowedFiles) {
    addFramed(hash, "pattern", pattern);
  }

  for (const entry of indexEntries(projectPath, allowedFiles)) {
    addFramed(hash, "path", entry.path);
    const content = runGitBuffer(
      projectPath,
      ["cat-file", "blob", entry.object],
    );
    if (entry.mode === "120000") {
      addFramed(hash, "symlink", content);
    } else if (/^100[0-7]{3}$/u.test(entry.mode)) {
      addFramed(hash, "file", content);
    } else {
      throw new Error(`Git index subject is unreadable: ${entry.path}`);
    }
  }
  return hash.digest("hex");
}
