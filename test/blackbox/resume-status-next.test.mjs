import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  access,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
  createProject,
  frozenPlanTask,
  readState,
  readStateBytes,
  reviewPlan,
  runCli,
  runInit,
} from "../helpers/blackbox.mjs";

const canonicalKeys = [
  "schema_version",
  "availability",
  "goal",
  "status",
  "plan_revision",
  "cursor",
  "task_count",
  "completed_count",
  "completed",
  "current_task",
  "plan_board",
  "proof_freshness",
  "blocker",
  "next_action",
  "truth_target_count",
  "truth_targets",
  "document_sync_status",
  "handoff",
];

const ownerGoal = "Keep every resumed session aligned";
const taskId = "read-surfaces-001";
const expectedBehavior = "Every read surface shows the same current truth";
const nextTaskId = "read-surfaces-next";
const nextAction = `START_TASK:${nextTaskId}`;
const displayByteLimits = Object.freeze({
  goal: 16_384,
  id: 128,
  expected: 16_384,
  test: 4_096,
});

function quoteForShell(value) {
  return `"${value.replaceAll("\"", "\\\"")}"`;
}

function nodeCommand(scriptPath) {
  return `${quoteForShell(process.execPath)} ${quoteForShell(scriptPath)}`;
}

async function writeCommandScript(projectPath, name, source) {
  const relativePath = `commands/${name}.mjs`;
  await mkdir(resolve(projectPath, "commands"), { recursive: true });
  await writeFile(resolve(projectPath, relativePath), source, "utf8");
  return relativePath;
}

async function initialize(projectPath) {
  runInit(projectPath, ownerGoal);
}

function taskDefinition({
  command,
  id = taskId,
  expected = expectedBehavior,
  goal: taskGoal = "Keep read surfaces aligned",
}) {
  return frozenPlanTask({
    id,
    title: `Read surface task ${id}`,
    goal: taskGoal,
    expected_behavior: expected,
    test_command: command,
    stop_condition: "Stop when the read-surface black box passes",
    allowed_files: ["subject.txt"],
    time_budget_minutes: 60,
  });
}

async function startTask(projectPath, {
  nextId = nextTaskId,
  ...options
}) {
  const current = taskDefinition(options);
  reviewPlan(projectPath, {
    tasks: [
      current,
      frozenPlanTask({
        id: nextId,
        title: `Future task ${nextId}`,
        goal: `Future goal ${nextId}`,
        test_command: options.command,
        allowed_files: ["subject.txt"],
      }),
    ],
  });
  const result = runCli(projectPath, ["task", "start"]);
  assert.equal(result.status, 0, result.stderr);
}

async function proposeTask(projectPath, options) {
  const task = taskDefinition(options);
  const {
    writeDefaultAcceptanceBasis,
    syncTruthInventoryForBasis,
  } = await import("../helpers/blackbox.mjs");
  writeDefaultAcceptanceBasis(projectPath, [task], ".ohno/acceptance-basis.json");
  syncTruthInventoryForBasis(projectPath, ".ohno/acceptance-basis.json");
  await writeFile(
    resolve(projectPath, ".ohno", "invalid-plan.json"),
    `${JSON.stringify({
      cursor: 0,
      ordered_tasks: [task],
      acceptance_source: ".ohno/acceptance-basis.json",
    }, null, 2)}\n`,
    "utf8",
  );
  return runCli(projectPath, [
    "plan",
    "propose",
    "--file",
    ".ohno/invalid-plan.json",
  ]);
}

