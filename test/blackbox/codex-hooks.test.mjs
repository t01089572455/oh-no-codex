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
  readState,
  runCli,
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
  const initialized = runCli(projectPath, ["init", "--goal", goal]);
  assert.equal(initialized.status, 0, initialized.stderr);
}

async function startTask(
  projectPath,
  {
    files = "src/**",
    command = "node placeholder.mjs",
  } = {},
) {
  const started = runCli(projectPath, [
    "task",
    "start",
    "--id",
    taskId,
    "--expect",
    "Supported local mutation tools stay inside declared files",
    "--test",
    command,
    "--stop",
    "Stop after the Codex hook black box passes",
    "--files",
    files,
    "--minutes",
    "60",
    "--next",
    "Exercise the ordinary Git pre-commit guardrail",
  ]);
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

function assertDenied(output, expectedReason) {
  assert.deepEqual(
    {
      hookEventName: output.hookSpecificOutput?.hookEventName,
      permissionDecision:
        output.hookSpecificOutput?.permissionDecision,
    },
    {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
    },
  );
  assert.match(
    output.hookSpecificOutput.permissionDecisionReason,
    expectedReason,
  );
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
    assert.deepEqual(output, {
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: resume.stdout,
      },
    });
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
  const resume = runCli(projectPath, ["resume"]);
  assert.equal(resume.status, 0, resume.stderr);

  for (const trigger of ["manual", "auto"]) {
    const output = parseHookResult(runHook(projectPath, "PostCompact", {
      turn_id: "turn-compact",
      trigger,
    }));
    assert.deepEqual(output, {
      systemMessage: resume.stdout,
    });
    assert.ok(Buffer.byteLength(output.systemMessage, "utf8") < 4_096);
  }
});

test("PreToolUse denies a parseable mutation when no task is active", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);

  const output = preToolUse(projectPath, "apply_patch", {
    command: applyPatchCommand("src/new-file.ts"),
  });
  assertDenied(output, /no active task.*ohno task start/i);
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
    /document sync.*SYNC_GOVERNING_DOCUMENTS.*required.*docs\/PLAN\.md/i,
  );

  const mixed = preToolUse(projectPath, "apply_patch", {
    command: applyPatchCommand(
      "docs/PLAN.md",
      "src/implementation.ts",
    ),
  });
  assertDenied(
    mixed,
    /document sync.*outside required.*src\/implementation\.ts/i,
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
    assertDenied(output, /outside.*README\.md.*src\/\*\*/i);
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

test("ambiguous shell targeting is allowed with an honest limitation", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);

  const output = preToolUse(projectPath, "Bash", {
    command: "node -e \"require('node:fs').writeFileSync(process.argv[1], 'x')\" mystery.txt",
  });
  assert.equal(output.hookSpecificOutput?.permissionDecision, undefined);
  assert.equal(output.hookSpecificOutput?.hookEventName, "PreToolUse");
  assert.match(
    output.hookSpecificOutput?.additionalContext ?? "",
    /COOPERATIVE_GUARDRAIL.*cannot parse arbitrary shell|ambiguous.*allowed/i,
  );
});

test("Stop ignores missing or paraphrased completion markers", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  await startTask(projectPath);

  assert.deepEqual(stopHook(projectPath, "Work is still in progress."), {});
  assert.deepEqual(
    stopHook(projectPath, `OHNO COMPLETE ${taskId}`),
    {},
    "a paraphrase must not be treated as the cooperative marker",
  );
});

test("Stop continues on an exact marker with the wrong task id", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  await startTask(projectPath);

  const output = stopHook(projectPath, "OHNO_COMPLETE:another-task");
  assert.equal(output.decision, "block");
  assert.match(output.reason, /wrong task id.*hooks-001/i);
});

test("Stop continues on the current task marker until proof is fresh", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  await startTask(projectPath);

  const output = stopHook(projectPath, `OHNO_COMPLETE:${taskId}`);
  assert.equal(output.decision, "block");
  assert.match(output.reason, /fresh PASS.*ohno verify/i);
});

test("Stop accepts the just-completed task marker only with fresh proof", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  await completeFreshTask(projectPath);

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
  assert.deepEqual(status, {
    classification: "COOPERATIVE_GUARDRAIL",
    codex_config: "MISSING",
    codex_feature: "UNVERIFIED",
    codex_trust: "UNVERIFIED",
    git_hook: "MISSING",
    coverage: "SUPPORTED_LOCAL_PATHS_ONLY",
  });
});

test("CLI help names cooperative coverage without authority claims", async (t) => {
  const projectPath = await createProject(t);
  const result = runCli(projectPath, ["--help"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /COOPERATIVE_GUARDRAIL/);
  assert.match(result.stdout, /Codex.*trust.*UNVERIFIED/i);
  assert.match(result.stdout, /hosted|specialized.*outside.*coverage/i);
  assert.doesNotMatch(
    result.stdout,
    /\bproduction\b|\bfully enforced\b|\bsecure\b|\brelease ready\b/i,
  );
});
