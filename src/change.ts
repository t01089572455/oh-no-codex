import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";

import {
  compareAndSwapStateAtomic,
  readState,
} from "./state.js";
import type { ProjectState } from "./state.js";
import { refreshTruthAtChangeBegin } from "./truth-inventory.js";
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

function pendingAuthorityDigest(
  state: ProjectState,
  nonce: string,
): string {
  // Bind the non-display current authority that must not drift while a change
  // is open. Live plan replacement fields stay mutable so a reviewed
  // replacement plan can be proposed during PENDING_REVIEW; base plan identity
  // is captured once in document_sync at begin.
  return createHash("sha256")
    .update(JSON.stringify({
      schema_version: state.schema_version,
      goal: state.goal,
      status: state.status,
      truth_inventory: state.truth_inventory,
      active_task: state.active_task,
      last_verification: state.last_verification,
      completed: state.completed,
      document_sync: state.document_sync.status === "PENDING_REVIEW"
        ? {
          status: state.document_sync.status,
          required_paths: state.document_sync.required_paths,
          base_plan_revision: state.document_sync.base_plan_revision,
          base_cursor: state.document_sync.base_cursor,
          summary: state.document_sync.summary,
          started_at: state.document_sync.started_at,
        }
        : {
          status: state.document_sync.status,
          required_paths: state.document_sync.required_paths,
        },
      nonce,
    }))
    .digest("hex");
}

function changeIdFor(state: ProjectState): string {
  const nonce = randomUUID();
  return `change-${pendingAuthorityDigest(state, nonce).slice(0, 16)}-${nonce}`;
}

function assertPendingIdentity(
  changeId: string,
  state: ProjectState,
): void {
  const match = /^change-([a-f0-9]{16})-([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/u
    .exec(changeId);
  if (
    match === null
    || match[1] !== pendingAuthorityDigest(state, match[2] as string)
      .slice(0, 16)
  ) {
    throw new Error("pending state drift: current authority no longer matches change id");
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
    assertPendingIdentity(state.document_sync.change_id, state);
    throw new Error(
      `document sync ${state.document_sync.change_id} is already pending`,
    );
  }

  const truthInventory = await refreshTruthAtChangeBegin(
    projectPath,
    state.truth_inventory,
  );
  const stateWithInventory: ProjectState = {
    ...state,
    truth_inventory: truthInventory,
  };
  const truth = await readTruth(projectPath);
  const requiredPaths = selectRequiredPaths(
    truth,
    options.concerns,
    options.candidates,
  );
  const selectedPlanPaths = truth.targets
    .filter((target) => (
      target.concerns.includes("plan")
      && requiredPaths.includes(target.path)
    ))
    .map((target) => target.path);
  if (selectedPlanPaths.length === 0) {
    const example = truth.targets.find(
      (target) => target.concerns.includes("plan"),
    )?.path;
    throw new Error(
      "replacement plan is required; rerun with "
      + `--candidates <plan Truth path>${example === undefined ? "" : ` such as ${example}`}`,
    );
  }

  const startedAt = new Date().toISOString();
  const pendingStateWithoutIdentity: ProjectState = {
    ...stateWithInventory,
    status: "BLOCKED_DOC_SYNC",
    active_task: null,
    last_verification: null,
    document_sync: {
      status: "PENDING_REVIEW",
      change_id: "pending-identity",
      required_paths: requiredPaths,
      reviewed_diff_digest: null,
      base_plan_revision: state.plan_revision,
      base_cursor: state.cursor,
      summary: options.summary,
      started_at: startedAt,
    },
  };
  const changeId = changeIdFor(pendingStateWithoutIdentity);
  const nextState: ProjectState = {
    ...pendingStateWithoutIdentity,
    document_sync: {
      status: "PENDING_REVIEW",
      change_id: changeId,
      required_paths: requiredPaths,
      reviewed_diff_digest: null,
      base_plan_revision: state.plan_revision,
      base_cursor: state.cursor,
      summary: options.summary,
      started_at: startedAt,
    },
  };
  assertPendingIdentity(changeId, nextState);
  if (!await compareAndSwapStateAtomic(projectPath, state, nextState)) {
    throw new Error("current state changed while beginning document sync");
  }
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
    pending.state,
  );
  const snapshot = diffSnapshot(projectPath, pending.sync.required_paths);
  const nextState: ProjectState = {
    ...pending.state,
    document_sync: {
      ...pending.sync,
      reviewed_diff_digest: snapshot.digest,
    },
  };
  if (
    !await compareAndSwapStateAtomic(
      projectPath,
      pending.state,
      nextState,
    )
  ) {
    throw new Error("pending state drifted while recording the exact diff");
  }

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
    pending.state,
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
  if (
    pending.state.pending_plan !== null
    || pending.state.plan_revision === null
    || pending.state.plan_review === null
    || pending.state.plan_review.plan_revision
      !== pending.state.plan_revision
    || pending.state.plan_revision === pending.sync.base_plan_revision
    || Date.parse(pending.state.plan_review.recorded_at)
      < Date.parse(pending.sync.started_at)
  ) {
    throw new Error(
      "replacement locally reviewed plan revision is required before acceptance",
    );
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

  const finalSnapshot = diffSnapshot(
    projectPath,
    pending.sync.required_paths,
  );
  if (
    finalSnapshot.digest !== suppliedDigest
    || finalSnapshot.missingPaths.length > 0
  ) {
    throw new Error("required document diff changed since display");
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
  if (
    !await compareAndSwapStateAtomic(
      projectPath,
      pending.state,
      cleanState,
    )
  ) {
    throw new Error("pending state drifted during acceptance");
  }
  return `Accepted ${pending.sync.change_id}: LOCAL_REVIEW_RECORDED\n`;
}
