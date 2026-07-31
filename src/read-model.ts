import { execFile } from "node:child_process";
import { realpath } from "node:fs/promises";
import { promisify } from "node:util";

import { nextActionFromPlan } from "./plan-next.js";
import { digestAllowedFiles } from "./subject-digest.js";
import { readState } from "./state.js";
import type {
  ProjectState,
  TaskContract,
  VerificationReceipt,
} from "./state.js";

const execFileAsync = promisify(execFile);

export type ProofFreshness =
  | "NONE"
  | "FAIL"
  | "UNKNOWN"
  | "FRESH"
  | "STALE"
  | "UNAVAILABLE";

export interface CompletedSummary {
  id: string;
  expected_behavior: string;
}

export interface CurrentTaskSummary {
  id: string;
  expected_behavior: string;
  test_command: string;
}

/**
 * Projection of plan progress for humans, Cockpit, and managed AGENTS blocks.
 * Not a second authority — always derived from `.ohno/state.json`.
 */
export type PlanBoardPhase =
  | "DONE"
  | "ACTIVE"
  | "HALF"
  | "READY"
  | "QUEUED"
  | "OUTLINE";

export interface PlanBoardEntry {
  index: number;
  id: string;
  title: string;
  phase: PlanBoardPhase;
  kind: "FROZEN" | "OUTLINE";
}

export interface ReadModel {
  schema_version: 2;
  availability: "AVAILABLE" | "UNAVAILABLE";
  goal: string | null;
  status: ProjectState["status"] | "UNAVAILABLE";
  plan_revision: string | null;
  cursor: number;
  task_count: number;
  completed_count: number;
  completed: CompletedSummary[];
  current_task: CurrentTaskSummary | null;
  plan_board: PlanBoardEntry[];
  proof_freshness: ProofFreshness;
  blocker:
    | "NONE"
    | "EXACT_TEST_FAILED"
    | "VERIFICATION_UNKNOWN"
    | "STALE_PASS"
    | "DOCUMENT_SYNC_PENDING"
    | "STATE_UNAVAILABLE";
  next_action: string;
  truth_target_count: number;
  truth_targets: string[];
  document_sync_status: "CLEAN" | "PENDING_REVIEW" | "UNAVAILABLE";
  handoff: {
    path: string;
    branch: string | null;
    head: string | null;
    dirty: boolean;
  };
}

const completedSummaryLimit = 3;
const completedBehaviorByteLimit = 256;

function truncateUtf8(value: string, byteLimit: number): string {
  if (Buffer.byteLength(value, "utf8") <= byteLimit) {
    return value;
  }
  const suffix = "…";
  const contentLimit = byteLimit - Buffer.byteLength(suffix, "utf8");
  let result = "";
  for (const character of value) {
    if (Buffer.byteLength(result + character, "utf8") > contentLimit) {
      break;
    }
    result += character;
  }
  return `${result}${suffix}`;
}

function completedSummaries(
  completed: TaskContract[],
): CompletedSummary[] {
  return completed
    .slice(-completedSummaryLimit)
    .map((task) => ({
      id: task.id,
      expected_behavior: truncateUtf8(
        task.expected_behavior,
        completedBehaviorByteLimit,
      ),
    }));
}

function currentTaskSummary(
  task: TaskContract | null,
): CurrentTaskSummary | null {
  return task === null
    ? null
    : {
      id: task.id,
      expected_behavior: task.expected_behavior,
      test_command: task.test_command,
    };
}

function receiptMatchesTask(
  receipt: VerificationReceipt,
  task: TaskContract,
): boolean {
  return receipt.command === task.test_command
    && receipt.contract_digest === task.contract_digest
    && receipt.plan_revision === task.plan_revision;
}

async function completedProofFreshness(
  projectPath: string,
  state: ProjectState,
): Promise<"FRESH" | "STALE" | "NONE"> {
  const task = state.completed.at(-1);
  const receipt = state.last_verification;
  if (task === undefined || receipt === null) {
    return "NONE";
  }
  if (
    receipt.result !== "PASS"
    || !receiptMatchesTask(receipt, task)
    || receipt.plan_revision !== state.plan_revision
    || receipt.subject_digest === null
  ) {
    return "STALE";
  }
  try {
    const subjectDigest = await digestAllowedFiles(
      projectPath,
      task.allowed_files,
    );
    return subjectDigest === receipt.subject_digest ? "FRESH" : "STALE";
  } catch {
    return "STALE";
  }
}

async function proofFreshness(
  projectPath: string,
  state: ProjectState,
): Promise<ProofFreshness> {
  const task = state.active_task;
  if (task !== null) {
    const receipt = state.last_verification;
    if (receipt === null || !receiptMatchesTask(receipt, task)) {
      return "NONE";
    }
    return receipt.result === "PASS" ? "STALE" : receipt.result;
  }
  return completedProofFreshness(projectPath, state);
}

