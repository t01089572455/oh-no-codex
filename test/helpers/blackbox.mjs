import assert from "node:assert/strict";
import {
  mkdtemp,
  readFile,
  rm,
} from "node:fs/promises";
import { writeFileSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

export const cliPath = resolve(repositoryRoot, "dist", "cli.js");

export async function createProject(t) {
  const projectPath = await mkdtemp(resolve(tmpdir(), "ohno-task-start-"));
  t.after(async () => {
    await rm(projectPath, { force: true, recursive: true });
  });

  const git = spawnSync("git", ["init", "--quiet"], {
    cwd: projectPath,
    encoding: "utf8",
  });
  assert.equal(
    git.status,
    0,
    `failed to initialize disposable Git repository:\n${git.stderr}`,
  );

  return projectPath;
}

export function runCli(cwd, args, options = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8",
    env: options.env,
  });
}

/**
 * A01: init has no project-level goal flag.
 * Second string arg is ignored for call-site compatibility (legacy tests).
 */
export function runInit(cwd, _goalOrOptions = {}, options = {}) {
  const opts =
    typeof _goalOrOptions === "object"
    && _goalOrOptions !== null
    && !Array.isArray(_goalOrOptions)
      ? _goalOrOptions
      : options;
  const result = runCli(cwd, ["init"], opts);
  assert.equal(result.status, 0, result.stderr);
  // Fixtures skip interactive DISCOVER; production still starts DISCOVER.
  sealHarnessForTests(cwd);
  return result;
}

