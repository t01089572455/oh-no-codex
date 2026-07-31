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

test("projectors write PROGRESS.md and AGENTS managed block from state", async (t) => {
  const projectPath = await createProject(t);
  const init = runCli(projectPath, [
    "init",
    "--goal",
    "Keep projections honest",
  ]);
  assert.equal(init.status, 0, init.stderr);

  await writeFile(
    resolve(projectPath, "AGENTS.md"),
    "# Owner rules\n\nDo not invent architecture.\n",
    "utf8",
  );

  reviewPlan(projectPath, {
    tasks: [
      frozenPlanTask({
        id: "board-active",
        title: "Active board row",
        goal: "Show ACTIVE phase",
        expected_behavior: "Board marks the active task",
        test_command: `"${process.execPath}" -e "process.exit(0)"`,
        stop_condition: "Stop after green",
        allowed_files: ["subject.txt"],
        time_budget_minutes: 20,
      }),
      {
        id: "board-outline",
        title: "Future outline",
        goal: "Remain outline",
        status: "OUTLINE",
      },
    ],
  });

  const started = runCli(projectPath, ["task", "start"]);
  assert.equal(started.status, 0, started.stderr);

  const refreshed = runCli(projectPath, ["projectors", "refresh"]);
  assert.equal(refreshed.status, 0, refreshed.stderr);
  assert.match(refreshed.stdout, /PROGRESS: \.ohno\/PROGRESS\.md/);
  assert.match(refreshed.stdout, /REQUIREMENTS: \.ohno\/REQUIREMENTS\.md/);
  assert.match(refreshed.stdout, /AGENTS: AGENTS\.md/);

  const requirements = await readFile(
    resolve(projectPath, ".ohno", "REQUIREMENTS.md"),
    "utf8",
  );
  assert.match(requirements, /ohno:requirements-projection-begin/);
  assert.match(requirements, /board-active/);

  const noted = runCli(projectPath, [
    "requirements",
    "note",
    "--text",
    "Owner wants draft save before any platform rewrite",
  ]);
  assert.equal(noted.status, 0, noted.stderr);
  const requirements2 = await readFile(
    resolve(projectPath, ".ohno", "REQUIREMENTS.md"),
    "utf8",
  );
  assert.match(requirements2, /Owner wants draft save before any platform rewrite/);
  assert.match(requirements2, /Owner notes \(append-only\)/);

  const progress = await readFile(
    resolve(projectPath, ".ohno", "PROGRESS.md"),
    "utf8",
  );
  assert.match(progress, /ohno:generated-progress-v1/);
  assert.match(progress, /board-active/);
  assert.match(progress, /\*\*ACTIVE\*\*/);
  assert.match(progress, /\*\*OUTLINE\*\*/);
  assert.match(progress, /Not a second authority/);

  const agents = await readFile(resolve(projectPath, "AGENTS.md"), "utf8");
  assert.match(agents, /Do not invent architecture/);
  assert.match(agents, /ohno:managed-begin/);
  assert.match(agents, /ohno:managed-end/);
  assert.match(agents, /\[ACTIVE\]/);
  assert.match(agents, /board-active/);
  assert.match(agents, /projection/);

  // Second refresh replaces the managed block without duplicating it.
  const again = runCli(projectPath, ["projectors", "refresh"]);
  assert.equal(again.status, 0, again.stderr);
  const agents2 = await readFile(resolve(projectPath, "AGENTS.md"), "utf8");
  assert.equal(
    agents2.split("ohno:managed-begin").length - 1,
    1,
  );
  assert.match(agents2, /Do not invent architecture/);
});

test("plan board marks HALF when active proof is FAIL", async (t) => {
  const projectPath = await createProject(t);
  runCli(projectPath, ["init", "--goal", "Show half-finished work"]);
  await writeFile(resolve(projectPath, "subject.txt"), "x\n", "utf8");
  await writeFile(
    resolve(projectPath, "fail.mjs"),
    "process.exit(1);\n",
    "utf8",
  );
  reviewPlan(projectPath, {
    tasks: [
      frozenPlanTask({
        id: "half-task",
        title: "Half finished",
        goal: "Fail once",
        expected_behavior: "Verify fails and stays half",
        test_command: `"${process.execPath}" "fail.mjs"`,
        stop_condition: "Stop after fail path is clear",
        allowed_files: ["subject.txt", "fail.mjs"],
        time_budget_minutes: 15,
      }),
    ],
  });
  assert.equal(runCli(projectPath, ["task", "start"]).status, 0);
  const verified = runCli(projectPath, ["verify"]);
  assert.notEqual(verified.status, 0);

  const status = runCli(projectPath, ["status", "--json"]);
  assert.equal(status.status, 0, status.stderr);
  const model = JSON.parse(status.stdout);
  assert.equal(model.plan_board[0].phase, "HALF");
  assert.equal(model.proof_freshness, "FAIL");
  assert.equal(model.document_sync_status, "CLEAN");
  assert.ok(model.truth_target_count >= 0);
  assert.ok(Array.isArray(model.truth_targets));
  assert.equal(typeof model.handoff.path, "string");
});

test("doctor reports state and projection health", async (t) => {
  const projectPath = await createProject(t);
  runCli(projectPath, ["init", "--goal", "Doctor health surface"]);
  const doctor = runCli(projectPath, ["doctor"]);
  assert.equal(doctor.status, 0, doctor.stderr);
  assert.match(doctor.stdout, /^OK: YES$/m);
  assert.match(doctor.stdout, /PASS: state/);
  assert.match(doctor.stdout, /NEXT:/);

  const json = runCli(projectPath, ["doctor", "--json"]);
  assert.equal(json.status, 0, json.stderr);
  const report = JSON.parse(json.stdout);
  assert.equal(report.ok, true);
  assert.ok(Array.isArray(report.checks));
});
