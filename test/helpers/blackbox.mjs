import assert from "node:assert/strict";
import {
  mkdtemp,
  readFile,
  rm,
} from "node:fs/promises";
import { writeFileSync } from "node:fs";
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

export function runCli(cwd, args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8",
  });
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

export function reviewPlan(
  cwd,
  {
    tasks = [frozenPlanTask()],
    cursor = 0,
    fileName = ".ohno/test-plan.json",
  } = {},
) {
  writeFileSync(
    resolve(cwd, fileName),
    `${JSON.stringify({
      cursor,
      ordered_tasks: tasks,
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
  const accepted = runCli(cwd, [
    "plan",
    "accept",
    "--revision",
    revision,
    "--diff",
    diff,
  ]);
  assert.equal(accepted.status, 0, accepted.stderr);
  return {
    revision,
    diff,
    proposed,
    accepted,
  };
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