function statusJson(projectPath) {
  const result = runCli(projectPath, ["status", "--json"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  const model = JSON.parse(result.stdout);
  assert.deepEqual(
    Object.keys(model),
    canonicalKeys,
    "status --json must keep one stable canonical top-level shape",
  );
  return model;
}

function expectedCurrentTask({
  command,
  id = taskId,
  expected = expectedBehavior,
}) {
  return {
    id,
    expected_behavior: expected,
    test_command: command,
  };
}

function assertHumanProjection(result, model) {
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, new RegExp(`^AVAILABILITY: ${model.availability}$`, "m"));
  assert.match(result.stdout, new RegExp(`^GOAL: ${escapeRegExp(model.goal ?? "NONE")}$`, "m"));
  assert.match(result.stdout, new RegExp(`^STATUS: ${model.status}$`, "m"));
  assert.match(
    result.stdout,
    new RegExp(`^PLAN: ${escapeRegExp(model.plan_revision ?? "NONE")}$`, "m"),
  );
  assert.match(result.stdout, new RegExp(`^CURSOR: ${model.cursor}/${model.task_count}$`, "m"));
  assert.match(result.stdout, /^BOARD: /m);
  assert.match(result.stdout, new RegExp(`^COMPLETED: ${model.completed_count}$`, "m"));
  assert.match(
    result.stdout,
    new RegExp(
      `^COMPLETED_RECENT: ${escapeRegExp(
        model.completed.length === 0
          ? "NONE"
          : model.completed
            .map((entry) => `${entry.id}: ${entry.expected_behavior}`)
            .join(" | "),
      )}$`,
      "m",
    ),
  );
  assert.match(
    result.stdout,
    new RegExp(`^TASK: ${escapeRegExp(model.current_task?.id ?? "NONE")}$`, "m"),
  );
  assert.match(
    result.stdout,
    new RegExp(
      `^EXPECTED: ${escapeRegExp(model.current_task?.expected_behavior ?? "NONE")}$`,
      "m",
    ),
  );
  assert.match(
    result.stdout,
    new RegExp(
      `^TEST: ${escapeRegExp(model.current_task?.test_command ?? "NONE")}$`,
      "m",
    ),
  );
  assert.match(result.stdout, new RegExp(`^PROOF: ${model.proof_freshness}$`, "m"));
  assert.match(result.stdout, new RegExp(`^BLOCKER: ${model.blocker}$`, "m"));
  assert.match(
    result.stdout,
    new RegExp(`^DOC_SYNC: ${model.document_sync_status}$`, "m"),
  );
  assert.match(
    result.stdout,
    new RegExp(`^TRUTH_TARGETS: ${model.truth_target_count}$`, "m"),
  );
  assert.match(result.stdout, /^TRUTH_PATHS: /m);
  assert.match(result.stdout, /^HANDOFF_PATH: /m);
  assert.match(result.stdout, /^HANDOFF_BRANCH: /m);
  assert.match(result.stdout, /^HANDOFF_HEAD: /m);
  assert.match(result.stdout, /^HANDOFF_TREE: /m);
  assert.match(result.stdout, /^HANDOFF_DIRTY: /m);
  assert.match(
    result.stdout,
    new RegExp(`^NEXT: ${escapeRegExp(model.next_action)}$`, "m"),
  );
}

function assertAllSurfacesAgree(projectPath, model) {
  assertHumanProjection(runCli(projectPath, ["status"]), model);
  assertHumanProjection(runCli(projectPath, ["resume"]), model);

  const next = runCli(projectPath, ["next"]);
  assert.equal(next.status, 0, next.stderr);
  assert.equal(next.stderr, "");
  assert.equal(next.stdout, `${model.next_action}\n`);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function utf8ValueAtLimit(byteLimit, prefix = "") {
  assert.ok(Buffer.byteLength(prefix, "utf8") <= byteLimit);
  let value = prefix;
  while (Buffer.byteLength(`${value}界`, "utf8") <= byteLimit) {
    value += "界";
  }
  return value.padEnd(
    value.length + byteLimit - Buffer.byteLength(value, "utf8"),
    "x",
  );
}

function asciiValueAtLimit(byteLimit, prefix = "") {
  return prefix.padEnd(byteLimit, "x");
}

function paddedCommand(command, byteLimit = displayByteLimits.test) {
  const currentBytes = Buffer.byteLength(command, "utf8");
  assert.ok(currentBytes <= byteLimit);
  return `${command}${" ".repeat(byteLimit - currentBytes)}`;
}

function unsignedContract({
  expected = expectedBehavior,
  id = taskId,
  planRevision,
  testCommand,
}) {
  return {
    id,
    expected_behavior: expected,
    test_command: testCommand,
    stop_condition: "Stop when the read-surface black box passes",
    allowed_files: ["subject.txt"],
    time_budget_minutes: 60,
    plan_revision: planRevision,
  };
}

function contractDigest(contract) {
  const {
    contract_digest: _contractDigest,
    ...unsigned
  } = contract;
  return createHash("sha256")
    .update(JSON.stringify(unsigned))
    .digest("hex");
}

function completedContract(options) {
  const contract = unsignedContract(options);
  return {
    ...contract,
    contract_digest: contractDigest(contract),
  };
}

test("idle status, resume, and next agree on the derived plan action", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);

  const model = statusJson(projectPath);
  assert.deepEqual(model, {
    schema_version: 2,
    availability: "AVAILABLE",
    goal: null,
    status: "IDLE",
    plan_revision: null,
    cursor: 0,
    task_count: 0,
    completed_count: 0,
    completed: [],
    current_task: null,
    plan_board: [],
    proof_freshness: "NONE",
    blocker: "NONE",
    next_action: "PROPOSE_PLAN",
    truth_target_count: model.truth_target_count,
    truth_targets: model.truth_targets,
    document_sync_status: "CLEAN",
    handoff: model.handoff,
  });
  assertAllSurfacesAgree(projectPath, model);
});

