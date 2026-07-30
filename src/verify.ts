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

export async function verifyTask(
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
    await recordActiveResult(
      projectPath,
      state,
      receipt(task, "UNKNOWN", head, null, null),
    );
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
  if (
    processResult.timedOut
    || processResult.interrupted
    || processResult.signal !== null
    || processResult.launchError
    || processResult.exitCode === null
  ) {
    await recordActiveResult(
      projectPath,
      state,
      receipt(task, "UNKNOWN", head, subjectDigest, null),
    );
    return {
      result: "UNKNOWN",
      message: "UNKNOWN: exact command timed out, was signaled, or could not run",
    };
  }

  if (processResult.exitCode !== 0) {
    await recordActiveResult(
      projectPath,
      state,
      receipt(task, "FAIL", head, subjectDigest, processResult.exitCode),
    );
    return {
      result: "FAIL",
      message: `FAIL: exact command exited ${processResult.exitCode}`,
    };
  }

  let postState: ProjectState;
  let postHead: string;
  let postSubjectDigest: string;
  try {
    postState = await readState(projectPath);
    postHead = readGitHead(projectPath);
    postSubjectDigest = await digestAllowedFiles(
      projectPath,
      task.allowed_files,
    );
  } catch {
    await recordActiveResult(
      projectPath,
      state,
      receipt(task, "UNKNOWN", head, subjectDigest, null),
    );
    return {
      result: "UNKNOWN",
      message: "UNKNOWN: verification subject became unreadable",
    };
  }

  if (
    postState.status !== "ACTIVE"
    || postState.active_task?.contract_digest !== task.contract_digest
    || postHead !== head
    || postSubjectDigest !== subjectDigest
  ) {
    await recordActiveResult(
      projectPath,
      state,
      receipt(task, "UNKNOWN", head, subjectDigest, null),
    );
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
  await writeStateAtomic(projectPath, {
    ...state,
    status: "IDLE",
    active_task: null,
    last_verification: passReceipt,
    completed: [...state.completed, task],
  });
  return {
    result: "PASS",
    nextAction: task.next_action,
  };
}
