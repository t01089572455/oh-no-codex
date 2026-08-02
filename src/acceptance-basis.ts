import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { resolveInsideProject } from "./paths.js";
import type { FrozenPlanTask, PlanTask } from "./state.js";

export interface StructuredAcceptanceTask {
  id: string;
  expected_behavior: string;
  test_command: string;
  stop_condition: string;
}

export interface StructuredAcceptanceBasis {
  schema_version: 1;
  tasks: StructuredAcceptanceTask[];
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

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "" && value === value;
}

function parseStructuredBasis(raw: unknown): StructuredAcceptanceBasis {
  if (
    !isRecord(raw)
    || !hasExactKeys(raw, ["schema_version", "tasks"])
    || raw.schema_version !== 1
    || !Array.isArray(raw.tasks)
  ) {
    throw new Error(
      "ACCEPTANCE_BASIS_INVALID: structured basis must be "
        + '{ "schema_version": 1, "tasks": [ { id, expected_behavior, '
        + "test_command, stop_condition } ] }",
    );
  }
  const tasks: StructuredAcceptanceTask[] = [];
  const seen = new Set<string>();
  for (const entry of raw.tasks) {
    if (
      !isRecord(entry)
      || !hasExactKeys(entry, [
        "id",
        "expected_behavior",
        "test_command",
        "stop_condition",
      ])
      || !isNonBlankString(entry.id)
      || !isNonBlankString(entry.expected_behavior)
      || !isNonBlankString(entry.test_command)
      || !isNonBlankString(entry.stop_condition)
      || seen.has(entry.id)
    ) {
      throw new Error(
        "ACCEPTANCE_BASIS_INVALID: each tasks[] entry needs unique id and "
          + "exact expected_behavior, test_command, stop_condition strings",
      );
    }
    seen.add(entry.id);
    tasks.push({
      id: entry.id,
      expected_behavior: entry.expected_behavior,
      test_command: entry.test_command,
      stop_condition: entry.stop_condition,
    });
  }
  return { schema_version: 1, tasks };
}

export function sha256Text(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Load structured acceptance basis from a project-relative path.
 * Path must pass unified safety checks and resolve inside the project.
 */
export async function loadStructuredAcceptanceBasis(
  projectPath: string,
  relativePath: string,
): Promise<{
  path: string;
  digest: string;
  prose: string;
  document: StructuredAcceptanceBasis;
}> {
  const { relativePath: path, absolutePath } = await resolveInsideProject(
    projectPath,
    relativePath,
  );
  let prose: string;
  try {
    prose = await readFile(absolutePath, "utf8");
  } catch {
    throw new Error(
      `ACCEPTANCE_BASIS_UNREADABLE: cannot read acceptance_source ${path}`,
    );
  }
  if (prose.trim() === "") {
    throw new Error(`ACCEPTANCE_BASIS_EMPTY: acceptance_source ${path} is empty`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(prose);
  } catch {
    throw new Error(
      `ACCEPTANCE_BASIS_INVALID: acceptance_source ${path} is not JSON`,
    );
  }
  const document = parseStructuredBasis(parsed);
  return {
    path,
    digest: sha256Text(prose),
    prose,
    document,
  };
}

/**
 * Exact structural match: every FROZEN plan task must have one basis entry
 * with identical id, expected_behavior, test_command, stop_condition.
 * OUTLINE tasks must not appear in the basis.
 */
export function assertFrozenTasksMatchBasis(
  orderedTasks: readonly PlanTask[],
  basis: StructuredAcceptanceBasis,
): void {
  const frozen = orderedTasks.filter(
    (task): task is FrozenPlanTask => task.status === "FROZEN",
  );
  const byId = new Map(basis.tasks.map((task) => [task.id, task]));
  if (byId.size !== basis.tasks.length) {
    throw new Error("ACCEPTANCE_BASIS_INVALID: duplicate task id in basis");
  }

  for (const task of frozen) {
    const entry = byId.get(task.id);
    if (entry === undefined) {
      throw new Error(
        `ACCEPTANCE_DENOMINATOR_MISMATCH: FROZEN task ${task.id} missing from `
          + "structured acceptance basis",
      );
    }
    if (
      entry.expected_behavior !== task.expected_behavior
      || entry.test_command !== task.test_command
      || entry.stop_condition !== task.stop_condition
    ) {
      throw new Error(
        `ACCEPTANCE_DENOMINATOR_MISMATCH: FROZEN task ${task.id} plan contract `
          + "differs from structured acceptance basis "
          + "(expected_behavior / test_command / stop_condition must match exactly)",
      );
    }
  }

  const frozenIds = new Set(frozen.map((task) => task.id));
  for (const entry of basis.tasks) {
    if (!frozenIds.has(entry.id)) {
      // Basis may only describe FROZEN tasks currently in the plan.
      const outline = orderedTasks.find((task) => task.id === entry.id);
      if (outline?.status === "OUTLINE") {
        throw new Error(
          `ACCEPTANCE_BASIS_INVALID: OUTLINE task ${entry.id} must not have a `
            + "full acceptance contract in basis until frozen",
        );
      }
      if (outline === undefined) {
        throw new Error(
          `ACCEPTANCE_BASIS_INVALID: basis task ${entry.id} is not in ordered_tasks`,
        );
      }
    }
  }

  if (basis.tasks.length !== frozen.length) {
    throw new Error(
      "ACCEPTANCE_DENOMINATOR_MISMATCH: basis task count must equal FROZEN "
        + `task count (basis=${basis.tasks.length}, frozen=${frozen.length})`,
    );
  }
}
