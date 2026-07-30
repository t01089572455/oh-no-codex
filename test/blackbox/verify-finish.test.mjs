import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import {
  createProject,
  readState,
  readStateBytes,
  runCli,
} from "../helpers/blackbox.mjs";

const nextAction = "Start the next frozen task";

function quoteForShell(value) {
  return `"${value.replaceAll("\"", "\\\"")}"`;
}

function nodeCommand(scriptPath) {
  return `${quoteForShell(process.execPath)} ${quoteForShell(scriptPath)}`;
}

function runCliWithEnvironment(cwd, args, environment) {
  return spawnSync(
    process.execPath,
    [resolve(import.meta.dirname, "..", "..", "dist", "cli.js"), ...args],
    {
      cwd,
      encoding: "utf8",
      env: {
        ...process.env,
        ...environment,
      },
    },
  );
}

function runGit(cwd, args) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  return result;
}

async function writeCommandScript(projectPath, name, source) {
  const relativePath = `commands/${name}.mjs`;
  await mkdir(resolve(projectPath, "commands"), { recursive: true });
  await writeFile(resolve(projectPath, relativePath), source, "utf8");
  return relativePath;
}

async function initializeTask(
  t,
  {
    allowedFiles = "subject.txt",
    command,
    projectPath: suppliedProjectPath,
  },
) {
  const projectPath = suppliedProjectPath ?? await createProject(t);
  const initialized = runCli(projectPath, [
    "init",
    "--goal",
    "Finish only with fresh exact evidence",
  ]);
  assert.equal(initialized.status, 0, initialized.stderr);

  const started = runCli(projectPath, [
    "task",
    "start",
    "--id",
    "verify-001",
    "--expect",
    "The exact command decides whether the task closes",
    "--test",
    command,
    "--stop",
    "Stop after fresh verification",
    "--files",
    allowedFiles,
    "--minutes",
    "1",
    "--next",
    nextAction,
  ]);
  assert.equal(started.status, 0, started.stderr);
  return projectPath;
}

function assertActiveWithResult(state, result) {
  assert.equal(state.status, "ACTIVE");
  assert.equal(state.active_task.id, "verify-001");
  assert.equal(state.last_verification.result, result);
}

function contractDigest(contract) {
  return createHash("sha256")
    .update(JSON.stringify({
      id: contract.id,
      expected_behavior: contract.expected_behavior,
      test_command: contract.test_command,
      stop_condition: contract.stop_condition,
      allowed_files: contract.allowed_files,
      time_budget_minutes: contract.time_budget_minutes,
      next_action: contract.next_action,
    }))
    .digest("hex");
}

test("a non-zero exact command records FAIL and leaves the task active", async (t) => {
  const projectPath = await createProject(t);
  await writeFile(resolve(projectPath, "subject.txt"), "before\n", "utf8");
  const script = await writeCommandScript(projectPath, "fail", "process.exit(7);\n");
  const exactCommand = nodeCommand(script);
  await initializeTask(t, { command: exactCommand, projectPath });

  const result = runCli(projectPath, ["verify"]);
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /\bFAIL\b/);

  const state = await readState(projectPath);
  assertActiveWithResult(state, "FAIL");
  assert.equal(state.last_verification.command, exactCommand);
  assert.equal(state.last_verification.contract_digest, state.active_task.contract_digest);
  assert.equal(state.last_verification.head, "UNBORN");
  assert.match(state.last_verification.subject_digest, /^[a-f0-9]{64}$/);
  assert.equal(state.last_verification.exit_code, 7);
});

test("a bounded timeout records UNKNOWN and leaves the task active", async (t) => {
  const projectPath = await createProject(t);
  await writeFile(resolve(projectPath, "subject.txt"), "before\n", "utf8");
  const script = await writeCommandScript(
    projectPath,
    "hang",
    "setInterval(() => undefined, 1_000);\n",
  );
  await initializeTask(t, { command: nodeCommand(script), projectPath });

  // The product timeout is the task's minute budget. This test-only bound keeps
  // the public black box fast while exercising the same termination path.
  const result = runCliWithEnvironment(projectPath, ["verify"], {
    NODE_ENV: "test",
    OHNO_TEST_TIMEOUT_MS: "150",
  });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /\bUNKNOWN\b/);

  const state = await readState(projectPath);
  assertActiveWithResult(state, "UNKNOWN");
  assert.equal(state.last_verification.exit_code, null);
});

