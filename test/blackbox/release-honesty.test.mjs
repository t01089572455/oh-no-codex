import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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
  reviewPlan,
  runCli,
  runInit,
} from "../helpers/blackbox.mjs";
import { selectRequiredPaths } from "../../dist/truth.js";

const ownerGoal =
  "Help the Owner stop procrastinating and avoid underestimating effort";

test("init requires Owner goal, preserves AGENTS, seeds multi-path Truth and runtime ignore", async (t) => {
  const projectPath = await createProject(t);
  const ownerProse = [
    "# Owner agents",
    "",
    "Do not delete this Owner rule: ALWAYS_ASK_BEFORE_DEPLOY",
    "",
  ].join("\n");
  await writeFile(resolve(projectPath, "AGENTS.md"), ownerProse, "utf8");
  await writeFile(resolve(projectPath, "README.md"), "# Product\n", "utf8");
  await mkdir(resolve(projectPath, "docs"), { recursive: true });
  await writeFile(
    resolve(projectPath, "docs", "PRODUCT-CONTRACT.md"),
    "# Contract\n",
    "utf8",
  );

  const missing = runCli(projectPath, ["init"]);
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /usage: ohno init --goal/i);

  const init = runInit(projectPath, ownerGoal);
  assert.match(init.stdout, /preserved existing file/i);
  assert.match(init.stdout, /seeded \.ohno\/truth\.json/i);
  assert.match(init.stdout, new RegExp(`GOAL: ${ownerGoal}`));

  const agents = await readFile(resolve(projectPath, "AGENTS.md"), "utf8");
  assert.match(agents, /ALWAYS_ASK_BEFORE_DEPLOY/);
  assert.match(agents, /ohno:managed-begin/);

  const truth = JSON.parse(
    await readFile(resolve(projectPath, ".ohno", "truth.json"), "utf8"),
  );
  const paths = truth.targets.map((target) => target.path);
  assert.ok(paths.includes("AGENTS.md"));
  assert.ok(paths.includes("README.md"));
  assert.ok(paths.includes("docs/PRODUCT-CONTRACT.md"));
  // Default Truth must not be AGENTS-only when more high-risk paths exist.
  assert.ok(paths.length >= 3);

  const required = selectRequiredPaths(truth, [], []);
  assert.ok(required.includes("README.md"));
  assert.ok(required.includes("docs/PRODUCT-CONTRACT.md"));

  const ignore = await readFile(
    resolve(projectPath, ".ohno", ".gitignore"),
    "utf8",
  );
  assert.match(ignore, /cockpit\.runtime\.json/);
  assert.doesNotMatch(ignore, /cockpit-runtime\.json/);

  await writeFile(
    resolve(projectPath, ".ohno", "cockpit.runtime.json"),
    "{\"pid\":1}\n",
    "utf8",
  );
  const checkIgnore = spawnSync(
    "git",
    ["-C", projectPath, "check-ignore", "-v", ".ohno/cockpit.runtime.json"],
    { encoding: "utf8", windowsHide: true },
  );
  assert.equal(checkIgnore.status, 0, checkIgnore.stderr);
  assert.match(checkIgnore.stdout, /cockpit\.runtime\.json/);

  const status = runCli(projectPath, ["status", "--json"]);
  assert.equal(status.status, 0, status.stderr);
  const model = JSON.parse(status.stdout);
  assert.equal(model.goal, ownerGoal);
  assert.ok(model.truth_target_count >= 3);
});

test("ACTIVE projects CONTINUE_ACTIVE and keep Owner project goal stable", async (t) => {
  const projectPath = await createProject(t);
  runInit(projectPath, ownerGoal);
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
        goal: "Slice A task goal (not project goal)",
        expected_behavior: "User sees slice A done",
        test_command: "node --test slice-a.test.mjs",
        stop_condition: "Stop after unit black box",
        allowed_files: ["slice-a.test.mjs", "src/**"],
        time_budget_minutes: 30,
      }),
      frozenPlanTask({
        id: "slice-b",
        title: "Bounded slice B",
        goal: "Later task goal",
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
  // Project goal must not follow the cursor/task goal (#10).
  assert.equal(model.goal, ownerGoal);
  assert.notEqual(model.goal, "Slice A task goal (not project goal)");

  const next = runCli(projectPath, ["next"]);
  assert.equal(next.stdout, "CONTINUE_ACTIVE:slice-a\n");
  const resume = runCli(projectPath, ["resume"]);
  assert.match(resume.stdout, new RegExp(`^GOAL: ${ownerGoal}$`, "m"));
  assert.match(resume.stdout, /ACTIVE_NOTE:/);
});

// Denominator hard-gate public cases live in acceptance-denominator.test.mjs.
