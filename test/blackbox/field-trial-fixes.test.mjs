import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
  createProject,
  frozenPlanTask,
  reviewPlan,
  runCli,
  runInit,
  writeDefaultAcceptanceBasis,
  syncTruthInventoryForBasis,
} from "../helpers/blackbox.mjs";

test("field trial: weak blackbox warns on propose and requires --allow-weak-plan to accept", async (t) => {
  const projectPath = await createProject(t);
  assert.equal(runInit(projectPath).status, 0);
  const tasks = [
    frozenPlanTask({
      id: "commit-design-doc",
      title: "Commit design document only",
      goal: "Submit the design markdown",
      expected_behavior: "Design doc is staged and format-checked",
      test_command: "git diff --cached --check -- docs/design.md",
      allowed_files: ["docs/design.md"],
      stop_condition: "Only the design doc",
      time_budget_minutes: 15,
    }),
  ];
  writeDefaultAcceptanceBasis(projectPath, tasks, ".ohno/acceptance-basis.json");
  syncTruthInventoryForBasis(projectPath, ".ohno/acceptance-basis.json");
  const planPath = resolve(projectPath, ".ohno", "toy-plan.json");
  await writeFile(
    planPath,
    JSON.stringify({
      cursor: 0,
      ordered_tasks: tasks,
      acceptance_source: ".ohno/acceptance-basis.json",
    }, null, 2),
    "utf8",
  );
  const propose = runCli(projectPath, [
    "plan",
    "propose",
    "--file",
    ".ohno/toy-plan.json",
  ]);
  assert.equal(propose.status, 0, propose.stderr + propose.stdout);
  assert.match(
    propose.stdout,
    /WARN:.*micro-plan|WARN:.*git diff --check|WARN:.*format only/i,
  );
  const rev = /PLAN_REVISION: ([a-f0-9]+)/.exec(propose.stdout)?.[1];
  const dig = /DIFF_DIGEST: ([a-f0-9]+)/.exec(propose.stdout)?.[1];
  assert.ok(rev && dig);
  const refused = runCli(projectPath, [
    "plan",
    "accept",
    "--revision",
    rev,
    "--diff",
    dig,
  ]);
  assert.notEqual(refused.status, 0);
  assert.match(
    `${refused.stderr}\n${refused.stdout}`,
    /Refuse accept|WEAK_BLACKBOX|format only|trivial/i,
  );
  const accepted = runCli(projectPath, [
    "plan",
    "accept",
    "--revision",
    rev,
    "--diff",
    dig,
    "--allow-weak-plan",
  ]);
  assert.equal(accepted.status, 0, accepted.stderr + accepted.stdout);
  assert.match(accepted.stdout, /LOCAL_REVIEW_RECORDED|WEAK_PLAN_OVERRIDE/);
});

test("field trial: resume frames plan progress and authority cwd", async (t) => {
  const projectPath = await createProject(t);
  assert.equal(runInit(projectPath).status, 0);
  reviewPlan(projectPath, {
    tasks: [
      frozenPlanTask({
        id: "t1",
        test_command: "node --test test/ok.test.mjs",
        allowed_files: ["test/ok.test.mjs"],
      }),
    ],
  });
  const resume = runCli(projectPath, ["resume"]);
  assert.equal(resume.status, 0, resume.stderr);
  assert.match(resume.stdout, /PLAN_PROGRESS:/);
  assert.match(resume.stdout, /AUTHORITY_NOTE:/);
  assert.match(resume.stdout, /of THIS plan|plan-tasks/i);
});

test("field trial: doctor warns on an accepted weak blackbox", async (t) => {
  const projectPath = await createProject(t);
  assert.equal(runInit(projectPath).status, 0);
  const tasks = [
    frozenPlanTask({
      id: "commit-design-doc",
      title: "Commit design document only",
      goal: "Submit the design markdown",
      expected_behavior: "Design doc is staged and format-checked",
      test_command: "git diff --cached --check -- docs/design.md",
      allowed_files: ["docs/design.md"],
      stop_condition: "Only the design doc",
    }),
  ];
  writeDefaultAcceptanceBasis(projectPath, tasks, ".ohno/acceptance-basis.json");
  syncTruthInventoryForBasis(projectPath, ".ohno/acceptance-basis.json");
  const planPath = resolve(projectPath, ".ohno", "toy-plan.json");
  await writeFile(
    planPath,
    JSON.stringify({
      cursor: 0,
      ordered_tasks: tasks,
      acceptance_source: ".ohno/acceptance-basis.json",
    }, null, 2),
    "utf8",
  );
  const propose = runCli(projectPath, [
    "plan",
    "propose",
    "--file",
    ".ohno/toy-plan.json",
  ]);
  const rev = /PLAN_REVISION: ([a-f0-9]+)/.exec(propose.stdout)?.[1];
  const dig = /DIFF_DIGEST: ([a-f0-9]+)/.exec(propose.stdout)?.[1];
  assert.equal(
    runCli(projectPath, [
      "plan",
      "accept",
      "--revision",
      rev,
      "--diff",
      dig,
      "--allow-weak-plan",
    ]).status,
    0,
  );
  assert.equal(runCli(projectPath, ["task", "start"]).status, 0);
  const doctor = runCli(projectPath, ["doctor"]);
  // Hooks file present without Desktop /hooks trust → FAIL hooks (honest).
  assert.match(doctor.stdout, /blackbox_discipline|plan_shape|cli_path|hooks/);
  assert.match(doctor.stdout, /WARN:|FAIL: hooks|REVIEW_REQUIRED/);
});

