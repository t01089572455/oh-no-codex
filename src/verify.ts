import {
  open,
  rm,
} from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";

import { runExactCommand } from "./process.js";
import {
  digestAllowedFiles,
  readGitHead,
} from "./subject-digest.js";
import {
  readState,
  writeStateAtomic,
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
  let handle: FileHandle;
  try {
    handle = await open(lockPath, "wx", 0o600);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EEXIST") {
      throw new Error(
        "verification already in progress; wait for it to finish before retrying",
      );
    }
    if (code === "ENOENT") {
      throw new Error("project is not initialized; run ohno init --goal <goal>");
    }
    throw error;
  }

  try {
    await handle.writeFile(`${process.pid}\n`, "utf8");
    await handle.sync();
  } catch (error) {
    await handle.close().catch(() => undefined);
    await rm(lockPath, { force: true }).catch(() => undefined);
    throw error;
  }

  return async () => {
    try {
      await handle.close();
    } finally {
      await rm(lockPath, { force: true });
    }
  };
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
    head,
    subject_digest: subjectDigest,
    exit_code: exitCode,
    finished_at: new Date().toISOString(),
  };
}

async function recordActiveResult(
  projectPath: string,
  state: ProjectState,
  verification: VerificationReceipt,
): Promise<void> {
  await writeStateAtomic(projectPath, {
    ...state,
    status: "ACTIVE",
    active_task: state.active_task,
    last_verification: verification,
  });
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
  const currentState = await readUnchangedState(projectPath, expectedState);
  if (currentState === null) {
    return false;
  }
  await recordActiveResult(projectPath, currentState, verification);
  return true;
}

function stateChangedOutcome(): VerificationOutcome {
  return {
    result: "UNKNOWN",
    message: "UNKNOWN: current state became unreadable or changed",
  };
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

  let head: string;
  let subjectDigest: string;
  try {
    head = readGitHead(projectPath);
    subjectDigest = await digestAllowedFiles(projectPath, task.allowed_files);
  } catch {
    throw new Error("STALE: prior PASS subject can no longer be read");
  }

  if (
    verification.command !== task.test_command
    || verification.contract_digest !== task.contract_digest
    || verification.head !== head
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
  await writeStateAtomic(projectPath, {
    ...finalState,
    status: "IDLE",
    active_task: null,
    last_verification: passReceipt,
    completed: [...finalState.completed, task],
  });
  return {
    result: "PASS",
    nextAction: task.next_action,
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
