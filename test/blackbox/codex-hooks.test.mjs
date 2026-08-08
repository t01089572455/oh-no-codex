import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
  cliPath,
  createProject,
  frozenPlanTask,
  readState,
  runCli,
  startTaskFromPlan,
  runInit,
} from "../helpers/blackbox.mjs";

const goal = "Keep Codex mutations inside one bounded task";
const taskId = "hooks-001";

function hookInput(projectPath, hookEventName, fields = {}) {
  return {
    session_id: "test-session",
    transcript_path: null,
    cwd: projectPath,
    hook_event_name: hookEventName,
    model: "test-model",
    permission_mode: "default",
    ...fields,
  };
}

function runHook(
  projectPath,
  hookEventName,
  fields = {},
  executionPath = projectPath,
) {
  return spawnSync(process.execPath, [cliPath, "hook"], {
    cwd: executionPath,
    encoding: "utf8",
    input: `${JSON.stringify(
      hookInput(executionPath, hookEventName, fields),
    )}\n`,
  });
}

function parseHookResult(result) {
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.notEqual(result.stdout.trim(), "", "hook must emit one JSON object");
  return JSON.parse(result.stdout);
}

async function initialize(projectPath) {
  const initialized = runInit(projectPath);
  assert.equal(initialized.status, 0, initialized.stderr);
}

async function startTask(
  projectPath,
  {
    files = "src/**",
    command = "node placeholder.mjs",
  } = {},
) {
  const { started } = startTaskFromPlan(projectPath, frozenPlanTask({
    id: taskId,
    title: "Guard supported local Codex mutations",
    goal: "Keep supported local mutation tools inside declared files",
    expected_behavior:
      "Supported local mutation tools stay inside declared files",
    test_command: command,
    stop_condition: "Stop after the Codex hook black box passes",
    allowed_files: [files],
    time_budget_minutes: 60,
  }));
  assert.equal(started.status, 0, started.stderr);
}

function applyPatchCommand(...paths) {
  return [
    "*** Begin Patch",
    ...paths.flatMap((path, index) => [
      `*** Add File: ${path}`,
      `+fixture ${index}`,
    ]),
    "*** End Patch",
  ].join("\n");
}

function applyPatchLifecycleCommand(moveTarget = "src/moved.ts") {
  return [
    "*** Begin Patch",
    "*** Add File: src/added.ts",
    "+added",
    "*** Update File: src/source.ts",
    "@@",
    "-old",
    "+new",
    `*** Move to: ${moveTarget}`,
    "*** Delete File: src/deleted.ts",
    "*** End Patch",
  ].join("\n");
}

function applyPatchHeaderCommand(header, target) {
  return [
    "*** Begin Patch",
    `*** ${header}: ${target}`,
    ...(header === "Add File" ? ["+added"] : []),
    "*** End Patch",
  ].join("\n");
}

function applyPatchMoveCommand(source, destination) {
  return [
    "*** Begin Patch",
    `*** Update File: ${source}`,
    `*** Move to: ${destination}`,
    "@@",
    "-old",
    "+new",
    "*** End Patch",
  ].join("\n");
}

function preToolUse(
  projectPath,
  toolName,
  toolInput,
  executionPath = projectPath,
) {
  return parseHookResult(runHook(projectPath, "PreToolUse", {
    turn_id: "turn-1",
    tool_name: toolName,
    tool_use_id: "tool-1",
    tool_input: toolInput,
  }, executionPath));
}

function stopHook(projectPath, lastAssistantMessage) {
  return parseHookResult(runHook(projectPath, "Stop", {
    turn_id: "turn-1",
    stop_hook_active: false,
    last_assistant_message: lastAssistantMessage,
  }));
}

/** Normal Desktop path: SessionStart before Stop auto-continue. */
function sessionStartHook(projectPath, sessionId = "test-session") {
  return parseHookResult(runHook(projectPath, "SessionStart", {
    session_id: sessionId,
  }));
}

/** Background PreToolUse: short hard deny, no session lecture. */
function assertDenied(output, expectedReason) {
  assert.equal(
    output.hookSpecificOutput?.hookEventName,
    "PreToolUse",
  );
  assert.equal(
    output.hookSpecificOutput?.permissionDecision,
    "deny",
    "clear phase/scope violations hard-deny silently",
  );
  const reason = String(
    output.hookSpecificOutput?.permissionDecisionReason ?? "",
  );
  assert.doesNotMatch(
    reason,
    /OHNO_PROMPT_RAILS|Standing law every turn|OHNO_PROMPT_ADVISORY/i,
  );
  assert.match(reason, expectedReason);
}