test("active read surfaces expose the exact contract without running its test", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  const sentinelPath = resolve(projectPath, "test-was-run");
  const script = await writeCommandScript(
    projectPath,
    "must-not-run",
    [
      'import { writeFileSync } from "node:fs";',
      'writeFileSync("test-was-run", "unexpected\\n", "utf8");',
      "",
    ].join("\n"),
  );
  const command = nodeCommand(script);
  await startTask(projectPath, { command });

  const model = statusJson(projectPath);
  assert.deepEqual(model, {
    schema_version: 2,
    availability: "AVAILABLE",
    goal: null,
    status: "ACTIVE",
    plan_revision: model.plan_revision,
    cursor: 0,
    task_count: 2,
    completed_count: 0,
    completed: [],
    current_task: expectedCurrentTask({ command }),
    plan_board: model.plan_board,
    proof_freshness: "NONE",
    blocker: "NONE",
    next_action: `CONTINUE_ACTIVE:${taskId}`,
    truth_target_count: model.truth_target_count,
    truth_targets: model.truth_targets,
    document_sync_status: "CLEAN",
    handoff: model.handoff,
  });
  assert.equal(model.plan_board[0]?.phase, "ACTIVE");
  assert.equal(model.plan_board[1]?.phase, "QUEUED");
  assertAllSurfacesAgree(projectPath, model);
  await assert.rejects(
    access(sentinelPath),
    (error) => error.code === "ENOENT",
    "read surfaces must never run the frozen exact test",
  );
});

test("a prior PASS is historical when a different task becomes active", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  await writeFile(resolve(projectPath, "subject.txt"), "task A subject\n", "utf8");
  const passScript = await writeCommandScript(
    projectPath,
    "task-a-pass",
    "process.exit(0);\n",
  );
  const taskACommand = nodeCommand(passScript);
  await startTask(projectPath, {
    command: taskACommand,
    expected: "Task A passes with fresh evidence",
    id: "task-a",
    nextId: "task-b",
  });
  assert.equal(runCli(projectPath, ["verify"]).status, 0);

  const taskBScript = await writeCommandScript(
    projectPath,
    "task-b-must-not-run",
    "process.exit(0);\n",
  );
  const taskBCommand = nodeCommand(taskBScript);
  await startTask(projectPath, {
    command: taskBCommand,
    expected: "Task B is the only current contract",
    id: "task-b",
    nextId: "task-c",
  });

  const model = statusJson(projectPath);
  assert.equal(model.status, "ACTIVE");
  assert.equal(model.completed_count, 1);
  assert.deepEqual(model.current_task, expectedCurrentTask({
    command: taskBCommand,
    expected: "Task B is the only current contract",
    id: "task-b",
  }));
  assert.equal(model.proof_freshness, "NONE");
  assert.equal(model.blocker, "NONE");
  assert.equal(model.next_action, "CONTINUE_ACTIVE:task-b");
  assert.equal(model.goal, null);
  assertAllSurfacesAgree(projectPath, model);
});

