import { spawnSync } from "node:child_process";
import {
  access,
  lstat,
} from "node:fs/promises";
import { posix, resolve } from "node:path";

import { readTruth } from "./truth.js";
import type { TruthDocument } from "./truth.js";
import type {
  TruthClassification,
  TruthClassificationEntry,
  TruthInventory,
} from "./state.js";
import { truthInventoryDigestFor } from "./state.js";

const canonicalGoverning = new Set([
  "PLAN.md",
  "PRODUCT-CONTRACT.md",
  "DESIGN.md",
  "ACCEPTANCE.md",
  "docs/PLAN.md",
  "docs/PRODUCT-CONTRACT.md",
  "docs/DESIGN.md",
  "docs/ACCEPTANCE.md",
  "docs/IMPLEMENTATION-PLAN.md",
]);

function gitPaths(projectPath: string, args: string[]): string[] {
  const result = spawnSync("git", args, {
    cwd: projectPath,
    encoding: "buffer",
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  });
  if (
    result.error !== undefined
    || result.status !== 0
    || !Buffer.isBuffer(result.stdout)
  ) {
    throw new Error("cannot inventory repository authority paths");
  }
  return result.stdout
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .map((path) => path.replaceAll("\\", "/"));
}

async function truthIfPresent(
  projectPath: string,
): Promise<TruthDocument | null> {
  try {
    await access(resolve(projectPath, ".ohno", "truth.json"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
  // Present but unreadable/invalid: fail closed (never treat as missing).
  return readTruth(projectPath);
}

function builtInClassification(
  path: string,
): TruthClassification | null {
  const basename = posix.basename(path);
  if (path === ".ohno/truth.json") {
    return "TRUTH_FILE";
  }
  if (
    basename === "AGENTS"
    || basename === "AGENTS.md"
    || basename === "AGENTS.override"
    || basename === "AGENTS.override.md"
  ) {
    return "AGENT_INSTRUCTIONS";
  }
  if (
    !path.includes("/")
    && /^(?:README|README(?:\.[A-Za-z0-9_-]+)+\.md|README\.md)$/iu.test(path)
  ) {
    return "PUBLIC_README_ENTRY";
  }
  if (
    path.startsWith(".codex/")
    || path === ".github/copilot-instructions.md"
    || path.startsWith(".github/instructions/")
    || /(?:^|\/)(?:hooks?|agent)(?:\.config)?\.(?:json|ya?ml|toml)$/iu.test(path)
  ) {
    return "AGENT_HOOK_CONFIG";
  }
  if (canonicalGoverning.has(path)) {
    return "CANONICAL_GOVERNING";
  }
  return null;
}

async function assertTargetExists(
  projectPath: string,
  path: string,
): Promise<void> {
  try {
    const stats = await lstat(resolve(projectPath, ...path.split("/")));
    if (stats.isFile() || stats.isSymbolicLink()) {
      return;
    }
  } catch {
    // The stable fail-closed message below covers absence and unreadability.
  }
  throw new Error(`GOVERNING_TARGET_MISSING_OR_RENAMED: ${path}`);
}

async function scan(
  projectPath: string,
  truthOverride?: TruthDocument | null,
): Promise<{
  inventory: TruthInventory;
  truthTargets: Set<string>;
}> {
  const truth = truthOverride !== undefined
    ? truthOverride
    : await truthIfPresent(projectPath);
  const truthTargets = new Set(
    truth?.targets.map(({ path }) => path) ?? [],
  );
  await Promise.all(
    [...truthTargets].map((path) => assertTargetExists(projectPath, path)),
  );

  const paths = new Set([
    ...gitPaths(projectPath, [
      "ls-files",
      "-z",
      "--cached",
      "--others",
      "--exclude-standard",
    ]),
    ...gitPaths(projectPath, [
      "ls-files",
      "-z",
      "--others",
      "--ignored",
      "--exclude-standard",
    ]),
  ]);
  if (truth !== null) {
    paths.add(".ohno/truth.json");
    for (const target of truthTargets) {
      paths.add(target);
    }
  }

  const classification: TruthClassificationEntry[] = [];
  for (const path of [...paths].toSorted()) {
    const kind = builtInClassification(path)
      ?? (truthTargets.has(path) ? "TRUTH_TARGET" : null);
    if (kind !== null) {
      classification.push({
        path,
        classification: kind,
        governing: true,
        truth_target: truthTargets.has(path),
      });
    }
  }
  return {
    inventory: {
      inventory_digest: truthInventoryDigestFor(classification),
      classification,
    },
    truthTargets,
  };
}

export async function classifyTruthAtInit(
  projectPath: string,
): Promise<TruthInventory> {
  return (await scan(projectPath)).inventory;
}

/**
 * Full high-risk inventory as if `truth` were already on disk.
 * Used by zero-write migrate preview so apply digests stay stable.
 */
export async function classifyWithTruthDocument(
  projectPath: string,
  truth: TruthDocument,
): Promise<TruthInventory> {
  return (await scan(projectPath, truth)).inventory;
}

export async function refreshTruthAtChangeBegin(
  projectPath: string,
  previous: TruthInventory,
): Promise<TruthInventory> {
  const current = await scan(projectPath);
  for (const prior of previous.classification) {
    await assertTargetExists(projectPath, prior.path);
  }
  if (current.inventory.inventory_digest === previous.inventory_digest) {
    return previous;
  }

  const currentByPath = new Map(
    current.inventory.classification.map((entry) => [entry.path, entry]),
  );
  for (const prior of previous.classification) {
    if (!currentByPath.has(prior.path)) {
      throw new Error(
        `GOVERNING_TARGET_MISSING_OR_RENAMED: ${prior.path}`,
      );
    }
    if (
      (
        prior.classification === "TRUTH_TARGET"
        || prior.truth_target === true
      )
      && !current.truthTargets.has(prior.path)
    ) {
      throw new Error(
        `GOVERNING_TARGET_MISSING_OR_RENAMED: ${prior.path}`,
      );
    }
  }

  const previousPaths = new Set(
    previous.classification.map(({ path }) => path),
  );
  for (const entry of current.inventory.classification) {
    if (
      !previousPaths.has(entry.path)
      && !current.truthTargets.has(entry.path)
    ) {
      throw new Error(`UNCLASSIFIED_HIGH_RISK: ${entry.path}`);
    }
  }
  return current.inventory;
}
