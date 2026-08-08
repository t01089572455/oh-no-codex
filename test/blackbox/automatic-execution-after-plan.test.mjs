import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
  cliPath,
  createProject,
  frozenPlanTask,
  readState,
  reviewPlan,
  runCli,
  runInit,
  syncTruthInventoryForBasis,
  writeStructuredAcceptanceBasis,
} from "../helpers/blackbox.mjs";

const automaticPrefix = "OHNO_AUTO_CONTINUE";

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hookInput(cwd, hookEventName, fields = {}) {
  return {
    session_id: "session-auto-plan",
    transcript_path: null,
    cwd,
    hook_event_name: hookEventName,
    model: "test-model",
    permission_mode: "default",
    ...fields,
  };
}

function runHook(cwd, hookEventName, fields = {}) {
  return spawnSync(process.execPath, [cliPath, "hook"], {
    cwd,
    encoding: "utf8",
    input: `${JSON.stringify(hookInput(cwd, hookEventName, fields))}\n`,
  });
}

function parseHookResult(result) {
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.notEqual(result.stdout.trim(), "");
  return JSON.parse(result.stdout);
}

function stop(cwd, message) {
  return parseHookResult(runHook(cwd, "Stop", {
    turn_id: "turn-stop",
    stop_hook_active: false,
    last_assistant_message: message,
  }));
}

function assertAutomatic(output, nextAction, proof) {
  assert.equal(output.decision, "block");
  assert.match(output.reason, /^OHNO_AUTO_CONTINUE(?:\r?\n|$)/u);
  assert.match(output.reason, /OHNO_CONTINUE/u);
  assert.match(
    output.reason,
    new RegExp(
      `^next: ${nextAction.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}$`,
      "mu",
    ),
  );
  if (proof !== undefined) {
    assert.match(
      output.reason,
      new RegExp(`^proof: ${proof}$`, "miu"),
    );
  }
  assert.match(
    output.reason,
    /no Owner ask|stay in scope|ohno verify|mode:/iu,
  );
}

function applyPatchCommand(path) {
  return [
    "*** Begin Patch",
    `*** Add File: ${path}`,
    "+fixture",
    "*** End Patch",
  ].join("\n");
}

function preToolUse(cwd, path) {
  return parseHookResult(runHook(cwd, "PreToolUse", {
    turn_id: "turn-tool",
    tool_name: "apply_patch",
    tool_use_id: "tool-1",
    tool_input: { command: applyPatchCommand(path) },
  }));
}

async function proposePlan(cwd, tasks, basisTasks = tasks) {
  writeStructuredAcceptanceBasis(
    cwd,
    basisTasks.filter((task) => task.status === "FROZEN"),
  );
  syncTruthInventoryForBasis(cwd, ".ohno/acceptance-basis.json");
  await writeFile(
    resolve(cwd, ".ohno", "automatic-plan.json"),
    `${JSON.stringify({
      cursor: 0,
      ordered_tasks: tasks,
      acceptance_source: ".ohno/acceptance-basis.json",
    }, null, 2)}\n`,
    "utf8",
  );
  return runCli(cwd, [
    "plan",
    "propose",
    "--file",
    ".ohno/automatic-plan.json",
  ]);
}

function acceptProposal(cwd, proposal, options = {}) {
  const revision = /^PLAN_REVISION: ([a-f0-9]{64})$/mu.exec(
    proposal.stdout,
  )?.[1];
  const diff = /^DIFF_DIGEST: ([a-f0-9]{64})$/mu.exec(
    proposal.stdout,
  )?.[1];
  assert.ok(revision && diff, proposal.stdout);
  const args = [
    "plan",
    "accept",
    "--revision",
    revision,
    "--diff",
    diff,
  ];
  if (options.allowWeakPlan === true) {
    args.push("--allow-weak-plan");
  }
  return runCli(cwd, args);
}