test("init without arguments creates empty project goal", async (t) => {
  const projectPath = await createProject(t);

  const result = runCli(projectPath, ["init"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Initialized/i);
  const state = await readState(projectPath);
  assert.equal(state.goal, "");
});

const oversizedTaskFields = [
  {
    field: "id",
    options: {
      id: `${asciiValueAtLimit(displayByteLimits.id)}x`,
    },
  },
  {
    field: "expected_behavior",
    options: {
      expected: `${utf8ValueAtLimit(displayByteLimits.expected)}x`,
    },
  },
  {
    field: "test_command",
    options: {
      command: `${utf8ValueAtLimit(displayByteLimits.test)}x`,
    },
  },
  {
    field: "goal",
    options: {
      goal: `${utf8ValueAtLimit(displayByteLimits.goal)}x`,
    },
  },
];

for (const { field, options } of oversizedTaskFields) {
  test(`plan review rejects ${field} above its UTF-8 byte limit without state damage`, async (t) => {
    const projectPath = await createProject(t);
    await initialize(projectPath);
    const before = await readStateBytes(projectPath);

    const result = await proposeTask(projectPath, {
      command: "node placeholder.mjs",
      ...options,
    });
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /invalid|bounded|stable|single line|exceeds|UTF-8|expect|test|goal|id/i,
    );
    assert.deepEqual(await readStateBytes(projectPath), before);
  });
}

for (const { field, options } of [
  {
    field: "id",
    options: {
      id: "task-first\r\ntask-second",
    },
  },
  {
    field: "expected_behavior",
    options: {
      expected: "First expected line\r\nSecond expected line",
    },
  },
  {
    field: "test_command",
    options: {
      command: "node first.mjs\r\nnode second.mjs",
    },
  },
  {
    field: "goal",
    options: {
      goal: "First goal line\r\nSecond goal line",
    },
  },
]) {
  test(`plan review rejects line breaks in ${field} without state damage`, async (t) => {
    const projectPath = await createProject(t);
    await initialize(projectPath);
    const before = await readStateBytes(projectPath);

    const result = await proposeTask(projectPath, {
      command: "node placeholder.mjs",
      ...options,
    });
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /invalid|bounded|stable|single line|exceeds|UTF-8|expect|test|goal|id/i,
    );
    assert.deepEqual(await readStateBytes(projectPath), before);
  });
}

test("manually oversized display fields make state UNAVAILABLE without overwrite", async (t) => {
  const mutations = [
    {
      name: "goal",
      mutate(state) {
        state.goal = `${utf8ValueAtLimit(displayByteLimits.goal)}x`;
      },
    },
    {
      name: "task id",
      mutate(state) {
        state.active_task.id = `${asciiValueAtLimit(displayByteLimits.id)}x`;
      },
    },
    {
      name: "expected behavior",
      mutate(state) {
        state.active_task.expected_behavior =
          `${utf8ValueAtLimit(displayByteLimits.expected)}x`;
      },
    },
    {
      name: "exact test",
      mutate(state) {
        state.active_task.test_command =
          `${utf8ValueAtLimit(displayByteLimits.test)}x`;
      },
    },
    {
      name: "plan title",
      mutate(state) {
        state.ordered_tasks[state.cursor].title =
          `${utf8ValueAtLimit(displayByteLimits.goal)}x`;
      },
    },
  ];

  for (const { name, mutate } of mutations) {
    const projectPath = await createProject(t);
    await initialize(projectPath);
    await startTask(projectPath, { command: "node placeholder.mjs" });
    const state = await readState(projectPath);
    mutate(state);
    if (name !== "goal") {
      state.active_task.contract_digest = contractDigest(state.active_task);
    }
    const oversizedBytes = Buffer.from(`${JSON.stringify(state, null, 2)}\n`);
    await writeFile(
      resolve(projectPath, ".ohno", "state.json"),
      oversizedBytes,
    );

    const result = runCli(projectPath, ["status", "--json"]);
    assert.notEqual(result.status, 0, `${name} must fail runtime validation`);
    assert.equal(JSON.parse(result.stdout).availability, "UNAVAILABLE");
    assert.deepEqual(await readStateBytes(projectPath), oversizedBytes);
  }
});

