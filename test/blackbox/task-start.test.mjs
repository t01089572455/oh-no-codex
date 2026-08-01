import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { watch } from "node:fs";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
  createProject,
  frozenPlanTask,
  readState,
  readStateBytes,
  reviewPlan,
  runCli,
  spawnCli,
  runInit,
} from "../helpers/blackbox.mjs";

const requiredFrozenFields = [
  "id",
  "goal",
  "expected_behavior",
  "test_command",
  "stop_condition",
  "allowed_files",
  "time_budget_minutes",
];

async function initialize(projectPath, projectGoal = "Ship one bounded change") {
  runInit(projectPath, projectGoal);
}

async function writeProposal(projectPath, task) {
  await writeFile(
    resolve(projectPath, ".ohno", "test-plan.json"),
    `${JSON.stringify({
      cursor: 0,
      ordered_tasks: [task],
    }, null, 2)}\n`,
    "utf8",
  );
}

function blankValue(field) {
  if (field === "allowed_files") {
    return [];
  }
  if (field === "time_budget_minutes") {
    return 0;
  }
  return "   ";
}

function assertInvalidFrozenField(result, field) {
  assert.notEqual(result.status, 0, `${field} rejection must exit non-zero`);
  assert.match(
    result.stderr,
    new RegExp(`${field}|FROZEN|stable task id|bounded contract`, "i"),
    `stderr must identify the invalid frozen contract; received:\n${result.stderr}`,
  );
}

function activeStateBytes(state, task) {
  const unsigned = {
    id: task.id,
    expected_behavior: task.expected_behavior,
    test_command: task.test_command,
    stop_condition: task.stop_condition,
    allowed_files: task.allowed_files,
    time_budget_minutes: task.time_budget_minutes,
    plan_revision: state.plan_revision,
  };
  const active = {
    ...unsigned,
    contract_digest: createHash("sha256")
      .update(JSON.stringify(unsigned))
      .digest("hex"),
  };
  return Buffer.from(`${JSON.stringify({
    ...state,
    status: "ACTIVE",
    active_task: active,
  }, null, 2)}\n`);
}

test("init requires Owner goal and refuses silent re-initialization", async (t) => {
  const projectPath = await createProject(t);
  const missingGoal = runCli(projectPath, ["init"]);
  assert.notEqual(missingGoal.status, 0);
  assert.match(missingGoal.stderr, /usage: ohno init --goal/i);

  const first = runInit(projectPath, "Ship one bounded change");
  assert.equal((await readState(projectPath)).goal, "Ship one bounded change");
  assert.match(first.stdout, /Initialized/i);
  assert.match(first.stdout, /GOAL: Ship one bounded change/);
  assert.match(first.stdout, /cockpit/i);

  const secondInit = runCli(projectPath, ["init", "--goal", "another slogan"]);
  assert.notEqual(secondInit.status, 0);
  assert.match(secondInit.stderr, /already initialized/i);

  const projectPath2 = await createProject(t);
  await initialize(projectPath2, "Preserve re-init refusal");
  const before = await readStateBytes(projectPath2);
  const repeated = runCli(projectPath2, ["init", "--goal", "must fail"]);
  assert.notEqual(repeated.status, 0);
  assert.match(repeated.stderr, /already initialized/i);
  assert.deepEqual(await readStateBytes(projectPath2), before);
});

for (const field of requiredFrozenFields) {
  test(`plan review rejects missing ${field} without creating an active task`, async (t) => {
    const projectPath = await createProject(t);
    await initialize(projectPath);
    const task = { ...frozenPlanTask() };
    delete task[field];
    await writeProposal(projectPath, task);
    const result = runCli(projectPath, [
      "plan",
      "propose",
      "--file",
      ".ohno/test-plan.json",
    ]);
    assertInvalidFrozenField(result, field);
    assert.equal((await readState(projectPath)).active_task, null);
  });

  test(`plan review rejects blank ${field} without creating an active task`, async (t) => {
    const projectPath = await createProject(t);
    await initialize(projectPath);
    const task = {
      ...frozenPlanTask(),
      [field]: blankValue(field),
    };
    await writeProposal(projectPath, task);
    const result = runCli(projectPath, [
      "plan",
      "propose",
      "--file",
      ".ohno/test-plan.json",
    ]);
    assertInvalidFrozenField(result, field);
    assert.equal((await readState(projectPath)).active_task, null);
  });
}

