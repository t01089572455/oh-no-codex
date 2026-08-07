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
import { setTimeout as delay } from "node:timers/promises";
import { isDeepStrictEqual } from "node:util";

import { isSafeProjectRelativePath } from "./paths.js";
import {
  isPidLockStale,
  removePathForce,
  tryCreatePidLockFile,
} from "./process-lock.js";

/**
 * Authoring caps (harness 0.2). Display/injection may truncate earlier;
 * these limits must not ridicule ordinary Owner intent (sin #12 control tax).
 */
export const displayFieldByteLimits = Object.freeze({
  goal: 16_384,
  taskId: 128,
  title: 512,
  expectedBehavior: 16_384,
  testCommand: 4_096,
  changeSummary: 4_096,
  /** Owner requirements notes: longer than change summaries. */
  ownerNote: 16_384,
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

interface PlanTaskIdentity {
  id: string;
  title: string;
  goal: string;
}

export interface OutlinePlanTask extends PlanTaskIdentity {
  status: "OUTLINE";
}

export interface FrozenPlanTask extends PlanTaskIdentity {
  status: "FROZEN";
  expected_behavior: string;
  test_command: string;
  allowed_files: string[];
  stop_condition: string;
  time_budget_minutes: number;
}

export type PlanTask = OutlinePlanTask | FrozenPlanTask;

export interface TaskContract {
  id: string;
  expected_behavior: string;
  test_command: string;
  stop_condition: string;
  allowed_files: string[];
  time_budget_minutes: number;
  plan_revision: string;
  contract_digest: string;
}

export interface VerificationReceipt {
  result: "PASS" | "FAIL" | "UNKNOWN";
  command: string;
  contract_digest: string;
  plan_revision: string;
  head: string | null;
  subject_digest: string | null;
  exit_code: number | null;
  finished_at: string;
  /** Same-contract consecutive FAIL/UNKNOWN count (harness STUCK threshold). */
  consecutive_failures?: number;
}

/** External acceptance basis bound into plan_revision (structured basis). */
export interface AcceptanceBasis {
  path: string;
  digest: string;
}

/** Pre–structured-basis plan review (schema 2). */
export interface PlanReviewLegacy {
  status: "LOCAL_REVIEW_RECORDED";
  plan_revision: string;
  diff_digest: string;
  head: string;
  proposed_at: string;
  recorded_at: string;
}

/** Schema 3 plan review with structured acceptance basis binding. */
export interface PlanReview {
  status: "LOCAL_REVIEW_RECORDED";
  plan_revision: string;
  diff_digest: string;
  head: string;
  proposed_at: string;
  recorded_at: string;
  acceptance_source_path: string;
  acceptance_source_digest: string;
}

export type AnyPlanReview = PlanReview | PlanReviewLegacy;

/** Pre-basis pending proposal (schema 2). */
export interface PendingPlanLegacy {
  plan_revision: string;
  ordered_tasks: PlanTask[];
  cursor: number;
  diff_digest: string;
  head: string;
  proposed_at: string;
  source_path: string;
  source_digest: string;
}

/** Schema 3 pending proposal with structured basis binding. */
export interface PendingPlan {
  plan_revision: string;
  ordered_tasks: PlanTask[];
  cursor: number;
  diff_digest: string;
  head: string;
  proposed_at: string;
  source_path: string;
  source_digest: string;
  acceptance_source_path: string;
  acceptance_source_digest: string;
}

export type AnyPendingPlan = PendingPlan | PendingPlanLegacy;

export type TruthClassification =
  | "AGENT_INSTRUCTIONS"
  | "PUBLIC_README_ENTRY"
  | "AGENT_HOOK_CONFIG"
  | "CANONICAL_GOVERNING"
  | "TRUTH_FILE"
  | "TRUTH_TARGET";

export interface TruthClassificationEntry {
  path: string;
  classification: TruthClassification;
  governing: true;
  truth_target: boolean;
}

export interface TruthInventory {
  inventory_digest: string;
  classification: TruthClassificationEntry[];
}

/** Owner-vision pipeline phase (0.3+). OPEN = legacy / ungated. */
export type HarnessPhase =
  | "OPEN"
  | "DISCOVER"
  | "DESIGN"
  | "PLAN_READY"
  | "EXECUTE"
  | "RECOVER"
  | "CHANGE";

export interface TruthReadReceipt {
  read_at: string;
  paths: string[];
  paths_digest: string;
  /** A = fix implementation; B = fix plan/design. */
  mode: "A" | "B";
}

/** Optional control block: missing on pre-0.3 state files (legacy OPEN). */
export interface HarnessControl {
  phase: HarnessPhase;
  requirements_digest: string | null;
  design_digest: string | null;
  truth_read: TruthReadReceipt | null;
  /** Latest Owner prompt id (sha256) for latest-wins binding. */
  owner_head: string | null;
}

export interface ProjectState {
  /** 2 = pre–structured-basis (migrate); 3 = structured acceptance basis. */
  schema_version: 2 | 3;
  goal: string;
  status: "IDLE" | "ACTIVE" | "BLOCKED_DOC_SYNC";
  plan_revision: string | null;
  ordered_tasks: PlanTask[];
  cursor: number;
  plan_review: AnyPlanReview | null;
  pending_plan: AnyPendingPlan | null;
  truth_inventory: TruthInventory;
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
      base_plan_revision: string | null;
      base_cursor: number;
      summary: string;
      started_at: string;
    };
  /** 0.3+ phase control; omit on legacy files. */
  harness?: HarnessControl | null;
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

/** Project-level goal may be empty (Owner opted out of a top-line slogan). */
function isProjectGoal(value: unknown): value is string {
  if (typeof value !== "string" || /[\r\n]/u.test(value)) {
    return false;
  }
  if (value === "") {
    return true;
  }
  return isBoundedDisplayString(value, displayFieldByteLimits.goal);
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

function isGitHead(value: unknown): value is string {
  return value === "UNBORN"
    || (typeof value === "string" && /^[a-f0-9]{40,64}$/u.test(value));
}

function isRfc3339Timestamp(value: unknown): value is string {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u
      .test(value)
    && !Number.isNaN(Date.parse(value));
}

function isStableTaskId(value: unknown): value is string {
  return isBoundedDisplayString(value, displayFieldByteLimits.taskId)
    && /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value);
}

/** @deprecated Prefer isSafeProjectRelativePath from paths.ts — same rules. */
function isSafePath(value: unknown): value is string {
  return isSafeProjectRelativePath(value);
}

export { isSafeProjectRelativePath };

/**
 * Allowed-file patterns must stay inside a non-root static directory or name a
 * concrete relative path. Root-level globs such as `**`, `*.ts`, or `README*`
 * would enumerate the entire repository and are rejected.
 */
export function isBoundedAllowedPattern(value: unknown): value is string {
  if (!isSafePath(value)) {
    return false;
  }
  const magicIndex = [...value].findIndex((character) =>
    "*?[]{}".includes(character)
  );
  if (magicIndex === -1) {
    return true;
  }
  const prefix = value.slice(0, magicIndex);
  return prefix.lastIndexOf("/") !== -1;
}

function isFrozenFields(value: Record<string, unknown>): boolean {
  return isBoundedDisplayString(
    value.expected_behavior,
    displayFieldByteLimits.expectedBehavior,
  )
    && isBoundedDisplayString(
      value.test_command,
      displayFieldByteLimits.testCommand,
    )
    && isNonBlankString(value.stop_condition)
    && Array.isArray(value.allowed_files)
    && value.allowed_files.length > 0
    && value.allowed_files.every(isBoundedAllowedPattern)
    && Number.isSafeInteger(value.time_budget_minutes)
    && (value.time_budget_minutes as number) > 0;
}

export function isPlanTask(value: unknown): value is PlanTask {
  if (
    !isRecord(value)
    || !isStableTaskId(value.id)
    || !isBoundedDisplayString(value.title, displayFieldByteLimits.title)
    || !isBoundedDisplayString(value.goal, displayFieldByteLimits.goal)
  ) {
    return false;
  }
  if (value.status === "OUTLINE") {
    return hasExactKeys(value, ["id", "title", "goal", "status"]);
  }
  return value.status === "FROZEN"
    && hasExactKeys(value, [
      "id",
      "title",
      "goal",
      "status",
      "expected_behavior",
      "test_command",
      "allowed_files",
      "stop_condition",
      "time_budget_minutes",
    ])
    && isFrozenFields(value);
}

/** Legacy schema 2: revision over ordered_tasks only. */
export function planRevisionForTasksOnly(tasks: readonly PlanTask[]): string {
  return createHash("sha256")
    .update(JSON.stringify(tasks))
    .digest("hex");
}

/**
 * Schema 3: revision binds ordered_tasks and structured acceptance basis
 * (path + content digest).
 */
export function planRevisionFor(
  tasks: readonly PlanTask[],
  acceptanceBasis: AcceptanceBasis | null = null,
): string {
  return createHash("sha256")
    .update(JSON.stringify({
      format: "ohno-plan-revision-v3",
      ordered_tasks: tasks,
      acceptance_basis: acceptanceBasis,
    }))
    .digest("hex");
}

/** True when schema 2 state still has a plan/pending that needs explicit migrate. */
export function needsAcceptanceBasisMigration(state: ProjectState): boolean {
  if (state.schema_version !== 2) {
    return false;
  }
  return state.plan_revision !== null || state.pending_plan !== null;
}

function unsignedContract(contract: Omit<TaskContract, "contract_digest">) {
  return {
    id: contract.id,
    expected_behavior: contract.expected_behavior,
    test_command: contract.test_command,
    stop_condition: contract.stop_condition,
    allowed_files: contract.allowed_files,
    time_budget_minutes: contract.time_budget_minutes,
    plan_revision: contract.plan_revision,
  };
}

export function contractDigestFor(
  contract: Omit<TaskContract, "contract_digest">,
): string {
  return createHash("sha256")
    .update(JSON.stringify(unsignedContract(contract)))
    .digest("hex");
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
      "plan_revision",
      "contract_digest",
    ])
    || !isStableTaskId(value.id)
    || !isFrozenFields(value)
    || !isSha256(value.plan_revision)
    || !isSha256(value.contract_digest)
  ) {
    return false;
  }
  const contract = value as unknown as TaskContract;
  return contract.contract_digest === contractDigestFor({
    id: contract.id,
    expected_behavior: contract.expected_behavior,
    test_command: contract.test_command,
    stop_condition: contract.stop_condition,
    allowed_files: contract.allowed_files,
    time_budget_minutes: contract.time_budget_minutes,
    plan_revision: contract.plan_revision,
  });
}

