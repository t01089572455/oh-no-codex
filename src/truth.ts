import { readFile } from "node:fs/promises";
import { posix, resolve } from "node:path";

export interface TruthTarget {
  path: string;
  concerns: string[];
}

export interface TruthDocument {
  schema_version: 1;
  targets: TruthTarget[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  const actualKeys = Object.keys(value);
  return actualKeys.length === expectedKeys.length
    && actualKeys.every((key) => expectedKeys.includes(key));
}

function isCanonicalProjectPath(value: unknown): value is string {
  return typeof value === "string"
    && value !== ""
    && value === value.trim()
    && !value.includes("\\")
    && !value.includes("\0")
    && !/[*?\[]/u.test(value)
    && !value.startsWith(":")
    && !value.startsWith("/")
    && !/^[A-Za-z]:/u.test(value)
    && value !== "."
    && value !== ".."
    && !value.startsWith("../")
    && posix.normalize(value) === value;
}

function isConcern(value: unknown): value is string {
  return typeof value === "string"
    && value !== ""
    && value === value.trim()
    && !/[\r\n]/u.test(value);
}

function parseTruth(value: unknown): TruthDocument {
  if (
    !isRecord(value)
    || !hasExactKeys(value, ["schema_version", "targets"])
    || value.schema_version !== 1
    || !Array.isArray(value.targets)
    || value.targets.length === 0
  ) {
    throw new Error("truth.json must contain the supported v1 target list");
  }

  const targets: TruthTarget[] = [];
  const seenPaths = new Set<string>();
  for (const target of value.targets) {
    if (
      !isRecord(target)
      || !hasExactKeys(target, ["path", "concerns"])
      || !isCanonicalProjectPath(target.path)
      || !Array.isArray(target.concerns)
      || target.concerns.length === 0
      || !target.concerns.every(isConcern)
      || new Set(target.concerns).size !== target.concerns.length
      || seenPaths.has(target.path)
    ) {
      throw new Error("truth.json contains an invalid or unsafe target");
    }
    seenPaths.add(target.path);
    targets.push({
      path: target.path,
      concerns: [...target.concerns],
    });
  }

  return {
    schema_version: 1,
    targets,
  };
}

export async function readTruth(projectPath: string): Promise<TruthDocument> {
  const path = resolve(projectPath, ".ohno", "truth.json");
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(path, "utf8"));
  } catch {
    throw new Error(`cannot read valid Truth from ${path}`);
  }

  try {
    return parseTruth(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`invalid Truth: ${message}`);
  }
}

export function selectRequiredPaths(
  truth: TruthDocument,
  requestedConcerns: string[],
  candidatePaths: string[],
): string[] {
  const knownConcerns = new Set(
    truth.targets.flatMap((target) => target.concerns),
  );
  const requested = new Set(requestedConcerns);
  const requireAll = requested.size === 0
    || [...requested].some((concern) => !knownConcerns.has(concern));
  const ownerRequired = new Set(
    truth.targets
      .filter((target) => (
        requireAll
        || target.concerns.some((concern) => requested.has(concern))
      ))
      .map((target) => target.path),
  );
  const truthPaths = new Set(truth.targets.map((target) => target.path));

  for (const candidate of candidatePaths) {
    if (!truthPaths.has(candidate)) {
      throw new Error(`candidate path ${candidate} is not an Owner Truth target`);
    }
    ownerRequired.add(candidate);
  }

  return truth.targets
    .map((target) => target.path)
    .filter((path) => ownerRequired.has(path));
}