async function setPendingDocumentSync(projectPath) {
  const state = await readState(projectPath);
  state.status = "BLOCKED_DOC_SYNC";
  state.active_task = null;
  state.last_verification = null;
  state.document_sync = {
    status: "PENDING_REVIEW",
    change_id: "change-hook-fixture",
    required_paths: ["docs/PLAN.md"],
    reviewed_diff_digest: null,
    base_plan_revision: state.plan_revision,
    base_cursor: state.cursor,
    summary: "Owner fixture for pending PreToolUse document sync",
    started_at: new Date().toISOString(),
  };
  await mkdir(resolve(projectPath, ".ohno"), { recursive: true });
  await writeFile(
    resolve(projectPath, ".ohno", "state.json"),
    `${JSON.stringify(state, null, 2)}\n`,
    "utf8",
  );
}

async function completeFreshTask(projectPath) {
  await writeFile(resolve(projectPath, "subject.txt"), "fresh\n", "utf8");
  await writeFile(resolve(projectPath, "pass.mjs"), "process.exit(0);\n", "utf8");
  const command = `"${process.execPath}" "pass.mjs"`;
  await startTask(projectPath, {
    files: "subject.txt",
    command,
  });
  const verified = runCli(projectPath, ["verify"]);
  assert.equal(verified.status, 0, verified.stderr);
}

test("SessionStart injects the exact capsule at startup and after compact", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  await startTask(projectPath);
  // Capture after projector refresh so hook re-entry matches CLI resume.
  runCli(projectPath, ["projectors", "refresh"]);
  const resume = runCli(projectPath, ["resume"]);
  assert.equal(resume.status, 0, resume.stderr);

  const nestedPath = resolve(projectPath, "nested", "workspace");
  await mkdir(nestedPath, { recursive: true });
  for (const [source, executionPath] of [
    ["startup", projectPath],
    ["compact", nestedPath],
  ]) {
    const output = parseHookResult(runHook(projectPath, "SessionStart", {
      source,
    }, executionPath));
    assert.equal(output.hookSpecificOutput?.hookEventName, "SessionStart");
    assert.equal(
      output.hookSpecificOutput?.additionalContext,
      resume.stdout,
    );
    assert.ok(
      Buffer.byteLength(output.hookSpecificOutput.additionalContext, "utf8")
        < 4_096,
    );
  }
});

test("PostCompact projects the same capsule via supported systemMessage", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  await startTask(projectPath);
  runCli(projectPath, ["projectors", "refresh"]);
  const resume = runCli(projectPath, ["resume"]);
  assert.equal(resume.status, 0, resume.stderr);

  for (const trigger of ["manual", "auto"]) {
    const output = parseHookResult(runHook(projectPath, "PostCompact", {
      turn_id: "turn-compact",
      trigger,
    }));
    assert.equal(output.systemMessage, resume.stdout);
    assert.ok(Buffer.byteLength(output.systemMessage, "utf8") < 4_096);
  }
});

test("PreToolUse denies a parseable mutation when no task is active", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);

  const output = preToolUse(projectPath, "apply_patch", {
    command: applyPatchCommand("src/new-file.ts"),
  });
  assertDenied(output, /PREPARE|PROPOSE_PLAN|DISCOVER|product|seal-requirements|Truth/i);
});

test("PreToolUse allows .ohno plan JSON when next is PROPOSE_PLAN (freeze path)", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);

  const planFile = preToolUse(projectPath, "apply_patch", {
    command: applyPatchCommand(".ohno/review-plan.json"),
  });
  assert.equal(
    planFile.hookSpecificOutput?.permissionDecision,
    undefined,
    "plan draft under .ohno must be allowed before task start",
  );

  const docsOk = preToolUse(projectPath, "apply_patch", {
    command: applyPatchCommand("docs/DESIGN.md"),
  });
  assert.equal(
    docsOk.hookSpecificOutput?.permissionDecision,
    undefined,
    "governing docs may be written in PREPARE",
  );

  const stateDenied = preToolUse(projectPath, "apply_patch", {
    command: applyPatchCommand(".ohno/state.json"),
  });
  assertDenied(stateDenied, /state\.json|PREPARE|product/i);

  const productDenied = preToolUse(projectPath, "apply_patch", {
    command: applyPatchCommand("src/app.js"),
  });
  assertDenied(productDenied, /PREPARE|product|PROPOSE_PLAN|Blocked/i);
});

