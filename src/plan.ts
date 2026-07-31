import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

import { readGitHead } from "./subject-digest.js";
import {
  compareAndSwapStateAtomic,
  isPlanTask,
  planRevisionFor,
  readState,
} from "./state.js";
import type {
  PendingPlan,
  PlanTask,
  ProjectState,
} from "./state.js";

interface PlanProposalFile {
  cursor: number;
  ordered_tasks: PlanTask[];
}

export interface PlanProposalEvidence {
  planRevision: string;
  diffDigest: string;
  head: string;
  proposedAt: string;
  exactDiff: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length
    && actual.every((key) => keys.includes(key));
}

function safeSourcePath(projectPath: string, input: string): {
  relativePath: string;
  absolutePath: string;
} {
  const absolutePath = resolve(projectPath, input);
  const relativePath = relative(projectPath, absolutePath).replaceAll("\\", "/");
  if (
    relativePath === ""
    || relativePath.startsWith("../")
    || relativePath === ".."
    || /^[A-Za-z]:/u.test(relativePath)
  ) {
    throw new Error("--file must name one project-relative plan proposal");
  }
  return {
    relativePath,
    absolutePath,
  };
}

function normalizeTask(value: unknown): PlanTask {
  if (!isRecord(value)) {
    throw new Error("every ordered task must be one object");
  }
  if (value.status === "OUTLINE") {
    if (!hasExactKeys(value, ["id", "title", "goal", "status"])) {
      throw new Error(
        "OUTLINE tasks contain only stable task id, title, goal, and status",
      );
    }
    const task = {
      id: value.id,
      title: value.title,
      goal: value.goal,
      status: value.status,
    };
    if (!isPlanTask(task)) {
      throw new Error("invalid stable task id, title, or goal");
    }
    return task;
  }
  if (value.status === "FROZEN") {
    if (!hasExactKeys(value, [
      "id",
      "title",
      "goal",
      "status",
      "expected_behavior",
      "test_command",
      "allowed_files",
      "stop_condition",
      "time_budget_minutes",
    ])) {
      throw new Error(
        "FROZEN cursor contract must bind behavior, test, files, stop, and budget",
      );
    }
    const task = {
      id: value.id,
      title: value.title,
      goal: value.goal,
      status: value.status,
      expected_behavior: value.expected_behavior,
      test_command: value.test_command,
      allowed_files: value.allowed_files,
      stop_condition: value.stop_condition,
      time_budget_minutes: value.time_budget_minutes,
    };
    if (!isPlanTask(task)) {
      throw new Error(
        "invalid FROZEN task; stable task id and bounded contract are required"
        + "; allowed_files must use bounded non-root globs or concrete paths",
      );
    }
    return task;
  }
  throw new Error("ordered task status must be FROZEN or OUTLINE");
}

function parsePlan(bytes: string): PlanProposalFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes);
  } catch {
    throw new Error("plan proposal file must be valid JSON");
  }
  if (
    !isRecord(parsed)
    || !hasExactKeys(parsed, ["cursor", "ordered_tasks"])
    || !Number.isSafeInteger(parsed.cursor)
    || (parsed.cursor as number) < 0
    || !Array.isArray(parsed.ordered_tasks)
    || parsed.ordered_tasks.length === 0
  ) {
    throw new Error(
      "plan proposal must contain only cursor and non-empty ordered_tasks",
    );
  }
  const orderedTasks = parsed.ordered_tasks.map(normalizeTask);
  if ((parsed.cursor as number) > orderedTasks.length) {
    throw new Error("plan cursor cannot exceed ordered_tasks length");
  }
  const ids = orderedTasks.map(({ id }) => id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("duplicate stable task id in ordered_tasks");
  }
  return {
    cursor: parsed.cursor as number,
    ordered_tasks: orderedTasks,
  };
}

