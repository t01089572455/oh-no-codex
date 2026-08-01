import { realpath, lstat } from "node:fs/promises";
import {
  isAbsolute,
  resolve,
  relative,
  sep,
} from "node:path";

/**
 * Project-relative path rules shared by state validation and plan I/O.
 * Rejects absolute paths, drive letters, `..`, NUL, and CR/LF.
 */
export function isSafeProjectRelativePath(value: unknown): value is string {
  if (typeof value !== "string" || value.trim() === "") {
    return false;
  }
  // Reject leading/trailing whitespace before any other use (no silent trim).
  if (value !== value.trim()) {
    return false;
  }
  if (value.includes("\\") || value.includes("\0") || /[\r\n]/u.test(value)) {
    return false;
  }
  if (value.startsWith("/") || value.startsWith("../") || value === "..") {
    return false;
  }
  if (/^[A-Za-z]:/u.test(value)) {
    return false;
  }
  if (value.split("/").includes("..")) {
    return false;
  }
  // Normalize form must already use `/` only (no backslash).
  return value === value.replaceAll("\\", "/");
}

export function assertSafeProjectRelativePath(
  value: unknown,
  label = "path",
): string {
  if (!isSafeProjectRelativePath(value)) {
    throw new Error(
      `${label} must be a project-relative path using forward slashes `
        + "(no absolute paths, drive letters, .., backslashes, or whitespace padding)",
    );
  }
  return value;
}

/**
 * Resolve a project-relative path and ensure the real path stays inside the
 * project root (blocks escapes after resolution).
 */
export async function resolveInsideProject(
  projectPath: string,
  relativePath: string,
): Promise<{ relativePath: string; absolutePath: string }> {
  const safe = assertSafeProjectRelativePath(relativePath, "path");
  const projectRoot = await realpath(projectPath).catch(() =>
    resolve(projectPath)
  );
  const absolutePath = resolve(projectRoot, ...safe.split("/"));
  let resolved: string;
  try {
    // If file exists, realpath; if not, realpath parent + basename.
    await lstat(absolutePath);
    resolved = await realpath(absolutePath);
  } catch {
    const parent = await realpath(resolve(absolutePath, "..")).catch(() =>
      resolve(absolutePath, "..")
    );
    const base = absolutePath.split(/[/\\]/u).at(-1) ?? "";
    resolved = resolve(parent, base);
  }
  const rel = relative(projectRoot, resolved);
  // Cross-drive / junction escape: relative() returns an absolute path.
  if (
    isAbsolute(rel)
    || rel.startsWith("..")
    || rel === ".."
    || (rel.length > 0 && rel.split(sep)[0] === "..")
  ) {
    throw new Error(
      `path escapes project root: ${safe}`,
    );
  }
  if (rel === "") {
    throw new Error(`path must name a file inside the project: ${safe}`);
  }
  return {
    relativePath: safe,
    // Use the non-escaped resolved path under the real project root.
    absolutePath: resolve(projectRoot, ...safe.split("/")),
  };
}
