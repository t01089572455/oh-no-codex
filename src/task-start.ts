import { createHash } from "node:crypto";

import {
  readState,
  writeStateAtomic,
} from "./state.js";
import type {
  ProjectState,
  TaskContract,
} from "./state.js";

const taskFields = [
  ["--id", "id"],
  ["--expect", "expected_behavior"],
  ["--test", "test_command"],
  ["--stop", "stop_condition"],
  ["--files", "allowed_files"],
  ["--minutes", "time_budget_minutes"],
  ["--next", "next_action"],
] as const;

type TaskField = (typeof taskFields)[number][1];
type ParsedTaskFields = Record<TaskField, string>;

function requiredValue(args: string[], flag: string): string {
  const index = args.indexOf(flag);
  const value = index === -1 ? undefined : args[index + 1];

  if (value === undefined || value.startsWith("--") || value.trim() === "") {
    throw new Error(`${flag} is required and cannot be blank`);
  }

  return value.trim();
}

function parseTaskFields(args: string[]): ParsedTaskFields {
  return Object.fromEntries(
    taskFields.map(([flag, field]) => [field, requiredValue(args, flag)]),
  ) as ParsedTaskFields;
}

function createContract(args: string[]): TaskContract {
  const fields = parseTaskFields(args);
  const minutes = Number(fields.time_budget_minutes);
  if (!Number.isSafeInteger(minutes) || minutes <= 0) {
    throw new Error("--minutes must be a positive integer");
  }

  const allowedFiles = fields.allowed_files
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (allowedFiles.length === 0) {
    throw new Error("--files is required and cannot be blank");
  }

  const unsignedContract = {
    id: fields.id,
    expected_behavior: fields.expected_behavior,
    test_command: fields.test_command,
    stop_condition: fields.stop_condition,
    allowed_files: allowedFiles,
    time_budget_minutes: minutes,
    next_action: fields.next_action,
  };
  const contractDigest = createHash("sha256")
    .update(JSON.stringify(unsignedContract))
    .digest("hex");

  return {
    ...unsignedContract,
    contract_digest: contractDigest,
  };
}

export async function startTask(
  projectPath: string,
  args: string[],
): Promise<TaskContract> {
  const contract = createContract(args);
  const state = await readState(projectPath);
  if (state.active_task !== null) {
    throw new Error(`active task ${state.active_task.id} already exists`);
  }

  const nextState: ProjectState = {
    ...state,
    status: "ACTIVE",
    active_task: contract,
  };
  await writeStateAtomic(projectPath, nextState);
  return contract;
}
