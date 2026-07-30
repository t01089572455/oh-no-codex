import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";

import {
  readState,
  writeStateAtomic,
} from "./state.js";
import type { ProjectState } from "./state.js";
import {
  readTruth,
  selectRequiredPaths,
} from "./truth.js";

interface ParsedOptions {
  candidates: string[];
  concerns: string[];
  summary: string;
}

interface PendingState {
  state: ProjectState;
  sync: Extract<
    ProjectState["document_sync"],
    { status: "PENDING_REVIEW" }
  >;
}

interface DiffSnapshot {
  digest: string;
  exactDiff: Buffer;
  missingPaths: string[];
}

const beginFlags = new Set(["--summary", "--concerns", "--candidates"]);
const acceptFlags = new Set(["--change", "--diff"]);

function parseFlagValues(
  args: string[],
  allowedFlags: ReadonlySet<string>,
): Map<string, string> {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (
      flag === undefined
      || !allowedFlags.has(flag)
      || value === undefined
      || values.has(flag)
    ) {
      throw new Error("invalid or duplicate change command option");
    }
    values.set(flag, value);
  }
  return values;
}

function requiredOption(values: Map<string, string>, flag: string): string {
  const value = values.get(flag);
  if (value === undefined || value.trim() === "") {
    throw new Error(`${flag} is required and cannot be blank`);
  }
  return value.trim();
}

function commaSeparated(value: string | undefined): string[] {
  if (value === undefined) {
    return [];
  }
  return [...new Set(
    value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  )];
}

function parseBeginOptions(args: string[]): ParsedOptions {
  const values = parseFlagValues(args, beginFlags);
  return {
    candidates: commaSeparated(values.get("--candidates")),
    concerns: commaSeparated(values.get("--concerns")),
    summary: requiredOption(values, "--summary"),
  };
}

function requiredPathsDigest(requiredPaths: string[]): string {
  return createHash("sha256")
    .update(JSON.stringify(requiredPaths))
    .digest("hex");
}

function changeIdFor(requiredPaths: string[]): string {
  return `change-${requiredPathsDigest(requiredPaths).slice(0, 16)}-${randomUUID()}`;
}

function assertPendingIdentity(
  changeId: string,
  requiredPaths: string[],
): void {
  const expectedPrefix =
    `change-${requiredPathsDigest(requiredPaths).slice(0, 16)}-`;
  if (!changeId.startsWith(expectedPrefix)) {
    throw new Error("pending state drift: required paths no longer match change id");
  }
}

function pendingState(state: ProjectState): PendingState {
  if (
    state.status !== "BLOCKED_DOC_SYNC"
    || state.active_task !== null
    || state.document_sync.status !== "PENDING_REVIEW"
  ) {
    throw new Error("no pending document sync");
  }
  return {
    state,
    sync: state.document_sync,
  };
}

