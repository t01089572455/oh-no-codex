import {
  access,
  lstat,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
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

/**
 * High-risk entry paths considered for default Truth seeding when present.
 * Only paths that exist on disk are written (fail-closed targets).
 */
export const defaultTruthCandidates: readonly TruthTarget[] = [
  {
    path: "AGENTS.md",
    concerns: ["agent-instructions", "workflow"],
  },
  {
    path: "README.md",
    concerns: ["public-capability"],
  },
  {
    path: "README.zh-CN.md",
    concerns: ["public-capability"],
  },
  {
    path: "PRODUCT-CONTRACT.md",
    concerns: ["requirements", "contract"],
  },
  {
    path: "DESIGN.md",
    concerns: ["requirements", "design"],
  },
  {
    path: "ACCEPTANCE.md",
    concerns: ["requirements", "acceptance"],
  },
  {
    path: "PLAN.md",
    concerns: ["requirements", "plan"],
  },
  {
    path: "docs/PRODUCT-CONTRACT.md",
    concerns: ["requirements", "contract"],
  },
  {
    path: "docs/DESIGN.md",
    concerns: ["requirements", "design"],
  },
  {
    path: "docs/ACCEPTANCE.md",
    concerns: ["requirements", "acceptance"],
  },
  {
    path: "docs/IMPLEMENTATION-PLAN.md",
    concerns: ["requirements", "plan"],
  },
  {
    path: "docs/PLAN.md",
    concerns: ["requirements", "plan"],
  },
  {
    path: "docs/PRODUCT.md",
    concerns: ["requirements"],
  },
  {
    path: ".ohno/REQUIREMENTS.md",
    concerns: ["owner-requirements"],
  },
  {
    path: ".ohno/acceptance-basis.json",
    concerns: ["acceptance-basis", "black-box"],
  },
];

async function pathExistsAsFile(
  projectPath: string,
  relativePath: string,
): Promise<boolean> {
  try {
    const stats = await lstat(resolve(projectPath, ...relativePath.split("/")));
    return stats.isFile() || stats.isSymbolicLink();
  } catch {
    return false;
  }
}

/**
 * Default Truth from present high-risk paths so init is not a zero-target
 * dead end and change-sync has more than AGENTS alone. Owner may expand.
 */
export async function buildDefaultInitTruthDocument(
  projectPath: string,
): Promise<TruthDocument> {
  const targets: TruthTarget[] = [];
  for (const candidate of defaultTruthCandidates) {
    if (await pathExistsAsFile(projectPath, candidate.path)) {
      targets.push({
        path: candidate.path,
        concerns: [...candidate.concerns],
      });
    }
  }
  if (targets.length === 0) {
    // AGENTS shell is created before seed; still fail closed with one target.
    targets.push({
      path: "AGENTS.md",
      concerns: ["agent-instructions", "workflow"],
    });
  }
  return {
    schema_version: 1,
    targets,
  };
}

/** Seed empty structured acceptance basis so Truth can list it at init. */
export async function ensureEmptyAcceptanceBasisTemplate(
  projectPath: string,
): Promise<void> {
  const path = resolve(projectPath, ".ohno", "acceptance-basis.json");
  try {
    await access(path);
    return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
  await mkdir(resolve(projectPath, ".ohno"), { recursive: true });
  await writeFile(
    path,
    `${JSON.stringify({
      schema_version: 1,
      tasks: [],
    }, null, 2)}\n`,
    "utf8",
  );
}

const defaultAcceptanceBasisTarget: TruthTarget = {
  path: ".ohno/acceptance-basis.json",
  concerns: ["acceptance-basis", "black-box"],
};

/**
 * Ensure structured acceptance basis path is always a Truth target so plan
 * propose can bind it without test helpers patching inventory mid-change.
 */
export async function ensureAcceptanceBasisTruthTarget(
  projectPath: string,
): Promise<void> {
  await ensureEmptyAcceptanceBasisTemplate(projectPath);
  const path = resolve(projectPath, ".ohno", "truth.json");
  let doc: TruthDocument;
  try {
    doc = await readTruth(projectPath);
  } catch {
    return;
  }
  if (doc.targets.some((t) => t.path === defaultAcceptanceBasisTarget.path)) {
    return;
  }
  const next: TruthDocument = {
    schema_version: 1,
    targets: [...doc.targets, defaultAcceptanceBasisTarget],
  };
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

/** Write `.ohno/truth.json` only when absent. Returns whether a file was created. */
export async function ensureDefaultTruth(
  projectPath: string,
): Promise<boolean> {
  await ensureEmptyAcceptanceBasisTemplate(projectPath);
  const path = resolve(projectPath, ".ohno", "truth.json");
  try {
    await access(path);
    await ensureAcceptanceBasisTruthTarget(projectPath);
    return false;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
  await mkdir(resolve(projectPath, ".ohno"), { recursive: true });
  const doc = await buildDefaultInitTruthDocument(projectPath);
  // Always register structured acceptance basis as a Truth target.
  if (!doc.targets.some((t) => t.path === defaultAcceptanceBasisTarget.path)) {
    doc.targets.push(defaultAcceptanceBasisTarget);
  }
  await writeFile(path, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  return true;
}

/** Runtime/transient Oh No files — not canonical harness assets for Git handoff. */
export const ohnoRuntimeGitignore = [
  "# Oh No: runtime / machine-local (do not commit)",
  "verify.lock",
  "*.lock",
  "cockpit.runtime.json",
  "cockpit-port",
  "*.pid",
  "",
].join("\n");

export async function ensureOhnoRuntimeGitignore(
  projectPath: string,
): Promise<void> {
  const path = resolve(projectPath, ".ohno", ".gitignore");
  try {
    await access(path);
    return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
  await mkdir(resolve(projectPath, ".ohno"), { recursive: true });
  await writeFile(path, ohnoRuntimeGitignore, "utf8");
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