function isVerificationReceipt(
  value: unknown,
): value is VerificationReceipt {
  const required = [
    "result",
    "command",
    "contract_digest",
    "plan_revision",
    "head",
    "subject_digest",
    "exit_code",
    "finished_at",
  ] as const;
  if (
    !isRecord(value)
    || !required.every((key) => key in value)
    || Object.keys(value).some(
      (key) =>
        !(required as readonly string[]).includes(key)
        && key !== "consecutive_failures",
    )
    || !["PASS", "FAIL", "UNKNOWN"].includes(String(value.result))
    || !isNonBlankString(value.command)
    || !isSha256(value.contract_digest)
    || !isSha256(value.plan_revision)
    || !(
      value.head === null
      || isGitHead(value.head)
    )
    || !(value.subject_digest === null || isSha256(value.subject_digest))
    || !isRfc3339Timestamp(value.finished_at)
  ) {
    return false;
  }
  if (
    value.consecutive_failures !== undefined
    && (!Number.isSafeInteger(value.consecutive_failures)
      || (value.consecutive_failures as number) < 0)
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

function isPlanReviewLegacy(value: unknown): value is PlanReviewLegacy {
  return isRecord(value)
    && hasExactKeys(value, [
      "status",
      "plan_revision",
      "diff_digest",
      "head",
      "proposed_at",
      "recorded_at",
    ])
    && value.status === "LOCAL_REVIEW_RECORDED"
    && isSha256(value.plan_revision)
    && isSha256(value.diff_digest)
    && isGitHead(value.head)
    && isRfc3339Timestamp(value.proposed_at)
    && isRfc3339Timestamp(value.recorded_at)
    && Date.parse(value.recorded_at) >= Date.parse(value.proposed_at);
}

function isPlanReviewModern(value: unknown): value is PlanReview {
  return isRecord(value)
    && hasExactKeys(value, [
      "status",
      "plan_revision",
      "diff_digest",
      "head",
      "proposed_at",
      "recorded_at",
      "acceptance_source_path",
      "acceptance_source_digest",
    ])
    && value.status === "LOCAL_REVIEW_RECORDED"
    && isSha256(value.plan_revision)
    && isSha256(value.diff_digest)
    && isGitHead(value.head)
    && isRfc3339Timestamp(value.proposed_at)
    && isRfc3339Timestamp(value.recorded_at)
    && Date.parse(value.recorded_at) >= Date.parse(value.proposed_at)
    && isSafePath(value.acceptance_source_path)
    && isSha256(value.acceptance_source_digest);
}

function isOrderedTasks(value: unknown): value is PlanTask[] {
  if (!Array.isArray(value) || value.length === 0 || !value.every(isPlanTask)) {
    return false;
  }
  const ids = value.map(({ id }) => id);
  return new Set(ids).size === ids.length;
}

function isPendingPlanLegacy(value: unknown): value is PendingPlanLegacy {
  if (
    !isRecord(value)
    || !hasExactKeys(value, [
      "plan_revision",
      "ordered_tasks",
      "cursor",
      "diff_digest",
      "head",
      "proposed_at",
      "source_path",
      "source_digest",
    ])
    || !isSha256(value.plan_revision)
    || !isOrderedTasks(value.ordered_tasks)
    || !Number.isSafeInteger(value.cursor)
    || (value.cursor as number) < 0
    || (value.cursor as number) > value.ordered_tasks.length
    || !isSha256(value.diff_digest)
    || !isGitHead(value.head)
    || !isRfc3339Timestamp(value.proposed_at)
    || !isSafePath(value.source_path)
    || !isSha256(value.source_digest)
  ) {
    return false;
  }
  return value.plan_revision === planRevisionForTasksOnly(
    value.ordered_tasks as PlanTask[],
  );
}

function isPendingPlanModern(value: unknown): value is PendingPlan {
  if (
    !isRecord(value)
    || !hasExactKeys(value, [
      "plan_revision",
      "ordered_tasks",
      "cursor",
      "diff_digest",
      "head",
      "proposed_at",
      "source_path",
      "source_digest",
      "acceptance_source_path",
      "acceptance_source_digest",
    ])
    || !isSha256(value.plan_revision)
    || !isOrderedTasks(value.ordered_tasks)
    || !Number.isSafeInteger(value.cursor)
    || (value.cursor as number) < 0
    || (value.cursor as number) > value.ordered_tasks.length
    || !isSha256(value.diff_digest)
    || !isGitHead(value.head)
    || !isRfc3339Timestamp(value.proposed_at)
    || !isSafePath(value.source_path)
    || !isSha256(value.source_digest)
    || !isSafePath(value.acceptance_source_path)
    || !isSha256(value.acceptance_source_digest)
  ) {
    return false;
  }
  const basis: AcceptanceBasis = {
    path: value.acceptance_source_path as string,
    digest: value.acceptance_source_digest as string,
  };
  return value.plan_revision === planRevisionFor(
    value.ordered_tasks as PlanTask[],
    basis,
  );
}

const truthClassifications: readonly TruthClassification[] = [
  "AGENT_INSTRUCTIONS",
  "PUBLIC_README_ENTRY",
  "AGENT_HOOK_CONFIG",
  "CANONICAL_GOVERNING",
  "TRUTH_FILE",
  "TRUTH_TARGET",
];

function isTruthInventory(value: unknown): value is TruthInventory {
  if (
    !isRecord(value)
    || !hasExactKeys(value, ["inventory_digest", "classification"])
    || !isSha256(value.inventory_digest)
    || !Array.isArray(value.classification)
  ) {
    return false;
  }
  const paths: string[] = [];
  for (const entry of value.classification) {
    if (
      !isRecord(entry)
      || !hasExactKeys(entry, [
        "path",
        "classification",
        "governing",
        "truth_target",
      ])
      || !isSafePath(entry.path)
      || !truthClassifications.includes(
        entry.classification as TruthClassification,
      )
      || entry.governing !== true
      || typeof entry.truth_target !== "boolean"
    ) {
      return false;
    }
    paths.push(entry.path);
  }
  return new Set(paths).size === paths.length
    && paths.toSorted().every((path, index) => path === paths[index])
    && value.inventory_digest === truthInventoryDigestFor(
      value.classification as TruthClassificationEntry[],
    );
}

export function truthInventoryDigestFor(
  classification: readonly TruthClassificationEntry[],
): string {
  return createHash("sha256")
    .update(JSON.stringify(classification.map(({
      path,
      classification: kind,
      truth_target,
    }) => ({
      path,
      classification: kind,
      truth_target,
    }))))
    .digest("hex");
}

function isDocumentSync(
  value: unknown,
): value is ProjectState["document_sync"] {
  if (
    !isRecord(value)
    || !Array.isArray(value.required_paths)
  ) {
    return false;
  }
  if (value.status === "CLEAN") {
    return hasExactKeys(value, [
      "status",
      "change_id",
      "required_paths",
      "reviewed_diff_digest",
    ])
      && value.change_id === null
      && value.required_paths.length === 0
      && value.reviewed_diff_digest === null;
  }
  return hasExactKeys(value, [
    "status",
    "change_id",
    "required_paths",
    "reviewed_diff_digest",
    "base_plan_revision",
    "base_cursor",
    "summary",
    "started_at",
  ])
    && value.status === "PENDING_REVIEW"
    && isNonBlankString(value.change_id)
    && value.required_paths.length > 0
    && value.required_paths.every(isSafePath)
    && (
      value.reviewed_diff_digest === null
      || isSha256(value.reviewed_diff_digest)
    )
    && (
      value.base_plan_revision === null
      || isSha256(value.base_plan_revision)
    )
    && Number.isSafeInteger(value.base_cursor)
    && (value.base_cursor as number) >= 0
    && isBoundedDisplayString(
      value.summary,
      displayFieldByteLimits.changeSummary,
    )
    && isRfc3339Timestamp(value.started_at);
}

const projectStateRequiredKeys = [
  "schema_version",
  "goal",
  "status",
  "plan_revision",
  "ordered_tasks",
  "cursor",
  "plan_review",
  "pending_plan",
  "truth_inventory",
  "active_task",
  "last_verification",
  "completed",
  "document_sync",
] as const;

function isHarnessControl(value: unknown): value is HarnessControl {
  if (!isRecord(value)) {
    return false;
  }
  const required = [
    "phase",
    "requirements_digest",
    "design_digest",
    "truth_read",
  ] as const;
  if (!required.every((key) => key in value)) {
    return false;
  }
  if (
    Object.keys(value).some(
      (key) =>
        !(required as readonly string[]).includes(key) && key !== "owner_head",
    )
  ) {
    return false;
  }
  const phases = new Set([
    "OPEN",
    "DISCOVER",
    "DESIGN",
    "PLAN_READY",
    "EXECUTE",
    "RECOVER",
    "CHANGE",
  ]);
  if (!phases.has(String(value.phase))) {
    return false;
  }
  if (
    !(value.requirements_digest === null || isSha256(value.requirements_digest))
    || !(value.design_digest === null || isSha256(value.design_digest))
  ) {
    return false;
  }
  if (
    value.owner_head !== undefined
    && value.owner_head !== null
    && !isSha256(value.owner_head)
  ) {
    return false;
  }
  if (value.truth_read === null) {
    return true;
  }
  if (
    !isRecord(value.truth_read)
    || !isRfc3339Timestamp(value.truth_read.read_at)
    || !Array.isArray(value.truth_read.paths)
    || !value.truth_read.paths.every((path) => typeof path === "string")
    || !isSha256(value.truth_read.paths_digest)
  ) {
    return false;
  }
  if (
    value.truth_read.mode !== undefined
    && value.truth_read.mode !== "A"
    && value.truth_read.mode !== "B"
  ) {
    return false;
  }
  return true;
}

function isProjectState(value: unknown): value is ProjectState {
  if (
    !isRecord(value)
    || !projectStateRequiredKeys.every((key) => key in value)
    || Object.keys(value).some(
      (key) =>
        !(projectStateRequiredKeys as readonly string[]).includes(key)
        && key !== "harness",
    )
    || (value.harness !== undefined
      && value.harness !== null
      && !isHarnessControl(value.harness))
    || (value.schema_version !== 2 && value.schema_version !== 3)
    || !isProjectGoal(value.goal)
    || !Number.isSafeInteger(value.cursor)
    || (value.cursor as number) < 0
    || !isTruthInventory(value.truth_inventory)
    || !(
      value.active_task === null
      || isTaskContract(value.active_task)
    )
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

  const schema = value.schema_version as 2 | 3;

  // Schema 2: legacy plan_review + optional legacy pending (no basis fields).
  if (schema === 2) {
    if (
      !(
        value.plan_review === null
        || isPlanReviewLegacy(value.plan_review)
      )
      || !(
        value.pending_plan === null
        || isPendingPlanLegacy(value.pending_plan)
      )
    ) {
      return false;
    }
  } else if (
    !(
      value.plan_review === null
      || isPlanReviewModern(value.plan_review)
    )
    || !(
      value.pending_plan === null
      || isPendingPlanModern(value.pending_plan)
    )
  ) {
    return false;
  }

  if (value.plan_revision === null) {
    if (
      !Array.isArray(value.ordered_tasks)
      || value.ordered_tasks.length !== 0
      || value.cursor !== 0
      || value.plan_review !== null
    ) {
      return false;
    }
  } else if (
    !isSha256(value.plan_revision)
    || !isOrderedTasks(value.ordered_tasks)
    || value.plan_review === null
    || value.plan_review.plan_revision !== value.plan_revision
    || (value.cursor as number) > value.ordered_tasks.length
  ) {
    return false;
  } else if (schema === 2) {
    if (!isPlanReviewLegacy(value.plan_review)) {
      return false;
    }
    if (
      value.plan_revision
        !== planRevisionForTasksOnly(value.ordered_tasks as PlanTask[])
    ) {
      return false;
    }
  } else {
    if (!isPlanReviewModern(value.plan_review)) {
      return false;
    }
    const basis: AcceptanceBasis = {
      path: value.plan_review.acceptance_source_path,
      digest: value.plan_review.acceptance_source_digest,
    };
    if (value.plan_revision !== planRevisionFor(value.ordered_tasks, basis)) {
      return false;
    }
  }

  if (value.status === "ACTIVE") {
    if (
      !isTaskContract(value.active_task)
      || value.document_sync.status !== "CLEAN"
      || value.plan_revision === null
      || value.active_task.plan_revision !== value.plan_revision
    ) {
      return false;
    }
    const current = value.ordered_tasks[value.cursor as number];
    return current?.status === "FROZEN"
      && current.id === value.active_task.id
      && current.expected_behavior === value.active_task.expected_behavior
      && current.test_command === value.active_task.test_command
      && current.stop_condition === value.active_task.stop_condition
      && JSON.stringify(current.allowed_files)
        === JSON.stringify(value.active_task.allowed_files)
      && current.time_budget_minutes
        === value.active_task.time_budget_minutes;
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
    && value.last_verification.result === "PASS"
    && value.last_verification.plan_revision
      === value.completed.at(-1)?.plan_revision;
}

export function emptyTruthInventory(): TruthInventory {
  const classification: TruthClassificationEntry[] = [];
  return {
    inventory_digest: truthInventoryDigestFor(classification),
    classification,
  };
}

export function initialState(
  goal = "",
  truthInventory = emptyTruthInventory(),
): ProjectState {
  return {
    schema_version: 3,
    goal,
    status: "IDLE",
    plan_revision: null,
    ordered_tasks: [],
    cursor: 0,
    plan_review: null,
    pending_plan: null,
    truth_inventory: truthInventory,
    active_task: null,
    last_verification: null,
    completed: [],
    document_sync: {
      status: "CLEAN",
      change_id: null,
      required_paths: [],
      reviewed_diff_digest: null,
    },
    harness: {
      phase: "DISCOVER",
      requirements_digest: null,
      design_digest: null,
      truth_read: null,
      owner_head: null,
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
      throw new Error("project is not initialized; run ohno init");
    }
    throw new Error(`cannot read valid state from ${path}`);
  }
  if (!isProjectState(parsed)) {
    throw new Error(`unsupported or invalid state in ${path}`);
  }
  return parsed;
}

async function renameWithRetry(
  from: string,
  to: string,
  attempts = 10,
): Promise<void> {
  let last: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await rename(from, to);
      return;
    } catch (error) {
      last = error;
      const code = (error as NodeJS.ErrnoException).code;
      // Windows can briefly hold the target or tmp during antivirus/indexers.
      if (code !== "EPERM" && code !== "EACCES" && code !== "EBUSY") {
        throw error;
      }
      await new Promise((resolveDelay) => {
        setTimeout(resolveDelay, 15 * (attempt + 1));
      });
    }
  }
  throw last instanceof Error
    ? last
    : new Error(`cannot rename ${from} → ${to}`);
}

/** Best-effort cleanup of orphaned state write temps (Windows crashes, kills). */
export async function cleanupStaleStateTemps(
  projectPath: string,
): Promise<void> {
  const directory = stateDirectory(projectPath);
  let names: string[] = [];
  try {
    const { readdir } = await import("node:fs/promises");
    names = await readdir(directory);
  } catch {
    return;
  }
  const cutoff = Date.now() - 60_000;
  for (const name of names) {
    if (!/^state\.json\.\d+\.[0-9a-f-]+\.tmp$/iu.test(name)) {
      continue;
    }
    const full = resolve(directory, name);
    try {
      const { stat } = await import("node:fs/promises");
      const info = await stat(full);
      if (info.mtimeMs < cutoff) {
        await rm(full, { force: true });
      }
    } catch {
      // ignore
    }
  }
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
  await cleanupStaleStateTemps(projectPath).catch(() => undefined);
  try {
    handle = await open(temporaryPath, "wx", 0o600);
    await handle.writeFile(`${JSON.stringify(state, null, 2)}\n`, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await renameWithRetry(temporaryPath, currentPath);
  } finally {
    await handle?.close().catch(() => undefined);
    await rm(temporaryPath, { force: true }).catch(() => undefined);
  }
}

async function acquireStateCasLock(
  projectPath: string,
): Promise<string> {
  const directory = stateDirectory(projectPath);
  const lockPath = resolve(directory, "state.cas.lock");
  const deadline = Date.now() + 2_000;
  await mkdir(directory, { recursive: true });
  while (Date.now() < deadline) {
    if (await tryCreatePidLockFile(lockPath)) {
      return lockPath;
    }
    if (await isPidLockStale(lockPath)) {
      await removePathForce(lockPath);
      continue;
    }
    await delay(10);
  }
  throw new Error("cannot acquire atomic state update lock");
}

async function releaseStateCasLock(
  projectPath: string,
  _lockPath: string,
): Promise<void> {
  const lockPath = resolve(stateDirectory(projectPath), "state.cas.lock");
  await removePathForce(lockPath);
}

export async function compareAndSwapStateAtomic(
  projectPath: string,
  expected: ProjectState,
  next: ProjectState,
): Promise<boolean> {
  const handle = await acquireStateCasLock(projectPath);
  try {
    const current = await readState(projectPath);
    if (!isDeepStrictEqual(current, expected)) {
      return false;
    }
    await writeStateAtomic(projectPath, next);
    return true;
  } finally {
    await releaseStateCasLock(projectPath, handle);
  }
}

/**
 * CAS under the same state.cas.lock: after expected matches, run side-effect
 * commit (e.g. atomic Truth replace), then write next state. On state write
 * failure, invoke rollback so ordinary failures leave no half-migration.
 */
export async function compareAndSwapStateWithSideEffects(
  projectPath: string,
  expected: ProjectState,
  next: ProjectState,
  sideEffects: {
    commit: () => Promise<void>;
    rollback: () => Promise<void>;
  },
): Promise<boolean> {
  const handle = await acquireStateCasLock(projectPath);
  let committed = false;
  try {
    const current = await readState(projectPath);
    if (!isDeepStrictEqual(current, expected)) {
      return false;
    }
    await sideEffects.commit();
    committed = true;
    await writeStateAtomic(projectPath, next);
    return true;
  } catch (error) {
    if (committed) {
      try {
        await sideEffects.rollback();
      } catch (rollbackError) {
        const detail = rollbackError instanceof Error
          ? rollbackError.message
          : String(rollbackError);
        // Prefer explicit recovery signal when Truth may be half-applied.
        if (detail.startsWith("RECOVERY_REQUIRED:")) {
          throw rollbackError;
        }
        throw new Error(
          "RECOVERY_REQUIRED: state write failed after side-effect commit and "
            + `rollback failed: ${detail}`,
          { cause: error },
        );
      }
    }
    throw error;
  } finally {
    await releaseStateCasLock(projectPath, handle);
  }
}