test("a failed exact command is projected as blocker with RUN_EXACT_TEST next", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  await writeFile(resolve(projectPath, "subject.txt"), "failing subject\n", "utf8");
  const script = await writeCommandScript(
    projectPath,
    "fail",
    "process.exit(7);\n",
  );
  const command = nodeCommand(script);
  await startTask(projectPath, { command });
  assert.notEqual(runCli(projectPath, ["verify"]).status, 0);

  const model = statusJson(projectPath);
  assert.equal(model.status, "ACTIVE");
  assert.deepEqual(model.current_task, expectedCurrentTask({ command }));
  assert.equal(model.proof_freshness, "FAIL");
  assert.equal(model.blocker, "EXACT_TEST_FAILED");
  assert.equal(model.next_action, `RUN_EXACT_TEST:${taskId}`);
  assert.equal(model.goal, null);
  assertAllSurfacesAgree(projectPath, model);
});

test("a completed fresh PASS exposes only its plan-derived next action", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  await writeFile(resolve(projectPath, "subject.txt"), "fresh subject\n", "utf8");
  const script = await writeCommandScript(projectPath, "pass", "process.exit(0);\n");
  const command = nodeCommand(script);
  await startTask(projectPath, { command });
  const verified = runCli(projectPath, ["verify"]);
  assert.equal(verified.status, 0, verified.stderr);
  assert.equal(verified.stdout, `${nextAction}\n`);

  const model = statusJson(projectPath);
  assert.deepEqual(model, {
    schema_version: 2,
    availability: "AVAILABLE",
    goal: null,
    status: "IDLE",
    plan_revision: model.plan_revision,
    cursor: 1,
    task_count: 2,
    completed_count: 1,
    completed: [{
      id: taskId,
      expected_behavior: expectedBehavior,
    }],
    current_task: null,
    plan_board: model.plan_board,
    proof_freshness: "FRESH",
    blocker: "NONE",
    next_action: nextAction,
    truth_target_count: model.truth_target_count,
    truth_targets: model.truth_targets,
    document_sync_status: "CLEAN",
    handoff: model.handoff,
  });
  assert.equal(model.plan_board[0]?.phase, "DONE");
  assert.equal(model.plan_board[1]?.phase, "READY");
  assertAllSurfacesAgree(projectPath, model);
});

test("a maximum stable next task id remains exact in a bounded resume", async (t) => {
  const projectPath = await createProject(t);
  const maximumId = asciiValueAtLimit(displayByteLimits.id, "task-max-");
  const maximumExpected = utf8ValueAtLimit(
    displayByteLimits.expected,
    "Expected ",
  );
  const maximumNextId = asciiValueAtLimit(
    displayByteLimits.id,
    "next-max-",
  );
  const maximumNext = `START_TASK:${maximumNextId}`;
  await initialize(projectPath);
  await writeFile(resolve(projectPath, "subject.txt"), "fresh subject\n", "utf8");
  const script = await writeCommandScript(projectPath, "max-pass", "process.exit(0);\n");
  const maximumTest = paddedCommand(nodeCommand(script));
  await startTask(projectPath, {
    command: maximumTest,
    expected: maximumExpected,
    id: maximumId,
    nextId: maximumNextId,
  });
  const verified = runCli(projectPath, ["verify"]);
  assert.equal(verified.status, 0, verified.stderr);
  assert.equal(verified.stdout, `${maximumNext}\n`);

  const model = statusJson(projectPath);
  assert.equal(model.goal, null);
  assert.equal(model.proof_freshness, "FRESH");
  assert.equal(model.next_action, maximumNext);
  const resumed = runCli(projectPath, ["resume"]);
  assert.equal(resumed.status, 0, resumed.stderr);
  assert.ok(Buffer.byteLength(resumed.stdout, "utf8") < 4_096);
  assert.match(
    resumed.stdout,
    /^GOAL: NONE$/m,
  );
  assert.ok(resumed.stdout.includes(`NEXT: ${maximumNext}\n`));
  assertAllSurfacesAgree(projectPath, model);
});

