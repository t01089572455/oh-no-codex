import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  access,
  mkdir,
  readFile,
  stat,
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

function runGit(projectPath, args) {
  const result = spawnSync("git", args, {
    cwd: projectPath,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  return result;
}

function quotePosix(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function quotePowerShell(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

async function initialize(projectPath) {
  const result = runCli(projectPath, [
    "init",
    "--goal",
    "Keep ordinary commits aligned with the active bounded task",
  ]);
  assert.equal(result.status, 0, result.stderr);
}

async function startTask(
  projectPath,
  {
    files = "src/**",
    command = "node placeholder.mjs",
  } = {},
) {
  const result = runCli(projectPath, [
    "task",
    "start",
    "--id",
    "git-hook-001",
    "--expect",
    "Ordinary staged changes stay inside the bounded task",
    "--test",
    command,
    "--stop",
    "Stop after the Git pre-commit black box passes",
    "--files",
    files,
    "--minutes",
    "60",
    "--next",
    "Lock the Cockpit design contract",
  ]);
  assert.equal(result.status, 0, result.stderr);
}

async function stageFile(projectPath, relativePath, content) {
  const absolutePath = resolve(projectPath, ...relativePath.split("/"));
  await mkdir(resolve(absolutePath, ".."), { recursive: true });
  await writeFile(absolutePath, content, "utf8");
  runGit(projectPath, ["add", "--", relativePath]);
}

async function setPendingDocumentSync(projectPath) {
  const state = await readState(projectPath);
  state.status = "BLOCKED_DOC_SYNC";
  state.active_task = null;
  state.last_verification = null;
  state.document_sync = {
    status: "PENDING_REVIEW",
    change_id: "change-git-hook-fixture",
    required_paths: ["docs/PLAN.md"],
    reviewed_diff_digest: null,
  };
  await writeFile(
    resolve(projectPath, ".ohno", "state.json"),
    `${JSON.stringify(state, null, 2)}\n`,
    "utf8",
  );
}

async function completeFreshTask(projectPath) {
  await stageFile(projectPath, "subject.txt", "fresh subject\n");
  await writeFile(resolve(projectPath, "pass.mjs"), "process.exit(0);\n", "utf8");
  await startTask(projectPath, {
    files: "subject.txt",
    command: `"${process.execPath}" "pass.mjs"`,
  });
  const verified = runCli(projectPath, ["verify"]);
  assert.equal(verified.status, 0, verified.stderr);
}

function runPreCommit(projectPath) {
  return runCli(projectPath, ["git", "pre-commit"]);
}

async function assertMissing(path) {
  await assert.rejects(
    access(path),
    (error) => error.code === "ENOENT",
  );
}

test("install writes cross-platform templates, stays untrusted, and is idempotent", async (t) => {
  const projectPath = await createProject(t);
  const first = runCli(projectPath, ["install"]);
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /COOPERATIVE_GUARDRAIL/);
  assert.match(first.stdout, /Codex.*trust.*UNVERIFIED/i);
  assert.match(first.stdout, /\.codex\/hooks\.json/);
  for (const eventName of [
    "SessionStart",
    "PostCompact",
    "PreToolUse",
    "Stop",
  ]) {
    assert.match(first.stdout, new RegExp(`\\b${eventName}\\b`));
  }
  assert.match(first.stdout, /\.git\/hooks\/pre-commit/);
  assert.doesNotMatch(first.stdout, /\btrusted\b|\benforced\b/i);

  const codexPath = resolve(projectPath, ".codex", "hooks.json");
  const gitPath = resolve(projectPath, ".git", "hooks", "pre-commit");
  const codexBytes = await readFile(codexPath);
  const gitBytes = await readFile(gitPath);
  const config = JSON.parse(codexBytes);
  assert.doesNotMatch(codexBytes.toString("utf8"), /\{\{[^}]+\}\}/);
  assert.deepEqual(
    Object.keys(config.hooks).sort(),
    ["PostCompact", "PreToolUse", "SessionStart", "Stop"].sort(),
  );
  assert.equal(
    config.hooks.SessionStart[0].matcher,
    "startup|resume|clear|compact",
  );
  assert.equal(config.hooks.PostCompact[0].matcher, "manual|auto");
  assert.equal(
    config.hooks.PreToolUse[0].matcher,
    "^(?:apply_patch|Edit|Write)$",
  );
  const expectedCommand = `${quotePosix(process.execPath)} `
    + `${quotePosix(cliPath)} hook`;
  const expectedCommandWindows = `& ${quotePowerShell(process.execPath)} `
    + `${quotePowerShell(cliPath)} hook`;
  for (const event of Object.values(config.hooks)) {
    assert.ok(Array.isArray(event) && event.length > 0);
    for (const group of event) {
      assert.ok(Array.isArray(group.hooks) && group.hooks.length > 0);
      for (const hook of group.hooks) {
        assert.equal(hook.type, "command");
        assert.equal(hook.command, expectedCommand);
        assert.equal(hook.commandWindows, expectedCommandWindows);
      }
    }
  }
  assert.doesNotMatch(
    config.hooks.PreToolUse[0].matcher,
    /Bash|mcp/i,
  );
  const expectedGitCommand = `${quotePosix(
    process.execPath.replaceAll("\\", "/"),
  )} ${quotePosix(cliPath.replaceAll("\\", "/"))} git pre-commit`;
  assert.match(gitBytes.toString("utf8"), /^#!\/bin\/sh\r?\n/);
  assert.doesNotMatch(gitBytes.toString("utf8"), /\{\{[^}]+\}\}/);
  assert.ok(
    gitBytes.toString("utf8").includes(`exec ${expectedGitCommand}\n`),
  );
  if (process.platform !== "win32") {
    assert.notEqual((await stat(gitPath)).mode & 0o111, 0);
  }

  const second = runCli(projectPath, ["install"]);
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stdout, /already installed|idempotent/i);
  assert.deepEqual(await readFile(codexPath), codexBytes);
  assert.deepEqual(await readFile(gitPath), gitBytes);

  await initialize(projectPath);
  await startTask(projectPath);
  await stageFile(projectPath, "src/template-smoke.ts", "export {};\n");
  const sessionHandler = config.hooks.SessionStart[0].hooks[0];
  const hookInput = `${JSON.stringify({
    session_id: "template-smoke",
    transcript_path: null,
    cwd: projectPath,
    hook_event_name: "SessionStart",
    model: "test-model",
    permission_mode: "default",
    source: "startup",
  })}\n`;
  const sessionSmoke = process.platform === "win32"
    ? spawnSync("powershell.exe", [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      sessionHandler.commandWindows,
    ], {
      cwd: projectPath,
      encoding: "utf8",
      input: hookInput,
    })
    : spawnSync(sessionHandler.command, {
      cwd: projectPath,
      encoding: "utf8",
      input: hookInput,
      shell: true,
    });
  assert.equal(sessionSmoke.status, 0, sessionSmoke.stderr);
  assert.equal(
    JSON.parse(sessionSmoke.stdout).hookSpecificOutput.hookEventName,
    "SessionStart",
  );

  const gitSmoke = spawnSync("git", [
    "-c",
    "user.name=Oh No Template Smoke",
    "-c",
    "user.email=ohno-template@example.invalid",
    "commit",
    "--quiet",
    "-m",
    "template smoke",
  ], {
    cwd: projectPath,
    encoding: "utf8",
  });
  assert.equal(gitSmoke.status, 0, gitSmoke.stderr);

  const status = runCli(projectPath, ["hooks", "status", "--json"]);
  assert.equal(status.status, 0, status.stderr);
  assert.deepEqual(JSON.parse(status.stdout), {
    classification: "COOPERATIVE_GUARDRAIL",
    codex_config: "INSTALLED_TEMPLATE",
    codex_feature: "UNVERIFIED",
    codex_trust: "UNVERIFIED",
    git_hook: "INSTALLED_TEMPLATE",
    coverage: "SUPPORTED_LOCAL_PATHS_ONLY",
  });

  await writeFile(codexPath, `${codexBytes.toString("utf8")} `, "utf8");
  await writeFile(gitPath, `${gitBytes.toString("utf8")}# changed\n`, "utf8");
  const modifiedStatus = runCli(projectPath, ["hooks", "status", "--json"]);
  assert.equal(modifiedStatus.status, 0, modifiedStatus.stderr);
  assert.deepEqual(JSON.parse(modifiedStatus.stdout), {
    classification: "COOPERATIVE_GUARDRAIL",
    codex_config: "MODIFIED_OR_CUSTOM",
    codex_feature: "UNVERIFIED",
    codex_trust: "UNVERIFIED",
    git_hook: "MODIFIED_OR_CUSTOM",
    coverage: "SUPPORTED_LOCAL_PATHS_ONLY",
  });
});

test("install refuses an existing Codex hook without partial writes", async (t) => {
  const projectPath = await createProject(t);
  const codexPath = resolve(projectPath, ".codex", "hooks.json");
  const gitPath = resolve(projectPath, ".git", "hooks", "pre-commit");
  await mkdir(resolve(projectPath, ".codex"), { recursive: true });
  const existing = Buffer.from('{"hooks":{"Stop":[]}}\n');
  await writeFile(codexPath, existing);

  const result = runCli(projectPath, ["install"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /refus.*existing.*\.codex\/hooks\.json/i);
  assert.match(result.stderr, /manual.*templates\/\.codex\/hooks\.json/i);
  assert.match(result.stderr, /preserv/i);
  assert.deepEqual(await readFile(codexPath), existing);
  await assertMissing(gitPath);
});

test("install refuses an existing Git hook without partial writes", async (t) => {
  const projectPath = await createProject(t);
  const codexPath = resolve(projectPath, ".codex", "hooks.json");
  const gitPath = resolve(projectPath, ".git", "hooks", "pre-commit");
  const existing = Buffer.from("#!/bin/sh\nprintf existing\n");
  await writeFile(gitPath, existing);

  const result = runCli(projectPath, ["install"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /refus.*existing.*\.git\/hooks\/pre-commit/i);
  assert.match(result.stderr, /manual.*templates\/git\/pre-commit/i);
  assert.match(result.stderr, /preserv/i);
  assert.deepEqual(await readFile(gitPath), existing);
  await assertMissing(codexPath);
});

test("pre-commit accepts an active in-scope checkpoint", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  await startTask(projectPath);
  await stageFile(projectPath, "src/in-scope.ts", "export {};\n");

  const result = runPreCommit(projectPath);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /COOPERATIVE_GUARDRAIL.*checkpoint.*in.scope/i);
});

test("pre-commit rejects an active out-of-scope staged path", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  await startTask(projectPath);
  await stageFile(projectPath, "README.md", "outside\n");

  const result = runPreCommit(projectPath);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /outside.*README\.md.*src\/\*\*/i);
});

