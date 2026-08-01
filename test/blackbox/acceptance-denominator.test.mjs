/**
 * Correction 4 (repaired): structured acceptance basis hard gate.
 * Exact task contract match — not keyword regex.
 */
import assert from "node:assert/strict";
import {
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
  createProject,
  frozenPlanTask,
  runCli,
  runInit,
  syncTruthInventoryForBasis,
  writeStructuredAcceptanceBasis,
} from "../helpers/blackbox.mjs";

const ownerGoal =
  "Help the Owner stop procrastinating without underestimating effort";

const basisPath = ".ohno/acceptance-basis.json";

const task2Frozen = frozenPlanTask({
  id: "cloudbase-data",
  title: "建立 CloudBase 数据与用户隔离",
  goal: "让用户能够安全创建、查询和删除自己的任务",
  expected_behavior:
    "服务端从 CloudBase 上下文取 ownerId，创建任务时校验描述；"
    + "相同用户 idempotencyKey 只产生一条任务；列表只返回本人未删除任务",
  test_command:
    "npm test -- --run cloudfunctions/_shared/validation.test.js "
    + "cloudfunctions/createTask/index.test.js",
  stop_condition:
    "绑定的验证和用户隔离测试全部通过，CloudBase 数据切片已提交",
  allowed_files: [
    "cloudfunctions/**",
    "miniprogram/**",
    "docs/development/cloudbase-setup.md",
  ],
  time_budget_minutes: 90,
});

/** Independent correct basis for Task2 unit black box (Owner-authored). */
const task2BasisCorrect = {
  id: "cloudbase-data",
  expected_behavior: task2Frozen.expected_behavior,
  test_command: task2Frozen.test_command,
  stop_condition: task2Frozen.stop_condition,
};

/** Independent heavier basis claim (what the detailed plan required). */
const task2BasisHeavy = {
  id: "cloudbase-data",
  expected_behavior:
    "在微信开发者工具中创建任务、重启后仍存在、切换模拟用户后数据隔离",
  test_command:
    "node --test tests/smoke/wechat-devtools-multi-user.smoke.test.mjs",
  stop_condition: "微信开发者工具 multi-user smoke 全部通过",
};

async function writePlan(projectPath, tasks, acceptanceSource = basisPath) {
  await writeFile(
    resolve(projectPath, ".ohno", "plan.json"),
    `${JSON.stringify({
      cursor: 0,
      ordered_tasks: tasks,
      acceptance_source: acceptanceSource,
    }, null, 2)}\n`,
    "utf8",
  );
}

test("RED: plan shrinks vs independent structured basis is blocked", async (t) => {
  const projectPath = await createProject(t);
  runInit(projectPath, ownerGoal);
  // Basis written first independently with heavier contract.
  writeStructuredAcceptanceBasis(projectPath, [task2BasisHeavy], basisPath);
  syncTruthInventoryForBasis(projectPath, basisPath);
  // Plan freezes a narrower unit-only contract (Task2 accident).
  await writePlan(projectPath, [task2Frozen], basisPath);

  const proposed = runCli(projectPath, [
    "plan",
    "propose",
    "--file",
    ".ohno/plan.json",
  ]);
  assert.notEqual(proposed.status, 0);
  assert.match(
    `${proposed.stderr}\n${proposed.stdout}`,
    /ACCEPTANCE_DENOMINATOR_MISMATCH/i,
  );
});

test("PASS: plan exact-matches independent structured basis", async (t) => {
  const projectPath = await createProject(t);
  runInit(projectPath, ownerGoal);
  writeStructuredAcceptanceBasis(projectPath, [task2BasisCorrect], basisPath);
  syncTruthInventoryForBasis(projectPath, basisPath);
  await writePlan(projectPath, [task2Frozen], basisPath);

  const proposed = runCli(projectPath, [
    "plan",
    "propose",
    "--file",
    ".ohno/plan.json",
  ]);
  assert.equal(proposed.status, 0, proposed.stderr);
  assert.match(proposed.stdout, /^ACCEPTANCE_SOURCE: /m);
  const revision = /^PLAN_REVISION: ([a-f0-9]{64})$/m.exec(proposed.stdout)?.[1];
  const diff = /^DIFF_DIGEST: ([a-f0-9]{64})$/m.exec(proposed.stdout)?.[1];
  const accepted = runCli(projectPath, [
    "plan",
    "accept",
    "--revision",
    revision,
    "--diff",
    diff,
  ]);
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.match(accepted.stdout, /LOCAL_REVIEW_RECORDED/);
});