test("a stale PASS after close points at REOPEN_TASK not next-slice license", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  await writeFile(resolve(projectPath, "subject.txt"), "verified subject\n", "utf8");
  const script = await writeCommandScript(projectPath, "pass", "process.exit(0);\n");
  const command = nodeCommand(script);
  await startTask(projectPath, { command });
  assert.equal(runCli(projectPath, ["verify"]).status, 0);
  await writeFile(resolve(projectPath, "subject.txt"), "changed after PASS\n", "utf8");

  const model = statusJson(projectPath);
  assert.equal(model.status, "IDLE");
  assert.equal(model.completed_count, 1);
  assert.equal(model.current_task, null);
  assert.equal(model.proof_freshness, "STALE");
  assert.equal(model.blocker, "STALE_PASS");
  assert.equal(model.next_action, `REOPEN_TASK:${taskId}`);
  assertAllSurfacesAgree(projectPath, model);
});

test("pending document sync has one authoritative next action", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  const state = await readState(projectPath);
  state.status = "BLOCKED_DOC_SYNC";
  state.document_sync = {
    status: "PENDING_REVIEW",
    change_id: "change-001",
    required_paths: [
      "docs/PRODUCT-CONTRACT.md",
      "docs/IMPLEMENTATION-PLAN.md",
    ],
    reviewed_diff_digest: null,
    base_plan_revision: null,
    base_cursor: state.cursor,
    summary: "Owner fixture for pending document sync projection",
    started_at: new Date().toISOString(),
  };
  await writeFile(
    resolve(projectPath, ".ohno", "state.json"),
    `${JSON.stringify(state, null, 2)}\n`,
    "utf8",
  );

  const model = statusJson(projectPath);
  assert.deepEqual(model, {
    schema_version: 2,
    availability: "AVAILABLE",
    goal: null,
    status: "BLOCKED_DOC_SYNC",
    plan_revision: null,
    cursor: 0,
    task_count: 0,
    completed_count: 0,
    completed: [],
    current_task: null,
    plan_board: [],
    proof_freshness: "NONE",
    blocker: "DOCUMENT_SYNC_PENDING",
    next_action: "SYNC_GOVERNING_DOCUMENTS",
    truth_target_count: model.truth_target_count,
    truth_targets: model.truth_targets,
    document_sync_status: "PENDING_REVIEW",
    handoff: model.handoff,
  });
  assertAllSurfacesAgree(projectPath, model);
});

test("resume stays below 4096 UTF-8 bytes and prioritizes the current contract and blocker", async (t) => {
  const projectPath = await createProject(t);
  // Capsule budget is 4KiB; authoring limits are larger. Use display-sized
  // contract fields that must still fit intact in the resume projection.
  const capsuleIdLimit = 96;
  const capsuleExpectedLimit = 512;
  const capsuleTestLimit = 1_024;
  const maximumId = asciiValueAtLimit(capsuleIdLimit, "active-");
  const maximumExpected = utf8ValueAtLimit(capsuleExpectedLimit, "Expected ");
  await initialize(projectPath);
  await writeFile(resolve(projectPath, "subject.txt"), "failing subject\n", "utf8");
  const script = await writeCommandScript(projectPath, "fail", "process.exit(9);\n");
  const command = paddedCommand(nodeCommand(script), capsuleTestLimit);
  await startTask(projectPath, {
    command,
    expected: maximumExpected,
    id: maximumId,
  });
  assert.notEqual(runCli(projectPath, ["verify"]).status, 0);

  const state = await readState(projectPath);
  state.completed = Array.from({ length: 120 }, (_, index) =>
    completedContract({
      id: asciiValueAtLimit(
        capsuleIdLimit,
        `completed-${String(index).padStart(3, "0")}-`,
      ),
      expected: utf8ValueAtLimit(
        capsuleExpectedLimit,
        `History ${index} `,
      ),
      planRevision: state.plan_revision,
      testCommand: utf8ValueAtLimit(
        capsuleTestLimit,
        `node historical-${index}.mjs `,
      ),
    })
  );
  await writeFile(
    resolve(projectPath, ".ohno", "state.json"),
    `${JSON.stringify(state, null, 2)}\n`,
    "utf8",
  );

  const model = statusJson(projectPath);
  assert.equal(model.completed_count, 120);
  assert.ok(model.completed.length <= 3, "completed summaries must be bounded");
  assert.deepEqual(model.current_task, expectedCurrentTask({
    command,
    expected: maximumExpected,
    id: maximumId,
  }));
  assert.equal(model.blocker, "EXACT_TEST_FAILED");
  assert.equal(model.next_action, `RUN_EXACT_TEST:${maximumId}`);

  const resumed = runCli(projectPath, ["resume"]);
  assert.equal(resumed.status, 0, resumed.stderr);
  assert.ok(
    Buffer.byteLength(resumed.stdout, "utf8") < 4_096,
    `resume capsule was ${Buffer.byteLength(resumed.stdout, "utf8")} bytes`,
  );
  assert.match(resumed.stdout, /^GOAL: NONE$/m);
  assert.ok(resumed.stdout.includes(`TASK: ${maximumId}\n`));
  assert.ok(resumed.stdout.includes(`EXPECTED: ${maximumExpected}\n`));
  assert.ok(resumed.stdout.includes(`TEST: ${command}\n`));
  assert.match(resumed.stdout, /^BLOCKER: EXACT_TEST_FAILED$/m);
  assert.match(resumed.stdout, new RegExp(`^NEXT: RUN_EXACT_TEST:${maximumId}$`, "m"));
  assert.doesNotMatch(resumed.stdout, /completed-000/);
});