export function spawnCli(cwd, args) {
  return spawn(process.execPath, [cliPath, ...args], {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

export async function readState(cwd) {
  return JSON.parse(await readFile(resolve(cwd, ".ohno", "state.json"), "utf8"));
}

export async function readStateBytes(cwd) {
  return readFile(resolve(cwd, ".ohno", "state.json"));
}

export const completePlanTask = Object.freeze({
  id: "task-001",
  title: "Start one bounded task",
  goal: "Exercise the bounded task-start contract",
  status: "FROZEN",
  expected_behavior: "A user can start one bounded task",
  test_command: "node --test test/blackbox/task-start.test.mjs",
  stop_condition: "Stop after the task-start black box passes",
  allowed_files: ["src/**", "test/blackbox/task-start.test.mjs"],
  time_budget_minutes: 60,
});

export function frozenPlanTask(overrides = {}) {
  return {
    ...completePlanTask,
    ...overrides,
  };
}

/**
 * Write structured acceptance basis independently (never reverse-generate
 * from plan silently in product code). Tests pass explicit basis tasks.
 */
export function writeStructuredAcceptanceBasis(
  cwd,
  basisTasks,
  relativePath = ".ohno/acceptance-basis.json",
) {
  const document = {
    schema_version: 1,
    tasks: basisTasks.map((task) => ({
      id: task.id,
      expected_behavior: task.expected_behavior,
      test_command: task.test_command,
      stop_condition: task.stop_condition,
    })),
  };
  writeFileSync(
    resolve(cwd, relativePath),
    `${JSON.stringify(document, null, 2)}\n`,
    "utf8",
  );
  return relativePath;
}

/**
 * Ensure Truth lists the basis path as a truth target (required for propose).
 */
/** @deprecated Use writeStructuredAcceptanceBasis with independent content. */
export function writeDefaultAcceptanceBasis(cwd, tasks, relativePath) {
  const frozen = tasks.filter((task) => task.status === "FROZEN");
  return writeStructuredAcceptanceBasis(
    cwd,
    frozen.map((task) => ({
      id: task.id,
      expected_behavior: task.expected_behavior,
      test_command: task.test_command,
      stop_condition: task.stop_condition,
    })),
    relativePath ?? ".ohno/acceptance-basis.json",
  );
}

/**
 * Satisfy 0.3 harness seals so plan accept is allowed after init (DISCOVER).
 */
export function sealHarnessForTests(cwd) {
  const reqPath = resolve(cwd, ".ohno", "REQUIREMENTS.md");
  let prior = "";
  try {
    prior = readFileSync(reqPath, "utf8");
  } catch {
    prior = "# Requirements\n";
  }
  writeFileSync(
    reqPath,
    `${prior}\n\n## Owner intent (test seal)\n\n`
      + "Goal: ship the bounded black-box behavior for this disposable fixture. "
      + "Acceptance: frozen expect/test on plan tasks must pass (user-visible). "
      + "Non-goals: expand scope outside allowed_files. "
      + "Constraints: must use exact test_command; forbid soft echo tests.\n",
    "utf8",
  );
  writeFileSync(
    resolve(cwd, ".ohno", "DESIGN.md"),
    "# Design (test seal)\n\n"
      + "Goal: implement the frozen task contract only. "
      + "Acceptance: hard black-box test_command. "
      + "Route: multi-task plan OK; execute cursor-first. "
      + "Non-goals: redesign outside allowed_files. "
      + "Components: subject under allowed_files.\n",
    "utf8",
  );
  const sealedReq = runCli(cwd, ["phase", "seal-requirements"]);
  assert.equal(sealedReq.status, 0, sealedReq.stderr);
  const sealedDes = runCli(cwd, ["phase", "seal-design"]);
  assert.equal(sealedDes.status, 0, sealedDes.stderr);
}

export function reviewPlan(
  cwd,
  {
    tasks = [frozenPlanTask()],
    cursor = 0,
    fileName = ".ohno/test-plan.json",
    acceptanceSource = ".ohno/acceptance-basis.json",
    allowWeakPlan = false,
  } = {},
) {
  sealHarnessForTests(cwd);
  // Independent basis first (same field values as frozen tasks by fixture design).
  const frozen = tasks.filter((t) => t.status === "FROZEN");
  writeStructuredAcceptanceBasis(
    cwd,
    frozen.map((task) => ({
      id: task.id,
      expected_behavior: task.expected_behavior,
      test_command: task.test_command,
      stop_condition: task.stop_condition,
    })),
    acceptanceSource,
  );
  // Refresh truth inventory in state for basis path (init may already list it).
  syncTruthInventoryForBasis(cwd, acceptanceSource);

  writeFileSync(
    resolve(cwd, fileName),
    `${JSON.stringify({
      cursor,
      ordered_tasks: tasks,
      acceptance_source: acceptanceSource,
    }, null, 2)}\n`,
    "utf8",
  );
  const proposed = runCli(cwd, [
    "plan",
    "propose",
    "--file",
    fileName,
  ]);
  assert.equal(proposed.status, 0, proposed.stderr);
  const revision = /^PLAN_REVISION: ([a-f0-9]{64})$/m.exec(
    proposed.stdout,
  )?.[1];
  const diff = /^DIFF_DIGEST: ([a-f0-9]{64})$/m.exec(
    proposed.stdout,
  )?.[1];
  assert.ok(revision, "plan proposal must expose its exact revision");
  assert.ok(diff, "plan proposal must expose its exact diff digest");
  const acceptArgs = [
    "plan",
    "accept",
    "--revision",
    revision,
    "--diff",
    diff,
  ];
  if (allowWeakPlan) {
    acceptArgs.push("--allow-weak-plan");
  }
  const accepted = runCli(cwd, acceptArgs);
  assert.equal(accepted.status, 0, accepted.stderr);
  return {
    revision,
    diff,
    proposed,
    accepted,
    acceptanceSource,
  };
}

/**
 * Patch live state truth_inventory so basis path is truth_target without
 * full change-begin. Test-only helper (not a product command).
 */
/**
 * Ensure basis path is a Truth target without rewriting live state inventory
 * mid-change (which would break change-id CAS). Prefer init seed for
 * `.ohno/acceptance-basis.json`. For alternate paths, only update truth.json;
 * caller should re-init inventory via change begin or re-run classify at init.
 */
export function syncTruthInventoryForBasis(cwd, basisPath) {
  const truthPath = resolve(cwd, ".ohno", "truth.json");
  let truth;
  try {
    truth = JSON.parse(readFileSync(truthPath, "utf8"));
  } catch {
    truth = { schema_version: 1, targets: [] };
  }
  if (!Array.isArray(truth.targets)) {
    truth.targets = [];
  }
  if (!truth.targets.some((t) => t.path === basisPath)) {
    truth.targets.push({
      path: basisPath,
      concerns: ["acceptance-basis", "black-box"],
    });
    writeFileSync(truthPath, `${JSON.stringify(truth, null, 2)}\n`);
  }

  // Only patch state inventory when not in a pending document sync.
  const statePath = resolve(cwd, ".ohno", "state.json");
  const state = JSON.parse(readFileSync(statePath, "utf8"));
  if (state.document_sync?.status === "PENDING_REVIEW") {
    return;
  }
  const classification = [...(state.truth_inventory?.classification ?? [])];
  const idx = classification.findIndex((e) => e.path === basisPath);
  if (idx === -1) {
    classification.push({
      path: basisPath,
      classification: "TRUTH_TARGET",
      governing: true,
      truth_target: true,
    });
  } else {
    classification[idx] = {
      ...classification[idx],
      classification: "TRUTH_TARGET",
      truth_target: true,
      governing: true,
    };
  }
  classification.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const inventory_digest = createHash("sha256")
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
  state.truth_inventory = { inventory_digest, classification };
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
}

export function startTaskFromPlan(
  cwd,
  task = frozenPlanTask(),
  futureTasks = [],
) {
  const review = reviewPlan(cwd, {
    tasks: [task, ...futureTasks],
  });
  const started = runCli(cwd, ["task", "start"]);
  return {
    ...review,
    started,
  };
}
