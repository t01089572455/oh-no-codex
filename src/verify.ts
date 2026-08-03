import {
  access,
  open,
  rm,
  writeFile,
} from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { isDeepStrictEqual } from "node:util";

import { runExactCommand } from "./process.js";
import {
  isPidLockStale,
  removePathForce,
  tryCreatePidLockFile,
} from "./process-lock.js";
import { assertMigrationNotRequired } from "./migration-guard.js";
import { nextActionFromPlan } from "./plan-next.js";
import {
  digestAllowedFiles,
  readGitHead,
} from "./subject-digest.js";
import {
  compareAndSwapStateAtomic,
  readState,
} from "./state.js";
import type {
  ProjectState,
  TaskContract,
  VerificationReceipt,
} from "./state.js";

export type VerificationOutcome =
  | {
    result: "PASS";
    nextAction: string;
  }
  | {
    result: "FAIL" | "UNKNOWN";
    message: string;
  };

type ReleaseVerificationLock = () => Promise<void>;

async function acquireVerificationLock(
  projectPath: string,
): Promise<ReleaseVerificationLock> {
  const lockPath = resolve(projectPath, ".ohno", "verify.lock");
  // Ensure .ohno exists (init) — ENOENT on parent would otherwise mislead.
  try {
    await access(resolve(projectPath, ".ohno"));
  } catch {
    throw new Error("project is not initialized; run ohno init");
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await tryCreatePidLockFile(lockPath)) {
      return async () => {
        await removePathForce(lockPath);
      };
    }
    if (attempt < 2 && await isPidLockStale(lockPath)) {
      await removePathForce(lockPath);
      continue;
    }
    throw new Error(
      "verification already in progress; wait for it to finish before retrying",
    );
  }
  throw new Error(
    "verification already in progress; wait for it to finish before retrying",
  );
}

function receipt(
  task: TaskContract,
  result: VerificationReceipt["result"],
  head: string | null,
  subjectDigest: string | null,
  exitCode: number | null,
): VerificationReceipt {
  return {
    result,
    command: task.test_command,
    contract_digest: task.contract_digest,
    plan_revision: task.plan_revision,
    head,
    subject_digest: subjectDigest,
    exit_code: exitCode,
    finished_at: new Date().toISOString(),
  };
}

async function readUnchangedState(
  projectPath: string,
  expectedState: ProjectState,
): Promise<ProjectState | null> {
  let currentState: ProjectState;
  try {
    currentState = await readState(projectPath);
  } catch {
    return null;
  }
  return isDeepStrictEqual(currentState, expectedState)
    ? currentState
    : null;
}

async function recordActiveResultIfStateUnchanged(
  projectPath: string,
  expectedState: ProjectState,
  verification: VerificationReceipt,
): Promise<boolean> {
  return compareAndSwapStateAtomic(projectPath, expectedState, {
    ...expectedState,
    status: "ACTIVE",
    active_task: expectedState.active_task,
    last_verification: verification,
  });
}

function stateChangedOutcome(): VerificationOutcome {
  return {
    result: "UNKNOWN",
    message: "UNKNOWN: current state became unreadable or changed",
  };
}

async function pauseBeforePassCasForTest(): Promise<void> {
  if (process.env.NODE_ENV !== "test") {
    return;
  }
  const readyPath = process.env.OHNO_TEST_PASS_CAS_READY;
  const releasePath = process.env.OHNO_TEST_PASS_CAS_RELEASE;
  if (readyPath === undefined || releasePath === undefined) {
    return;
  }

  await writeFile(readyPath, "ready\n", "utf8");
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    try {
      await access(releasePath);
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
    await delay(10);
  }
  throw new Error("test PASS CAS release timed out");
}

async function assertLastPassFresh(
  projectPath: string,
  state: ProjectState,
): Promise<never> {
  const task = state.completed.at(-1);
  const verification = state.last_verification;
  if (task === undefined || verification?.result !== "PASS") {
    throw new Error("no active task to verify");
  }

  let subjectDigest: string;
  try {
    subjectDigest = await digestAllowedFiles(projectPath, task.allowed_files);
  } catch {
    throw new Error("STALE: prior PASS subject can no longer be read");
  }

  if (
    verification.command !== task.test_command
    || verification.contract_digest !== task.contract_digest
    || verification.plan_revision !== task.plan_revision
    || verification.plan_revision !== state.plan_revision
    || verification.subject_digest !== subjectDigest
  ) {
    throw new Error("STALE: prior PASS no longer matches the current subject");
  }

  throw new Error("no active task; the last PASS remains fresh");
}