test("PreToolUse allows .ohno plan JSON when next is FREEZE_TASK", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  await writeFile(
    resolve(projectPath, "pass.mjs"),
    "process.exit(0);\n",
    "utf8",
  );
  const passCmd = `"${process.execPath}" "pass.mjs"`;
  const planPath = ".ohno/freeze-setup.json";
  const tasks = [
    frozenPlanTask({
      id: "done-slice",
      title: "Done slice",
      expected_behavior: "A pass script exits zero",
      test_command: passCmd,
      stop_condition: "Stop after pass",
      allowed_files: ["pass.mjs"],
      time_budget_minutes: 30,
    }),
    {
      id: "outline-next",
      title: "Outline next",
      goal: "freeze later",
      status: "OUTLINE",
    },
  ];
  const {
    writeDefaultAcceptanceBasis,
    syncTruthInventoryForBasis,
  } = await import("../helpers/blackbox.mjs");
  writeDefaultAcceptanceBasis(projectPath, tasks, ".ohno/acceptance-basis.json");
  syncTruthInventoryForBasis(projectPath, ".ohno/acceptance-basis.json");
  await writeFile(
    resolve(projectPath, planPath),
    `${JSON.stringify({
      cursor: 0,
      ordered_tasks: tasks,
      acceptance_source: ".ohno/acceptance-basis.json",
    }, null, 2)}\n`,
    "utf8",
  );
  const proposed = runCli(projectPath, ["plan", "propose", "--file", planPath]);
  assert.equal(proposed.status, 0, proposed.stderr);
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
  const started = runCli(projectPath, ["task", "start"]);
  assert.equal(started.status, 0, started.stderr);
  const verified = runCli(projectPath, ["verify"]);
  assert.equal(verified.status, 0, verified.stderr);
  const next = runCli(projectPath, ["next"]);
  assert.match(next.stdout, /FREEZE_TASK:outline-next/);

  const allowed = preToolUse(projectPath, "apply_patch", {
    command: applyPatchCommand(".ohno/product-plan-v2.json"),
  });
  assert.equal(
    allowed.hookSpecificOutput?.permissionDecision,
    undefined,
    "FREEZE path must allow writing plan JSON under .ohno",
  );

  const deniedProduct = preToolUse(projectPath, "apply_patch", {
    command: applyPatchCommand("src/extra.js"),
  });
  assertDenied(deniedProduct, /FREEZE_TASK|only \.ohno plan/i);
});

test("PreToolUse allows required doc sync and denies unrelated mutation", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  await setPendingDocumentSync(projectPath);

  const required = preToolUse(projectPath, "apply_patch", {
    command: applyPatchCommand("docs/PLAN.md"),
  });
  assert.equal(required.hookSpecificOutput?.permissionDecision, undefined);

  const unrelated = preToolUse(projectPath, "apply_patch", {
    command: applyPatchCommand("src/implementation.ts"),
  });
  assertDenied(
    unrelated,
    /document sync pending|outside:.*implementation/i,
  );

  const mixed = preToolUse(projectPath, "apply_patch", {
    command: applyPatchCommand(
      "docs/PLAN.md",
      "src/implementation.ts",
    ),
  });
  assertDenied(
    mixed,
    /document sync pending|outside:.*implementation/i,
  );
});

test("PreToolUse allows every parseable apply_patch target inside scope", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  await startTask(projectPath);
  const nestedPath = resolve(projectPath, "nested");
  await mkdir(nestedPath, { recursive: true });

  const output = preToolUse(projectPath, "apply_patch", {
    command: applyPatchLifecycleCommand(),
  }, nestedPath);
  assert.equal(
    output.hookSpecificOutput?.permissionDecision,
    undefined,
    "absence of a deny decision allows the supported tool call",
  );
});

