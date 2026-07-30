import {
  digestAllowedFiles,
  readGitHead,
} from "./subject-digest.js";
import { readState } from "./state.js";
import type {
  ProjectState,
  TaskContract,
  VerificationReceipt,
} from "./state.js";

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

export interface ReadModel {
  schema_version: 1;
  availability: "AVAILABLE" | "UNAVAILABLE";
  goal: string | null;
  status: ProjectState["status"] | "UNAVAILABLE";
  completed_count: number;
  completed: CompletedSummary[];
  current_task: CurrentTaskSummary | null;
  proof_freshness: ProofFreshness;
  blocker:
    | "NONE"
    | "EXACT_TEST_FAILED"
    | "VERIFICATION_UNKNOWN"
    | "STALE_PASS"
    | "DOCUMENT_SYNC_PENDING"
    | "STATE_UNAVAILABLE";
  next_action: string;
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
    && receipt.contract_digest === task.contract_digest;
}

async function completedProofFreshness(
  projectPath: string,
  state: ProjectState,
): Promise<"FRESH" | "STALE" | "NONE"> {
  const task = state.completed.at(-1);
  const receipt = state.last_verification;
  if (task === undefined) {
    return "NONE";
  }
  if (
    receipt?.result !== "PASS"
    || !receiptMatchesTask(receipt, task)
    || receipt.head === null
    || receipt.subject_digest === null
  ) {
    return "STALE";
  }

  try {
    const [head, subjectDigest] = await Promise.all([
      Promise.resolve(readGitHead(projectPath)),
      digestAllowedFiles(projectPath, task.allowed_files),
    ]);
    return head === receipt.head && subjectDigest === receipt.subject_digest
      ? "FRESH"
      : "STALE";
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
    if (receipt === null) {
      return "NONE";
    }
    if (!receiptMatchesTask(receipt, task)) {
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
  if (state.document_sync.status === "PENDING_REVIEW") {
    return "SYNC_GOVERNING_DOCUMENTS";
  }
  if (state.active_task !== null || freshness !== "FRESH") {
    return "NONE";
  }
  return state.completed.at(-1)?.next_action ?? "NONE";
}

function unavailableReadModel(): ReadModel {
  return {
    schema_version: 1,
    availability: "UNAVAILABLE",
    goal: null,
    status: "UNAVAILABLE",
    completed_count: 0,
    completed: [],
    current_task: null,
    proof_freshness: "UNAVAILABLE",
    blocker: "STATE_UNAVAILABLE",
    next_action: "NONE",
  };
}

export async function readModel(projectPath: string): Promise<ReadModel> {
  let state: ProjectState;
  try {
    state = await readState(projectPath);
  } catch {
    return unavailableReadModel();
  }

  const freshness = await proofFreshness(projectPath, state);
  return {
    schema_version: 1,
    availability: "AVAILABLE",
    goal: state.goal,
    status: state.status,
    completed_count: state.completed.length,
    completed: completedSummaries(state.completed),
    current_task: currentTaskSummary(state.active_task),
    proof_freshness: freshness,
    blocker: blockerFor(state, freshness),
    next_action: nextActionFor(state, freshness),
  };
}
