import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import {
  access,
  mkdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import {
  createProject,
  readState,
  readStateBytes,
  runCli,
  spawnCli,
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

function runGitWithInput(cwd, args, input) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    input,
  });
  assert.equal(result.status, 0, result.stderr);
  return result;
}

async function waitForPath(path, timeoutMilliseconds = 5_000) {
  const deadline = Date.now() + timeoutMilliseconds;
  while (Date.now() < deadline) {
    try {
      await access(path);
      return;
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
    await delay(20);
  }
  assert.fail(`timed out waiting for ${path}`);
}

async function collectCliResult(child) {
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const [status, signal] = await once(child, "exit");
  return {
    status,
    signal,
    stdout,
    stderr,
  };
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

test("a non-zero command that corrupts state is UNKNOWN without overwrite", async (t) => {
  const projectPath = await createProject(t);
  await writeFile(resolve(projectPath, "subject.txt"), "before\n", "utf8");
  const corruptStateBytes = Buffer.from('{"corrupt_after_failure":\n');
  const script = await writeCommandScript(
    projectPath,
    "fail-and-corrupt-state",
    [
      'import { writeFileSync } from "node:fs";',
      `writeFileSync(".ohno/state.json", Buffer.from("${corruptStateBytes.toString("base64")}", "base64"));`,
      "process.exit(7);",
      "",
    ].join("\n"),
  );
  await initializeTask(t, { command: nodeCommand(script), projectPath });

  const result = runCli(projectPath, ["verify"]);
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /\bUNKNOWN\b/);
  assert.deepEqual(await readStateBytes(projectPath), corruptStateBytes);
});

test("a bounded timeout records UNKNOWN and leaves the task active", async (t) => {
  const projectPath = await createProject(t);
  await writeFile(resolve(projectPath, "subject.txt"), "before\n", "utf8");
  const script = await writeCommandScript(
    projectPath,
    "hang",
    [
      'import { writeFileSync } from "node:fs";',
      'process.on("SIGTERM", () => undefined);',
      'setTimeout(() => writeFileSync("commands/timeout-survivor.txt", "alive\\n"), 900);',
      "setInterval(() => undefined, 1_000);",
      "",
    ].join("\n"),
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

  await delay(1_000);
  await assert.rejects(
    access(resolve(projectPath, "commands", "timeout-survivor.txt")),
    (error) => error.code === "ENOENT",
    "timeout must terminate a command that ignores SIGTERM",
  );
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

test("a corrupt Git HEAD is UNKNOWN and never treated as UNBORN", async (t) => {
  const projectPath = await createProject(t);
  await writeFile(resolve(projectPath, "subject.txt"), "before\n", "utf8");
  const script = await writeCommandScript(projectPath, "pass", "process.exit(0);\n");
  await initializeTask(t, { command: nodeCommand(script), projectPath });
  await writeFile(
    resolve(projectPath, ".git", "HEAD"),
    `${"0".repeat(40)}\n`,
    "utf8",
  );

  const result = runCli(projectPath, ["verify"]);
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /\bUNKNOWN\b/);

  const state = await readState(projectPath);
  assertActiveWithResult(state, "UNKNOWN");
  assert.equal(state.last_verification.head, null);
});

test("an exact allowed path is digested without enumerating a huge unrelated index", async (t) => {
  const projectPath = await createProject(t);
  await writeFile(resolve(projectPath, "subject.txt"), "allowed\n", "utf8");
  const blob = runGitWithInput(
    projectPath,
    ["hash-object", "-w", "--stdin"],
    "cached-only\n",
  ).stdout.trim();
  const indexLines = [];
  let listedPathBytes = 0;
  for (let index = 0; listedPathBytes <= 1_300_000; index += 1) {
    const relativePath = `unrelated/cache-${String(index).padStart(6, "0")}-${"x".repeat(48)}.txt`;
    indexLines.push(`100644 ${blob}\t${relativePath}\n`);
    listedPathBytes += Buffer.byteLength(`${relativePath}\0`);
  }
  assert.ok(listedPathBytes > 1_048_576);
  runGitWithInput(
    projectPath,
    ["update-index", "--add", "--index-info"],
    indexLines.join(""),
  );

  const script = await writeCommandScript(projectPath, "pass", "process.exit(0);\n");
  await initializeTask(t, { command: nodeCommand(script), projectPath });
  const result = runCli(projectPath, ["verify"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, `${nextAction}\n`);
  assert.equal((await readState(projectPath)).status, "IDLE");
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

test("concurrent verification cannot let a slower process reopen a closed task", async (t) => {
  const projectPath = await createProject(t);
  await writeFile(resolve(projectPath, "subject.txt"), "unchanged\n", "utf8");
  const markerPath = resolve(projectPath, "commands", "slow-first.marker");
  const script = await writeCommandScript(
    projectPath,
    "slow-first-fast-second",
    [
      'import { closeSync, openSync } from "node:fs";',
      "let isFirst = false;",
      "try {",
      '  const descriptor = openSync("commands/slow-first.marker", "wx");',
      "  closeSync(descriptor);",
      "  isFirst = true;",
      "} catch (error) {",
      '  if (error?.code !== "EEXIST") throw error;',
      "}",
      "if (isFirst) {",
      "  await new Promise((resolve) => setTimeout(resolve, 1_500));",
      "}",
      "",
    ].join("\n"),
  );
  await initializeTask(t, { command: nodeCommand(script), projectPath });

  const first = spawnCli(projectPath, ["verify"]);
  const firstResultPromise = collectCliResult(first);
  await waitForPath(markerPath);
  const second = spawnCli(projectPath, ["verify"]);
  const secondResultPromise = collectCliResult(second);
  const [firstResult, secondResult] = await Promise.all([
    firstResultPromise,
    secondResultPromise,
  ]);

  assert.equal(firstResult.status, 0, firstResult.stderr);
  assert.equal(firstResult.signal, null);
  assert.equal(firstResult.stdout, `${nextAction}\n`);
  assert.notEqual(secondResult.status, 0);
  assert.match(secondResult.stderr, /verification.*(?:progress|lock)|lock/i);

  const state = await readState(projectPath);
  assert.equal(state.status, "IDLE");
  assert.equal(state.active_task, null);
  assert.equal(state.completed.length, 1);
  assert.equal(state.completed[0].id, "verify-001");
  await assert.rejects(
    access(resolve(projectPath, ".ohno", "verify.lock")),
    (error) => error.code === "ENOENT",
    "verification lock must be released",
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

test("a non-RFC3339 receipt timestamp is rejected without overwrite", async (t) => {
  const projectPath = await createProject(t);
  await writeFile(resolve(projectPath, "subject.txt"), "verified\n", "utf8");
  const script = await writeCommandScript(projectPath, "pass", "process.exit(0);\n");
  await initializeTask(t, { command: nodeCommand(script), projectPath });
  assert.equal(runCli(projectPath, ["verify"]).status, 0);

  const state = await readState(projectPath);
  state.last_verification.finished_at = "2026-07-30";
  const malformedStateBytes = Buffer.from(`${JSON.stringify(state, null, 2)}\n`);
  await writeFile(
    resolve(projectPath, ".ohno", "state.json"),
    malformedStateBytes,
  );

  const result = runCli(projectPath, ["verify"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /invalid state/i);
  assert.deepEqual(await readStateBytes(projectPath), malformedStateBytes);
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
