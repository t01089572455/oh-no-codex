/**
 * P0: plan accept must not forge PROJECT_COMPLETE / DONE without PASS.
 */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
  createProject,
  frozenPlanTask,
  runCli,
  runInit,
  writeStructuredAcceptanceBasis,
} from "../helpers/blackbox.mjs";

function ensureBasisInTruth(cwd, acceptanceSource = ".ohno/acceptance-basis.json") {
  const statePath = resolve(cwd, ".ohno", "state.json");
  const state = JSON.parse(readFileSync(statePath, "utf8"));
  const has = state.truth_inventory.classification.some(
    (entry) => entry.path === acceptanceSource && entry.truth_target === true,
  );
  if (!has) {
    state.truth_inventory.classification.push({
      path: acceptanceSource,
      truth_target: true,
      concerns: ["acceptance-basis"],
      reason: "test fixture",
    });
    writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  }
}

async function proposePlan(cwd, tasks, cursor) {
  const basisPath = ".ohno/acceptance-basis.json";
  writeStructuredAcceptanceBasis(
    cwd,
    tasks
      .filter((t) => t.status === "FROZEN")
      .map((t) => ({
        id: t.id,
        expected_behavior: t.expected_behavior,
        test_command: t.test_command,
        stop_condition: t.stop_condition,
      })),
    basisPath,
  );
  ensureBasisInTruth(cwd, basisPath);
  await writeFile(
    resolve(cwd, ".ohno", "cursor-plan.json"),
    `${JSON.stringify({
      cursor,
      ordered_tasks: tasks,
      acceptance_source: basisPath,
    }, null, 2)}\n`,
    "utf8",
  );
  return runCli(cwd, ["plan", "propose", "--file", ".ohno/cursor-plan.json"]);
}

test("plan propose refuses cursor past completed count (no forged PROJECT_COMPLETE)", async (t) => {
  const projectPath = await createProject(t);
  runInit(projectPath, "cursor honesty");
  await writeFile(resolve(projectPath, "pass.mjs"), "process.exit(0);\n", "utf8");

  const tasks = [
    frozenPlanTask({
      id: "t1",
      title: "one",
      test_command: "node pass.mjs",
      allowed_files: ["pass.mjs"],
    }),
    frozenPlanTask({
      id: "t2",
      title: "two",
      test_command: "node pass.mjs",
      allowed_files: ["pass.mjs"],
    }),
  ];

  const forged = await proposePlan(projectPath, tasks, 2);
  assert.notEqual(forged.status, 0, forged.stdout + forged.stderr);
  assert.match(
    `${forged.stderr}${forged.stdout}`,
    /cursor|completed|verify|PASS|forged|honest/i,
  );

  const ok = await proposePlan(projectPath, tasks, 0);
  assert.equal(ok.status, 0, ok.stderr);
  const rev = /^PLAN_REVISION: ([a-f0-9]{64})$/m.exec(ok.stdout)?.[1];
  const dig = /^DIFF_DIGEST: ([a-f0-9]{64})$/m.exec(ok.stdout)?.[1];
  assert.ok(rev && dig);
  const accepted = runCli(projectPath, [
    "plan",
    "accept",
    "--revision",
    rev,
    "--diff",
    dig,
    "--allow-weak-plan",
  ]);
  assert.equal(accepted.status, 0, accepted.stderr);

  const status = JSON.parse(runCli(projectPath, ["status", "--json"]).stdout);
  assert.equal(status.cursor, 0);
  assert.equal(status.completed_count, 0);
  assert.equal(status.next_action, "START_TASK:t1");
  assert.equal(status.plan_board[0].phase, "READY");
  assert.equal(status.plan_board[1].phase, "QUEUED");
  assert.notEqual(status.next_action, "PROJECT_COMPLETE");
});

test("board DONE tracks completed receipts, not bare cursor ahead of proof", async (t) => {
  const projectPath = await createProject(t);
  runInit(projectPath, "board honesty");
  await writeFile(resolve(projectPath, "pass.mjs"), "process.exit(0);\n", "utf8");
  const tasks = [
    frozenPlanTask({
      id: "alpha",
      title: "alpha",
      test_command: "node pass.mjs",
      allowed_files: ["pass.mjs"],
    }),
    frozenPlanTask({
      id: "beta",
      title: "beta",
      test_command: "node pass.mjs",
      allowed_files: ["pass.mjs"],
    }),
  ];
  const proposed = await proposePlan(projectPath, tasks, 0);
  assert.equal(proposed.status, 0, proposed.stderr);
  const rev = /^PLAN_REVISION: ([a-f0-9]{64})$/m.exec(proposed.stdout)[1];
  const dig = /^DIFF_DIGEST: ([a-f0-9]{64})$/m.exec(proposed.stdout)[1];
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

  // Corrupt state the way a buggy older build could: cursor advanced without completed.
  const statePath = resolve(projectPath, ".ohno", "state.json");
  const raw = JSON.parse(readFileSync(statePath, "utf8"));
  raw.cursor = 2;
  raw.completed = [];
  writeFileSync(statePath, `${JSON.stringify(raw, null, 2)}\n`, "utf8");

  const status = JSON.parse(runCli(projectPath, ["status", "--json"]).stdout);
  assert.equal(status.completed_count, 0);
  assert.ok(
    status.plan_board.every((entry) => entry.phase !== "DONE"),
    `forged cursor must not paint DONE: ${JSON.stringify(status.plan_board)}`,
  );
  assert.notEqual(status.next_action, "PROJECT_COMPLETE");
});