test("comment in test_command does not satisfy structured basis mismatch", async (t) => {
  const projectPath = await createProject(t);
  runInit(projectPath, ownerGoal);
  writeStructuredAcceptanceBasis(projectPath, [task2BasisHeavy], basisPath);
  syncTruthInventoryForBasis(projectPath, basisPath);
  const sneaky = {
    ...task2Frozen,
    test_command:
      `${task2Frozen.test_command} # 微信开发者工具 multi-user`,
  };
  await writePlan(projectPath, [sneaky], basisPath);
  const proposed = runCli(projectPath, [
    "plan",
    "propose",
    "--file",
    ".ohno/plan.json",
  ]);
  assert.notEqual(proposed.status, 0);
  assert.match(
    `${proposed.stderr}\n${proposed.stdout}`,
    /ACCEPTANCE_DENOMINATOR_MISMATCH/i,
  );
});

test("multi-task isolation: unit task not blocked by later heavy basis entry", async (t) => {
  const projectPath = await createProject(t);
  runInit(projectPath, ownerGoal);
  const unit = frozenPlanTask({
    id: "unit-a",
    expected_behavior: "Unit A behavior",
    test_command: "node --test a.test.mjs",
    stop_condition: "A done",
    allowed_files: ["a.test.mjs"],
  });
  const e2e = frozenPlanTask({
    id: "e2e-b",
    expected_behavior: "E2E B behavior with browser path",
    test_command: "node --test e2e-b.test.mjs",
    stop_condition: "E2E B done",
    allowed_files: ["e2e-b.test.mjs"],
  });
  writeStructuredAcceptanceBasis(
    projectPath,
    [
      {
        id: "unit-a",
        expected_behavior: unit.expected_behavior,
        test_command: unit.test_command,
        stop_condition: unit.stop_condition,
      },
      {
        id: "e2e-b",
        expected_behavior: e2e.expected_behavior,
        test_command: e2e.test_command,
        stop_condition: e2e.stop_condition,
      },
    ],
    basisPath,
  );
  syncTruthInventoryForBasis(projectPath, basisPath);
  await writePlan(projectPath, [unit, e2e], basisPath);
  const proposed = runCli(projectPath, [
    "plan",
    "propose",
    "--file",
    ".ohno/plan.json",
  ]);
  assert.equal(proposed.status, 0, proposed.stderr);
});

test("absolute Windows path acceptance_source is refused before I/O", async (t) => {
  const projectPath = await createProject(t);
  runInit(projectPath, ownerGoal);
  await writePlan(
    projectPath,
    [frozenPlanTask()],
    "C:/Users/Public/evil-basis.json",
  );
  const proposed = runCli(projectPath, [
    "plan",
    "propose",
    "--file",
    ".ohno/plan.json",
  ]);
  assert.notEqual(proposed.status, 0);
  assert.match(
    `${proposed.stderr}\n${proposed.stdout}`,
    /project-relative|drive|acceptance_source/i,
  );
});

test("acceptance_source not in Truth is refused", async (t) => {
  const projectPath = await createProject(t);
  runInit(projectPath, ownerGoal);
  await mkdir(resolve(projectPath, "docs"), { recursive: true });
  const outsider = "docs/not-in-truth-basis.json";
  writeStructuredAcceptanceBasis(
    projectPath,
    [task2BasisCorrect],
    outsider,
  );
  // Do NOT sync truth inventory for this path.
  await writePlan(projectPath, [task2Frozen], outsider);
  const proposed = runCli(projectPath, [
    "plan",
    "propose",
    "--file",
    ".ohno/plan.json",
  ]);
  assert.notEqual(proposed.status, 0);
  assert.match(
    `${proposed.stderr}\n${proposed.stdout}`,
    /ACCEPTANCE_BASIS_NOT_IN_TRUTH/i,
  );
});

