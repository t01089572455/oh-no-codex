import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import {
  appendFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { cpus, platform, release, tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  cliPath,
  frozenPlanTask,
} from "../helpers/blackbox.mjs";

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const defaultOutputPath = resolve(
  repositoryRoot,
  "test",
  "evidence",
  "task7-real-project-trials.json",
);
const sampleCount = 30;
const budgetsMs = Object.freeze({
  status: 250,
  next: 250,
  resume: 500,
  task_start: 2_000,
});
const forbiddenPathPattern = /vibe[-_ ]?tether|\.vibetether/iu;

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function run(cwd, executable, args, options = {}) {
  return spawnSync(executable, args, {
    cwd,
    encoding: "utf8",
    ...options,
  });
}

function requireSuccess(result, label) {
  assert.equal(
    result.status,
    0,
    `${label} failed (${result.status}):\n${result.stderr}`,
  );
  return result;
}

function runCli(cwd, args, options) {
  return run(cwd, process.execPath, [cliPath, ...args], options);
}

function runGit(cwd, args) {
  return requireSuccess(run(cwd, "git", args), `git ${args.join(" ")}`);
}

function parseArguments(argv) {
  const projects = [];
  let pendingProject;
  let outputPath = defaultOutputPath;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (argument === "--project") {
      assert.ok(value, "--project requires a copied project path");
      pendingProject = value;
      index += 1;
      continue;
    }
    if (argument === "--stack") {
      assert.ok(value, "--stack requires a public stack label");
      assert.ok(pendingProject, "--stack must follow one --project");
      projects.push({
        inputPath: pendingProject,
        stack: value,
      });
      pendingProject = undefined;
      index += 1;
      continue;
    }
    if (argument === "--output") {
      assert.ok(value, "--output requires a path");
      outputPath = resolve(value);
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${argument}`);
  }

  assert.equal(pendingProject, undefined, "each --project needs one --stack");
  assert.equal(projects.length, 3, "exactly three real copied projects are required");
  return {
    outputPath,
    projects,
  };
}

async function collectManifest(rootPath) {
  const records = [];

  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      const absolutePath = resolve(directory, entry.name);
      const relativePath = relative(rootPath, absolutePath).replaceAll("\\", "/");
      if (forbiddenPathPattern.test(relativePath)) {
        throw new Error("forbidden historical product marker in trial copy");
      }
      const firstSegment = relativePath.split("/")[0];
      if (
        firstSegment.startsWith(".git")
        || [".ohno", ".codex", "ohno-trial", "node_modules"].includes(firstSegment)
      ) {
        continue;
      }
      if (entry.isDirectory()) {
        await visit(absolutePath);
        continue;
      }
      if (entry.isFile()) {
        const metadata = await stat(absolutePath);
        records.push([relativePath, metadata.size]);
      }
    }
  }

  await visit(rootPath);
  const canonical = JSON.stringify(records);
  return {
    file_count: records.length,
    identity_sha256: sha256(canonical),
    total_bytes: records.reduce((total, [, size]) => total + size, 0),
  };
}

function quoteForShell(value) {
  return `"${value.replaceAll("\"", "\\\"")}"`;
}

function trialTask({
  id,
  subject,
}) {
  return frozenPlanTask({
    id,
    title: `Exercise ${id}`,
    goal: `Keep ${id} inside one frozen trial contract`,
    expected_behavior: `${id} passes only after its exact public check succeeds`,
    test_command:
      `${quoteForShell(process.execPath)} ${quoteForShell("ohno-trial/check.mjs")}`,
    stop_condition: `Stop after ${id} has fresh exact evidence`,
    allowed_files: [subject],
    time_budget_minutes: 30,
  });
}

async function reviewPlan(cwd, tasks, fileName) {
  const planPath = resolve(cwd, fileName);
  await writeFile(
    planPath,
    `${JSON.stringify({
      cursor: 0,
      ordered_tasks: tasks,
    }, null, 2)}\n`,
    "utf8",
  );
  const proposed = requireSuccess(
    runCli(cwd, ["plan", "propose", "--file", fileName]),
    "ohno plan propose",
  );
  const revision =
    /^PLAN_REVISION: ([a-f0-9]{64})$/mu.exec(proposed.stdout)?.[1];
  const diff = /^DIFF_DIGEST: ([a-f0-9]{64})$/mu.exec(proposed.stdout)?.[1];
  assert.ok(revision, "plan proposal did not expose PLAN_REVISION");
  assert.ok(diff, "plan proposal did not expose DIFF_DIGEST");
  requireSuccess(
    runCli(cwd, [
      "plan",
      "accept",
      "--revision",
      revision,
      "--diff",
      diff,
    ]),
    "ohno plan accept",
  );
  return {
    diff,
    revision,
  };
}

