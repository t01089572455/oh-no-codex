/**
 * Correction 4 closure: two-phase migrate, full inventory, sole MIGRATE next.
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
async function writeSchema2ActiveFixture(projectPath, {
  task = frozenUnit,
  withFailReceipt = false,
} = {}) {
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
      inventory_digest: createHash("sha256")
        .update(JSON.stringify([]))
        .digest("hex"),
      classification: [],
    },
    active_task: contract,
    last_verification: withFailReceipt
      ? {
        result: "FAIL",
        command: task.test_command,
        contract_digest: contract.contract_digest,
        plan_revision: rev,
        head: "UNBORN",
        subject_digest: createHash("sha256").update("fail").digest("hex"),
        exit_code: 1,
        finished_at: now,
      }
      : null,
    completed: [],
    document_sync: {
      status: "CLEAN",
      change_id: null,
      required_paths: [],
      reviewed_diff_digest: null,
    },
  };
  await mkdir(resolve(projectPath, ".ohno"), { recursive: true });
  await writeFile(
    resolve(projectPath, ".ohno", "state.json"),
    `${JSON.stringify(state, null, 2)}\n`,
    "utf8",
  );
  return { rev, state };
}

function runMigratePreview(projectPath) {
  return runCli(projectPath, [
    "migrate",
    "acceptance-basis",
    "--file",
    basisPath,
  ]);
}

function runMigrateApply(projectPath, previewStdout) {
  const diff = /^DIFF_DIGEST: ([a-f0-9]{64})$/m.exec(previewStdout)?.[1];
  const head = /^HEAD: (.+)$/m.exec(previewStdout)?.[1];
  assert.ok(diff, "preview must frame DIFF_DIGEST");
  assert.ok(head, "preview must frame HEAD");
  return runCli(projectPath, [
    "migrate",
    "acceptance-basis",
    "--file",
    basisPath,
    "--diff",
    diff,
    "--head",
    head,
  ]);
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

test("MIGRATE next blocks verify and beats FAIL receipt", async (t) => {
  const projectPath = await createProject(t);
  await writeSchema2ActiveFixture(projectPath, { withFailReceipt: true });
  const next = runCli(projectPath, ["next"]);
  assert.equal(next.stdout.trim(), "MIGRATE_ACCEPTANCE_BASIS");
  const status = runCli(projectPath, ["status", "--json"]);
  assert.equal(JSON.parse(status.stdout).next_action, "MIGRATE_ACCEPTANCE_BASIS");
  const verified = runCli(projectPath, ["verify"]);
  assert.notEqual(verified.status, 0);
  assert.match(verified.stderr, /MIGRATE_ACCEPTANCE_BASIS/i);
});

test("empty-Truth schema 2 ACTIVE two-phase migrates and enables change begin", async (t) => {
  const projectPath = await createProject(t);
  const { rev: oldRev } = await writeSchema2ActiveFixture(projectPath);
  writeStructuredAcceptanceBasis(projectPath, [basisUnit], basisPath);

  const beforeStateBytes = await readFile(
    resolve(projectPath, ".ohno", "state.json"),
  );
  const preview = runMigratePreview(projectPath);
  assert.equal(preview.status, 0, preview.stderr);
  assert.match(preview.stdout, /MIGRATE_PREVIEW: zero-write/);
  assert.match(preview.stdout, /DIFF_DIGEST: [a-f0-9]{64}/);
  assert.match(preview.stdout, /EXACT_MIGRATE_DIFF:/);
  assert.match(preview.stdout, /ohno-acceptance-basis-migrate-v2/);
  assert.match(preview.stdout, /"active_task"/);
  assert.match(preview.stdout, /"truth_inventory"/);
  // Zero-write: state and Truth untouched after preview.
  assert.deepEqual(
    await readFile(resolve(projectPath, ".ohno", "state.json")),
    beforeStateBytes,
  );
  await assert.rejects(
    () => readFile(resolve(projectPath, ".ohno", "truth.json"), "utf8"),
  );

  const applied = runMigrateApply(projectPath, preview.stdout);
  assert.equal(applied.status, 0, applied.stderr);
  assert.match(applied.stdout, /MIGRATED: schema_version=3/);
  assert.match(applied.stdout, /REVIEW: LOCAL_REVIEW_RECORDED after caller-returned/);

  const after = JSON.parse(
    await readFile(resolve(projectPath, ".ohno", "state.json"), "utf8"),
  );
  assert.equal(after.schema_version, 3);
  assert.equal(after.cursor, 0);
  assert.equal(after.completed.length, 0);
  assert.equal(after.active_task, null);
  assert.notEqual(after.plan_revision, oldRev);
  assert.equal(after.plan_review.acceptance_source_path, basisPath);
  assert.notEqual(after.plan_review.diff_digest, oldRev);
  // Full inventory must include Truth file so change begin does not self-lock.
  assert.ok(
    after.truth_inventory.classification.some(
      (e) => e.path === ".ohno/truth.json",
    ),
    "inventory must classify .ohno/truth.json",
  );
  assert.ok(
    after.truth_inventory.classification.some(
      (e) => e.path === basisPath && e.truth_target,
    ),
  );

  const truth = JSON.parse(
    await readFile(resolve(projectPath, ".ohno", "truth.json"), "utf8"),
  );
  assert.ok(truth.targets.some((t) => t.path === basisPath));

  const next = runCli(projectPath, ["next"]);
  assert.equal(next.stdout.trim(), "START_TASK:cloudbase-data");

  // migrate → change begin must not hit UNCLASSIFIED_HIGH_RISK on truth.json
  await mkdir(resolve(projectPath, "docs"), { recursive: true });
  await writeFile(
    resolve(projectPath, "docs", "PLAN.md"),
    "replacement plan path for change begin smoke\n",
    "utf8",
  );
  const truthDoc = JSON.parse(
    await readFile(resolve(projectPath, ".ohno", "truth.json"), "utf8"),
  );
  if (!truthDoc.targets.some((t) => t.path === "docs/PLAN.md")) {
    truthDoc.targets.push({
      path: "docs/PLAN.md",
      concerns: ["plan", "requirements"],
    });
    await writeFile(
      resolve(projectPath, ".ohno", "truth.json"),
      `${JSON.stringify(truthDoc, null, 2)}\n`,
      "utf8",
    );
  }
  // New Truth targets are allowed at change-begin rescan; built-in high-risk
  // paths (truth.json) must already be in inventory from migrate rebuild.
  const begun = runCli(projectPath, [
    "change",
    "begin",
    "--summary",
    "Owner post-migrate requirement change",
    "--concerns",
    "requirements",
    "--candidates",
    "docs/PLAN.md",
  ]);
  assert.equal(begun.status, 0, begun.stderr);
  const pending = JSON.parse(
    await readFile(resolve(projectPath, ".ohno", "state.json"), "utf8"),
  );
  assert.equal(pending.status, "BLOCKED_DOC_SYNC");
  assert.ok(
    pending.document_sync.required_paths.includes(basisPath),
    "change begin must include acceptance-basis path",
  );
});

test("corrupt Truth fails closed without overwrite on migrate preview", async (t) => {
  const projectPath = await createProject(t);
  await writeSchema2ActiveFixture(projectPath);
  writeStructuredAcceptanceBasis(projectPath, [basisUnit], basisPath);
  await mkdir(resolve(projectPath, ".ohno"), { recursive: true });
  const corrupt = "{ not valid truth\n";
  await writeFile(resolve(projectPath, ".ohno", "truth.json"), corrupt, "utf8");
  const preview = runMigratePreview(projectPath);
  assert.notEqual(preview.status, 0);
  assert.match(preview.stderr, /invalid Truth|fail-closed|repair/i);
  assert.equal(
    await readFile(resolve(projectPath, ".ohno", "truth.json"), "utf8"),
    corrupt,
  );
});

test("basis mismatch refuses without Truth write", async (t) => {
  const projectPath = await createProject(t);
  await writeSchema2ActiveFixture(projectPath);
  writeStructuredAcceptanceBasis(projectPath, [basisHeavy], basisPath);
  const preview = runMigratePreview(projectPath);
  assert.notEqual(preview.status, 0);
  assert.match(
    `${preview.stderr}\n${preview.stdout}`,
    /ACCEPTANCE_DENOMINATOR_MISMATCH|mismatch/i,
  );
  await assert.rejects(
    () => readFile(resolve(projectPath, ".ohno", "truth.json"), "utf8"),
  );
});

test("legacy schema 2 pending rebinds with accept-able v3 diff", async (t) => {
  const projectPath = await createProject(t);
  runInit(projectPath, ownerGoal);
  await writePassScript(projectPath);
  writeStructuredAcceptanceBasis(projectPath, [basisUnit], basisPath);
  const tasks = [frozenUnit];
  // Source file must be accept-able after rebind (includes acceptance_source).
  const planBody = `${JSON.stringify({
    cursor: 0,
    ordered_tasks: tasks,
    acceptance_source: basisPath,
  }, null, 2)}\n`;
  await writeFile(resolve(projectPath, ".ohno", "plan.json"), planBody, "utf8");
  const sourceDigest = createHash("sha256").update(planBody).digest("hex");
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
    source_digest: sourceDigest,
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

  const preview = runMigratePreview(projectPath);
  assert.equal(preview.status, 0, preview.stderr);
  assert.match(preview.stdout, /rebind_schema3/);
  assert.match(preview.stdout, /apply_metadata/);
  assert.match(preview.stdout, /caller-returned local review/i);
  const applied = runMigrateApply(projectPath, preview.stdout);
  assert.equal(applied.status, 0, applied.stderr);
  assert.match(applied.stdout, /caller-returned/i);
  const after = JSON.parse(
    await readFile(resolve(projectPath, ".ohno", "state.json"), "utf8"),
  );
  assert.equal(after.schema_version, 3);
  assert.notEqual(after.pending_plan, null);
  assert.equal(after.pending_plan.acceptance_source_path, basisPath);
  assert.notEqual(after.pending_plan.plan_revision, rev);
  const next = runCli(projectPath, ["next"]);
  assert.match(next.stdout.trim(), /^REVIEW_PLAN:[a-f0-9]{64}$/);

  // Executable next: plan accept must succeed with rebound digests.
  const accepted = runCli(projectPath, [
    "plan",
    "accept",
    "--revision",
    after.pending_plan.plan_revision,
    "--diff",
    after.pending_plan.diff_digest,
  ]);
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.match(accepted.stdout, /LOCAL_REVIEW_RECORDED/);
  const finalNext = runCli(projectPath, ["next"]);
  assert.equal(finalNext.stdout.trim(), "START_TASK:cloudbase-data");
});

test("pending source shrink after pending clears to PROPOSE_PLAN not REVIEW_PLAN", async (t) => {
  const projectPath = await createProject(t);
  runInit(projectPath, ownerGoal);
  await writePassScript(projectPath);
  writeStructuredAcceptanceBasis(projectPath, [basisUnit], basisPath);
  const tasks = [frozenUnit];
  const planBody = `${JSON.stringify({
    cursor: 0,
    ordered_tasks: tasks,
    acceptance_source: basisPath,
  }, null, 2)}\n`;
  await writeFile(resolve(projectPath, ".ohno", "plan.json"), planBody, "utf8");
  const sourceDigest = createHash("sha256").update(planBody).digest("hex");
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
    source_digest: sourceDigest,
  };
  await writeFile(
    resolve(projectPath, ".ohno", "state.json"),
    `${JSON.stringify(state, null, 2)}\n`,
    "utf8",
  );
  // After pending: shrink plan source acceptance vs independent basis.
  const shrunk = {
    ...frozenUnit,
    expected_behavior: "unit-only path; real browser path dropped",
  };
  await writeFile(
    resolve(projectPath, ".ohno", "plan.json"),
    `${JSON.stringify({
      cursor: 0,
      ordered_tasks: [shrunk],
      acceptance_source: basisPath,
    }, null, 2)}\n`,
    "utf8",
  );

  const preview = runMigratePreview(projectPath);
  assert.equal(preview.status, 0, preview.stderr);
  assert.match(preview.stdout, /clear_pending|pending_disposition/);
  assert.doesNotMatch(preview.stdout, /"pending_disposition": "rebind_schema3"/);
  const applied = runMigrateApply(projectPath, preview.stdout);
  assert.equal(applied.status, 0, applied.stderr);
  const after = JSON.parse(
    await readFile(resolve(projectPath, ".ohno", "state.json"), "utf8"),
  );
  assert.equal(after.schema_version, 3);
  assert.equal(after.pending_plan, null);
  const next = runCli(projectPath, ["next"]);
  assert.equal(next.stdout.trim(), "PROPOSE_PLAN");
});

test("Truth concurrent edit since preview refuses apply without overwrite", async (t) => {
  const projectPath = await createProject(t);
  await writeSchema2ActiveFixture(projectPath);
  writeStructuredAcceptanceBasis(projectPath, [basisUnit], basisPath);
  // Existing Truth so migrate plans an update (not create).
  await mkdir(resolve(projectPath, ".ohno"), { recursive: true });
  await mkdir(resolve(projectPath, "docs"), { recursive: true });
  await writeFile(
    resolve(projectPath, "docs", "PRODUCT.md"),
    "baseline product\n",
    "utf8",
  );
  await writeFile(
    resolve(projectPath, ".ohno", "truth.json"),
    `${JSON.stringify({
      schema_version: 1,
      targets: [
        { path: "docs/PRODUCT.md", concerns: ["requirements"] },
      ],
    }, null, 2)}\n`,
    "utf8",
  );

  const preview = runMigratePreview(projectPath);
  assert.equal(preview.status, 0, preview.stderr);
  assert.match(preview.stdout, /"action": "update"/);

  // Owner/other process edits Truth after preview.
  await writeFile(
    resolve(projectPath, "docs", "CONCURRENT.md"),
    "owner concurrent note\n",
    "utf8",
  );
  await writeFile(
    resolve(projectPath, ".ohno", "truth.json"),
    `${JSON.stringify({
      schema_version: 1,
      targets: [
        { path: "docs/PRODUCT.md", concerns: ["requirements"] },
        { path: "docs/CONCURRENT.md", concerns: ["requirements"] },
      ],
    }, null, 2)}\n`,
    "utf8",
  );

  const applied = runMigrateApply(projectPath, preview.stdout);
  assert.notEqual(applied.status, 0);
  assert.match(applied.stderr, /Truth content changed|exact-byte CAS|re-preview/i);

  const truth = JSON.parse(
    await readFile(resolve(projectPath, ".ohno", "truth.json"), "utf8"),
  );
  assert.ok(
    truth.targets.some((x) => x.path === "docs/CONCURRENT.md"),
    "concurrent Truth target must not be silently deleted",
  );
  const still = JSON.parse(
    await readFile(resolve(projectPath, ".ohno", "state.json"), "utf8"),
  );
  assert.equal(still.schema_version, 2);
});

test("failed migrate apply does not leave Truth half-written", async (t) => {
  const projectPath = await createProject(t);
  await writeSchema2ActiveFixture(projectPath);
  writeStructuredAcceptanceBasis(projectPath, [basisUnit], basisPath);
  const preview = runMigratePreview(projectPath);
  assert.equal(preview.status, 0, preview.stderr);
  const diff = /^DIFF_DIGEST: ([a-f0-9]{64})$/m.exec(preview.stdout)?.[1];
  const head = /^HEAD: (.+)$/m.exec(preview.stdout)?.[1];
  // Mutate authority fields covered by the exact migrate diff so stale
  // --diff cannot apply; Truth must stay unwritten.
  const state = JSON.parse(
    await readFile(resolve(projectPath, ".ohno", "state.json"), "utf8"),
  );
  state.status = "IDLE";
  state.active_task = null;
  await writeFile(
    resolve(projectPath, ".ohno", "state.json"),
    `${JSON.stringify(state, null, 2)}\n`,
    "utf8",
  );
  const applied = runCli(projectPath, [
    "migrate",
    "acceptance-basis",
    "--file",
    basisPath,
    "--diff",
    diff,
    "--head",
    head,
  ]);
  assert.notEqual(applied.status, 0);
  assert.match(applied.stderr, /DIFF_DIGEST|state changed|re-preview/i);
  await assert.rejects(
    () => readFile(resolve(projectPath, ".ohno", "truth.json"), "utf8"),
    "failed apply must not leave Truth created",
  );
  const still = JSON.parse(
    await readFile(resolve(projectPath, ".ohno", "state.json"), "utf8"),
  );
  assert.equal(still.schema_version, 2);
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