function gitDiff(projectPath: string, paths: string[]): Buffer {
  const result = spawnSync(
    "git",
    [
      "--no-pager",
      "diff",
      "--no-ext-diff",
      "--no-color",
      "--binary",
      "HEAD",
      "--",
      ...paths,
    ],
    {
      cwd: projectPath,
      encoding: null,
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  if (result.error !== undefined || result.status !== 0) {
    const detail = result.stderr?.toString("utf8").trim();
    throw new Error(
      `cannot read exact required Git diff${detail === "" ? "" : `: ${detail}`}`,
    );
  }
  return result.stdout;
}

function diffSnapshot(
  projectPath: string,
  requiredPaths: string[],
): DiffSnapshot {
  const exactDiff = gitDiff(projectPath, requiredPaths);
  const missingPaths = requiredPaths.filter(
    (path) => gitDiff(projectPath, [path]).length === 0,
  );
  return {
    digest: createHash("sha256").update(exactDiff).digest("hex"),
    exactDiff,
    missingPaths,
  };
}

export async function beginChange(
  projectPath: string,
  args: string[],
): Promise<string> {
  const options = parseBeginOptions(args);
  const state = await readState(projectPath);
  if (state.document_sync.status === "PENDING_REVIEW") {
    throw new Error(
      `document sync ${state.document_sync.change_id} is already pending`,
    );
  }

  const truth = await readTruth(projectPath);
  const requiredPaths = selectRequiredPaths(
    truth,
    options.concerns,
    options.candidates,
  );
  const changeId = changeIdFor(requiredPaths);
  const nextState: ProjectState = {
    ...state,
    status: "BLOCKED_DOC_SYNC",
    active_task: null,
    last_verification: null,
    document_sync: {
      status: "PENDING_REVIEW",
      change_id: changeId,
      required_paths: requiredPaths,
      reviewed_diff_digest: null,
    },
  };
  await writeStateAtomic(projectPath, nextState);
  return [
    `Started ${changeId}`,
    `Required paths: ${requiredPaths.join(", ")}`,
    "Next: SYNC_GOVERNING_DOCUMENTS",
    "",
  ].join("\n");
}

export async function displayChangeDiff(
  projectPath: string,
): Promise<Buffer> {
  const pending = pendingState(await readState(projectPath));
  assertPendingIdentity(
    pending.sync.change_id,
    pending.sync.required_paths,
  );
  const snapshot = diffSnapshot(projectPath, pending.sync.required_paths);
  const nextState: ProjectState = {
    ...pending.state,
    document_sync: {
      ...pending.sync,
      reviewed_diff_digest: snapshot.digest,
    },
  };
  await writeStateAtomic(projectPath, nextState);

  const header = [
    `CHANGE_ID: ${pending.sync.change_id}`,
    `REQUIRED_PATHS_JSON: ${JSON.stringify(pending.sync.required_paths)}`,
    `MISSING_PATHS_JSON: ${JSON.stringify(snapshot.missingPaths)}`,
    `DIFF_DIGEST: ${snapshot.digest}`,
    `EXACT_DIFF_BYTES: ${snapshot.exactDiff.length}`,
    "",
  ].join("\n");
  return Buffer.concat([Buffer.from(header, "utf8"), snapshot.exactDiff]);
}

export async function acceptChange(
  projectPath: string,
  args: string[],
): Promise<string> {
  const values = parseFlagValues(args, acceptFlags);
  const suppliedChangeId = requiredOption(values, "--change");
  const suppliedDigest = requiredOption(values, "--diff");
  const pending = pendingState(await readState(projectPath));

  if (suppliedChangeId !== pending.sync.change_id) {
    throw new Error("--change must match the pending change id");
  }
  assertPendingIdentity(
    pending.sync.change_id,
    pending.sync.required_paths,
  );
  if (
    !/^[a-f0-9]{64}$/u.test(suppliedDigest)
    || suppliedDigest !== pending.sync.reviewed_diff_digest
  ) {
    throw new Error("--diff must match the displayed digest");
  }

  const truth = await readTruth(projectPath);
  const truthTargets = new Map(
    truth.targets.map((target) => [target.path, target]),
  );
  if (
    pending.sync.required_paths.some((path) => !truthTargets.has(path))
  ) {
    throw new Error("pending state drift: required path is no longer in Truth");
  }

  const snapshot = diffSnapshot(projectPath, pending.sync.required_paths);
  if (snapshot.digest !== suppliedDigest) {
    throw new Error("required document diff changed since display");
  }
  const requiredPlanPaths = pending.sync.required_paths.filter(
    (path) => truthTargets.get(path)?.concerns.includes("plan") === true,
  );
  if (requiredPlanPaths.length === 0) {
    throw new Error("replacement plan target is missing from the required set");
  }
  const missingPlans: string[] = [];
  for (const path of requiredPlanPaths) {
    try {
      if (!(await stat(resolve(projectPath, path))).isFile()) {
        missingPlans.push(path);
      }
    } catch {
      missingPlans.push(path);
    }
  }
  missingPlans.push(
    ...requiredPlanPaths.filter(
      (path) => (
        snapshot.missingPaths.includes(path)
        && !missingPlans.includes(path)
      ),
    ),
  );
  if (missingPlans.length > 0) {
    throw new Error(
      `replacement plan is missing for ${missingPlans.join(", ")}`,
    );
  }
  if (snapshot.missingPaths.length > 0) {
    throw new Error(
      `missing required document coverage: ${snapshot.missingPaths.join(", ")}`,
    );
  }

  const currentState = await readState(projectPath);
  if (JSON.stringify(currentState) !== JSON.stringify(pending.state)) {
    throw new Error("pending state drifted during acceptance");
  }

  const cleanState: ProjectState = {
    ...pending.state,
    status: "IDLE",
    active_task: null,
    last_verification: null,
    document_sync: {
      status: "CLEAN",
      change_id: null,
      required_paths: [],
      reviewed_diff_digest: null,
    },
  };
  await writeStateAtomic(projectPath, cleanState);
  return `Accepted ${pending.sync.change_id}: LOCAL_OWNER_CONFIRMATION_ONLY\n`;
}
