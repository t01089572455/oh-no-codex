/**
 * Integrity holes from post-0.1.8 audit: basis drift, requirements race.
 * Plan cursor forge lives in plan-cursor-honesty.test.mjs.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";

import {
  cliPath,
  createProject,
  frozenPlanTask,
  readState,
  reviewPlan,
  runCli,
  runInit,
  writeStructuredAcceptanceBasis,
} from "../helpers/blackbox.mjs";

test("task start refuses acceptance basis that drifted after plan review", async (t) => {
  const projectPath = await createProject(t);
  runInit(projectPath, "basis drift");
  await writeFile(resolve(projectPath, "pass.mjs"), "process.exit(0);\n", "utf8");
  const task = frozenPlanTask({
    id: "unit-slice",
    test_command: "node pass.mjs",
    allowed_files: ["pass.mjs"],
    expected_behavior: "unit path green",
    stop_condition: "unit done",
  });
  reviewPlan(projectPath, {
    tasks: [task],
    allowWeakPlan: true,
  });

  // Post-review: strengthen denominator without re-propose.
  writeStructuredAcceptanceBasis(projectPath, [{
    id: "unit-slice",
    expected_behavior: "real e2e path green",
    test_command: "node e2e.mjs",
    stop_condition: "e2e done",
  }]);

  const started = runCli(projectPath, ["task", "start"]);
  assert.notEqual(started.status, 0, started.stdout + started.stderr);
  assert.match(
    `${started.stderr}${started.stdout}`,
    /ACCEPTANCE_BASIS_STALE|DENOMINATOR|basis/i,
  );
  const state = await readState(projectPath);
  assert.equal(state.active_task, null);
});

test("concurrent requirements note keeps every successful owner line", async (t) => {
  const projectPath = await createProject(t);
  runInit(projectPath, "req race");
  const n = 24;
  const runs = Array.from({ length: n }, (_, i) => new Promise((resolvePromise) => {
    const child = spawn(
      process.execPath,
      [cliPath, "requirements", "note", "--text", `race-note-${i}`],
      { cwd: projectPath, stdio: ["ignore", "pipe", "pipe"] },
    );
    let err = "";
    child.stderr.on("data", (chunk) => {
      err += String(chunk);
    });
    child.on("exit", (code) => resolvePromise({ code, err }));
  }));
  const results = await Promise.all(runs);
  const failed = results.filter((r) => r.code !== 0);
  assert.equal(
    failed.length,
    0,
    failed.map((r) => r.err).join("\n") || "some notes failed",
  );
  const body = readFileSync(resolve(projectPath, ".ohno", "REQUIREMENTS.md"), "utf8");
  const found = body.match(/race-note-\d+/g) ?? [];
  assert.equal(
    new Set(found).size,
    n,
    `expected ${n} unique notes, found ${new Set(found).size}: ${[...new Set(found)].sort().join(",")}`,
  );
});
