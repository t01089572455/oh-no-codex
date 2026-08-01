import assert from "node:assert/strict";
import {
  readFile,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
  createProject,
  frozenPlanTask,
  reviewPlan,
  runCli,
} from "../helpers/blackbox.mjs";

test("init preserves Owner AGENTS.md and seeds truth + runtime gitignore", async (t) => {
  const projectPath = await createProject(t);
  const ownerProse = [
    "# Owner agents",
    "",
    "Do not delete this Owner rule: ALWAYS_ASK_BEFORE_DEPLOY",
    "",
  ].join("\n");
  await writeFile(resolve(projectPath, "AGENTS.md"), ownerProse, "utf8");

  const init = runCli(projectPath, ["init"]);
  assert.equal(init.status, 0, init.stderr);
  assert.match(init.stdout, /preserved existing file/i);
  assert.match(init.stdout, /seeded \.ohno\/truth\.json/i);

  const agents = await readFile(resolve(projectPath, "AGENTS.md"), "utf8");
  assert.match(agents, /ALWAYS_ASK_BEFORE_DEPLOY/);
  assert.match(agents, /ohno:managed-begin/);
  assert.match(agents, /ohno:managed-end/);

  const truth = JSON.parse(
    await readFile(resolve(projectPath, ".ohno", "truth.json"), "utf8"),
  );
  assert.equal(truth.schema_version, 1);
  assert.ok(truth.targets.some((target) => target.path === "AGENTS.md"));

  const ignore = await readFile(
    resolve(projectPath, ".ohno", ".gitignore"),
    "utf8",
  );
  assert.match(ignore, /verify\.lock/);
  assert.match(ignore, /cockpit-runtime/);

  const status = runCli(projectPath, ["status", "--json"]);
  assert.equal(status.status, 0, status.stderr);
  const model = JSON.parse(status.stdout);
  assert.ok(model.truth_target_count >= 1);
  assert.ok(model.truth_targets.includes("AGENTS.md"));
});

test("ACTIVE projects CONTINUE_ACTIVE and surfaces task goal", async (t) => {
  const projectPath = await createProject(t);
  assert.equal(runCli(projectPath, ["init"]).status, 0);
  await writeFile(
    resolve(projectPath, "slice-a.test.mjs"),
    "import test from \"node:test\";\ntest(\"slice a\", () => {});\n",
    "utf8",
  );
  await writeFile(
    resolve(projectPath, "slice-b.test.mjs"),
    "import test from \"node:test\";\ntest(\"slice b\", () => {});\n",
    "utf8",
  );

  reviewPlan(projectPath, {
    tasks: [
      frozenPlanTask({
        id: "slice-a",
        title: "Bounded slice A",
        goal: "Owner-facing slice goal must appear on read surfaces",
        expected_behavior: "User sees slice A done",
        test_command: "node --test slice-a.test.mjs",
        stop_condition: "Stop after unit black box",
        allowed_files: ["slice-a.test.mjs", "src/**"],
        time_budget_minutes: 30,
      }),
      frozenPlanTask({
        id: "slice-b",
        title: "Bounded slice B",
        goal: "Later goal",
        expected_behavior: "User sees slice B done",
        test_command: "node --test slice-b.test.mjs",
        stop_condition: "Stop after unit black box",
        allowed_files: ["slice-b.test.mjs", "src/**"],
        time_budget_minutes: 30,
      }),
    ],
  });
  assert.equal(runCli(projectPath, ["task", "start"]).status, 0);

  const model = JSON.parse(runCli(projectPath, ["status", "--json"]).stdout);
  assert.equal(model.status, "ACTIVE");
  assert.equal(model.next_action, "CONTINUE_ACTIVE:slice-a");
  assert.equal(
    model.goal,
    "Owner-facing slice goal must appear on read surfaces",
  );

  const next = runCli(projectPath, ["next"]);
  assert.equal(next.stdout, "CONTINUE_ACTIVE:slice-a\n");

  const resume = runCli(projectPath, ["resume"]);
  assert.match(resume.stdout, /^NEXT: CONTINUE_ACTIVE:slice-a$/m);
  assert.match(
    resume.stdout,
    /^GOAL: Owner-facing slice goal must appear on read surfaces$/m,
  );
  assert.match(resume.stdout, /ACTIVE_NOTE:/);
});

test("plan propose warns when stop claims a heavier path than test_command", async (t) => {
  const projectPath = await createProject(t);
  assert.equal(runCli(projectPath, ["init"]).status, 0);

  await writeFile(
    resolve(projectPath, ".ohno", "shrink-plan.json"),
    `${JSON.stringify({
      cursor: 0,
      ordered_tasks: [
        frozenPlanTask({
          id: "cloudbase-data",
          title: "CloudBase isolation",
          goal: "User isolation",
          expected_behavior:
            "Multi-user smoke and WeChat DevTools path create and list tasks",
          test_command:
            "npm test -- --run cloudfunctions/createTask/index.test.js",
          stop_condition:
            "微信开发者工具 multi-user smoke passes and real-world path verified",
          allowed_files: ["cloudfunctions/**"],
          time_budget_minutes: 90,
        }),
      ],
    }, null, 2)}\n`,
    "utf8",
  );

  const proposed = runCli(projectPath, [
    "plan",
    "propose",
    "--file",
    ".ohno/shrink-plan.json",
  ]);
  assert.equal(proposed.status, 0, proposed.stderr);
  assert.match(proposed.stdout, /WARN:.*denominator shrink|WeChat DevTools|multi-user/i);
});