function spawnPrompt(cwd, index) {
  return new Promise((done) => {
    const child = spawn(process.execPath, [cliPath, "hook"], {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("exit", (code) => {
      done({ code, stdout, stderr });
    });
    child.stdin.end(`${JSON.stringify(hookInput(cwd, "UserPromptSubmit", {
      turn_id: `turn-race-${index}`,
      prompt: `exact-race-prompt-${index}`,
    }))}\n`);
  });
}

test("trusted UserPromptSubmit preserves one exact multiline Owner prompt and excludes synthetic continuation", async (t) => {
  const projectPath = await createProject(t);
  runInit(projectPath, "Preserve Owner inputs before automatic execution");
  const runtimeIgnorePath = resolve(projectPath, ".ohno", ".gitignore");
  const legacyIgnore = (await readFile(runtimeIgnorePath, "utf8"))
    .replace(/^OWNER-INPUTS\.md\r?\n/mu, "");
  await writeFile(runtimeIgnorePath, legacyIgnore, "utf8");

  const sessionId = "owner-session-1";
  const turnId = "owner-turn-1";
  const prompt = [
    "  Keep the leading spaces",
    "```json",
    '{"exact":true}',
    "```",
    "Keep the trailing spaces  ",
  ].join("\n");
  const promptDigest = sha256(prompt);
  const stableId = sha256([
    "ohno-owner-input-v1",
    sessionId,
    turnId,
    promptDigest,
  ].join("\0"));

  const submitted = runHook(projectPath, "UserPromptSubmit", {
    session_id: sessionId,
    turn_id: turnId,
    prompt,
  });
  const submittedOut = parseHookResult(submitted);
  // Real Owner prompts inject live OHNO_PIPELINE (phase next commands).
  assert.match(
    submittedOut.hookSpecificOutput?.additionalContext ?? "",
    /OHNO_PIPELINE/,
  );

  const ownerInputsPath = resolve(projectPath, ".ohno", "OWNER-INPUTS.md");
  const first = await readFile(ownerInputsPath, "utf8");
  assert.match(first, /^# Oh No Owner inputs$/mu);
  assert.match(first, new RegExp(`^## Input ${"`"}${stableId}${"`"}$`, "mu"));
  assert.match(
    first,
    new RegExp(`^- prompt_sha256: ${"`"}${promptDigest}${"`"}$`, "mu"),
  );
  assert.match(first, /^- received_at: `\d{4}-\d{2}-\d{2}T[^`]+Z`$/mu);
  assert.match(first, /^- session_id: `"owner-session-1"`$/mu);
  assert.match(first, /^- turn_id: `"owner-turn-1"`$/mu);
  assert.ok(first.includes(prompt), "the exact prompt text must remain readable");

  const retried = runHook(projectPath, "UserPromptSubmit", {
    session_id: sessionId,
    turn_id: turnId,
    prompt,
  });
  const retriedOut = parseHookResult(retried);
  assert.match(
    retriedOut.hookSpecificOutput?.additionalContext ?? "",
    /OHNO_PIPELINE/,
  );
  assert.equal(
    await readFile(ownerInputsPath, "utf8"),
    first,
    "a retried stable input must not be appended twice",
  );

  const ignored = runHook(projectPath, "UserPromptSubmit", {
    session_id: sessionId,
    turn_id: "synthetic-turn",
    prompt: `${automaticPrefix}\nCANONICAL_NEXT: START_TASK:auto-1`,
  });
  assert.deepEqual(parseHookResult(ignored), {});
  assert.equal(
    await readFile(ownerInputsPath, "utf8"),
    first,
    "Oh No continuation prompts must not impersonate Owner prose",
  );

  const ignoredByGit = spawnSync(
    "git",
    ["check-ignore", "-q", ".ohno/OWNER-INPUTS.md"],
    { cwd: projectPath, encoding: "utf8", windowsHide: true },
  );
  assert.equal(ignoredByGit.status, 0, ignoredByGit.stderr);
});

test("concurrent prompt submissions preserve every successful exact entry", async (t) => {
  const projectPath = await createProject(t);
  runInit(projectPath, "Preserve concurrent Owner inputs");

  const count = 24;
  const results = await Promise.all(
    Array.from({ length: count }, (_, index) => spawnPrompt(projectPath, index)),
  );
  assert.deepEqual(
    results.filter(({ code }) => code !== 0),
    [],
    results.map(({ stderr }) => stderr).filter(Boolean).join("\n"),
  );
  for (const result of results) {
    const parsed = JSON.parse(result.stdout);
    // Successful Owner prompts inject OHNO_PIPELINE; empty only if state unreadable.
    const ctx = parsed.hookSpecificOutput?.additionalContext ?? "";
    assert.match(ctx, /OHNO_PIPELINE/, result.stdout);
  }

  const body = await readFile(
    resolve(projectPath, ".ohno", "OWNER-INPUTS.md"),
    "utf8",
  );
  for (let index = 0; index < count; index += 1) {
    assert.ok(
      body.includes(`exact-race-prompt-${index}`),
      `missing successful prompt ${index}`,
    );
  }
  const ids = [...body.matchAll(/^## Input `([a-f0-9]{64})`$/gmu)]
    .map((match) => match[1]);
  assert.equal(ids.length, count);
  assert.equal(new Set(ids).size, count);
});

test("an accepted plan automatically continues through start, failure, stale proof, advance, and completion", async (t) => {
  const projectPath = await createProject(t);
  runInit(projectPath, "Finish every accepted task without repeated confirmation");
  await writeFile(resolve(projectPath, "subject.txt"), "original\n", "utf8");
  await writeFile(resolve(projectPath, "result.txt"), "fail\n", "utf8");
  await writeFile(
    resolve(projectPath, "verify.mjs"),
    [
      'import { readFileSync } from "node:fs";',
      'process.exit(readFileSync("result.txt", "utf8").trim() === "pass" ? 0 : 9);',
      "",
    ].join("\n"),
    "utf8",
  );

  const common = {
    expected_behavior: "The accepted task runs to exact proof",
    test_command: "node verify.mjs",
    stop_condition: "Stop only after exact fresh proof",
    allowed_files: ["subject.txt", "result.txt", "verify.mjs"],
    time_budget_minutes: 30,
  };
  reviewPlan(projectPath, {
    tasks: [
      frozenPlanTask({
        ...common,
        id: "auto-1",
        title: "Automatic task one",
        goal: "Prove repair and advance",
      }),
      frozenPlanTask({
        ...common,
        id: "auto-2",
        title: "Automatic task two",
        goal: "Prove terminal completion",
      }),
    ],
  });

  // SessionStart first — otherwise Stop treats mid-session hook enable as bootstrap.
  parseHookResult(runHook(projectPath, "SessionStart", {
    session_id: "auto-sess",
  }));

  assertAutomatic(stop(projectPath, "The plan is ready."), "START_TASK:auto-1", "NONE");
  assert.equal(runCli(projectPath, ["task", "start"]).status, 0);
  assertAutomatic(stop(projectPath, "Implementation is in progress."), "CONTINUE_ACTIVE:auto-1", "NONE");

  const failed = runCli(projectPath, ["verify"]);
  assert.notEqual(failed.status, 0);
  assertAutomatic(stop(projectPath, "The exact test failed."), "RUN_EXACT_TEST:auto-1", "FAIL");

  await writeFile(resolve(projectPath, "result.txt"), "pass\n", "utf8");
  const firstPass = runCli(projectPath, ["verify"]);
  assert.equal(firstPass.status, 0, firstPass.stderr);
  assert.equal(firstPass.stdout, "START_TASK:auto-2\n");
  assertAutomatic(stop(projectPath, "The first task passed."), "START_TASK:auto-2", "FRESH");

  await writeFile(resolve(projectPath, "subject.txt"), "drifted\n", "utf8");
  assertAutomatic(stop(projectPath, "The proof became stale."), "REOPEN_TASK:auto-1", "STALE");
  await writeFile(resolve(projectPath, "subject.txt"), "original\n", "utf8");
  assertAutomatic(stop(projectPath, "The first receipt is fresh again."), "START_TASK:auto-2", "FRESH");

  assert.equal(runCli(projectPath, ["task", "start"]).status, 0);
  const premature = stop(projectPath, "OHNO_COMPLETE:auto-2");
  assert.equal(premature.decision, "block");
  assert.match(premature.reason, /^OHNO_AUTO_CONTINUE(?:\r?\n|$)/u);
  assert.match(premature.reason, /fresh PASS.*ohno verify/iu);

  const needsInput = stop(
    projectPath,
    "OHNO_NEEDS_INPUT:auto-2\nA paid service credential is unavailable.",
  );
  assertAutomatic(needsInput, "CONTINUE_ACTIVE:auto-2", "NONE");
  assert.match(needsInput.reason, /OHNO_CONTINUE|mode:/i);
  assert.match(needsInput.reason, /re-read|scope|ohno verify|Truth/i);
  assertAutomatic(
    stop(projectPath, "OHNO_NEEDS_INPUT:wrong-task\nMissing input."),
    "CONTINUE_ACTIVE:auto-2",
    "NONE",
  );
  assertAutomatic(
    stop(projectPath, "prefixOHNO_NEEDS_INPUT:auto-2"),
    "CONTINUE_ACTIVE:auto-2",
    "NONE",
  );

  const finalPass = runCli(projectPath, ["verify"]);
  assert.equal(finalPass.status, 0, finalPass.stderr);
  assert.equal(finalPass.stdout, "PROJECT_COMPLETE\n");
  assert.deepEqual(stop(projectPath, "The accepted plan is complete."), {});
});

test("weak blackbox warns on propose and hard-refuses accept without --allow-weak-plan", async (t) => {
  const projectPath = await createProject(t);
  runInit(projectPath, "Keep plan sizing heuristic and non-blocking");
  const task = frozenPlanTask({
    id: "small-doc-result",
    title: "Document one independent result",
    goal: "Keep the independently provable documentation result small",
    expected_behavior: "The user sees the bounded design note",
    test_command: "git diff --check -- docs/design.md",
    stop_condition: "Stop after the bounded documentation result",
    allowed_files: ["docs/design.md"],
    time_budget_minutes: 15,
  });
  const proposal = await proposePlan(projectPath, [task]);
  assert.equal(proposal.status, 0, proposal.stderr);
  assert.match(proposal.stdout, /WARN:.*micro-plan|WARN:.*format only/iu);

  const refused = acceptProposal(projectPath, proposal);
  assert.notEqual(refused.status, 0);
  assert.match(
    `${refused.stderr}\n${refused.stdout}`,
    /WEAK_BLACKBOX|trivial|format only|Refuse accept/iu,
  );

  const accepted = acceptProposal(projectPath, proposal, { allowWeakPlan: true });
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.match(accepted.stdout, /LOCAL_REVIEW_RECORDED|WEAK_PLAN_OVERRIDE/iu);
});

test("structural contract, acceptance basis, scope, and fresh-PASS protections remain hard", async (t) => {
  const mismatchProject = await createProject(t);
  runInit(mismatchProject, "Keep exact acceptance basis hard");
  const exactTask = frozenPlanTask({
    id: "basis-hard",
    expected_behavior: "The exact basis behavior",
    test_command: "node --test exact.test.mjs",
    stop_condition: "Stop after the exact basis test",
    allowed_files: ["src/**", "exact.test.mjs"],
  });
  const mismatch = await proposePlan(mismatchProject, [exactTask], [{
    ...exactTask,
    expected_behavior: "A different and broader behavior",
  }]);
  assert.notEqual(mismatch.status, 0);
  assert.match(
    `${mismatch.stderr}${mismatch.stdout}`,
    /ACCEPTANCE_DENOMINATOR_MISMATCH|exact.*match/iu,
  );

  const broadProject = await createProject(t);
  runInit(broadProject, "Keep root scope hard");
  const broadTask = frozenPlanTask({
    id: "scope-hard",
    expected_behavior: "The exact scope remains bounded",
    test_command: "node --test scope.test.mjs",
    stop_condition: "Stop after the exact scope test",
    allowed_files: ["**"],
  });
  const broad = await proposePlan(broadProject, [broadTask]);
  assert.notEqual(broad.status, 0);
  assert.match(`${broad.stderr}${broad.stdout}`, /allowed_files|root|unbounded/iu);

  const hookProject = await createProject(t);
  runInit(hookProject, "Keep mutation scope and proof hard");
  await writeFile(resolve(hookProject, "pass.mjs"), "process.exit(0);\n", "utf8");
  reviewPlan(hookProject, {
    tasks: [frozenPlanTask({
      id: "hook-hard",
      expected_behavior: "Only in-scope writes can reach fresh proof",
      test_command: "node pass.mjs",
      stop_condition: "Stop after fresh exact proof",
      allowed_files: ["src/**", "pass.mjs"],
    })],
  });
  assert.equal(runCli(hookProject, ["task", "start"]).status, 0);
  const denied = preToolUse(hookProject, "README.md");
  // Hybrid control: short hard deny on clear out-of-scope writes (no rails dump).
  // Semantic anti-drift stays prompt-only; structural scope remains a gate.
  assert.equal(denied.hookSpecificOutput?.permissionDecision, "deny");
  assert.match(
    denied.hookSpecificOutput?.permissionDecisionReason ?? "",
    /outside task scope:.*README\.md/iu,
  );

  const notFresh = stop(hookProject, "OHNO_COMPLETE:hook-hard");
  assert.equal(notFresh.decision, "block");
  assert.match(notFresh.reason, /fresh PASS.*ohno verify/iu);
  const state = await readState(hookProject);
  assert.equal(state.active_task?.id, "hook-hard");
});