test("legacy schema 2 plan state is readable with MIGRATE_ACCEPTANCE_BASIS", async (t) => {
  const projectPath = await createProject(t);
  runInit(projectPath, ownerGoal);
  // Build a modern plan first so we have valid tasks, then rewrite as schema 2 legacy.
  writeStructuredAcceptanceBasis(projectPath, [task2BasisCorrect], basisPath);
  syncTruthInventoryForBasis(projectPath, basisPath);
  await writePlan(projectPath, [task2Frozen], basisPath);
  const proposed = runCli(projectPath, [
    "plan",
    "propose",
    "--file",
    ".ohno/plan.json",
  ]);
  assert.equal(proposed.status, 0, proposed.stderr);
  const revision = /^PLAN_REVISION: ([a-f0-9]{64})$/m.exec(proposed.stdout)?.[1];
  const diff = /^DIFF_DIGEST: ([a-f0-9]{64})$/m.exec(proposed.stdout)?.[1];
  assert.equal(
    runCli(projectPath, [
      "plan",
      "accept",
      "--revision",
      revision,
      "--diff",
      diff,
    ]).status,
    0,
  );

  // Downgrade on disk to schema 2 legacy shape (simulate 0.1.6).
  const { createHash } = await import("node:crypto");
  const state = JSON.parse(
    await readFile(resolve(projectPath, ".ohno", "state.json"), "utf8"),
  );
  const legacyRevision = createHash("sha256")
    .update(JSON.stringify(state.ordered_tasks))
    .digest("hex");
  state.schema_version = 2;
  state.plan_revision = legacyRevision;
  state.plan_review = {
    status: "LOCAL_REVIEW_RECORDED",
    plan_revision: legacyRevision,
    diff_digest: state.plan_review.diff_digest,
    head: state.plan_review.head,
    proposed_at: state.plan_review.proposed_at,
    recorded_at: state.plan_review.recorded_at,
  };
  state.pending_plan = null;
  const { createHash: h2 } = await import("node:crypto");
  const completedUnsigned = {
    id: "planning-domain",
    expected_behavior: "domain done",
    test_command: "node --test d.test.mjs",
    stop_condition: "stop",
    allowed_files: ["d.test.mjs"],
    time_budget_minutes: 10,
    plan_revision: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  };
  state.completed = [
    {
      ...completedUnsigned,
      contract_digest: h2("sha256")
        .update(JSON.stringify(completedUnsigned))
        .digest("hex"),
    },
  ];
  state.cursor = 0;
  state.active_task = null;
  state.last_verification = null;
  state.status = "IDLE";
  await writeFile(
    resolve(projectPath, ".ohno", "state.json"),
    `${JSON.stringify(state, null, 2)}\n`,
    "utf8",
  );

  const status = runCli(projectPath, ["status", "--json"]);
  assert.equal(status.status, 0, status.stderr);
  const model = JSON.parse(status.stdout);
  assert.equal(model.availability, "AVAILABLE");
  assert.equal(model.next_action, "MIGRATE_ACCEPTANCE_BASIS");
  assert.equal(model.cursor, 0);

  const start = runCli(projectPath, ["task", "start"]);
  assert.notEqual(start.status, 0);
  assert.match(start.stderr, /MIGRATE_ACCEPTANCE_BASIS|migration/i);

  // Explicit migrate preserves completed count and cursor.
  writeStructuredAcceptanceBasis(projectPath, [task2BasisCorrect], basisPath);
  syncTruthInventoryForBasis(projectPath, basisPath);
  const migrated = runCli(projectPath, [
    "migrate",
    "acceptance-basis",
    "--file",
    basisPath,
  ]);
  assert.equal(migrated.status, 0, migrated.stderr);
  assert.match(migrated.stdout, /MIGRATED: schema_version=3/);
  const after = JSON.parse(
    await readFile(resolve(projectPath, ".ohno", "state.json"), "utf8"),
  );
  assert.equal(after.schema_version, 3);
  assert.equal(after.cursor, 0);
  assert.equal(after.completed.length, 1);
  assert.equal(after.completed[0].id, "planning-domain");
  assert.ok(after.plan_review.acceptance_source_path);
  assert.equal(after.active_task, null);

  const next = runCli(projectPath, ["next"]);
  assert.equal(next.stdout.trim(), "START_TASK:cloudbase-data");
});

test("accept re-reads basis and blocks content drift", async (t) => {
  const projectPath = await createProject(t);
  runInit(projectPath, ownerGoal);
  writeStructuredAcceptanceBasis(projectPath, [task2BasisCorrect], basisPath);
  syncTruthInventoryForBasis(projectPath, basisPath);
  await writePlan(projectPath, [task2Frozen], basisPath);
  const proposed = runCli(projectPath, [
    "plan",
    "propose",
    "--file",
    ".ohno/plan.json",
  ]);
  assert.equal(proposed.status, 0, proposed.stderr);
  const revision = /^PLAN_REVISION: ([a-f0-9]{64})$/m.exec(proposed.stdout)?.[1];
  const diff = /^DIFF_DIGEST: ([a-f0-9]{64})$/m.exec(proposed.stdout)?.[1];

  writeStructuredAcceptanceBasis(projectPath, [task2BasisHeavy], basisPath);

  const accepted = runCli(projectPath, [
    "plan",
    "accept",
    "--revision",
    revision,
    "--diff",
    diff,
  ]);
  assert.notEqual(accepted.status, 0);
  assert.match(
    `${accepted.stderr}\n${accepted.stdout}`,
    /ACCEPTANCE_BASIS_DRIFT|ACCEPTANCE_DENOMINATOR_MISMATCH/i,
  );
});