test("a signaled exact command records UNKNOWN and leaves the task active", async (t) => {
  const projectPath = await createProject(t);
  await writeFile(resolve(projectPath, "subject.txt"), "before\n", "utf8");
  const script = await writeCommandScript(
    projectPath,
    "await-signal",
    "setInterval(() => undefined, 1_000);\n",
  );
  await initializeTask(t, { command: nodeCommand(script), projectPath });

  // Node reports a signal portably when the parent terminates its child. This
  // test-only interrupt exercises that branch without platform signal races.
  const result = runCliWithEnvironment(projectPath, ["verify"], {
    NODE_ENV: "test",
    OHNO_TEST_INTERRUPT_MS: "150",
  });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /\bUNKNOWN\b/);

  const state = await readState(projectPath);
  assertActiveWithResult(state, "UNKNOWN");
  assert.equal(state.last_verification.exit_code, null);
});

test("an unreadable matched subject records UNKNOWN and leaves the task active", async (t) => {
  const projectPath = await createProject(t);
  await writeFile(resolve(projectPath, "subject.txt"), "indexed file\n", "utf8");
  runGit(projectPath, ["add", "--", "subject.txt"]);
  await rm(resolve(projectPath, "subject.txt"));
  await mkdir(resolve(projectPath, "subject.txt"));
  const script = await writeCommandScript(projectPath, "pass", "process.exit(0);\n");
  await initializeTask(t, { command: nodeCommand(script), projectPath });

  const result = runCli(projectPath, ["verify"]);
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /\bUNKNOWN\b/);

  const state = await readState(projectPath);
  assertActiveWithResult(state, "UNKNOWN");
  assert.equal(state.last_verification.subject_digest, null);
  assert.equal(state.last_verification.exit_code, null);
});

test("unchanged zero exit binds a fresh PASS receipt and returns exactly one next action", async (t) => {
  const projectPath = await createProject(t);
  await writeFile(resolve(projectPath, "subject.txt"), "unchanged\n", "utf8");
  const script = await writeCommandScript(projectPath, "pass", "process.exit(0);\n");
  const exactCommand = `  ${nodeCommand(script)}  `;
  await initializeTask(t, { command: exactCommand, projectPath });
  const startedState = await readState(projectPath);
  assert.equal(startedState.active_task.test_command, exactCommand);

  const result = runCli(projectPath, ["verify"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, `${nextAction}\n`);
  assert.equal(result.stderr, "");

  const state = await readState(projectPath);
  assert.equal(state.status, "IDLE");
  assert.equal(state.active_task, null);
  assert.equal(state.completed.length, 1);
  assert.equal(state.completed[0].id, "verify-001");
  assert.deepEqual(state.last_verification, {
    result: "PASS",
    command: exactCommand,
    contract_digest: startedState.active_task.contract_digest,
    head: "UNBORN",
    subject_digest: state.last_verification.subject_digest,
    exit_code: 0,
    finished_at: state.last_verification.finished_at,
  });
  assert.match(state.last_verification.subject_digest, /^[a-f0-9]{64}$/);
  assert.equal(
    Number.isNaN(Date.parse(state.last_verification.finished_at)),
    false,
    "finished_at must be an RFC3339-compatible timestamp",
  );
});

test("allowed-file mutation during a zero-exit test is UNKNOWN and cannot close", async (t) => {
  const projectPath = await createProject(t);
  await writeFile(resolve(projectPath, "subject.txt"), "before\n", "utf8");
  const script = await writeCommandScript(
    projectPath,
    "mutate",
    [
      'import { writeFileSync } from "node:fs";',
      'writeFileSync("subject.txt", "during test\\n", "utf8");',
      "",
    ].join("\n"),
  );
  await initializeTask(t, { command: nodeCommand(script), projectPath });

  const result = runCli(projectPath, ["verify"]);
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /\bUNKNOWN\b/);
  assertActiveWithResult(await readState(projectPath), "UNKNOWN");
});

