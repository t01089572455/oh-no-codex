import assert from "node:assert/strict";
import { once } from "node:events";
import { watch } from "node:fs";
import { writeFile } from "node:fs/promises";
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

test("parseable but structurally corrupt state fails closed without overwrite", async (t) => {
  const projectPath = await createProject(t);
  assert.equal(
    runCli(projectPath, ["init", "--goal", "Preserve corrupt state evidence"]).status,
    0,
  );
  const corruptStateBytes = Buffer.from(
    '{\n  "schema_version": 1,\n  "goal": "Preserve corrupt state evidence",\n  "active_task": null\n}\n',
  );
  await writeFile(
    resolve(projectPath, ".ohno", "state.json"),
    corruptStateBytes,
  );

  const result = runCli(projectPath, [...completeTaskArguments]);
  assert.notEqual(result.status, 0, "corrupt state must reject task start");
  assert.match(result.stderr, /invalid state/i);
  assert.deepEqual(await readStateBytes(projectPath), corruptStateBytes);
});

test("an interrupted atomic replacement leaves old or new valid current JSON", async (t) => {
  const interruptedTaskArguments = [
    ...completeTaskArguments.with(
      9,
      `Stop after the atomic replacement ${"x".repeat(20_000)}`,
    ),
  ];
  const knownGoodProject = await createProject(t);
  assert.equal(
    runCli(
      knownGoodProject,
      ["init", "--goal", "Keep state valid during interruption"],
    ).status,
    0,
  );
  assert.equal(
    runCli(knownGoodProject, interruptedTaskArguments).status,
    0,
  );
  const expectedNewStateBytes = await readStateBytes(knownGoodProject);
  let observedInterruptedWrite = false;

  for (let attempt = 0; attempt < 12 && !observedInterruptedWrite; attempt += 1) {
    const projectPath = await createProject(t);
    assert.equal(
      runCli(projectPath, ["init", "--goal", "Keep state valid during interruption"]).status,
      0,
    );
    const oldStateBytes = await readStateBytes(projectPath);
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

    child = spawnCli(projectPath, interruptedTaskArguments);
    child.stdout.resume();
    child.stderr.resume();
    const [exitCode, signal] = await once(child, "exit");
    watcher.close();

    if (sawTemporaryFile && killAccepted && signal !== null) {
      observedInterruptedWrite = true;
      assert.equal(exitCode, null, "signal termination must not report an exit code");
      const currentStateBytes = await readStateBytes(projectPath);
      const isOld = currentStateBytes.equals(oldStateBytes);
      const isNew = currentStateBytes.equals(expectedNewStateBytes);
      assert.ok(
        isOld || isNew,
        "current state bytes must exactly match the known-good old or new state",
      );
    }
  }

  assert.equal(
    observedInterruptedWrite,
    true,
    "the black box must observe the temporary file and terminate its writer by signal",
  );
});
