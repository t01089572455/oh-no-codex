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
  readState,
  readStateBytes,
  runCli,
} from "../helpers/blackbox.mjs";

const canonicalKeys = [
  "schema_version",
  "availability",
  "goal",
  "status",
  "completed_count",
  "completed",
  "current_task",
  "proof_freshness",
  "blocker",
  "next_action",
];

const goal = "Keep every resumed session aligned";
const taskId = "read-surfaces-001";
const expectedBehavior = "Every read surface shows the same current truth";
const nextAction = "Begin the requirement-change slice";
const displayByteLimits = Object.freeze({
  goal: 256,
  id: 96,
  expected: 512,
  test: 1_024,
  next: 256,
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

async function initialize(projectPath, ownerGoal = goal) {
  const result = runCli(projectPath, ["init", "--goal", ownerGoal]);
  assert.equal(result.status, 0, result.stderr);
}

function taskArguments({
  command,
  id = taskId,
  expected = expectedBehavior,
  next = nextAction,
}) {
  return [
    "task",
    "start",
    "--id",
    id,
    "--expect",
    expected,
    "--test",
    command,
    "--stop",
    "Stop when the read-surface black box passes",
    "--files",
    "subject.txt",
    "--minutes",
    "60",
    "--next",
    next,
  ];
}

async function startTask(projectPath, options) {
  const result = runCli(projectPath, taskArguments(options));
  assert.equal(result.status, 0, result.stderr);
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

function paddedCommand(command, byteLimit = displayByteLimits.test) {
  const currentBytes = Buffer.byteLength(command, "utf8");
  assert.ok(currentBytes <= byteLimit);
  return `${command}${" ".repeat(byteLimit - currentBytes)}`;
}

function unsignedContract({
  expected = expectedBehavior,
  id = taskId,
  next = nextAction,
  testCommand,
}) {
  return {
    id,
    expected_behavior: expected,
    test_command: testCommand,
    stop_condition: "Stop when the read-surface black box passes",
    allowed_files: ["subject.txt"],
    time_budget_minutes: 60,
    next_action: next,
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

test("idle status, resume, and next agree and explicitly report NONE", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);

  const model = statusJson(projectPath);
  assert.deepEqual(model, {
    schema_version: 1,
    availability: "AVAILABLE",
    goal,
    status: "IDLE",
    completed_count: 0,
    completed: [],
    current_task: null,
    proof_freshness: "NONE",
    blocker: "NONE",
    next_action: "NONE",
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
    schema_version: 1,
    availability: "AVAILABLE",
    goal,
    status: "ACTIVE",
    completed_count: 0,
    completed: [],
    current_task: expectedCurrentTask({ command }),
    proof_freshness: "NONE",
    blocker: "NONE",
    next_action: "NONE",
  });
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
    next: "Start task B",
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
    next: "Start task C",
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
  assert.equal(model.next_action, "NONE");
  assertAllSurfacesAgree(projectPath, model);
});

test("init rejects a goal above its UTF-8 byte limit without creating state", async (t) => {
  const projectPath = await createProject(t);
  const oversizedGoal = `${utf8ValueAtLimit(displayByteLimits.goal)}x`;

  const result = runCli(projectPath, ["init", "--goal", oversizedGoal]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--goal\b/);
  await assert.rejects(
    access(resolve(projectPath, ".ohno", "state.json")),
    (error) => error.code === "ENOENT",
  );
});

test("init rejects line breaks in the goal without creating state", async (t) => {
  const projectPath = await createProject(t);

  const result = runCli(projectPath, [
    "init",
    "--goal",
    "First goal line\r\nSecond goal line",
  ]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--goal\b/);
  await assert.rejects(
    access(resolve(projectPath, ".ohno", "state.json")),
    (error) => error.code === "ENOENT",
  );
});

const oversizedTaskFields = [
  {
    flag: "--id",
    options: {
      id: `${utf8ValueAtLimit(displayByteLimits.id)}x`,
    },
  },
  {
    flag: "--expect",
    options: {
      expected: `${utf8ValueAtLimit(displayByteLimits.expected)}x`,
    },
  },
  {
    flag: "--test",
    options: {
      command: `${utf8ValueAtLimit(displayByteLimits.test)}x`,
    },
  },
  {
    flag: "--next",
    options: {
      next: `${utf8ValueAtLimit(displayByteLimits.next)}x`,
    },
  },
];

for (const { flag, options } of oversizedTaskFields) {
  test(`task start rejects ${flag} above its UTF-8 byte limit without state damage`, async (t) => {
    const projectPath = await createProject(t);
    await initialize(projectPath);
    const before = await readStateBytes(projectPath);

    const result = runCli(projectPath, taskArguments({
      command: "node placeholder.mjs",
      ...options,
    }));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, new RegExp(`${escapeRegExp(flag)}\\b`));
    assert.deepEqual(await readStateBytes(projectPath), before);
  });
}

for (const { flag, options } of [
  {
    flag: "--id",
    options: {
      id: "task-first\r\ntask-second",
    },
  },
  {
    flag: "--expect",
    options: {
      expected: "First expected line\r\nSecond expected line",
    },
  },
  {
    flag: "--test",
    options: {
      command: "node first.mjs\r\nnode second.mjs",
    },
  },
  {
    flag: "--next",
    options: {
      next: "First action\r\nSecond action",
    },
  },
]) {
  test(`task start rejects line breaks in ${flag} without state damage`, async (t) => {
    const projectPath = await createProject(t);
    await initialize(projectPath);
    const before = await readStateBytes(projectPath);

    const result = runCli(projectPath, taskArguments({
      command: "node placeholder.mjs",
      ...options,
    }));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, new RegExp(`${escapeRegExp(flag)}\\b`));
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
        state.active_task.id = `${utf8ValueAtLimit(displayByteLimits.id)}x`;
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
      name: "next action",
      mutate(state) {
        state.active_task.next_action =
          `${utf8ValueAtLimit(displayByteLimits.next)}x`;
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

test("a failed exact command is projected as the current blocker with no invented next", async (t) => {
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
  assert.equal(model.next_action, "NONE");
  assertAllSurfacesAgree(projectPath, model);
});

test("a completed fresh PASS exposes only its frozen next action", async (t) => {
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
    schema_version: 1,
    availability: "AVAILABLE",
    goal,
    status: "IDLE",
    completed_count: 1,
    completed: [{
      id: taskId,
      expected_behavior: expectedBehavior,
    }],
    current_task: null,
    proof_freshness: "FRESH",
    blocker: "NONE",
    next_action: nextAction,
  });
  assertAllSurfacesAgree(projectPath, model);
});

test("accepted maximum UTF-8 next action remains exact in a bounded resume", async (t) => {
  const projectPath = await createProject(t);
  const maximumGoal = utf8ValueAtLimit(displayByteLimits.goal, "Goal ");
  const maximumId = utf8ValueAtLimit(displayByteLimits.id, "task-max-");
  const maximumExpected = utf8ValueAtLimit(
    displayByteLimits.expected,
    "Expected ",
  );
  const maximumNext = utf8ValueAtLimit(displayByteLimits.next, "Next ");
  await initialize(projectPath, maximumGoal);
  await writeFile(resolve(projectPath, "subject.txt"), "fresh subject\n", "utf8");
  const script = await writeCommandScript(projectPath, "max-pass", "process.exit(0);\n");
  const maximumTest = paddedCommand(nodeCommand(script));
  await startTask(projectPath, {
    command: maximumTest,
    expected: maximumExpected,
    id: maximumId,
    next: maximumNext,
  });
  const verified = runCli(projectPath, ["verify"]);
  assert.equal(verified.status, 0, verified.stderr);
  assert.equal(verified.stdout, `${maximumNext}\n`);

  const model = statusJson(projectPath);
  assert.equal(model.goal, maximumGoal);
  assert.equal(model.proof_freshness, "FRESH");
  assert.equal(model.next_action, maximumNext);
  const resumed = runCli(projectPath, ["resume"]);
  assert.equal(resumed.status, 0, resumed.stderr);
  assert.ok(Buffer.byteLength(resumed.stdout, "utf8") < 4_096);
  assert.ok(resumed.stdout.includes(`GOAL: ${maximumGoal}\n`));
  assert.ok(resumed.stdout.includes(`NEXT: ${maximumNext}\n`));
  assertAllSurfacesAgree(projectPath, model);
});

test("a stale PASS blocks its old action and reports explicit NONE", async (t) => {
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
  assert.equal(model.next_action, "NONE");
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
  };
  await writeFile(
    resolve(projectPath, ".ohno", "state.json"),
    `${JSON.stringify(state, null, 2)}\n`,
    "utf8",
  );

  const model = statusJson(projectPath);
  assert.deepEqual(model, {
    schema_version: 1,
    availability: "AVAILABLE",
    goal,
    status: "BLOCKED_DOC_SYNC",
    completed_count: 0,
    completed: [],
    current_task: null,
    proof_freshness: "NONE",
    blocker: "DOCUMENT_SYNC_PENDING",
    next_action: "SYNC_GOVERNING_DOCUMENTS",
  });
  assertAllSurfacesAgree(projectPath, model);
});

test("resume stays below 4096 UTF-8 bytes and prioritizes the current contract and blocker", async (t) => {
  const projectPath = await createProject(t);
  const maximumGoal = utf8ValueAtLimit(displayByteLimits.goal, "Goal ");
  const maximumId = utf8ValueAtLimit(displayByteLimits.id, "active-");
  const maximumExpected = utf8ValueAtLimit(
    displayByteLimits.expected,
    "Expected ",
  );
  const maximumNext = utf8ValueAtLimit(displayByteLimits.next, "Next ");
  await initialize(projectPath, maximumGoal);
  await writeFile(resolve(projectPath, "subject.txt"), "failing subject\n", "utf8");
  const script = await writeCommandScript(projectPath, "fail", "process.exit(9);\n");
  const command = paddedCommand(nodeCommand(script));
  await startTask(projectPath, {
    command,
    expected: maximumExpected,
    id: maximumId,
    next: maximumNext,
  });
  assert.notEqual(runCli(projectPath, ["verify"]).status, 0);

  const state = await readState(projectPath);
  state.completed = Array.from({ length: 120 }, (_, index) =>
    completedContract({
      id: utf8ValueAtLimit(
        displayByteLimits.id,
        `completed-${String(index).padStart(3, "0")}-`,
      ),
      expected: utf8ValueAtLimit(
        displayByteLimits.expected,
        `History ${index} `,
      ),
      next: utf8ValueAtLimit(
        displayByteLimits.next,
        `Historical action ${index} `,
      ),
      testCommand: utf8ValueAtLimit(
        displayByteLimits.test,
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
  assert.equal(model.next_action, "NONE");

  const resumed = runCli(projectPath, ["resume"]);
  assert.equal(resumed.status, 0, resumed.stderr);
  assert.ok(
    Buffer.byteLength(resumed.stdout, "utf8") < 4_096,
    `resume capsule was ${Buffer.byteLength(resumed.stdout, "utf8")} bytes`,
  );
  assert.ok(resumed.stdout.includes(`GOAL: ${maximumGoal}\n`));
  assert.ok(resumed.stdout.includes(`TASK: ${maximumId}\n`));
  assert.ok(resumed.stdout.includes(`EXPECTED: ${maximumExpected}\n`));
  assert.ok(resumed.stdout.includes(`TEST: ${command}\n`));
  assert.match(resumed.stdout, /^BLOCKER: EXACT_TEST_FAILED$/m);
  assert.match(resumed.stdout, /^NEXT: NONE$/m);
  assert.doesNotMatch(resumed.stdout, /completed-000/);
});

test("missing or corrupt state reports UNAVAILABLE and is never overwritten", async (t) => {
  const missingProject = await createProject(t);
  const unavailable = runCli(missingProject, ["status", "--json"]);
  assert.notEqual(unavailable.status, 0);
  const missingModel = JSON.parse(unavailable.stdout);
  assert.deepEqual(Object.keys(missingModel), canonicalKeys);
  assert.deepEqual(missingModel, {
    schema_version: 1,
    availability: "UNAVAILABLE",
    goal: null,
    status: "UNAVAILABLE",
    completed_count: 0,
    completed: [],
    current_task: null,
    proof_freshness: "UNAVAILABLE",
    blocker: "STATE_UNAVAILABLE",
    next_action: "NONE",
  });
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