test("a complete reviewed bounded contract creates exactly one active task", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  const task = frozenPlanTask();
  const review = reviewPlan(projectPath, { tasks: [task] });
  const result = runCli(projectPath, ["task", "start"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /task-001/);

  const state = await readState(projectPath);
  assert.equal(state.schema_version, 2);
  assert.equal(state.status, "ACTIVE");
  assert.equal(state.goal, "Ship one bounded change");
  assert.equal(state.plan_revision, review.revision);
  assert.deepEqual(state.active_task, {
    id: "task-001",
    expected_behavior: "A user can start one bounded task",
    test_command: "node --test test/blackbox/task-start.test.mjs",
    stop_condition: "Stop after the task-start black box passes",
    allowed_files: ["src/**", "test/blackbox/task-start.test.mjs"],
    time_budget_minutes: 60,
    plan_revision: review.revision,
    contract_digest: state.active_task.contract_digest,
  });
  assert.match(state.active_task.contract_digest, /^[a-f0-9]{64}$/);
});

test("a second task is rejected and preserves the state byte-for-byte", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  reviewPlan(projectPath);
  assert.equal(runCli(projectPath, ["task", "start"]).status, 0);
  const before = await readStateBytes(projectPath);
  const second = runCli(projectPath, ["task", "start"]);
  assert.notEqual(second.status, 0);
  assert.match(second.stderr, /active task/i);
  assert.deepEqual(await readStateBytes(projectPath), before);
});

test("parseable but structurally corrupt state fails closed without overwrite", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath, "Preserve corrupt state evidence");
  const corruptStateBytes = Buffer.from(
    '{\n  "schema_version": 2,\n  "goal": "Preserve corrupt state evidence",\n  "active_task": null\n}\n',
  );
  await writeFile(
    resolve(projectPath, ".ohno", "state.json"),
    corruptStateBytes,
  );
  const result = runCli(projectPath, ["task", "start"]);
  assert.notEqual(result.status, 0, "corrupt state must reject task start");
  assert.match(result.stderr, /invalid state/i);
  assert.deepEqual(await readStateBytes(projectPath), corruptStateBytes);
});

test("an interrupted atomic replacement leaves old or new valid current JSON", async (t) => {
  const task = frozenPlanTask({
    stop_condition: `Stop after the atomic replacement ${"x".repeat(20_000)}`,
  });
  let observedInterruptedWrite = false;

  for (let attempt = 0; attempt < 12 && !observedInterruptedWrite; attempt += 1) {
    const projectPath = await createProject(t);
    await initialize(projectPath, "Keep state valid during interruption");
    reviewPlan(projectPath, { tasks: [task] });
    const oldState = await readState(projectPath);
    const oldStateBytes = await readStateBytes(projectPath);
    const expectedNewStateBytes = activeStateBytes(oldState, task);
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
    child = spawnCli(projectPath, ["task", "start"]);
    child.stdout.resume();
    child.stderr.resume();
    const [exitCode, signal] = await once(child, "exit");
    watcher.close();

    if (sawTemporaryFile && killAccepted && signal !== null) {
      observedInterruptedWrite = true;
      assert.equal(exitCode, null);
      const currentStateBytes = await readStateBytes(projectPath);
      assert.ok(
        currentStateBytes.equals(oldStateBytes)
          || currentStateBytes.equals(expectedNewStateBytes),
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