test("PreToolUse denies one out-of-scope target in a multi-file patch", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  await startTask(projectPath);

  for (const command of [
    applyPatchHeaderCommand("Add File", "README.md"),
    applyPatchHeaderCommand("Update File", "README.md"),
    applyPatchHeaderCommand("Delete File", "README.md"),
    applyPatchMoveCommand("README.md", "src/moved.ts"),
    applyPatchMoveCommand("src/source.ts", "README.md"),
  ]) {
    const output = preToolUse(projectPath, "apply_patch", { command });
    assertDenied(output, /outside task scope:.*README\.md/i);
  }

  for (const unsafeCommand of [
    applyPatchCommand("../escape.ts"),
    applyPatchCommand(resolve(projectPath, "src", "absolute.ts")),
    ...["Add File", "Update File", "Delete File", "Move to"].map(
      (header) => [
        "*** Begin Patch",
        `*** ${header}: `,
        "+missing target",
        "*** End Patch",
      ].join("\n"),
    ),
  ]) {
    const unsafe = preToolUse(projectPath, "apply_patch", {
      command: unsafeCommand,
    });
    assertDenied(unsafe, /unsafe|unparseable.*apply_patch/i);
  }
});

test("PreToolUse fails closed when state is missing or corrupt", async (t) => {
  for (const scenario of ["missing", "corrupt"]) {
    const projectPath = await createProject(t);
    await initialize(projectPath);
    const statePath = resolve(projectPath, ".ohno", "state.json");
    if (scenario === "missing") {
      await rm(statePath);
    } else {
      await writeFile(statePath, "{corrupt", "utf8");
    }

    const output = preToolUse(projectPath, "apply_patch", {
      command: applyPatchCommand("src/new-file.ts"),
    });
    assertDenied(output, /state.*unavailable|repair.*state|ohno init/i);
    if (scenario === "corrupt") {
      assert.equal(await readFile(statePath, "utf8"), "{corrupt");
    } else {
      await assert.rejects(
        readFile(statePath),
        (error) => error.code === "ENOENT",
      );
    }
  }
});

test("ambiguous shell targeting is allowed silently (no stamp spam)", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);

  const output = preToolUse(projectPath, "Bash", {
    command: "node -e \"require('node:fs').writeFileSync(process.argv[1], 'x')\" mystery.txt",
  });
  // Background allow: empty output — do not inject rails on every shell.
  assert.deepEqual(output, {});
});

test("Stop automatically continues accepted active work without requiring a completion marker", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  await startTask(projectPath);
  sessionStartHook(projectPath);

  for (const message of [
    "Work is still in progress.",
    `OHNO COMPLETE ${taskId}`,
  ]) {
    const output = stopHook(projectPath, message);
    assert.equal(output.decision, "block");
    assert.match(output.reason, /^OHNO_AUTO_CONTINUE/m);
    assert.match(output.reason, /OHNO_CONTINUE/);
    assert.match(output.reason, /^next: CONTINUE_ACTIVE:hooks-001$/m);
  }
});

test("Stop injects pipeline during DISCOVER when no plan is accepted", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  sessionStartHook(projectPath);
  // Fixture init auto-seals; force DISCOVER to assert pipeline injection.
  const statePath = resolve(projectPath, ".ohno", "state.json");
  const state = JSON.parse(await readFile(statePath, "utf8"));
  state.harness = {
    phase: "DISCOVER",
    requirements_digest: null,
    design_digest: null,
    truth_read: null,
    owner_head: null,
  };
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  const out = stopHook(projectPath, "Planning is not accepted.");
  assert.equal(out.decision, "block");
  assert.match(out.reason, /OHNO_PIPELINE|seal-requirements|DISCOVER/i);
});

