/**
 * Correction 4 follow-up: structured basis + real migration + hard MIGRATE gates.
 * Fixtures are written as files; migrate/verify go through the CLI only.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
  writeStructuredAcceptanceBasis,
} from "../helpers/blackbox.mjs";

const ownerGoal = "Owner goal for denominator follow-up";
const basisPath = ".ohno/acceptance-basis.json";

const frozenUnit = frozenPlanTask({
  id: "cloudbase-data",
  title: "CloudBase isolation",
  goal: "User isolation",
  expected_behavior: "ownerId isolation and validation for create/list/delete",
  test_command: "node pass.mjs",
  stop_condition: "unit black box passes; stop",
  allowed_files: ["pass.mjs"],
  time_budget_minutes: 30,
});

const basisUnit = {
  id: "cloudbase-data",
  expected_behavior: frozenUnit.expected_behavior,
  test_command: frozenUnit.test_command,
  stop_condition: frozenUnit.stop_condition,
};

const basisHeavy = {
  id: "cloudbase-data",
  expected_behavior:
    "WeChat DevTools multi-user smoke creates and isolates tasks",
  test_command: "node wechat-devtools-multi-user.smoke.mjs",
  stop_condition: "devtools multi-user smoke passes",
};

async function writePassScript(projectPath) {
  await writeFile(resolve(projectPath, "pass.mjs"), "process.exit(0);\n", "utf8");
}

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

/** Pure file fixture: schema 2 ACTIVE plan (0.1.6-shaped). No inventory patching. */
async function writeSchema2ActiveFixture(projectPath, task = frozenUnit) {
  await writePassScript(projectPath);
  const tasks = [task];
  const rev = createHash("sha256").update(JSON.stringify(tasks)).digest("hex");
  const unsigned = {
    id: task.id,
    expected_behavior: task.expected_behavior,
    test_command: task.test_command,
    stop_condition: task.stop_condition,
    allowed_files: task.allowed_files,
    time_budget_minutes: task.time_budget_minutes,
    plan_revision: rev,
  };
  const contract = {
    ...unsigned,
    contract_digest: createHash("sha256")
      .update(JSON.stringify(unsigned))
      .digest("hex"),
  };
  const now = new Date().toISOString();
  // Empty Truth inventory — real 0.1.6 empty-Truth field trial shape.
  const state = {
    schema_version: 2,
    goal: ownerGoal,
    status: "ACTIVE",
    plan_revision: rev,
    ordered_tasks: tasks,
    cursor: 0,
    plan_review: {
      status: "LOCAL_REVIEW_RECORDED",
      plan_revision: rev,
      diff_digest: rev,
      head: "UNBORN",
      proposed_at: now,
      recorded_at: now,
    },
    pending_plan: null,
    truth_inventory: {
      inventory_digest: createHash("sha256").update("[]").digest("hex"),
      classification: [],
    },
    active_task: contract,
    last_verification: null,
    completed: [],
    document_sync: {
      status: "CLEAN",
      change_id: null,
      required_paths: [],
      reviewed_diff_digest: null,
    },
  };
  // Fix empty inventory digest to match product formula.
  state.truth_inventory.inventory_digest = createHash("sha256")
    .update(JSON.stringify([]))
    .digest("hex");
  await mkdir(resolve(projectPath, ".ohno"), { recursive: true });
  await writeFile(
    resolve(projectPath, ".ohno", "state.json"),
    `${JSON.stringify(state, null, 2)}\n`,
    "utf8",
  );
  return { rev, state };
}