test("pre-commit rejects every pending document-sync commit", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  await setPendingDocumentSync(projectPath);
  await stageFile(projectPath, "docs/PLAN.md", "replacement plan\n");

  const result = runPreCommit(projectPath);
  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /document sync.*SYNC_GOVERNING_DOCUMENTS/i,
  );
});

test("pre-commit rejects with neither an active task nor a fresh completed subject", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  await stageFile(projectPath, "src/orphan.ts", "export {};\n");

  const result = runPreCommit(projectPath);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /no active task.*no fresh.*PASS/i);
});

test("pre-commit accepts a fresh completed in-scope subject", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  await completeFreshTask(projectPath);

  const result = runPreCommit(projectPath);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /fresh PASS.*subject\.txt/i);
});

test("pre-commit rejects a completed subject after its proof becomes stale", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  await completeFreshTask(projectPath);
  await stageFile(projectPath, "subject.txt", "changed after verify\n");

  const result = runPreCommit(projectPath);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /STALE.*ohno verify|fresh PASS.*required/i);
});

test("pre-commit rejects when fresh worktree proof does not cover the staged index", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  await stageFile(projectPath, "subject.txt", "staged version A\n");
  await writeFile(
    resolve(projectPath, "subject.txt"),
    "worktree version B\n",
    "utf8",
  );
  await writeFile(resolve(projectPath, "pass.mjs"), "process.exit(0);\n", "utf8");
  await startTask(projectPath, {
    files: "subject.txt",
    command: `"${process.execPath}" "pass.mjs"`,
  });
  const verified = runCli(projectPath, ["verify"]);
  assert.equal(verified.status, 0, verified.stderr);
  assert.equal(
    JSON.parse(runCli(projectPath, ["status", "--json"]).stdout)
      .proof_freshness,
    "FRESH",
    "the worktree receipt remains fresh, isolating index divergence",
  );

  const result = runPreCommit(projectPath);
  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /staged (?:index|subject).*(?:does not match|not covered).*fresh PASS|re-verify.*staged/i,
  );
});

test("pre-commit rejects out-of-scope staging even while proof remains fresh", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  await completeFreshTask(projectPath);
  await stageFile(projectPath, "outside.txt", "outside allowed subject\n");

  const result = runPreCommit(projectPath);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /outside.*outside\.txt.*subject\.txt/i);
});

test("pre-commit checks both sides of a staged rename without path parsing loss", async (t) => {
  const projectPath = await createProject(t);
  await stageFile(projectPath, "outside file.txt", "baseline\n");
  runGit(projectPath, [
    "-c",
    "user.name=Oh No Test",
    "-c",
    "user.email=ohno@example.invalid",
    "commit",
    "--quiet",
    "-m",
    "baseline",
  ]);
  await initialize(projectPath);
  await startTask(projectPath);
  await mkdir(resolve(projectPath, "src"), { recursive: true });
  runGit(projectPath, ["mv", "outside file.txt", "src/inside file.txt"]);

  const result = runPreCommit(projectPath);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /outside.*outside file\.txt.*src\/\*\*/i);
});