function blockerFor(
  state: ProjectState,
  freshness: ProofFreshness,
): ReadModel["blocker"] {
  if (state.document_sync.status === "PENDING_REVIEW") {
    return "DOCUMENT_SYNC_PENDING";
  }
  if (freshness === "FAIL") {
    return "EXACT_TEST_FAILED";
  }
  if (freshness === "UNKNOWN") {
    return "VERIFICATION_UNKNOWN";
  }
  if (freshness === "STALE") {
    return "STALE_PASS";
  }
  return "NONE";
}

function nextActionFor(
  state: ProjectState,
  freshness: ProofFreshness,
): string {
  if (
    freshness === "FAIL"
    || freshness === "UNKNOWN"
    || freshness === "STALE"
  ) {
    return "NONE";
  }
  return nextActionFromPlan(state);
}

function planBoardFor(
  state: ProjectState,
  freshness: ProofFreshness,
): PlanBoardEntry[] {
  return state.ordered_tasks.map((task, index) => {
    const kind = task.status === "OUTLINE" ? "OUTLINE" : "FROZEN";
    let phase: PlanBoardPhase;
    if (index < state.cursor) {
      phase = "DONE";
    } else if (index > state.cursor) {
      phase = task.status === "OUTLINE" ? "OUTLINE" : "QUEUED";
    } else if (state.active_task?.id === task.id) {
      phase = freshness === "FAIL"
          || freshness === "UNKNOWN"
          || freshness === "STALE"
        ? "HALF"
        : "ACTIVE";
    } else if (task.status === "OUTLINE") {
      phase = "OUTLINE";
    } else {
      phase = "READY";
    }
    return {
      index,
      id: task.id,
      title: task.title,
      phase,
      kind,
    };
  });
}

async function handoffIdentity(projectPath: string): Promise<ReadModel["handoff"]> {
  const resolvedPath = await realpath(projectPath).catch(() => projectPath);
  const base = {
    path: resolvedPath,
    branch: null as string | null,
    head: null as string | null,
    dirty: false,
  };
  try {
    const [branch, head, dirty] = await Promise.all([
      execFileAsync("git", ["-C", resolvedPath, "branch", "--show-current"], {
        windowsHide: true,
        maxBuffer: 64 * 1024,
      }).then((r) => r.stdout.trim() || null).catch(() => null),
      execFileAsync("git", ["-C", resolvedPath, "rev-parse", "HEAD"], {
        windowsHide: true,
        maxBuffer: 64 * 1024,
      }).then((r) => r.stdout.trim() || null).catch(async () => {
        // Unborn repository: report symbolic HEAD rather than lying about a commit.
        try {
          const symbolic = await execFileAsync(
            "git",
            ["-C", resolvedPath, "rev-parse", "--symbolic-full-name", "HEAD"],
            { windowsHide: true, maxBuffer: 64 * 1024 },
          );
          return symbolic.stdout.trim() || "UNBORN";
        } catch {
          return "UNBORN";
        }
      }),
      execFileAsync(
        "git",
        ["-C", resolvedPath, "status", "--porcelain"],
        { windowsHide: true, maxBuffer: 1024 * 1024 },
      ).then((r) => r.stdout.trim().length > 0).catch(() => false),
    ]);
    return {
      path: resolvedPath,
      branch,
      head,
      dirty: Boolean(dirty),
    };
  } catch {
    return base;
  }
}

function unavailableReadModel(projectPath = "."): ReadModel {
  return {
    schema_version: 2,
    availability: "UNAVAILABLE",
    goal: null,
    status: "UNAVAILABLE",
    plan_revision: null,
    cursor: 0,
    task_count: 0,
    completed_count: 0,
    completed: [],
    current_task: null,
    plan_board: [],
    proof_freshness: "UNAVAILABLE",
    blocker: "STATE_UNAVAILABLE",
    next_action: "NONE",
    truth_target_count: 0,
    truth_targets: [],
    document_sync_status: "UNAVAILABLE",
    handoff: {
      path: projectPath,
      branch: null,
      head: null,
      dirty: false,
    },
  };
}

export async function readModel(projectPath: string): Promise<ReadModel> {
  let state: ProjectState;
  try {
    state = await readState(projectPath);
  } catch {
    return unavailableReadModel(projectPath);
  }
  const freshness = await proofFreshness(projectPath, state);
  const truthTargets = state.truth_inventory.classification
    .filter((entry) => entry.truth_target)
    .map((entry) => entry.path)
    .toSorted();
  const handoff = await handoffIdentity(projectPath);
  return {
    schema_version: 2,
    availability: "AVAILABLE",
    goal: state.goal,
    status: state.status,
    plan_revision: state.plan_revision,
    cursor: state.cursor,
    task_count: state.ordered_tasks.length,
    completed_count: state.completed.length,
    completed: completedSummaries(state.completed),
    current_task: currentTaskSummary(state.active_task),
    plan_board: planBoardFor(state, freshness),
    proof_freshness: freshness,
    blocker: blockerFor(state, freshness),
    next_action: nextActionFor(state, freshness),
    truth_target_count: truthTargets.length,
    truth_targets: truthTargets,
    document_sync_status: state.document_sync.status,
    handoff,
  };
}
