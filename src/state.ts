import { createHash, randomUUID } from "node:crypto";
import {
  access,
  mkdir,
  open,
  readFile,
  rename,
  rm,
} from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { resolve } from "node:path";

// Worst active projection: 256 goal + 96 id + 512 expectation + 1,024 test
// + three (96 id + 256 expectation) summaries = 2,944 UTF-8 bytes. This leaves
// 1,152 bytes for labels, separators, counts, and fixed values below 4 KiB.
// A completed projection substitutes a <=256-byte next action for no task.
export const displayFieldByteLimits = Object.freeze({
  goal: 256,
  taskId: 96,
  expectedBehavior: 512,
  testCommand: 1_024,
  nextAction: 256,
});

export type DisplayTextIssue = "LINE_BREAK" | "TOO_LARGE";

export function displayTextIssue(
  value: string,
  byteLimit: number,
): DisplayTextIssue | null {
  if (/[\r\n]/u.test(value)) {
    return "LINE_BREAK";
  }
  return Buffer.byteLength(value, "utf8") > byteLimit
    ? "TOO_LARGE"
    : null;
}

export interface TaskContract {
  id: string;
  expected_behavior: string;
  test_command: string;
  stop_condition: string;
  allowed_files: string[];
  time_budget_minutes: number;
  next_action: string;
  contract_digest: string;
}

export interface VerificationReceipt {
  result: "PASS" | "FAIL" | "UNKNOWN";
  command: string;
  contract_digest: string;
  head: string | null;
  subject_digest: string | null;
  exit_code: number | null;
  finished_at: string;
}

export interface ProjectState {
  schema_version: 1;
  goal: string;
  status: "IDLE" | "ACTIVE" | "BLOCKED_DOC_SYNC";
  active_task: TaskContract | null;
  last_verification: VerificationReceipt | null;
  completed: TaskContract[];
  document_sync:
    | {
      status: "CLEAN";
      change_id: null;
      required_paths: [];
      reviewed_diff_digest: null;
    }
    | {
      status: "PENDING_REVIEW";
      change_id: string;
      required_paths: string[];
      reviewed_diff_digest: string | null;
    };
}

function stateDirectory(projectPath: string): string {
  return resolve(projectPath, ".ohno");
}