test("RED: plan contract shrink vs independent structured basis is blocked", async (t) => {
  const projectPath = await createProject(t);
  runInit(projectPath, ownerGoal);
  writeStructuredAcceptanceBasis(projectPath, [basisHeavy], basisPath);
  await writePlan(projectPath, [frozenUnit], basisPath);
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

test("PASS: exact structured basis match proposes and accepts", async (t) => {
  const projectPath = await createProject(t);
  runInit(projectPath, ownerGoal);
  writeStructuredAcceptanceBasis(projectPath, [basisUnit], basisPath);
  await writePlan(projectPath, [frozenUnit], basisPath);
  const proposed = runCli(projectPath, [
    "plan",
    "propose",
    "--file",
    ".ohno/plan.json",
  ]);
  assert.equal(proposed.status, 0, proposed.stderr);
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
});

test("unknown FROZEN field is hard-rejected", async (t) => {
  const projectPath = await createProject(t);
  runInit(projectPath, ownerGoal);
  writeStructuredAcceptanceBasis(projectPath, [basisUnit], basisPath);
  await writeFile(
    resolve(projectPath, ".ohno", "plan.json"),
    `${JSON.stringify({
      cursor: 0,
      ordered_tasks: [{
        ...frozenUnit,
        manual_acceptance: "Also verify the real browser path",
      }],
      acceptance_source: basisPath,
    }, null, 2)}\n`,
    "utf8",
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
    /ACCEPTANCE_UNKNOWN_FIELD|manual_acceptance/i,
  );
});

test("MIGRATE next blocks verify on real empty-Truth ACTIVE schema 2 fixture", async (t) => {
  const projectPath = await createProject(t);
  await writeSchema2ActiveFixture(projectPath);
  const next = runCli(projectPath, ["next"]);
  assert.equal(next.stdout.trim(), "MIGRATE_ACCEPTANCE_BASIS");
  const verified = runCli(projectPath, ["verify"]);
  assert.notEqual(verified.status, 0);
  assert.match(verified.stderr, /MIGRATE_ACCEPTANCE_BASIS/i);
  const after = JSON.parse(
    await readFile(resolve(projectPath, ".ohno", "state.json"), "utf8"),
  );
  assert.equal(after.cursor, 0);
  assert.equal(after.completed.length, 0);
  assert.equal(after.active_task?.id, "cloudbase-data");
});

test("empty-Truth schema 2 ACTIVE migrates without helper inventory patches", async (t) => {
  const projectPath = await createProject(t);
  const { rev: oldRev } = await writeSchema2ActiveFixture(projectPath);
  // No truth.json, no basis yet — product migrate must create/register them.
  writeStructuredAcceptanceBasis(projectPath, [basisUnit], basisPath);

  const migrated = runCli(projectPath, [
    "migrate",
    "acceptance-basis",
    "--file",
    basisPath,
  ]);
  assert.equal(migrated.status, 0, migrated.stderr);
  assert.match(migrated.stdout, /MIGRATED: schema_version=3/);
  assert.match(migrated.stdout, /DIFF_DIGEST: [a-f0-9]{64}/);
  assert.match(migrated.stdout, /REVIEW: LOCAL_REVIEW_RECORDED for migrate exact diff/);

  const after = JSON.parse(
    await readFile(resolve(projectPath, ".ohno", "state.json"), "utf8"),
  );
  assert.equal(after.schema_version, 3);
  assert.equal(after.cursor, 0);
  assert.equal(after.completed.length, 0);
  assert.equal(after.active_task, null);
  assert.notEqual(after.plan_revision, oldRev);
  assert.equal(after.plan_review.acceptance_source_path, basisPath);
  // Review evidence must be fresh (diff_digest is migrate exact diff, not old rev).
  assert.notEqual(after.plan_review.diff_digest, oldRev);
  assert.match(after.plan_review.diff_digest, /^[a-f0-9]{64}$/);
  // Truth file registered by migrate.
  const truth = JSON.parse(
    await readFile(resolve(projectPath, ".ohno", "truth.json"), "utf8"),
  );
  assert.ok(truth.targets.some((t) => t.path === basisPath));
  assert.ok(
    after.truth_inventory.classification.some(
      (e) => e.path === basisPath && e.truth_target,
    ),
  );

  const next = runCli(projectPath, ["next"]);
  assert.equal(next.stdout.trim(), "START_TASK:cloudbase-data");
});

test("legacy schema 2 pending_plan remains readable", async (t) => {
  const projectPath = await createProject(t);
  runInit(projectPath, ownerGoal);
  await writePassScript(projectPath);
  const tasks = [frozenUnit];
  const rev = createHash("sha256").update(JSON.stringify(tasks)).digest("hex");
  const now = new Date().toISOString();
  const state = JSON.parse(
    await readFile(resolve(projectPath, ".ohno", "state.json"), "utf8"),
  );
  state.schema_version = 2;
  state.status = "IDLE";
  state.plan_revision = null;
  state.ordered_tasks = [];
  state.cursor = 0;
  state.plan_review = null;
  state.active_task = null;
  state.last_verification = null;
  state.completed = [];
  state.pending_plan = {
    plan_revision: rev,
    ordered_tasks: tasks,
    cursor: 0,
    diff_digest: rev,
    head: "UNBORN",
    proposed_at: now,
    source_path: ".ohno/plan.json",
    source_digest: rev,
  };
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
});

test("absolute path acceptance_source is refused", async (t) => {
  const projectPath = await createProject(t);
  runInit(projectPath, ownerGoal);
  await writePlan(
    projectPath,
    [frozenUnit],
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

test("pre-commit is blocked while MIGRATE is required", async (t) => {
  const projectPath = await createProject(t);
  await writeSchema2ActiveFixture(projectPath);
  const pre = runCli(projectPath, ["git", "pre-commit"]);
  assert.notEqual(pre.status, 0);
  assert.match(pre.stderr, /MIGRATE_ACCEPTANCE_BASIS/i);
});
