import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { watch } from "node:fs";
import {
  access,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
  cliPath,
  createProject,
  frozenPlanTask,
  readStateBytes,
  reviewPlan,
  runCli,
  spawnCli,
  runInit,
} from "../helpers/blackbox.mjs";

async function initialize(projectPath) {
  const initialized = runInit(projectPath);
  assert.equal(initialized.status, 0, initialized.stderr);
}

function runGit(projectPath, args) {
  const result = spawnSync("git", args, {
    cwd: projectPath,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  return result;
}

function runHook(projectPath, hookEventName, fields = {}) {
  const result = spawnSync(process.execPath, [cliPath, "hook"], {
    cwd: projectPath,
    encoding: "utf8",
    input: `${JSON.stringify({
      session_id: "task7-a15",
      transcript_path: null,
      cwd: projectPath,
      hook_event_name: hookEventName,
      model: "test-model",
      permission_mode: "default",
      ...fields,
    })}\n`,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.notEqual(result.stdout.trim(), "");
  return JSON.parse(result.stdout);
}

async function startReadOnlyCockpit(projectPath) {
  const child = spawn(process.execPath, [cliPath, "cockpit"], {
    cwd: projectPath,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  let stdout = "";
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const exitPromise = once(child, "exit");
  const url = await new Promise((resolveUrl, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Cockpit URL timeout:\n${stdout}\n${stderr}`));
    }, 10_000);
    const onData = (chunk) => {
      stdout += chunk;
      const match = /http:\/\/127\.0\.0\.1:\d+\//u.exec(stdout);
      if (match) {
        clearTimeout(timeout);
        child.stdout.off("data", onData);
        resolveUrl(match[0]);
      }
    };
    child.stdout.on("data", onData);
    child.once("exit", (code, signal) => {
      clearTimeout(timeout);
      reject(
        new Error(
          `Cockpit exited before URL (${code}/${signal}):\n${stdout}\n${stderr}`,
        ),
      );
    });
  });
  let stopped = false;
  return {
    url,
    async stop() {
      if (stopped) {
        return;
      }
      stopped = true;
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGTERM");
      }
      await exitPromise;
    },
  };
}

test("corrupt current authority fails closed without byte replacement", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  const statePath = resolve(projectPath, ".ohno", "state.json");
  const corruptBytes = Buffer.from(
    '{\n  "schema_version": 2,\n  "goal": "truncated authority"\n}\n',
    "utf8",
  );
  await writeFile(statePath, corruptBytes);

  for (const args of [
    ["status", "--json"],
    ["task", "start"],
    ["change", "begin", "--summary", "Do not overwrite corrupt evidence"],
  ]) {
    const rejected = runCli(projectPath, args);
    assert.notEqual(rejected.status, 0, args.join(" "));
    assert.deepEqual(await readFile(statePath), corruptBytes, args.join(" "));
  }
});

test("interrupting an atomic replacement leaves known old or valid new authority", async (t) => {
  const largeTask = frozenPlanTask({
    id: "atomic-interrupt",
    title: "Observe one interrupted replacement",
    goal: "Keep old or new current authority valid",
    expected_behavior: "The current state is never truncated",
    stop_condition: `Stop after observing the temporary write ${"x".repeat(20_000)}`,
    allowed_files: ["subject.txt"],
    time_budget_minutes: 30,
  });
  let observedInterruptedWrite = false;

  for (
    let attempt = 0;
    attempt < 12 && !observedInterruptedWrite;
    attempt += 1
  ) {
    const projectPath = await createProject(t);
    await initialize(projectPath);
    await writeFile(
      resolve(projectPath, "subject.txt"),
      "bounded subject\n",
      "utf8",
    );
    reviewPlan(projectPath, { tasks: [largeTask] });
    const oldStateBytes = await readStateBytes(projectPath);
    const stateDirectory = resolve(projectPath, ".ohno");
    let child;
    let sawTemporaryFile = false;
    let killAccepted = false;

    const watcher = watch(stateDirectory, (_eventType, filename) => {
      if (filename?.endsWith(".tmp") && child) {
        sawTemporaryFile = true;
        killAccepted ||= child.kill();
      }
    });
    child = spawnCli(projectPath, ["task", "start"]);
    child.stdout.resume();
    child.stderr.resume();
    const [exitCode, signal] = await once(child, "exit");
    watcher.close();

    if (sawTemporaryFile && killAccepted && signal !== null) {
      observedInterruptedWrite = true;
      assert.equal(exitCode, null);
      const currentBytes = await readStateBytes(projectPath);
      if (!currentBytes.equals(oldStateBytes)) {
        assert.doesNotThrow(() => JSON.parse(currentBytes.toString("utf8")));
        const status = runCli(projectPath, ["status", "--json"]);
        assert.equal(status.status, 0, status.stderr);
        const model = JSON.parse(status.stdout);
        assert.equal(model.status, "ACTIVE");
        assert.equal(model.current_task.id, "atomic-interrupt");
      }
    }
  }

  assert.equal(
    observedInterruptedWrite,
    true,
    "the public black box must kill a writer after observing its temporary file",
  );
});

test("normal read surfaces and every supported hook avoid Truth and project-test scans", async (t) => {
  const projectPath = await createProject(t);
  const sentinelPath = resolve(projectPath, "project-test-ran.txt");
  await mkdir(resolve(projectPath, ".ohno"), { recursive: true });
  await mkdir(resolve(projectPath, "docs"), { recursive: true });
  await writeFile(resolve(projectPath, "README.md"), "# Trial project\n", "utf8");
  await writeFile(resolve(projectPath, "AGENTS.md"), "# Trial rules\n", "utf8");
  await writeFile(resolve(projectPath, "docs", "PRODUCT.md"), "baseline product\n", "utf8");
  await writeFile(resolve(projectPath, "docs", "PLAN.md"), "baseline plan\n", "utf8");
  await writeFile(resolve(projectPath, "subject.txt"), "bounded subject\n", "utf8");
  await writeFile(
    resolve(projectPath, "project-test.mjs"),
    [
      'import { writeFileSync } from "node:fs";',
      'writeFileSync("project-test-ran.txt", "unexpected execution\\n");',
      "process.exit(0);",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    resolve(projectPath, ".ohno", "truth.json"),
    `${JSON.stringify({
      schema_version: 1,
      targets: [
        { path: "README.md", concerns: ["public-capability"] },
        { path: "docs/PRODUCT.md", concerns: ["requirements"] },
        { path: "docs/PLAN.md", concerns: ["requirements", "plan"] },
        { path: "AGENTS.md", concerns: ["agent-rules"] },
      ],
    }, null, 2)}\n`,
    "utf8",
  );
  runGit(projectPath, ["add", "--all"]);
  runGit(projectPath, [
    "-c",
    "user.name=Oh No Test",
    "-c",
    "user.email=ohno@example.invalid",
    "commit",
    "--quiet",
    "-m",
    "governing baseline",
  ]);
  await initialize(projectPath);
  reviewPlan(projectPath, {
    tasks: [
      frozenPlanTask({
        id: "a15-read-isolation",
        title: "Keep read surfaces side-effect free",
        goal: "Read current state without rescanning project authority",
        expected_behavior:
          "Read surfaces never execute the frozen project test or rescan Truth",
        test_command: `"${process.execPath}" "project-test.mjs"`,
        stop_condition: "Stop after the A15 regression stays side-effect free",
        allowed_files: ["subject.txt"],
        time_budget_minutes: 30,
      }),
    ],
  });
  const started = runCli(projectPath, ["task", "start"]);
  assert.equal(started.status, 0, started.stderr);

  await mkdir(resolve(projectPath, "deep"), { recursive: true });
  await writeFile(
    resolve(projectPath, "deep", "AGENTS.override.md"),
    "# New unclassified high-risk entry\n",
    "utf8",
  );
  const before = await readStateBytes(projectPath);
  const directResume = runCli(projectPath, ["resume"]);
  assert.equal(directResume.status, 0, directResume.stderr);
  for (const args of [["status", "--json"], ["next"]]) {
    const result = runCli(projectPath, args);
    assert.equal(result.status, 0, result.stderr);
  }

  const session = runHook(projectPath, "SessionStart", { source: "startup" });
  assert.equal(
    session.hookSpecificOutput?.additionalContext,
    directResume.stdout,
  );
  const compact = runHook(projectPath, "PostCompact", {
    turn_id: "task7-a15",
    trigger: "manual",
  });
  assert.equal(compact.systemMessage, directResume.stdout);
  const preTool = runHook(projectPath, "PreToolUse", {
    turn_id: "task7-a15",
    tool_name: "apply_patch",
    tool_use_id: "task7-a15-tool",
    tool_input: {
      command: [
        "*** Begin Patch",
        "*** Update File: subject.txt",
        "@@",
        "+bounded read-isolation fixture",
        "*** End Patch",
      ].join("\n"),
    },
  });
  assert.equal(preTool.hookSpecificOutput?.permissionDecision, undefined);
  const stopped = runHook(projectPath, "Stop", {
    turn_id: "task7-a15",
    stop_hook_active: false,
    last_assistant_message: "Work remains in progress.",
  });
  assert.equal(stopped.decision, "block");
  assert.match(stopped.reason, /^OHNO_AUTO_CONTINUE\r?\n/u);
  assert.match(
    stopped.reason,
    /^next: CONTINUE_ACTIVE:a15-read-isolation$/mu,
  );

  const cockpit = await startReadOnlyCockpit(projectPath);
  try {
    const response = await fetch(new URL("api/state", cockpit.url));
    assert.equal(response.status, 200);
    const expected = JSON.parse(
      runCli(projectPath, ["status", "--json"]).stdout,
    );
    assert.deepEqual(await response.json(), expected);
  } finally {
    await cockpit.stop();
  }

  assert.deepEqual(await readStateBytes(projectPath), before);
  await assert.rejects(
    access(sentinelPath),
    (error) => error.code === "ENOENT",
  );
  const detectedOnlyAtChangeBegin = runCli(projectPath, [
    "change",
    "begin",
    "--summary",
    "Detect the new governing entry at the explicit scan boundary",
    "--concerns",
    "requirements",
  ]);
  assert.notEqual(detectedOnlyAtChangeBegin.status, 0);
  assert.match(
    detectedOnlyAtChangeBegin.stderr,
    /UNCLASSIFIED_HIGH_RISK.*deep\/AGENTS\.override\.md/iu,
  );
  assert.deepEqual(await readStateBytes(projectPath), before);
  await assert.rejects(
    access(sentinelPath),
    (error) => error.code === "ENOENT",
  );
});