test("UserPromptSubmit injects OHNO_PIPELINE and SessionStart names phase", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  const statePath = resolve(projectPath, ".ohno", "state.json");
  const state = JSON.parse(await readFile(statePath, "utf8"));
  state.harness = {
    phase: "DISCOVER",
    requirements_digest: null,
    design_digest: null,
    truth_read: null,
    owner_head: null,
  };
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");

  const session = parseHookResult(runHook(projectPath, "SessionStart", {}));
  assert.match(
    session.hookSpecificOutput?.additionalContext ?? "",
    /HARNESS_PHASE:\s*DISCOVER/i,
  );

  const submit = parseHookResult(runHook(projectPath, "UserPromptSubmit", {
    session_id: "field-sess",
    turn_id: "field-turn-1",
    prompt: "I want a todo CLI with export to markdown",
  }));
  const ctx = submit.hookSpecificOutput?.additionalContext ?? "";
  assert.match(ctx, /OHNO_PIPELINE/);
  assert.match(ctx, /phase:\s*DISCOVER/i);
  assert.match(ctx, /seal-requirements|phase advance/i);
  // Hooks inject next action only — no stamp/full law spam.
  assert.doesNotMatch(ctx, /OHNO_PROMPT_RAILS|Standing law every turn|越俎代庖/);
});

test("Owner pause stops auto-continue and injects OWNER_PAUSE", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  await startTask(projectPath);
  sessionStartHook(projectPath, "pause-sess");

  const submit = parseHookResult(runHook(projectPath, "UserPromptSubmit", {
    session_id: "pause-sess",
    turn_id: "pause-turn-1",
    prompt: "等一下 你先别做计划的，先别自己瞎猜",
  }));
  const ctx = submit.hookSpecificOutput?.additionalContext ?? "";
  assert.match(ctx, /OWNER_PAUSE/);
  assert.match(ctx, /Do NOT plan accept|task start/i);

  // Under pause, Stop must not OHNO_AUTO_CONTINUE (radar field).
  const pausedStop = stopHook(projectPath, "Work is still in progress.");
  assert.deepEqual(pausedStop, {});

  // Clear pause with a clear resume phrase.
  parseHookResult(runHook(projectPath, "UserPromptSubmit", {
    session_id: "pause-sess",
    turn_id: "pause-turn-2",
    prompt: "继续未完成的工作",
  }));
  const resumed = stopHook(projectPath, "Work is still in progress.");
  assert.equal(resumed.decision, "block");
  assert.match(resumed.reason, /^OHNO_AUTO_CONTINUE/m);
});

test("Stop anti-ask continues when agent waits for design/case confirm", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  await startTask(projectPath);
  sessionStartHook(projectPath);

  const output = stopHook(
    projectPath,
    "请确认这个设计草案。回复「确认」后我再实现。",
  );
  assert.equal(output.decision, "block");
  assert.match(output.reason, /ANTI_ASK|OHNO_AUTO_CONTINUE/i);
  assert.match(output.reason, /secrets|devices|account/i);
});

test("Stop continues on an exact marker with the wrong task id", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  await startTask(projectPath);
  sessionStartHook(projectPath);

  const output = stopHook(projectPath, "OHNO_COMPLETE:another-task");
  assert.equal(output.decision, "block");
  assert.match(output.reason, /wrong task id.*hooks-001/i);
});

test("Stop continues on the current task marker until proof is fresh", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  await startTask(projectPath);
  sessionStartHook(projectPath);

  const output = stopHook(projectPath, `OHNO_COMPLETE:${taskId}`);
  assert.equal(output.decision, "block");
  assert.match(output.reason, /fresh PASS.*ohno verify/i);
});

test("Stop accepts the just-completed task marker only with fresh proof", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  await completeFreshTask(projectPath);
  sessionStartHook(projectPath);

  assert.deepEqual(
    stopHook(projectPath, `Evidence: OHNO_COMPLETE:${taskId}`),
    {},
  );

  for (const malformed of [
    `OHNO_COMPLETE:${taskId}-typo`,
    `prefixOHNO_COMPLETE:${taskId}`,
  ]) {
    const output = stopHook(projectPath, malformed);
    assert.equal(output.decision, "block");
    assert.match(output.reason, /wrong task id|exact.*marker/i);
  }
});

test("Stop continues when the just-completed task proof became stale", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  await completeFreshTask(projectPath);
  sessionStartHook(projectPath);
  await writeFile(resolve(projectPath, "subject.txt"), "stale\n", "utf8");

  const output = stopHook(projectPath, `OHNO_COMPLETE:${taskId}`);
  assert.equal(output.decision, "block");
  assert.match(output.reason, /STALE.*ohno verify|fresh PASS.*ohno verify/i);
});