function exactPlanDiff(
  state: ProjectState,
  proposal: PlanProposalFile,
  planRevision: string,
): string {
  return `${JSON.stringify({
    format: "ohno-linear-plan-diff-v1",
    before: {
      plan_revision: state.plan_revision,
      ordered_tasks: state.ordered_tasks,
      cursor: state.cursor,
    },
    after: {
      plan_revision: planRevision,
      ordered_tasks: proposal.ordered_tasks,
      cursor: proposal.cursor,
    },
  }, null, 2)}\n`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function readSource(
  projectPath: string,
  sourcePath: string,
): Promise<{
  sourcePath: string;
  sourceDigest: string;
  proposal: PlanProposalFile;
}> {
  const path = safeSourcePath(projectPath, sourcePath);
  let bytes: string;
  try {
    bytes = await readFile(path.absolutePath, "utf8");
  } catch {
    throw new Error(`cannot read plan proposal ${path.relativePath}`);
  }
  return {
    sourcePath: path.relativePath,
    sourceDigest: sha256(bytes),
    proposal: parsePlan(bytes),
  };
}

export async function proposePlan(
  projectPath: string,
  sourcePath: string,
): Promise<PlanProposalEvidence> {
  const state = await readState(projectPath);
  const source = await readSource(projectPath, sourcePath);
  const planRevision = planRevisionFor(source.proposal.ordered_tasks);
  const exactDiff = exactPlanDiff(state, source.proposal, planRevision);
  const diffDigest = sha256(exactDiff);
  const head = readGitHead(projectPath);
  const proposedAt = new Date().toISOString();
  const pendingPlan: PendingPlan = {
    plan_revision: planRevision,
    ordered_tasks: source.proposal.ordered_tasks,
    cursor: source.proposal.cursor,
    diff_digest: diffDigest,
    head,
    proposed_at: proposedAt,
    source_path: source.sourcePath,
    source_digest: source.sourceDigest,
  };
  const recorded = await compareAndSwapStateAtomic(projectPath, state, {
    ...state,
    pending_plan: pendingPlan,
  });
  if (!recorded) {
    throw new Error("current state changed while recording the plan proposal");
  }
  return {
    planRevision,
    diffDigest,
    head,
    proposedAt,
    exactDiff,
  };
}

export async function acceptPlan(
  projectPath: string,
  revision: string,
  diffDigest: string,
): Promise<string> {
  const state = await readState(projectPath);
  const pending = state.pending_plan;
  if (pending === null) {
    throw new Error("no pending plan proposal to review");
  }
  if (
    revision !== pending.plan_revision
    || diffDigest !== pending.diff_digest
  ) {
    throw new Error("review must name the exact proposed revision and diff digest");
  }
  const currentHead = readGitHead(projectPath);
  if (currentHead !== pending.head) {
    throw new Error(
      "proposal HEAD changed; record a new exact local plan review",
    );
  }
  const source = await readSource(projectPath, pending.source_path);
  if (source.sourceDigest !== pending.source_digest) {
    throw new Error(
      "plan proposal file changed; record a new exact local plan review",
    );
  }
  const currentRevision = planRevisionFor(source.proposal.ordered_tasks);
  const currentDiff = exactPlanDiff(state, source.proposal, currentRevision);
  if (
    currentRevision !== pending.plan_revision
    || sha256(currentDiff) !== pending.diff_digest
  ) {
    throw new Error(
      "plan proposal base or exact diff changed; record a new local review",
    );
  }

  const recordedAt = new Date().toISOString();
  const accepted = await compareAndSwapStateAtomic(projectPath, state, {
    ...state,
    status: state.document_sync.status === "PENDING_REVIEW"
      ? "BLOCKED_DOC_SYNC"
      : "IDLE",
    plan_revision: pending.plan_revision,
    ordered_tasks: pending.ordered_tasks,
    cursor: pending.cursor,
    plan_review: {
      status: "LOCAL_REVIEW_RECORDED",
      plan_revision: pending.plan_revision,
      diff_digest: pending.diff_digest,
      head: pending.head,
      proposed_at: pending.proposed_at,
      recorded_at: recordedAt,
    },
    pending_plan: null,
    active_task: null,
    last_verification: null,
  });
  if (!accepted) {
    throw new Error("current state changed while recording the local plan review");
  }
  return `LOCAL_REVIEW_RECORDED: ${pending.plan_revision}\n`;
}
