import assert from "node:assert/strict";
import { once } from "node:events";
import { watch } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  completeTaskArguments,
  createProject,
  readState,
  readStateBytes,
  runCli,
  spawnCli,
  withBlankFlag,
  withoutFlag,
} from "../helpers/blackbox.mjs";

const requiredTaskFlags = [
  "--id",
  "--expect",
  "--test",
  "--stop",
  "--files",
  "--minutes",
  "--next",
];

function assertFieldError(result, flag) {
  assert.notEqual(result.status, 0, `${flag} rejection must exit non-zero`);
  assert.match(
    result.stderr,
    new RegExp(`${flag.replace("-", "\\-")}\\b`),
    `stderr must identify ${flag}; received:\n${result.stderr}`,
  );
}

test("init requires one Owner goal and refuses silent re-initialization", async (t) => {
  const projectPath = await createProject(t);

  const missing = runCli(projectPath, ["init"]);
  assertFieldError(missing, "--goal");

  const blank = runCli(projectPath, ["init", "--goal", "   "]);
  assertFieldError(blank, "--goal");

  const initialized = runCli(projectPath, [
    "init",
    "--goal",
    "Keep the current coding task aligned",
  ]);
  assert.equal(initialized.status, 0, initialized.stderr);

  const before = await readStateBytes(projectPath);
  assert.equal((await readState(projectPath)).goal, "Keep the current coding task aligned");

  const repeated = runCli(projectPath, [
    "init",
    "--goal",
    "Silently replace the original goal",
  ]);
  assert.notEqual(repeated.status, 0);
  assert.match(repeated.stderr, /already initialized/i);
  assert.deepEqual(await readStateBytes(projectPath), before);
});

for (const flag of requiredTaskFlags) {
  test(`task start rejects missing ${flag} without creating an active task`, async (t) => {
    const projectPath = await createProject(t);
    const initialized = runCli(projectPath, ["init", "--goal", "Ship one bounded change"]);
    assert.equal(initialized.status, 0, initialized.stderr);

    const result = runCli(
      projectPath,
      withoutFlag([...completeTaskArguments], flag),
    );
    assertFieldError(result, flag);
    assert.equal((await readState(projectPath)).active_task, null);
  });

  test(`task start rejects blank ${flag} without creating an active task`, async (t) => {
    const projectPath = await createProject(t);
    const initialized = runCli(projectPath, ["init", "--goal", "Ship one bounded change"]);
    assert.equal(initialized.status, 0, initialized.stderr);

    const result = runCli(
      projectPath,
      withBlankFlag([...completeTaskArguments], flag),
    );
    assertFieldError(result, flag);
    assert.equal((await readState(projectPath)).active_task, null);
  });
}

test("a complete bounded contract creates exactly one active task", async (t) => {
  const projectPath = await createProject(t);
  const initialized = runCli(projectPath, ["init", "--goal", "Ship one bounded change"]);
  assert.equal(initialized.status, 0, initialized.stderr);

  const result = runCli(projectPath, [...completeTaskArguments]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /task-001/);

  const state = await readState(projectPath);
  assert.equal(state.schema_version, 1);
  assert.equal(state.status, "ACTIVE");
  assert.equal(state.goal, "Ship one bounded change");
  assert.deepEqual(state.active_task, {
    id: "task-001",
    expected_behavior: "A user can start one bounded task",
    test_command: "node --test test/blackbox/task-start.test.mjs",
    stop_condition: "Stop after the task-start black box passes",
    allowed_files: ["src/**", "test/blackbox/task-start.test.mjs"],
    time_budget_minutes: 60,
    next_action: "Write the verify-finish black box",
    contract_digest: state.active_task.contract_digest,
  });
  assert.match(state.active_task.contract_digest, /^[a-f0-9]{64}$/);
});

test("a second task is rejected and preserves the state byte-for-byte", async (t) => {
  const projectPath = await createProject(t);
  assert.equal(
    runCli(projectPath, ["init", "--goal", "Ship one bounded change"]).status,
    0,
  );
  assert.equal(runCli(projectPath, [...completeTaskArguments]).status, 0);
  const before = await readStateBytes(projectPath);

  const second = runCli(projectPath, [
    ...completeTaskArguments.with(3, "task-002"),
  ]);
  assert.notEqual(second.status, 0);
  assert.match(second.stderr, /active task/i);
  assert.deepEqual(await readStateBytes(projectPath), before);
});

test("an interrupted atomic replacement leaves old or new valid current JSON", async (t) => {
  let observedInterruptedWrite = false;

  for (let attempt = 0; attempt < 12 && !observedInterruptedWrite; attempt += 1) {
    const projectPath = await createProject(t);
    assert.equal(
      runCli(projectPath, ["init", "--goal", "Keep state valid during interruption"]).status,
      0,
    );
    const oldState = await readState(projectPath);
    const directory = resolve(projectPath, ".ohno");
    let child;
    let sawTemporaryFile = false;
    let killAccepted = false;

    const watcher = watch(directory, (_eventType, filename) => {
      if (filename?.endsWith(".tmp") && child) {
        sawTemporaryFile = true;
        killAccepted ||= child.kill();
      }
    });

    child = spawnCli(projectPath, [
      ...completeTaskArguments.with(
        5,
        `A user-visible outcome ${"x".repeat(20_000)}`,
      ),
    ]);
    child.stdout.resume();
    child.stderr.resume();
    await once(child, "exit");
    watcher.close();

    if (sawTemporaryFile && killAccepted) {
      observedInterruptedWrite = true;
      const currentState = await readState(projectPath);
      const isOld = JSON.stringify(currentState) === JSON.stringify(oldState);
      const isNew = currentState.active_task?.id === "task-001";
      assert.ok(isOld || isNew, "current state must be the old or new valid JSON");
    }
  }

  assert.equal(
    observedInterruptedWrite,
    true,
    "the black box must kill a write after observing its same-directory temporary file",
  );
});