async function verifyTaskWithLock(
  projectPath: string,
): Promise<VerificationOutcome> {
  const state = await readState(projectPath);
  assertMigrationNotRequired(state);
  const task = state.active_task;
  if (task === null) {
    return assertLastPassFresh(projectPath, state);
  }

  let head: string | null = null;
  let subjectDigest: string | null = null;
  try {
    head = readGitHead(projectPath);
    subjectDigest = await digestAllowedFiles(
      projectPath,
      task.allowed_files,
    );
  } catch {
    const recorded = await recordActiveResultIfStateUnchanged(
      projectPath,
      state,
      receipt(task, "UNKNOWN", head, null, null),
    );
    if (!recorded) {
      return stateChangedOutcome();
    }
    return {
      result: "UNKNOWN",
      message: "UNKNOWN: matched verification subject is unreadable",
    };
  }

  const processResult = await runExactCommand(
    projectPath,
    task.test_command,
    task.time_budget_minutes,
  );
  if (await readUnchangedState(projectPath, state) === null) {
    return stateChangedOutcome();
  }

  if (
    processResult.timedOut
    || processResult.interrupted
    || processResult.signal !== null
    || processResult.launchError
    || processResult.exitCode === null
  ) {
    const recorded = await recordActiveResultIfStateUnchanged(
      projectPath,
      state,
      receipt(task, "UNKNOWN", head, subjectDigest, null),
    );
    if (!recorded) {
      return stateChangedOutcome();
    }
    return {
      result: "UNKNOWN",
      message: "UNKNOWN: exact command timed out, was signaled, or could not run",
    };
  }

  let postHead: string;
  let postSubjectDigest: string;
  try {
    postHead = readGitHead(projectPath);
    postSubjectDigest = await digestAllowedFiles(
      projectPath,
      task.allowed_files,
    );
  } catch {
    const recorded = await recordActiveResultIfStateUnchanged(
      projectPath,
      state,
      receipt(task, "UNKNOWN", head, subjectDigest, null),
    );
    if (!recorded) {
      return stateChangedOutcome();
    }
    return {
      result: "UNKNOWN",
      message: "UNKNOWN: verification subject became unreadable",
    };
  }

  if (
    postHead !== head
    || postSubjectDigest !== subjectDigest
  ) {
    const recorded = await recordActiveResultIfStateUnchanged(
      projectPath,
      state,
      receipt(task, "UNKNOWN", head, subjectDigest, null),
    );
    if (!recorded) {
      return stateChangedOutcome();
    }
    return {
      result: "UNKNOWN",
      message: "UNKNOWN: verification subject changed during the exact command",
    };
  }

  if (processResult.exitCode !== 0) {
    const recorded = await recordActiveResultIfStateUnchanged(
      projectPath,
      state,
      receipt(task, "FAIL", head, subjectDigest, processResult.exitCode),
    );
    if (!recorded) {
      return stateChangedOutcome();
    }
    return {
      result: "FAIL",
      message: `FAIL: exact command exited ${processResult.exitCode}`,
    };
  }

  const passReceipt = receipt(
    task,
    "PASS",
    head,
    subjectDigest,
    0,
  );
  const finalState = await readUnchangedState(projectPath, state);
  if (finalState === null) {
    return stateChangedOutcome();
  }
  // Reopen path (FT-24): task already in completed[] — refresh proof only.
  const alreadyCompleted = finalState.completed.some(
    (entry) => entry.id === task.id && entry.plan_revision === task.plan_revision,
  );
  const completedState: ProjectState = alreadyCompleted
    ? {
      ...finalState,
      status: "IDLE",
      active_task: null,
      last_verification: passReceipt,
      completed: finalState.completed.map((entry) =>
        entry.id === task.id && entry.plan_revision === task.plan_revision
          ? task
          : entry
      ),
    }
    : {
      ...finalState,
      status: "IDLE",
      active_task: null,
      last_verification: passReceipt,
      completed: [...finalState.completed, task],
      cursor: finalState.cursor + 1,
    };
  await pauseBeforePassCasForTest();
  if (
    !await compareAndSwapStateAtomic(
      projectPath,
      finalState,
      completedState,
    )
  ) {
    return stateChangedOutcome();
  }
  return {
    result: "PASS",
    nextAction: nextActionFromPlan(completedState),
  };
}

export async function verifyTask(
  projectPath: string,
): Promise<VerificationOutcome> {
  const releaseLock = await acquireVerificationLock(projectPath);
  try {
    return await verifyTaskWithLock(projectPath);
  } finally {
    await releaseLock();
  }
}