test("hook status is always honest about cooperative coverage and trust", async (t) => {
  const projectPath = await createProject(t);
  const result = runCli(projectPath, ["hooks", "status", "--json"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  const status = JSON.parse(result.stdout);
  assert.equal(status.classification, "COOPERATIVE_GUARDRAIL");
  assert.equal(status.codex_config, "MISSING");
  assert.equal(status.codex_feature, "UNVERIFIED");
  assert.equal(status.codex_trust, "MISSING");
  assert.equal(status.activation, "MISSING");
  assert.equal(status.git_hook, "MISSING");
  assert.equal(status.coverage, "SUPPORTED_LOCAL_PATHS_ONLY");
  assert.match(status.how_to_activate ?? "", /ohno setup|hooks\.json/i);
});

test("installed hooks without Desktop trust are REVIEW_REQUIRED not doctor PASS", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  assert.equal(runCli(projectPath, ["install"]).status, 0);
  // install writes hooks templates; no trusted_hash in this temp home.
  const status = JSON.parse(
    runCli(projectPath, ["hooks", "status", "--json"]).stdout,
  );
  assert.equal(status.codex_config, "INSTALLED_TEMPLATE");
  assert.equal(status.activation, "REVIEW_REQUIRED");
  assert.equal(status.codex_trust, "REVIEW_REQUIRED");
  assert.match(status.how_to_activate ?? "", /\/hooks|approve|trust/i);

  const doctor = runCli(projectPath, ["doctor", "--json"]);
  // FAIL hooks → doctor exits non-zero (not false-green).
  assert.notEqual(doctor.status, 0, doctor.stderr + doctor.stdout);
  const report = JSON.parse(doctor.stdout);
  const hooksCheck = report.checks.find((c) => c.id === "hooks");
  assert.ok(hooksCheck);
  assert.equal(hooksCheck.status, "FAIL");
  assert.match(hooksCheck.detail, /REVIEW_REQUIRED/);
  assert.equal(report.ok, false);
});

test("UserPromptSubmit ignores host personalized-suggestion noise", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  const noise =
    "Generate 0 to 3 hyperpersonalized suggestions for the user based on "
    + "recent conversation context.";
  const out = parseHookResult(runHook(projectPath, "UserPromptSubmit", {
    session_id: "noise-sess",
    turn_id: "noise-turn",
    prompt: noise,
  }));
  assert.deepEqual(out, {});
  // Must not land in OWNER-INPUTS.
  try {
    const raw = await readFile(
      resolve(projectPath, ".ohno", "OWNER-INPUTS.md"),
      "utf8",
    );
    assert.doesNotMatch(raw, /hyperpersonalized suggestions/i);
  } catch (error) {
    assert.equal(error.code, "ENOENT");
  }
});

test("Stop mid-session without SessionStart requires bootstrap not old REOPEN", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  await startTask(projectPath);
  // Fire Stop without SessionStart runtime evidence → bootstrap_required.
  const out = stopHook(projectPath, "Work is still in progress.");
  assert.equal(out.decision, "block");
  assert.match(out.reason, /HOOK_BOOTSTRAP_REQUIRED|OWNER_HISTORY_INCOMPLETE/i);
  assert.match(out.reason, /mode: BOOTSTRAP/);
  assert.match(out.reason, /^next: REBIND_LATEST_AND_CONFIRM_GOAL$/m);
  assert.doesNotMatch(out.reason, /^next: (CONTINUE_ACTIVE|REOPEN_TASK)/m);
});

test("SessionStart clears bootstrap and Stop may auto-continue again", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  await startTask(projectPath);
  sessionStartHook(projectPath, "boot-sess");
  const out = stopHook(projectPath, "Work is still in progress.");
  assert.equal(out.decision, "block");
  assert.match(out.reason, /^OHNO_AUTO_CONTINUE/m);
  assert.match(out.reason, /OHNO_CONTINUE/);
});

test("CLI help names cooperative coverage without authority claims", async (t) => {
  const projectPath = await createProject(t);
  const result = runCli(projectPath, ["--help"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /COOPERATIVE_GUARDRAIL/);
  assert.match(result.stdout, /ohno setup|pipeline/i);
  assert.match(result.stdout, /DISCOVER|RECOVER|seal-requirements|truth-read/i);
  assert.doesNotMatch(
    result.stdout,
    /\bproduction\b|\bfully enforced\b|\bsecure\b|\brelease ready\b/i,
  );
});
