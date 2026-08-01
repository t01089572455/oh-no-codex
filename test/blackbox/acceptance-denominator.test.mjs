/**
 * Public black-box for acceptance-denominator hard gate (#7/#9).
 * Owning case: cloudbase-data Task2 — WeChat DevTools path shrunk to Vitest.
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
  writeDefaultAcceptanceBasis,
} from "../helpers/blackbox.mjs";

const ownerGoal =
  "Help the Owner stop procrastinating without underestimating effort";

const externalPlanRel =
  "docs/superpowers/plans/2026-08-01-procrastination-prevention-mini-program-plan.md";

function task2Contract(overrides = {}) {
  return frozenPlanTask({
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
    ...overrides,
  });
}

async function writeExternalPlan(projectPath, body) {
  await mkdir(resolve(projectPath, "docs/superpowers/plans"), {
    recursive: true,
  });
  await writeFile(resolve(projectPath, externalPlanRel), body, "utf8");
}

async function writeProposal(projectPath, tasks, acceptanceSource) {
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

test("RED: Task2 shrink — external WeChat DevTools basis vs Vitest freeze is blocked", async (t) => {
  const projectPath = await createProject(t);
  runInit(projectPath, ownerGoal);
  await writeExternalPlan(
    projectPath,
    [
      "# Detailed plan",
      "",
      "## cloudbase-data",
      "",
      "Acceptance must reopen 微信开发者工具 and prove multi-user smoke,",
      "including create/list/delete for two accounts after restart.",
      "",
    ].join("\n"),
  );
  await writeProposal(projectPath, [task2Contract()], externalPlanRel);

  const proposed = runCli(projectPath, [
    "plan",
    "propose",
    "--file",
    ".ohno/plan.json",
  ]);
  assert.notEqual(proposed.status, 0, "must refuse Task2 denominator shrink");
  assert.match(
    `${proposed.stderr}\n${proposed.stdout}`,
    /ACCEPTANCE_DENOMINATOR_SHRINK/i,
  );
  assert.match(
    `${proposed.stderr}\n${proposed.stdout}`,
    /WeChat DevTools|multi-user|acceptance source/i,
  );
});

test("PASS: Task2 passes when freeze black box names the heavier path claimed by basis", async (t) => {
  const projectPath = await createProject(t);
  runInit(projectPath, ownerGoal);
  await writeExternalPlan(
    projectPath,
    [
      "# Detailed plan",
      "",
      "## cloudbase-data",
      "",
      "Acceptance must reopen 微信开发者工具 and prove multi-user smoke.",
      "",
    ].join("\n"),
  );
  // Honest freeze: test_command must include the same heavy-path signals as basis.
  const honest = task2Contract({
    test_command:
      "node --test tests/smoke/wechat-devtools-multi-user.smoke.test.mjs "
      + "# 微信开发者工具 multi-user",
    expected_behavior:
      "微信开发者工具 multi-user smoke creates and lists only owner tasks",
    stop_condition:
      "微信开发者工具 multi-user smoke passes; CloudBase isolation proven",
  });
  await writeProposal(projectPath, [honest], externalPlanRel);

  const proposed = runCli(projectPath, [
    "plan",
    "propose",
    "--file",
    ".ohno/plan.json",
  ]);
  assert.equal(proposed.status, 0, proposed.stderr);
  assert.match(proposed.stdout, /^ACCEPTANCE_SOURCE: /m);
  assert.match(proposed.stdout, /^ACCEPTANCE_DIGEST: [a-f0-9]{64}$/m);
  const revision = /^PLAN_REVISION: ([a-f0-9]{64})$/m.exec(proposed.stdout)?.[1];
  const diff = /^DIFF_DIGEST: ([a-f0-9]{64})$/m.exec(proposed.stdout)?.[1];
  assert.ok(revision && diff);
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
  assert.match(accepted.stdout, /ACCEPTANCE_SOURCE:/);
  assert.match(accepted.stdout, /ACCEPTANCE_DIGEST:/);
});

test("missing acceptance_source is refused", async (t) => {
  const projectPath = await createProject(t);
  runInit(projectPath, ownerGoal);
  await writeFile(
    resolve(projectPath, ".ohno", "plan.json"),
    `${JSON.stringify({
      cursor: 0,
      ordered_tasks: [frozenPlanTask()],
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
    /ACCEPTANCE_BASIS_REQUIRED/i,
  );
});

test("unreadable acceptance_source is refused", async (t) => {
  const projectPath = await createProject(t);
  runInit(projectPath, ownerGoal);
  await writeProposal(
    projectPath,
    [frozenPlanTask()],
    ".ohno/does-not-exist-basis.md",
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
    /ACCEPTANCE_BASIS_UNREADABLE/i,
  );
});

test("accept re-reads basis and blocks content drift after propose", async (t) => {
  const projectPath = await createProject(t);
  runInit(projectPath, ownerGoal);
  const tasks = [frozenPlanTask({
    test_command: "node --test slice.test.mjs",
    allowed_files: ["slice.test.mjs"],
  })];
  writeDefaultAcceptanceBasis(projectPath, tasks, ".ohno/acceptance-basis.md");
  await writeProposal(projectPath, tasks, ".ohno/acceptance-basis.md");

  const proposed = runCli(projectPath, [
    "plan",
    "propose",
    "--file",
    ".ohno/plan.json",
  ]);
  assert.equal(proposed.status, 0, proposed.stderr);
  const revision = /^PLAN_REVISION: ([a-f0-9]{64})$/m.exec(proposed.stdout)?.[1];
  const diff = /^DIFF_DIGEST: ([a-f0-9]{64})$/m.exec(proposed.stdout)?.[1];

  // Drift the basis after propose, before accept.
  await writeFile(
    resolve(projectPath, ".ohno", "acceptance-basis.md"),
    "# Changed after propose\n\nNow claims 微信开发者工具 multi-user smoke.\n",
    "utf8",
  );

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
    /ACCEPTANCE_BASIS_DRIFT|ACCEPTANCE_DENOMINATOR_SHRINK/i,
  );
});

test("contract-internal heavy path without matching test is hard-blocked", async (t) => {
  const projectPath = await createProject(t);
  runInit(projectPath, ownerGoal);
  const tasks = [
    frozenPlanTask({
      id: "internal-contradiction",
      expected_behavior:
        "Multi-user smoke and WeChat DevTools path create and list tasks",
      test_command:
        "npm test -- --run cloudfunctions/createTask/index.test.js",
      stop_condition:
        "微信开发者工具 multi-user smoke passes and real-world path verified",
      allowed_files: ["cloudfunctions/**"],
    }),
  ];
  // Basis itself is honest about only unit tests — contract still contradicts.
  writeDefaultAcceptanceBasis(projectPath, tasks, ".ohno/acceptance-basis.md");
  await writeProposal(projectPath, tasks, ".ohno/acceptance-basis.md");
  const proposed = runCli(projectPath, [
    "plan",
    "propose",
    "--file",
    ".ohno/plan.json",
  ]);
  assert.notEqual(proposed.status, 0);
  assert.match(
    `${proposed.stderr}\n${proposed.stdout}`,
    /ACCEPTANCE_DENOMINATOR_SHRINK|freeze-contract internal contradiction/i,
  );
});

test("--allow-weak-plan does not override denominator shrink", async (t) => {
  const projectPath = await createProject(t);
  runInit(projectPath, ownerGoal);
  await writeExternalPlan(
    projectPath,
    "## cloudbase-data\n\nMust use 微信开发者工具 multi-user smoke.\n",
  );
  await writeProposal(projectPath, [task2Contract()], externalPlanRel);
  const proposed = runCli(projectPath, [
    "plan",
    "propose",
    "--file",
    ".ohno/plan.json",
  ]);
  // Propose already hard-blocks; no accept path to weak-override.
  assert.notEqual(proposed.status, 0);
  assert.match(
    `${proposed.stderr}\n${proposed.stdout}`,
    /ACCEPTANCE_DENOMINATOR_SHRINK/i,
  );
});