function statePath(projectPath: string): string {
  return resolve(stateDirectory(projectPath), "state.json");
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

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isBoundedDisplayString(
  value: unknown,
  byteLimit: number,
): value is string {
  return isNonBlankString(value)
    && displayTextIssue(value, byteLimit) === null;
}

function isTaskContract(value: unknown): value is TaskContract {
  if (
    !isRecord(value)
    || !hasExactKeys(value, [
      "id",
      "expected_behavior",
      "test_command",
      "stop_condition",
      "allowed_files",
      "time_budget_minutes",
      "next_action",
      "contract_digest",
    ])
  ) {
    return false;
  }

  const {
    id,
    expected_behavior: expectedBehavior,
    test_command: testCommand,
    stop_condition: stopCondition,
    allowed_files: allowedFiles,
    time_budget_minutes: timeBudgetMinutes,
    next_action: nextAction,
    contract_digest: contractDigest,
  } = value;
  if (
    !isBoundedDisplayString(id, displayFieldByteLimits.taskId)
    || !isBoundedDisplayString(
      expectedBehavior,
      displayFieldByteLimits.expectedBehavior,
    )
    || !isBoundedDisplayString(
      testCommand,
      displayFieldByteLimits.testCommand,
    )
    || !isNonBlankString(stopCondition)
    || !Array.isArray(allowedFiles)
    || allowedFiles.length === 0
    || !allowedFiles.every(isNonBlankString)
    || !Number.isSafeInteger(timeBudgetMinutes)
    || (timeBudgetMinutes as number) <= 0
    || !isBoundedDisplayString(
      nextAction,
      displayFieldByteLimits.nextAction,
    )
    || typeof contractDigest !== "string"
    || !/^[a-f0-9]{64}$/.test(contractDigest)
  ) {
    return false;
  }

  const expectedDigest = createHash("sha256")
    .update(JSON.stringify({
      id,
      expected_behavior: expectedBehavior,
      test_command: testCommand,
      stop_condition: stopCondition,
      allowed_files: allowedFiles,
      time_budget_minutes: timeBudgetMinutes,
      next_action: nextAction,
    }))
    .digest("hex");
  return contractDigest === expectedDigest;
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isRfc3339Timestamp(value: unknown): value is string {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && !Number.isNaN(Date.parse(value));
}

function isVerificationReceipt(
  value: unknown,
): value is VerificationReceipt {
  if (
    !isRecord(value)
    || !hasExactKeys(value, [
      "result",
      "command",
      "contract_digest",
      "head",
      "subject_digest",
      "exit_code",
      "finished_at",
    ])
    || !["PASS", "FAIL", "UNKNOWN"].includes(String(value.result))
    || !isNonBlankString(value.command)
    || !isSha256(value.contract_digest)
    || !(
      value.head === null
      || value.head === "UNBORN"
      || (typeof value.head === "string" && /^[a-f0-9]{40,64}$/.test(value.head))
    )
    || !(value.subject_digest === null || isSha256(value.subject_digest))
    || !isRfc3339Timestamp(value.finished_at)
  ) {
    return false;
  }

  if (value.result === "PASS") {
    return value.head !== null
      && value.subject_digest !== null
      && value.exit_code === 0;
  }
  if (value.result === "FAIL") {
    return value.head !== null
      && value.subject_digest !== null
      && Number.isSafeInteger(value.exit_code)
      && (value.exit_code as number) !== 0;
  }
  return value.exit_code === null;
}

function isDocumentSync(
  value: unknown,
): value is ProjectState["document_sync"] {
  if (
    !isRecord(value)
    || !hasExactKeys(value, [
      "status",
      "change_id",
      "required_paths",
      "reviewed_diff_digest",
    ])
    || !Array.isArray(value.required_paths)
  ) {
    return false;
  }

  if (value.status === "CLEAN") {
    return value.change_id === null
      && value.required_paths.length === 0
      && value.reviewed_diff_digest === null;
  }

  return value.status === "PENDING_REVIEW"
    && isNonBlankString(value.change_id)
    && value.required_paths.length > 0
    && value.required_paths.every(isNonBlankString)
    && (
      value.reviewed_diff_digest === null
      || isSha256(value.reviewed_diff_digest)
    );
}

function isProjectState(value: unknown): value is ProjectState {
  if (
    !isRecord(value)
    || !hasExactKeys(value, [
      "schema_version",
      "goal",
      "status",
      "active_task",
      "last_verification",
      "completed",
      "document_sync",
    ])
    || value.schema_version !== 1
    || !isBoundedDisplayString(value.goal, displayFieldByteLimits.goal)
    || !(
      value.last_verification === null
      || isVerificationReceipt(value.last_verification)
    )
    || !Array.isArray(value.completed)
    || !value.completed.every(isTaskContract)
    || !isDocumentSync(value.document_sync)
  ) {
    return false;
  }

  if (value.status === "ACTIVE") {
    return isTaskContract(value.active_task)
      && value.document_sync.status === "CLEAN";
  }
  if (value.status === "BLOCKED_DOC_SYNC") {
    return value.active_task === null
      && value.document_sync.status === "PENDING_REVIEW";
  }
  if (
    value.status !== "IDLE"
    || value.active_task !== null
    || value.document_sync.status !== "CLEAN"
  ) {
    return false;
  }
  if (value.last_verification === null) {
    return true;
  }
  return value.completed.length > 0
    && value.last_verification.result === "PASS";
}

export function initialState(goal: string): ProjectState {
  return {
    schema_version: 1,
    goal,
    status: "IDLE",
    active_task: null,
    last_verification: null,
    completed: [],
    document_sync: {
      status: "CLEAN",
      change_id: null,
      required_paths: [],
      reviewed_diff_digest: null,
    },
  };
}

export async function stateExists(projectPath: string): Promise<boolean> {
  try {
    await access(statePath(projectPath));
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

export async function readState(projectPath: string): Promise<ProjectState> {
  const path = statePath(projectPath);
  let parsed: unknown;

  try {
    parsed = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error("project is not initialized; run ohno init --goal <goal>");
    }
    throw new Error(`cannot read valid state from ${path}`);
  }

  if (!isProjectState(parsed)) {
    throw new Error(`unsupported or invalid state in ${path}`);
  }

  return parsed;
}

export async function writeStateAtomic(
  projectPath: string,
  state: ProjectState,
): Promise<void> {
  const directory = stateDirectory(projectPath);
  const currentPath = statePath(projectPath);
  const temporaryPath = resolve(
    directory,
    `state.json.${process.pid}.${randomUUID()}.tmp`,
  );
  let handle: FileHandle | undefined;

  await mkdir(directory, { recursive: true });

  try {
    handle = await open(temporaryPath, "wx", 0o600);
    await handle.writeFile(`${JSON.stringify(state, null, 2)}\n`, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporaryPath, currentPath);
  } finally {
    await handle?.close().catch(() => undefined);
    await rm(temporaryPath, { force: true }).catch(() => undefined);
  }
}
