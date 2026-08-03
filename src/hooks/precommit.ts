import { spawnSync } from "node:child_process";

import { assertMigrationNotRequired } from "../migration-guard.js";
import { readModel } from "../read-model.js";
import { readState } from "../state.js";
import { digestAllowedIndex } from "../subject-digest.js";
import { findProjectRoot } from "./project-root.js";
import { pathsOutsideGlobs } from "./scope.js";
import type { ScopedPath } from "./scope.js";

/**
 * Canonical harness paths that must travel with Git for O4 recovery.
 * Not product mutation; allowed beside a fresh PASS subject (A09 still gates
 * product files to the verified allowed_files + subject digest).
 */
const HARNESS_AUTHORITY_PATHS = new Set([
  "AGENTS.md",
  ".ohno/state.json",
  ".ohno/truth.json",
  ".ohno/acceptance-basis.json",
  ".ohno/REQUIREMENTS.md",
  ".ohno/preferences.json",
  ".ohno/PROGRESS.md",
  ".ohno/.gitignore",
]);

function isHarnessAuthorityPath(path: string): boolean {
  const normalized = path.replaceAll("\\", "/");
  return HARNESS_AUTHORITY_PATHS.has(normalized);
}

function stagedPaths(projectPath: string): string[] {
  const result = spawnSync(
    "git",
    [
      "diff",
      "--cached",
      "--name-only",
      "-z",
      "--no-renames",
      "--diff-filter=ACMRDTUXB",
      "--",
    ],
    {
      cwd: projectPath,
      windowsHide: true,
    },
  );
  if (
    result.error !== undefined
    || result.status !== 0
    || !Buffer.isBuffer(result.stdout)
  ) {
    throw new Error("cannot read staged Git paths");
  }
  return result.stdout
    .toString("utf8")
    .split("\0")
    .filter((path) => path !== "");
}

function asScopedPaths(paths: string[]): ScopedPath[] {
  return paths.map((path) => ({
    display: path,
    relativePath: path,
  }));
}

function assertPathsInScope(
  staged: string[],
  allowedFiles: string[],
): void {
  const outside = pathsOutsideGlobs(asScopedPaths(staged), allowedFiles);
  if (outside.length > 0) {
    throw new Error(
      `COOPERATIVE_GUARDRAIL: outside task scope: `
      + `${outside.map(({ display }) => display).join(", ")}; allowed: `
      + allowedFiles.join(", "),
    );
  }
}

export async function checkPreCommit(startPath: string): Promise<string> {
  const projectPath = findProjectRoot(startPath);
  let state;
  try {
    state = await readState(projectPath);
  } catch {
    throw new Error(
      "COOPERATIVE_GUARDRAIL: state is unavailable; repair "
      + ".ohno/state.json before committing",
    );
  }

  if (state.document_sync.status === "PENDING_REVIEW") {
    throw new Error(
      "COOPERATIVE_GUARDRAIL: document sync pending; next is "
      + "SYNC_GOVERNING_DOCUMENTS; accept the exact reviewed diff first",
    );
  }

  try {
    assertMigrationNotRequired(state);
  } catch (error) {
    throw new Error(
      `COOPERATIVE_GUARDRAIL: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const staged = stagedPaths(projectPath);
  if (state.active_task !== null) {
    assertPathsInScope(staged, state.active_task.allowed_files);
    return `COOPERATIVE_GUARDRAIL: active checkpoint is in-scope: `
      + `${staged.join(", ") || "NONE"}\n`;
  }

  const completedTask = state.completed.at(-1);
  if (completedTask === undefined) {
    throw new Error(
      "COOPERATIVE_GUARDRAIL: no active task and no fresh PASS subject. "
        + "Do not invent a one-task docs/commit micro-plan just to unlock git "
        + "(FT-14). Propose multi-slice product tasks with behavioral tests, "
        + "then: ohno plan propose → accept → task start → verify. "
        + "Meta-only plans require Owner --allow-weak-plan on accept.",
    );
  }

  const model = await readModel(projectPath);
  if (model.proof_freshness !== "FRESH") {
    const prefix = model.proof_freshness === "STALE" ? "STALE: " : "";
    throw new Error(
      `COOPERATIVE_GUARDRAIL: ${prefix}fresh PASS is required; `
      + "run ohno verify",
    );
  }

  const productStaged = staged.filter((path) => !isHarnessAuthorityPath(path));
  const harnessStaged = staged.filter((path) => isHarnessAuthorityPath(path));

  // O4: after fresh PASS, Owner may commit sole authority + projectors alone.
  if (productStaged.length === 0) {
    if (harnessStaged.length === 0) {
      throw new Error(
        "COOPERATIVE_GUARDRAIL: nothing staged under the fresh PASS subject "
          + "or harness authority paths",
      );
    }
    return `COOPERATIVE_GUARDRAIL: fresh PASS; harness authority paths only: `
      + `${harnessStaged.join(", ")}\n`;
  }

  let indexDigest: string;
  try {
    indexDigest = digestAllowedIndex(
      projectPath,
      completedTask.allowed_files,
    );
  } catch {
    throw new Error(
      "COOPERATIVE_GUARDRAIL: cannot prove the staged index subject; "
      + "re-verify the staged subject",
    );
  }
  if (indexDigest !== state.last_verification?.subject_digest) {
    throw new Error(
      "COOPERATIVE_GUARDRAIL: staged subject digest does not match the "
      + "verified subject digest; re-verify the staged subject",
    );
  }

  assertPathsInScope(productStaged, completedTask.allowed_files);
  const extra = harnessStaged.length > 0
    ? `; harness authority also staged: ${harnessStaged.join(", ")}`
    : "";
  return `COOPERATIVE_GUARDRAIL: fresh PASS covers in-scope staged paths: `
    + `${productStaged.join(", ") || "NONE"}${extra}\n`;
}
