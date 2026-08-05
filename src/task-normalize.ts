/**
 * Harness authoring normalize: accept a short task shape and expand to the
 * stored FROZEN/OUTLINE contract. Legacy full field sets remain valid.
 */

import {
  displayFieldByteLimits,
  displayTextIssue,
  isBoundedAllowedPattern,
  isPlanTask,
} from "./state.js";
import type { PlanTask } from "./state.js";

const DEFAULT_STOP = "Stop when the exact black-box test passes";
const DEFAULT_BUDGET_MINUTES = 60;

const outlineAllowed = new Set([
  "id",
  "title",
  "goal",
  "status",
]);

const frozenAllowed = new Set([
  "id",
  "title",
  "goal",
  "status",
  "expected_behavior",
  "expect",
  "test_command",
  "test",
  "allowed_files",
  "scope",
  "stop_condition",
  "time_budget_minutes",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNonBlankString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function assertNoLineBreak(value: string, label: string, limit: number): void {
  const issue = displayTextIssue(value, limit);
  if (issue === "LINE_BREAK") {
    throw new Error(`${label} must be a single line (no CR/LF)`);
  }
  if (issue === "TOO_LARGE") {
    throw new Error(
      `${label} exceeds ${limit} UTF-8 bytes (authoring limit; display may truncate earlier)`,
    );
  }
}

/**
 * Expand author JSON (minimal or legacy) into a stored PlanTask.
 */
export function normalizeAuthorTask(value: unknown): PlanTask {
  if (!isRecord(value)) {
    throw new Error("every ordered task must be one object");
  }
  if (value.status !== "FROZEN" && value.status !== "OUTLINE") {
    throw new Error("ordered task status must be FROZEN or OUTLINE");
  }

  const keys = Object.keys(value);
  const allowed = value.status === "OUTLINE" ? outlineAllowed : frozenAllowed;
  const unknown = keys.filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw new Error(
      `ACCEPTANCE_UNKNOWN_FIELD: task has unsupported field(s): `
        + `${unknown.join(", ")} (silent drop forbidden)`,
    );
  }

  const id = asNonBlankString(value.id, "id");
  assertNoLineBreak(id, "id", displayFieldByteLimits.taskId);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(id)) {
    throw new Error(
      "id must be a stable token: start with alnum, then alnum/._-",
    );
  }

  if (value.status === "OUTLINE") {
    const titleRaw = value.title === undefined ? id : value.title;
    const goalRaw = value.goal === undefined ? id : value.goal;
    const title = asNonBlankString(titleRaw, "title");
    const goal = asNonBlankString(goalRaw, "goal");
    assertNoLineBreak(title, "title", displayFieldByteLimits.title);
    assertNoLineBreak(goal, "goal", displayFieldByteLimits.goal);
    const task = {
      id,
      title,
      goal,
      status: "OUTLINE" as const,
    };
    if (!isPlanTask(task)) {
      throw new Error("invalid OUTLINE task after normalize");
    }
    return task;
  }

  const expectRaw = value.expected_behavior ?? value.expect;
  const testRaw = value.test_command ?? value.test;
  const scopeRaw = value.allowed_files ?? value.scope;
  if (expectRaw === undefined) {
    throw new Error(
      "FROZEN task needs expect (or expected_behavior): user-visible done line",
    );
  }
  if (testRaw === undefined) {
    throw new Error(
      "FROZEN task needs test (or test_command): one exact black-box command",
    );
  }
  if (scopeRaw === undefined) {
    throw new Error(
      "FROZEN task needs scope (or allowed_files): non-empty path globs",
    );
  }
  if (!Array.isArray(scopeRaw) || scopeRaw.length === 0) {
    throw new Error("scope/allowed_files must be a non-empty string array");
  }
  if (!scopeRaw.every(isBoundedAllowedPattern)) {
    throw new Error(
      "scope/allowed_files must use bounded non-root globs or concrete paths",
    );
  }

  const expected_behavior = asNonBlankString(expectRaw, "expect");
  const test_command = asNonBlankString(testRaw, "test");
  const title = asNonBlankString(
    value.title === undefined ? id : value.title,
    "title",
  );
  const goal = asNonBlankString(
    value.goal === undefined ? expected_behavior : value.goal,
    "goal",
  );
  const stop_condition = asNonBlankString(
    value.stop_condition === undefined ? DEFAULT_STOP : value.stop_condition,
    "stop_condition",
  );
  let time_budget_minutes = DEFAULT_BUDGET_MINUTES;
  if (value.time_budget_minutes !== undefined) {
    if (
      !Number.isSafeInteger(value.time_budget_minutes)
      || (value.time_budget_minutes as number) <= 0
    ) {
      throw new Error("time_budget_minutes must be a positive integer");
    }
    time_budget_minutes = value.time_budget_minutes as number;
  }

  assertNoLineBreak(title, "title", displayFieldByteLimits.title);
  assertNoLineBreak(goal, "goal", displayFieldByteLimits.goal);
  assertNoLineBreak(
    expected_behavior,
    "expect",
    displayFieldByteLimits.expectedBehavior,
  );
  assertNoLineBreak(
    test_command,
    "test",
    displayFieldByteLimits.testCommand,
  );
  if (/[\r\n]/u.test(stop_condition)) {
    throw new Error("stop_condition must be a single line (no CR/LF)");
  }

  const task = {
    id,
    title,
    goal,
    status: "FROZEN" as const,
    expected_behavior,
    test_command,
    allowed_files: scopeRaw as string[],
    stop_condition,
    time_budget_minutes,
  };
  if (!isPlanTask(task)) {
    throw new Error(
      "invalid FROZEN task after normalize; check id/expect/test/scope bounds",
    );
  }
  return task;
}

