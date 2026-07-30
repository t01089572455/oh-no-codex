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
  status: "IDLE" | "ACTIVE";
  active_task: TaskContract | null;
  last_verification: VerificationReceipt | null;
  completed: TaskContract[];
  document_sync: {
    status: "CLEAN";
    change_id: null;
    required_paths: [];
    reviewed_diff_digest: null;
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
    !isNonBlankString(id)
    || !isNonBlankString(expectedBehavior)
    || !isNonBlankString(testCommand)
    || !isNonBlankString(stopCondition)
    || !Array.isArray(allowedFiles)
    || allowedFiles.length === 0
    || !allowedFiles.every(isNonBlankString)
    || !Number.isSafeInteger(timeBudgetMinutes)
    || (timeBudgetMinutes as number) <= 0
    || !isNonBlankString(nextAction)
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
    || !isNonBlankString(value.finished_at)
    || Number.isNaN(Date.parse(value.finished_at))
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
  return isRecord(value)
    && hasExactKeys(value, [
      "status",
      "change_id",
      "required_paths",
      "reviewed_diff_digest",
    ])
    && value.status === "CLEAN"
    && value.change_id === null
    && Array.isArray(value.required_paths)
    && value.required_paths.length === 0
    && value.reviewed_diff_digest === null;
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
    || !isNonBlankString(value.goal)
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
    return isTaskContract(value.active_task);
  }
  if (value.status !== "IDLE" || value.active_task !== null) {
    return false;
  }
  if (value.completed.length === 0) {
    return value.last_verification === null;
  }
  return value.last_verification?.result === "PASS";
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