test("state corrupted during a zero-exit test fails closed without overwrite", async (t) => {
  const projectPath = await createProject(t);
  await writeFile(resolve(projectPath, "subject.txt"), "before\n", "utf8");
  const corruptStateBytes = Buffer.from('{"schema_version":\n');
  const script = await writeCommandScript(
    projectPath,
    "corrupt-state",
    [
      'import { writeFileSync } from "node:fs";',
      `writeFileSync(".ohno/state.json", Buffer.from("${corruptStateBytes.toString("base64")}", "base64"));`,
      "",
    ].join("\n"),
  );
  await initializeTask(t, { command: nodeCommand(script), projectPath });

  const result = runCli(projectPath, ["verify"]);
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /\bUNKNOWN\b/);
  assert.deepEqual(await readStateBytes(projectPath), corruptStateBytes);
});

test("allowed-file content changed after PASS makes the receipt visibly STALE", async (t) => {
  const projectPath = await createProject(t);
  await writeFile(resolve(projectPath, "subject.txt"), "verified\n", "utf8");
  const script = await writeCommandScript(projectPath, "pass", "process.exit(0);\n");
  await initializeTask(t, { command: nodeCommand(script), projectPath });
  assert.equal(runCli(projectPath, ["verify"]).status, 0);

  await writeFile(resolve(projectPath, "subject.txt"), "changed later\n", "utf8");
  const stale = runCli(projectPath, ["verify"]);
  assert.notEqual(stale.status, 0);
  assert.match(`${stale.stdout}\n${stale.stderr}`, /\bSTALE\b/);
});

test("HEAD changed after PASS makes the receipt visibly STALE", async (t) => {
  const projectPath = await createProject(t);
  await writeFile(resolve(projectPath, "subject.txt"), "verified\n", "utf8");
  runGit(projectPath, ["add", "--", "subject.txt"]);
  runGit(projectPath, [
    "-c",
    "user.name=Oh No Test",
    "-c",
    "user.email=ohno@example.invalid",
    "commit",
    "--quiet",
    "-m",
    "subject",
  ]);
  const script = await writeCommandScript(projectPath, "pass", "process.exit(0);\n");
  await initializeTask(t, { command: nodeCommand(script), projectPath });
  assert.equal(runCli(projectPath, ["verify"]).status, 0);

  await writeFile(resolve(projectPath, "unrelated.txt"), "new HEAD\n", "utf8");
  runGit(projectPath, ["add", "--", "unrelated.txt"]);
  runGit(projectPath, [
    "-c",
    "user.name=Oh No Test",
    "-c",
    "user.email=ohno@example.invalid",
    "commit",
    "--quiet",
    "-m",
    "advance HEAD",
  ]);
  const stale = runCli(projectPath, ["verify"]);
  assert.notEqual(stale.status, 0);
  assert.match(`${stale.stdout}\n${stale.stderr}`, /\bSTALE\b/);
});

test("task contract changed after PASS makes the receipt visibly STALE", async (t) => {
  const projectPath = await createProject(t);
  await writeFile(resolve(projectPath, "subject.txt"), "verified\n", "utf8");
  const script = await writeCommandScript(projectPath, "pass", "process.exit(0);\n");
  await initializeTask(t, { command: nodeCommand(script), projectPath });
  assert.equal(runCli(projectPath, ["verify"]).status, 0);

  const state = await readState(projectPath);
  state.completed[0].expected_behavior = "A changed task contract";
  state.completed[0].contract_digest = contractDigest(state.completed[0]);
  await writeFile(
    resolve(projectPath, ".ohno", "state.json"),
    `${JSON.stringify(state, null, 2)}\n`,
    "utf8",
  );

  const stale = runCli(projectPath, ["verify"]);
  assert.notEqual(stale.status, 0);
  assert.match(`${stale.stdout}\n${stale.stderr}`, /\bSTALE\b/);
});

test("task finish is not a manual completion bypass", async (t) => {
  const projectPath = await createProject(t);
  await writeFile(resolve(projectPath, "subject.txt"), "unverified\n", "utf8");
  const script = await writeCommandScript(projectPath, "pass", "process.exit(0);\n");
  await initializeTask(t, { command: nodeCommand(script), projectPath });
  const before = await readStateBytes(projectPath);

  const result = runCli(projectPath, ["task", "finish"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /usage|verify/i);
  assert.deepEqual(await readStateBytes(projectPath), before);
});