function hookInput(cwd, hookEventName, fields = {}) {
  return {
    session_id: "task7-real-trial",
    transcript_path: null,
    cwd,
    hook_event_name: hookEventName,
    model: "trial-model",
    permission_mode: "default",
    ...fields,
  };
}

function runHook(cwd, hookEventName, fields = {}) {
  const result = requireSuccess(
    runCli(cwd, ["hook"], {
      input: `${JSON.stringify(hookInput(cwd, hookEventName, fields))}\n`,
    }),
    `ohno hook ${hookEventName}`,
  );
  assert.equal(result.stderr, "");
  assert.notEqual(result.stdout.trim(), "");
  return JSON.parse(result.stdout);
}

async function writeTrialBaseline(cwd) {
  const trialDirectory = resolve(cwd, "ohno-trial");
  await mkdir(resolve(cwd, ".ohno"), { recursive: true });
  await mkdir(trialDirectory, { recursive: true });
  const truth = {
    schema_version: 1,
    targets: [
      {
        path: "ohno-trial/PRODUCT.md",
        concerns: ["requirements", "public-capability"],
      },
      {
        path: "ohno-trial/PLAN.md",
        concerns: ["requirements", "plan"],
      },
    ],
  };
  await writeFile(
    resolve(cwd, ".ohno", "truth.json"),
    `${JSON.stringify(truth, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    resolve(trialDirectory, "PRODUCT.md"),
    "# Trial product contract\n\nKeep one copied project aligned.\n",
    "utf8",
  );
  await writeFile(
    resolve(trialDirectory, "PLAN.md"),
    "# Trial implementation plan\n\nRun two bounded tasks.\n",
    "utf8",
  );
  await writeFile(
    resolve(trialDirectory, "subject-1.txt"),
    "task one baseline\n",
    "utf8",
  );
  await writeFile(
    resolve(trialDirectory, "subject-2.txt"),
    "task two baseline\n",
    "utf8",
  );
  await writeFile(
    resolve(trialDirectory, "subject-3.txt"),
    "replacement baseline\n",
    "utf8",
  );
  await writeFile(resolve(trialDirectory, "mode.txt"), "FAIL\n", "utf8");
  await writeFile(
    resolve(trialDirectory, "check.mjs"),
    [
      'import { readFileSync } from "node:fs";',
      'const mode = readFileSync(new URL("./mode.txt", import.meta.url), "utf8").trim();',
      'process.exit(mode === "PASS" ? 0 : 9);',
      "",
    ].join("\n"),
    "utf8",
  );
}

function parseStatus(cwd) {
  const result = requireSuccess(
    runCli(cwd, ["status", "--json"]),
    "ohno status --json",
  );
  return JSON.parse(result.stdout);
}

function timedCli(cwd, args) {
  const startedAt = process.hrtime.bigint();
  const result = runCli(cwd, args);
  const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
  requireSuccess(result, `ohno ${args.join(" ")}`);
  return {
    elapsedMs,
    stdout: result.stdout,
  };
}

function percentile95(samples) {
  const sorted = samples.toSorted((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * 0.95) - 1];
}

async function collectCommandSamples(cwd, readyStateBytes) {
  const statePath = resolve(cwd, ".ohno", "state.json");
  const commandDefinitions = {
    status: ["status", "--json"],
    next: ["next"],
    resume: ["resume"],
  };

  for (const args of Object.values(commandDefinitions)) {
    timedCli(cwd, args);
  }
  await writeFile(statePath, readyStateBytes);
  timedCli(cwd, ["task", "start"]);
  await writeFile(statePath, readyStateBytes);

  const raw = {
    status: [],
    next: [],
    resume: [],
    task_start: [],
  };
  for (let index = 0; index < sampleCount; index += 1) {
    for (const [name, args] of Object.entries(commandDefinitions)) {
      raw[name].push(timedCli(cwd, args).elapsedMs);
    }
    await writeFile(statePath, readyStateBytes);
    raw.task_start.push(timedCli(cwd, ["task", "start"]).elapsedMs);
    await writeFile(statePath, readyStateBytes);
  }

  return Object.fromEntries(
    Object.entries(raw).map(([name, values]) => {
      const p95 = percentile95(values);
      const budget = budgetsMs[name];
      assert.ok(
        p95 < budget,
        `${name} p95 ${p95.toFixed(3)} ms exceeded ${budget} ms`,
      );
      return [
        name,
        {
          budget_ms_exclusive: budget,
          p95_ms: Number(p95.toFixed(3)),
          raw_ms: values.map((value) => Number(value.toFixed(3))),
          result: "TRIAL_PASS",
        },
      ];
    }),
  );
}

async function startCockpitAndReadState(cwd) {
  const child = spawn(process.execPath, [cliPath, "cockpit"], {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  let stdout = "";
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
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

  try {
    const response = await fetch(new URL("api/state", url));
    assert.equal(response.status, 200);
    const value = await response.json();
    assert.deepEqual(value, parseStatus(cwd));
    const page = await fetch(url);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /OH NO, CODEX!/u);
    return true;
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
    }
    await once(child, "exit");
  }
}

function commitStagedSubject(cwd, message) {
  return requireSuccess(
    run(cwd, "git", [
      "-c",
      "user.name=Oh No Trial",
      "-c",
      "user.email=ohno-trial@example.invalid",
      "commit",
      "--quiet",
      "-m",
      message,
    ]),
    `git commit ${message}`,
  );
}

async function initializeTrialProject(cwd) {
  runGit(cwd, ["init", "--quiet"]);
  const disabledGitLink = resolve(cwd, ".git.source-link.disabled");
  try {
    await stat(disabledGitLink);
    await writeFile(
      resolve(cwd, ".git", "info", "exclude"),
      ".git.source-link.disabled\n",
      "utf8",
    );
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
  await writeTrialBaseline(cwd);
  runGit(cwd, ["add", "--all"]);
  runGit(cwd, ["add", "--force", "--", ".ohno/truth.json"]);
  commitStagedSubject(cwd, "trial baseline");
  const installed = requireSuccess(runCli(cwd, ["install"]), "ohno install");
  assert.match(installed.stdout, /COOPERATIVE_GUARDRAIL/u);
  requireSuccess(
    runCli(cwd, [
      "init",
    ]),
    "ohno init",
  );
}

async function exerciseRealProject(cwd, label, stack, identity) {
  await initializeTrialProject(cwd);
  const support = (name) => resolve(cwd, "ohno-trial", name);
  const taskOne = trialTask({
    id: "trial-task-1",
    subject: "ohno-trial/subject-1.txt",
  });
  const taskTwo = trialTask({
    id: "trial-task-2",
    subject: "ohno-trial/subject-2.txt",
  });
  const flows = {
    cockpit_api_matches_status: false,
    codex_hook_status: false,
    fail_preserves_active_task: false,
    fresh_survives_ordinary_commit: false,
    installed_precommit: false,
    pass_advances_cursor: false,
    requirement_change_accepted: false,
    resume_projected: false,
    stale_after_subject_change: false,
    task_start: false,
  };

  const hookStatus = requireSuccess(
    runCli(cwd, ["hooks", "status", "--json"]),
    "ohno hooks status --json",
  );
  const hookModel = JSON.parse(hookStatus.stdout);
  assert.equal(hookModel.classification, "COOPERATIVE_GUARDRAIL");
  assert.equal(hookModel.git_hook, "INSTALLED_TEMPLATE");
  flows.codex_hook_status = true;
  flows.installed_precommit = true;

  await reviewPlan(
    cwd,
    [taskOne, taskTwo],
    ".ohno/trial-plan.json",
  );
  requireSuccess(runCli(cwd, ["task", "start"]), "first ohno task start");
  flows.task_start = true;
  const activeResume = requireSuccess(
    runCli(cwd, ["resume"]),
    "active ohno resume",
  ).stdout;
  const sessionStart = runHook(cwd, "SessionStart", { source: "startup" });
  assert.equal(
    sessionStart.hookSpecificOutput?.hookEventName,
    "SessionStart",
  );
  assert.equal(
    sessionStart.hookSpecificOutput?.additionalContext,
    activeResume,
  );
  const postCompact = runHook(cwd, "PostCompact", {
    turn_id: "task7-trial",
    trigger: "manual",
  });
  assert.equal(postCompact.systemMessage, activeResume);
  const preToolUse = runHook(cwd, "PreToolUse", {
    turn_id: "task7-trial",
    tool_name: "apply_patch",
    tool_use_id: "task7-trial-tool",
    tool_input: {
      command: [
        "*** Begin Patch",
        "*** Update File: ohno-trial/subject-1.txt",
        "@@",
        " task one baseline",
        "+bounded trial change",
        "*** End Patch",
      ].join("\n"),
    },
  });
  assert.equal(
    preToolUse.hookSpecificOutput?.permissionDecision,
    undefined,
  );

  const failed = runCli(cwd, ["verify"]);
  assert.notEqual(failed.status, 0);
  const failedStatus = parseStatus(cwd);
  assert.equal(failedStatus.current_task?.id, "trial-task-1");
  assert.equal(failedStatus.blocker, "EXACT_TEST_FAILED");
  flows.fail_preserves_active_task = true;

  await writeFile(support("mode.txt"), "PASS\n", "utf8");
  await appendFile(support("subject-1.txt"), "task one bounded work\n", "utf8");
  requireSuccess(runCli(cwd, ["verify"]), "first ohno verify PASS");
  assert.equal(parseStatus(cwd).next_action, "START_TASK:trial-task-2");
  flows.pass_advances_cursor = true;
  const stopped = runHook(cwd, "Stop", {
    turn_id: "task7-trial",
    stop_hook_active: false,
    last_assistant_message: "Evidence: OHNO_COMPLETE:trial-task-1",
  });
  assert.deepEqual(stopped, {});

  runGit(cwd, ["add", "--", "ohno-trial/subject-1.txt"]);
  requireSuccess(
    runCli(cwd, ["git", "pre-commit"]),
    "first ohno git pre-commit",
  );
  commitStagedSubject(cwd, "complete trial task one");
  assert.equal(parseStatus(cwd).proof_freshness, "FRESH");
  flows.fresh_survives_ordinary_commit = true;

  requireSuccess(runCli(cwd, ["task", "start"]), "second ohno task start");
  await appendFile(support("subject-2.txt"), "task two bounded work\n", "utf8");
  requireSuccess(runCli(cwd, ["verify"]), "second ohno verify PASS");
  runGit(cwd, ["add", "--", "ohno-trial/subject-2.txt"]);
  requireSuccess(
    runCli(cwd, ["git", "pre-commit"]),
    "second ohno git pre-commit",
  );
  commitStagedSubject(cwd, "complete trial task two");
  assert.equal(parseStatus(cwd).proof_freshness, "FRESH");
  await appendFile(support("subject-2.txt"), "post-proof drift\n", "utf8");
  assert.equal(parseStatus(cwd).proof_freshness, "STALE");
  flows.stale_after_subject_change = true;

  const resume = requireSuccess(runCli(cwd, ["resume"]), "ohno resume");
  assert.ok(Buffer.byteLength(resume.stdout, "utf8") < 4_096);
  assert.match(resume.stdout, /^PROOF: STALE$/mu);
  flows.resume_projected = true;

  requireSuccess(
    runCli(cwd, [
      "change",
      "begin",
      "--summary",
      "Update the disposable trial requirements",
      "--concerns",
      "requirements",
    ]),
    "ohno change begin",
  );
  await appendFile(
    support("PRODUCT.md"),
    "\nReplacement trial requirement.\n",
    "utf8",
  );
  await appendFile(
    support("PLAN.md"),
    "\nReplacement current trial plan.\n",
    "utf8",
  );
  await reviewPlan(
    cwd,
    [trialTask({
      id: "trial-replacement",
      subject: "ohno-trial/subject-3.txt",
    })],
    ".ohno/replacement-plan.json",
  );
  const displayed = requireSuccess(
    runCli(cwd, ["change", "diff"]),
    "ohno change diff",
  );
  const diffDigest =
    /^DIFF_DIGEST: ([a-f0-9]{64})$/mu.exec(displayed.stdout)?.[1];
  assert.ok(diffDigest, "change diff did not expose DIFF_DIGEST");
  const pendingState = JSON.parse(
    await readFile(resolve(cwd, ".ohno", "state.json"), "utf8"),
  );
  const changeId = pendingState.document_sync.change_id;
  assert.match(changeId, /^change-/u);
  requireSuccess(
    runCli(cwd, [
      "change",
      "accept",
      "--change",
      changeId,
      "--diff",
      diffDigest,
    ]),
    "ohno change accept",
  );
  const readyStatus = parseStatus(cwd);
  assert.equal(readyStatus.status, "IDLE");
  assert.equal(readyStatus.next_action, "START_TASK:trial-replacement");
  flows.requirement_change_accepted = true;

  flows.cockpit_api_matches_status = await startCockpitAndReadState(cwd);
  const readyStateBytes = await readFile(
    resolve(cwd, ".ohno", "state.json"),
  );
  const measurements = await collectCommandSamples(cwd, readyStateBytes);
  await writeFile(resolve(cwd, ".ohno", "state.json"), readyStateBytes);
  requireSuccess(
    runCli(cwd, ["task", "start"]),
    "replacement ohno task start",
  );
  assert.equal(parseStatus(cwd).current_task?.id, "trial-replacement");

  return {
    id: label,
    stack,
    copy_identity: identity,
    flows,
    measurements,
  };
}

function asciiValueAtLimit(byteLimit, prefix = "") {
  assert.ok(Buffer.byteLength(prefix, "utf8") <= byteLimit);
  return prefix.padEnd(byteLimit, "x");
}

function paddedCommand(command, byteLimit = 1_024) {
  const currentBytes = Buffer.byteLength(command, "utf8");
  assert.ok(currentBytes <= byteLimit);
  return `${command}${" ".repeat(byteLimit - currentBytes)}`;
}

function contractDigest(contract) {
  const {
    contract_digest: _contractDigest,
    ...unsigned
  } = contract;
  return sha256(JSON.stringify(unsigned));
}

function completedContract({
  expected,
  id,
  planRevision,
  testCommand,
}) {
  const contract = {
    id,
    expected_behavior: expected,
    test_command: testCommand,
    stop_condition: "Stop at the largest accepted fixture boundary",
    allowed_files: ["subject.txt"],
    time_budget_minutes: 60,
    plan_revision: planRevision,
  };
  return {
    ...contract,
    contract_digest: contractDigest(contract),
  };
}

async function measureLargestAcceptedCapsule() {
  const projectPath = await mkdtemp(resolve(tmpdir(), "ohno-task7-p04-"));
  try {
    runGit(projectPath, ["init", "--quiet"]);
    const maximumGoal = asciiValueAtLimit(256, "Goal ");
    const maximumId = asciiValueAtLimit(96, "active-");
    const maximumExpected = asciiValueAtLimit(512, "Expected ");
    const maximumNextId = asciiValueAtLimit(96, "next-");
    await writeFile(resolve(projectPath, "subject.txt"), "bounded\n", "utf8");
    await writeFile(resolve(projectPath, "fail.mjs"), "process.exit(9);\n", "utf8");
    requireSuccess(
      runCli(projectPath, ["init"]),
      "P04 ohno init",
    );
    const maximumTest = paddedCommand(
      `${quoteForShell(process.execPath)} ${quoteForShell("fail.mjs")}`,
    );
    await reviewPlan(
      projectPath,
      [
        frozenPlanTask({
          id: maximumId,
          title: asciiValueAtLimit(256, "Maximum active title "),
          goal: asciiValueAtLimit(256, "Maximum task goal "),
          expected_behavior: maximumExpected,
          test_command: maximumTest,
          stop_condition: "Stop at the largest accepted fixture boundary",
          allowed_files: ["subject.txt"],
          time_budget_minutes: 60,
        }),
        {
          id: maximumNextId,
          title: asciiValueAtLimit(256, "Maximum next title "),
          goal: asciiValueAtLimit(256, "Maximum next goal "),
          status: "OUTLINE",
        },
      ],
      ".ohno/p04-plan.json",
    );
    requireSuccess(
      runCli(projectPath, ["task", "start"]),
      "P04 ohno task start",
    );
    assert.notEqual(runCli(projectPath, ["verify"]).status, 0);
    const statePath = resolve(projectPath, ".ohno", "state.json");
    const state = JSON.parse(await readFile(statePath, "utf8"));
    state.completed = Array.from({ length: 120 }, (_, index) =>
      completedContract({
        expected: asciiValueAtLimit(
          512,
          `History ${String(index).padStart(3, "0")} `,
        ),
        id: asciiValueAtLimit(
          96,
          `completed-${String(index).padStart(3, "0")}-`,
        ),
        planRevision: state.plan_revision,
        testCommand: asciiValueAtLimit(
          1_024,
          `node historical-${String(index).padStart(3, "0")}.mjs `,
        ),
      })
    );
    await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    const resume = requireSuccess(
      runCli(projectPath, ["resume"]),
      "P04 ohno resume",
    );
    const bytes = Buffer.byteLength(resume.stdout, "utf8");
    assert.ok(bytes < 4_096, `largest capsule was ${bytes} bytes`);
    return {
      budget_bytes_exclusive: 4_096,
      fixture: {
        completed_history_entries: 120,
        expected_behavior_bytes: 512,
        goal_bytes: 256,
        stable_task_id_bytes: 96,
        test_command_bytes: 1_024,
      },
      result: "TRIAL_PASS",
      serialized_resume_bytes: bytes,
    };
  } finally {
    await rm(projectPath, { force: true, recursive: true });
  }
}

async function main() {
  const { outputPath, projects } = parseArguments(process.argv.slice(2));
  const resolvedProjects = [];
  for (const project of projects) {
    assert.doesNotMatch(project.inputPath, forbiddenPathPattern);
    const projectPath = await realpath(project.inputPath);
    assert.doesNotMatch(projectPath, forbiddenPathPattern);
    try {
      await stat(resolve(projectPath, ".git"));
      throw new Error("trial copy still has live Git metadata");
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
    resolvedProjects.push({
      ...project,
      identity: await collectManifest(projectPath),
      projectPath,
    });
  }

  const implementationHead = runGit(repositoryRoot, ["rev-parse", "HEAD"])
    .stdout.trim();
  const implementationTree = runGit(repositoryRoot, [
    "rev-parse",
    "HEAD^{tree}",
  ]).stdout.trim();
  const trials = [];
  for (let index = 0; index < resolvedProjects.length; index += 1) {
    const project = resolvedProjects[index];
    const label = `Trial ${String.fromCharCode(65 + index)}`;
    process.stdout.write(`RUNNING ${label} (${project.stack})\n`);
    trials.push(
      await exerciseRealProject(
        project.projectPath,
        label,
        project.stack,
        project.identity,
      ),
    );
  }

  const evidence = {
    schema_version: 1,
    classification: "TRIAL_EVIDENCE",
    generated_at: new Date().toISOString(),
    implementation: {
      dist_cli_sha256: sha256(await readFile(cliPath)),
      head: implementationHead,
      tree: implementationTree,
    },
    machine: {
      arch: process.arch,
      cpu: cpus()[0]?.model ?? "UNKNOWN",
      node: process.version,
      os: `${platform()} ${release()}`,
    },
    sample_method: {
      clock: "process.hrtime.bigint",
      p95: "nearest-rank ceil(0.95*n)-1",
      samples_per_command_per_copy: sampleCount,
      untimed_warmups_per_command_per_copy: 1,
    },
    trials,
    p04: await measureLargestAcceptedCapsule(),
    p06: {
      browser: "Codex in-app Browser",
      reason: "IN_APP_BROWSER_NAVIGATION_REJECTED",
      result: "NOT_MEASURED",
      trials: [],
    },
    limitations: [
      "Trials are evidence for these three disposable copies, not a universal performance claim.",
      "Codex and Git hooks are cooperative guardrails, not a hostile same-user security boundary.",
      "P06 and A14 require the authorized in-app Browser and are not inferred from HTTP-only checks.",
    ],
  };
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  process.stdout.write(
    `TRIAL_EVIDENCE_WRITTEN ${relative(repositoryRoot, outputPath).replaceAll("\\", "/")}\n`,
  );
}

await main();
