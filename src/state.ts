import { randomUUID } from "node:crypto";
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

export interface ProjectState {
  schema_version: 1;
  goal: string;
  status: "IDLE" | "ACTIVE";
  active_task: TaskContract | null;
  last_verification: null;
  completed: [];
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

  if (
    typeof parsed !== "object"
    || parsed === null
    || !("schema_version" in parsed)
    || parsed.schema_version !== 1
    || !("goal" in parsed)
    || typeof parsed.goal !== "string"
    || !("active_task" in parsed)
  ) {
    throw new Error(`unsupported or invalid state in ${path}`);
  }

  return parsed as ProjectState;
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