test("missing or corrupt state reports UNAVAILABLE and is never overwritten", async (t) => {
  const missingProject = await createProject(t);
  const unavailable = runCli(missingProject, ["status", "--json"]);
  assert.notEqual(unavailable.status, 0);
  const missingModel = JSON.parse(unavailable.stdout);
  assert.deepEqual(Object.keys(missingModel), canonicalKeys);
  assert.deepEqual(missingModel, {
    schema_version: 2,
    availability: "UNAVAILABLE",
    goal: null,
    status: "UNAVAILABLE",
    plan_revision: null,
    cursor: 0,
    task_count: 0,
    completed_count: 0,
    completed: [],
    current_task: null,
    plan_board: [],
    proof_freshness: "UNAVAILABLE",
    blocker: "STATE_UNAVAILABLE",
    next_action: "NONE",
    truth_target_count: 0,
    truth_targets: [],
    document_sync_status: "UNAVAILABLE",
    handoff: missingModel.handoff,
  });
  assert.equal(missingModel.handoff.path, missingProject);
  assert.match(unavailable.stderr, /\bUNAVAILABLE\b/);
  await assert.rejects(
    access(resolve(missingProject, ".ohno", "state.json")),
    (error) => error.code === "ENOENT",
  );

  const corruptProject = await createProject(t);
  await initialize(corruptProject);
  const corruptBytes = Buffer.from('{"schema_version":\n');
  await writeFile(
    resolve(corruptProject, ".ohno", "state.json"),
    corruptBytes,
  );

  for (const args of [["status"], ["resume"], ["next"]]) {
    const result = runCli(corruptProject, args);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /\bUNAVAILABLE\b/);
    if (args[0] === "next") {
      assert.equal(result.stdout, "NONE\n");
    } else {
      assert.match(result.stdout, /^AVAILABILITY: UNAVAILABLE$/m);
      assert.match(result.stdout, /^NEXT: NONE$/m);
    }
    assert.deepEqual(await readStateBytes(corruptProject), corruptBytes);
  }
  assert.deepEqual(
    await readFile(resolve(corruptProject, ".ohno", "state.json")),
    corruptBytes,
  );
});

test("bare ohno prints one-screen harness brief; help puts daily loop first", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);

  const bare = runCli(projectPath, []);
  assert.equal(bare.status, 0, bare.stderr);
  assert.match(bare.stdout, /Oh No harness/i);
  assert.match(bare.stdout, /status:\s+IDLE/i);
  assert.match(bare.stdout, /next:\s+PROPOSE_PLAN/i);
  assert.match(bare.stdout, /daily:/i);
  assert.doesNotMatch(bare.stdout, /^GOAL:/m);

  const missing = runCli(await createProject(t), []);
  assert.notEqual(missing.status, 0);
  assert.match(missing.stdout, /ohno init/i);

  const help = runCli(projectPath, ["--help"]);
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /daily loop first/i);
  const dailyIdx = help.stdout.indexOf("ohno status");
  const advancedIdx = help.stdout.indexOf("advanced:");
  assert.ok(dailyIdx >= 0 && advancedIdx > dailyIdx);
});
