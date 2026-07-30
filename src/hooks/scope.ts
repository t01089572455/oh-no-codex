import {
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";
import { posix } from "node:path";

export interface ScopedPath {
  display: string;
  relativePath: string | null;
}

export function toProjectPath(
  projectPath: string,
  target: string,
): ScopedPath {
  if (target === "" || target.includes("\0")) {
    return {
      display: target || "<blank>",
      relativePath: null,
    };
  }

  const absolute = isAbsolute(target)
    ? resolve(target)
    : resolve(projectPath, target);
  const projectRelative = relative(projectPath, absolute);
  if (
    projectRelative === ""
    || projectRelative === ".."
    || projectRelative.startsWith(`..${sep}`)
    || isAbsolute(projectRelative)
  ) {
    return {
      display: target,
      relativePath: null,
    };
  }

  return {
    display: target,
    relativePath: projectRelative.split(sep).join("/"),
  };
}

export function pathsOutsideGlobs(
  paths: ScopedPath[],
  allowedFiles: string[],
): ScopedPath[] {
  return paths.filter(({ relativePath }) =>
    relativePath === null
    || !allowedFiles.some((pattern) =>
      posix.matchesGlob(relativePath, pattern)
    )
  );
}