test("field trial: requirements note accepts up to 16KiB authoring limit", async (t) => {
  const projectPath = await createProject(t);
  assert.equal(runInit(projectPath).status, 0);
  const long = "x".repeat(8_000);
  const note = runCli(projectPath, ["requirements", "note", "--text", long]);
  assert.equal(note.status, 0, note.stderr + note.stdout);
  const tooLong = "y".repeat(17_000);
  const fail = runCli(projectPath, ["requirements", "note", "--text", tooLong]);
  assert.notEqual(fail.status, 0);
  assert.match(fail.stderr + fail.stdout, /16384|UTF-8 bytes/i);
});

test("field trial: task reopen re-activates last completed without double advance", async (t) => {
  const projectPath = await createProject(t);
  assert.equal(runInit(projectPath).status, 0);
  await mkdir(resolve(projectPath, "test"), { recursive: true });
  await writeFile(
    resolve(projectPath, "test", "ok.test.mjs"),
    'import test from "node:test";\ntest("ok", () => {});\n',
    "utf8",
  );
  reviewPlan(projectPath, {
    tasks: [
      frozenPlanTask({
        id: "t1",
        title: "Smoke",
        goal: "pass smoke",
        expected_behavior: "node test passes",
        test_command: "node --test test/ok.test.mjs",
        allowed_files: ["test/ok.test.mjs"],
        stop_condition: "smoke only",
      }),
      frozenPlanTask({
        id: "t2",
        title: "Second",
        goal: "later",
        expected_behavior: "second",
        test_command: "node --test test/ok.test.mjs",
        allowed_files: ["test/ok.test.mjs"],
        stop_condition: "second",
      }),
    ],
  });
  assert.equal(runCli(projectPath, ["task", "start"]).status, 0);
  const verify = runCli(projectPath, ["verify"]);
  assert.equal(verify.status, 0, verify.stdout + verify.stderr);
  // PASS path prints next_action only (e.g. START_TASK:t2)
  assert.match(verify.stdout, /START_TASK:t2|PROJECT_COMPLETE|FREEZE_TASK/);

  const afterPass = JSON.parse(runCli(projectPath, ["status", "--json"]).stdout);
  assert.equal(afterPass.cursor, 1);
  assert.equal(afterPass.completed_count, 1);

  const reopen = runCli(projectPath, ["task", "reopen"]);
  assert.equal(reopen.status, 0, reopen.stdout + reopen.stderr);
  assert.match(reopen.stdout, /REOPENED: t1/);
  const body = JSON.parse(runCli(projectPath, ["status", "--json"]).stdout);
  assert.equal(body.status, "ACTIVE");
  assert.equal(body.current_task?.id, "t1");
  assert.equal(body.cursor, 0, "reopen rolls cursor back to the reopened task");
  assert.equal(body.completed_count, 0, "reopen drops task from completed until PASS");

  const verify2 = runCli(projectPath, ["verify"]);
  assert.equal(verify2.status, 0, verify2.stdout + verify2.stderr);
  const status2 = JSON.parse(runCli(projectPath, ["status", "--json"]).stdout);
  assert.equal(status2.cursor, 1, "fresh PASS after reopen advances once");
  assert.equal(status2.completed_count, 1);
  assert.equal(status2.status, "IDLE");
});

test("field trial: cockpit copy is plan-complete not product complete", async () => {
  const { readFile } = await import("node:fs/promises");
  const js = await readFile(
    new URL("../../assets/cockpit/cockpit.js", import.meta.url),
    "utf8",
  );
  assert.match(js, /PLAN DONE|This linear plan is complete/);
  assert.doesNotMatch(js, /sub: "Project complete"/);
  // 0.1.6: primary label is "N of M plan tasks" (no bare percent product vibe).
  assert.match(js, /plan tasks/);
  assert.match(js, /not product completion/i);
  const html = await readFile(
    new URL("../../assets/cockpit/index.html", import.meta.url),
    "utf8",
  );
  assert.match(html, /PLAN CURSOR/);
  assert.match(html, /not product completion/i);
});
