import assert from "node:assert/strict";
import {
  spawn,
  spawnSync,
} from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import {
  access,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import {
  cliPath,
  createProject,
  readState,
  readStateBytes,
  runCli,
  runInit,
} from "../helpers/blackbox.mjs";

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const goal = "Keep one locally reviewed linear plan honest";
const passCommand = `"${process.execPath}" "pass.mjs"`;

function git(projectPath, args) {
  const result = spawnSync("git", args, {
    cwd: projectPath,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function commit(projectPath, paths, message) {
  git(projectPath, ["add", "--", ...paths]);
  git(projectPath, [
    "-c",
    "user.name=Oh No Test",
    "-c",
    "user.email=ohno@example.invalid",
    "commit",
    "--quiet",
    "-m",
    message,
    "--",
    ...paths,
  ]);
}

function emptyCommit(projectPath, message) {
  git(projectPath, [
    "-c",
    "user.name=Oh No Test",
    "-c",
    "user.email=ohno@example.invalid",
    "commit",
    "--quiet",
    "--allow-empty",
    "-m",
    message,
  ]);
}

async function initialize(projectPath) {
  const result = runInit(projectPath);
  assert.equal(result.status, 0, result.stderr);
}

function frozenTask(id, overrides = {}) {
  return {
    id,
    title: `Title for ${id}`,
    goal: `Goal for ${id}`,
    status: "FROZEN",
    expected_behavior: `Behavior for ${id}`,
    test_command: passCommand,
    allowed_files: ["subject.txt"],
    stop_condition: `Stop after ${id} passes`,
    time_budget_minutes: 30,
    ...overrides,
  };
}

function outlineTask(id, overrides = {}) {
  return {
    id,
    title: `Title for ${id}`,
    goal: `Goal for ${id}`,
    status: "OUTLINE",
    ...overrides,
  };
}

async function writePlan(projectPath, name, orderedTasks, cursor = 0) {
  const path = resolve(projectPath, name);
  await writeFile(
    path,
    `${JSON.stringify({
      cursor,
      ordered_tasks: orderedTasks,
    }, null, 2)}\n`,
    "utf8",
  );
  return name;
}

function proposalEvidence(result) {
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  const stdout = result.stdout.replaceAll("\r\n", "\n");
  const separator = stdout.indexOf("\n\n");
  assert.notEqual(separator, -1, "proposal must frame exact diff bytes");
  const header = stdout.slice(0, separator);
  const exactDiff = stdout.slice(separator + 2);
  const field = (name) => {
    const match = header.match(new RegExp(`^${name}: (.+)$`, "m"));
    assert.ok(match, `missing ${name} proposal evidence`);
    return match[1];
  };
  const evidence = {
    revision: field("PLAN_REVISION"),
    diffDigest: field("DIFF_DIGEST"),
    head: field("HEAD"),
    proposedAt: field("PROPOSED_AT"),
    exactDiff,
    exactDiffBytes: Number(field("EXACT_PLAN_DIFF_BYTES")),
  };
  assert.match(evidence.revision, /^[0-9a-f]{64}$/);
  assert.match(evidence.diffDigest, /^[0-9a-f]{64}$/);
  assert.match(evidence.head, /^(?:[0-9a-f]{40}|UNBORN)$/);
  assert.ok(Number.isFinite(Date.parse(evidence.proposedAt)));
  assert.equal(
    Buffer.byteLength(exactDiff, "utf8"),
    evidence.exactDiffBytes,
  );
  assert.equal(
    createHash("sha256").update(exactDiff).digest("hex"),
    evidence.diffDigest,
  );
  return evidence;
}

function propose(projectPath, planFile) {
  return proposalEvidence(
    runCli(projectPath, ["plan", "propose", "--file", planFile]),
  );
}

function accept(projectPath, evidence) {
  const result = runCli(projectPath, [
    "plan",
    "accept",
    "--revision",
    evidence.revision,
    "--diff",
    evidence.diffDigest,
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /^LOCAL_REVIEW_RECORDED: [0-9a-f]{64}\r?\n$/);
  assert.doesNotMatch(
    result.stdout,
    /OWNER_(?:AUTHORIZED|CONFIRMED)|LOCAL_OWNER_CONFIRMATION/i,
  );
  return result;
}

async function installPlan(projectPath, tasks, cursor = 0, name = "plan.json") {
  const planFile = await writePlan(projectPath, name, tasks, cursor);
  const evidence = propose(projectPath, planFile);
  accept(projectPath, evidence);
  return evidence;
}

function runHook(projectPath, hookEventName, fields = {}) {
  return spawnSync(process.execPath, [cliPath, "hook"], {
    cwd: projectPath,
    encoding: "utf8",
    input: `${JSON.stringify({
      session_id: "linear-plan-test",
      transcript_path: null,
      cwd: projectPath,
      hook_event_name: hookEventName,
      model: "test-model",
      permission_mode: "default",
      ...fields,
    })}\n`,
  });
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

async function collectChild(child) {
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

async function createTruthProject(t) {
  const projectPath = await createProject(t);
  await mkdir(resolve(projectPath, ".ohno"), { recursive: true });
  await mkdir(resolve(projectPath, ".codex"), { recursive: true });
  await mkdir(resolve(projectPath, "docs"), { recursive: true });
  await mkdir(resolve(projectPath, "nested"), { recursive: true });
  await writeFile(resolve(projectPath, "README.md"), "# Entry\n", "utf8");
  await writeFile(
    resolve(projectPath, "nested", "AGENTS.md"),
    "# Instructions\n",
    "utf8",
  );
  await writeFile(
    resolve(projectPath, ".codex", "hooks.json"),
    "{}\n",
    "utf8",
  );
  await writeFile(resolve(projectPath, "docs", "PLAN.md"), "# Plan\n", "utf8");
  await writeFile(
    resolve(projectPath, "docs", "PRODUCT-CONTRACT.md"),
    "# Contract\n",
    "utf8",
  );
  await writeFile(
    resolve(projectPath, "docs", "ACCEPTANCE.md"),
    "# Acceptance\n",
    "utf8",
  );
  await writeFile(
    resolve(projectPath, "docs", "DESIGN.md"),
    "# Design\n",
    "utf8",
  );
  await writeFile(
    resolve(projectPath, ".ohno", "truth.json"),
    `${JSON.stringify({
      schema_version: 1,
      targets: [
        {
          path: "docs/PLAN.md",
          concerns: ["requirements", "plan"],
        },
        {
          path: "docs/PRODUCT-CONTRACT.md",
          concerns: ["requirements", "contract"],
        },
        {
          path: "docs/ACCEPTANCE.md",
          concerns: ["requirements", "acceptance"],
        },
        {
          path: "README.md",
          concerns: ["public-entry"],
        },
        {
          path: "nested/AGENTS.md",
          concerns: ["agent-instructions"],
        },
        {
          path: ".codex/hooks.json",
          concerns: ["agent-hooks"],
        },
      ],
    }, null, 2)}\n`,
    "utf8",
  );
  commit(projectPath, [
    ".ohno/truth.json",
    ".codex/hooks.json",
    "README.md",
    "nested/AGENTS.md",
    "docs/PLAN.md",
    "docs/PRODUCT-CONTRACT.md",
    "docs/ACCEPTANCE.md",
    "docs/DESIGN.md",
  ], "governing baseline");
  await initialize(projectPath);
  return projectPath;
}

test("plan review records bounded local evidence and documents keep one dynamic authority", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  const planFile = await writePlan(projectPath, "plan.json", [
    frozenTask("alpha"),
    outlineTask("beta"),
  ]);
  const evidence = propose(projectPath, planFile);
  accept(projectPath, evidence);

  const state = await readState(projectPath);
  assert.deepEqual(state.plan_review, {
    status: "LOCAL_REVIEW_RECORDED",
    plan_revision: evidence.revision,
    diff_digest: evidence.diffDigest,
    head: evidence.head,
    proposed_at: evidence.proposedAt,
    recorded_at: state.plan_review.recorded_at,
  });
  assert.ok(Number.isFinite(Date.parse(state.plan_review.recorded_at)));
  assert.equal(state.pending_plan, null);
  assert.doesNotMatch(
    JSON.stringify(state.plan_review),
    /OWNER_(?:AUTHORIZED|CONFIRMED)|LOCAL_OWNER_CONFIRMATION/i,
  );

  const driftProject = await createProject(t);
  await initialize(driftProject);
  const driftFile = await writePlan(driftProject, "plan.json", [
    frozenTask("alpha"),
  ]);
  const driftEvidence = propose(driftProject, driftFile);
  emptyCommit(driftProject, "move head after proposal");
  const beforeReject = await readStateBytes(driftProject);
  const rejected = runCli(driftProject, [
    "plan",
    "accept",
    "--revision",
    driftEvidence.revision,
    "--diff",
    driftEvidence.diffDigest,
  ]);
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /HEAD.*changed|proposal.*HEAD/i);
  assert.deepEqual(await readStateBytes(driftProject), beforeReject);

  const agents = await readFile(resolve(repositoryRoot, "AGENTS.md"), "utf8");
  const product = await readFile(
    resolve(repositoryRoot, "docs", "PRODUCT-CONTRACT.md"),
    "utf8",
  );
  const design = await readFile(
    resolve(repositoryRoot, "docs", "DESIGN.md"),
    "utf8",
  );
  const acceptance = await readFile(
    resolve(repositoryRoot, "docs", "ACCEPTANCE.md"),
    "utf8",
  );
  const ledger = await readFile(
    resolve(repositoryRoot, "docs", "IMPLEMENTATION-PLAN.md"),
    "utf8",
  );
  assert.doesNotMatch(
    agents,
    /Status is `DESIGN_FROZEN_IMPLEMENTATION_NOT_STARTED`|exact first action is:\s*\n/i,
  );
  assert.match(agents, /ohno resume/i);
  assert.match(agents, /CLI.*unavailable.*ledger|fallback.*ledger/i);
  for (const document of [product, design, acceptance]) {
    assert.doesNotMatch(
      document,
      /^Status:.*(?:NOT IMPLEMENTED|NOT_STARTED|NO ACCEPTANCE|NO ROWS)/im,
    );
  }
  assert.doesNotMatch(
    `${product}\n${design}\n${acceptance}\n${ledger}`,
    /LOCAL_OWNER_CONFIRMATION_ONLY/i,
  );
  assert.match(ledger, /Correction 1[\s\S]*LOCAL_PASS/);
  assert.equal(
    (ledger.match(/unique next:/giu) ?? []).length,
    1,
    "the bootstrap ledger must expose exactly one dynamic next action",
  );
  assert.match(
    ledger,
    /## Exact current action[\s\S]*There is exactly one\. \*\*Unique next:\*\*/iu,
  );
  assert.match(
    `${product}\n${design}`,
    /same-user[\s\S]{0,160}(?:bypass|circumvent)|malicious[\s\S]{0,160}not.*boundary/i,
  );
});

test("accepted plans expose one revision, ordered tasks, cursor, and stable bounded task shapes", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  const tasks = [
    frozenTask("alpha"),
    outlineTask("beta"),
  ];
  const evidence = await installPlan(projectPath, tasks);
  const state = await readState(projectPath);

  assert.equal(state.schema_version, 2);
  assert.equal(state.plan_revision, evidence.revision);
  assert.equal(state.cursor, 0);
  assert.deepEqual(state.ordered_tasks, tasks);
  assert.deepEqual(Object.keys(state.ordered_tasks[1]).sort(), [
    "goal",
    "id",
    "status",
    "title",
  ]);
  assert.equal(state.ordered_tasks[0].next_action, undefined);

  const beforeInvalid = await readStateBytes(projectPath);
  await writePlan(projectPath, "duplicate.json", [
    frozenTask("same"),
    outlineTask("same"),
  ]);
  const duplicate = runCli(projectPath, [
    "plan",
    "propose",
    "--file",
    "duplicate.json",
  ]);
  assert.notEqual(duplicate.status, 0);
  assert.match(duplicate.stderr, /stable task id|duplicate.*id/i);
  assert.deepEqual(await readStateBytes(projectPath), beforeInvalid);
});

test("task start activates only the frozen cursor contract and refuses caller overrides or outlines", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  const frozen = frozenTask("alpha", {
    expected_behavior: "The exact reviewed behavior",
    test_command: `"${process.execPath}" "reviewed-test.mjs"`,
    allowed_files: ["src/exact.ts", "test/exact.test.mjs"],
    stop_condition: "Stop at the reviewed boundary",
    time_budget_minutes: 47,
  });
  const evidence = await installPlan(projectPath, [
    frozen,
    outlineTask("beta"),
  ]);

  const beforeOverride = await readStateBytes(projectPath);
  const override = runCli(projectPath, [
    "task",
    "start",
    "--test",
    "node attacker.mjs",
    "--files",
    "**",
    "--next",
    "ATTACKER_NEXT",
  ]);
  assert.notEqual(override.status, 0);
  assert.match(override.stderr, /caller override|takes no arguments|frozen plan/i);
  assert.deepEqual(await readStateBytes(projectPath), beforeOverride);

  const started = runCli(projectPath, ["task", "start"]);
  assert.equal(started.status, 0, started.stderr);
  assert.match(started.stdout, /Started task alpha/);
  const state = await readState(projectPath);
  assert.deepEqual(state.active_task, {
    id: frozen.id,
    expected_behavior: frozen.expected_behavior,
    test_command: frozen.test_command,
    stop_condition: frozen.stop_condition,
    allowed_files: frozen.allowed_files,
    time_budget_minutes: frozen.time_budget_minutes,
    plan_revision: evidence.revision,
    contract_digest: state.active_task.contract_digest,
  });
  assert.match(state.active_task.contract_digest, /^[0-9a-f]{64}$/);
  assert.equal(state.active_task.next_action, undefined);

  const outlineProject = await createProject(t);
  await initialize(outlineProject);
  await installPlan(outlineProject, [outlineTask("outline-only")]);
  const next = runCli(outlineProject, ["next"]);
  assert.equal(next.status, 0, next.stderr);
  assert.equal(next.stdout, "FREEZE_TASK:outline-only\n");
  const beforeOutlineStart = await readStateBytes(outlineProject);
  const rejected = runCli(outlineProject, ["task", "start"]);
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /OUTLINE.*FREEZE_TASK:outline-only/i);
  assert.deepEqual(await readStateBytes(outlineProject), beforeOutlineStart);
});

test("PASS advances the cursor once and derives every next action from ordered tasks", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  await writeFile(resolve(projectPath, "subject.txt"), "bounded\n", "utf8");
  await writeFile(resolve(projectPath, "pass.mjs"), "process.exit(0);\n", "utf8");
  await installPlan(projectPath, [
    frozenTask("first"),
    frozenTask("second"),
  ]);

  let result = runCli(projectPath, ["task", "start"]);
  assert.equal(result.status, 0, result.stderr);
  result = runCli(projectPath, ["verify"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "START_TASK:second\n");
  assert.equal((await readState(projectPath)).cursor, 1);

  const repeated = runCli(projectPath, ["verify"]);
  assert.notEqual(repeated.status, 0);
  assert.match(repeated.stderr, /last PASS remains fresh|no active task/i);
  assert.equal((await readState(projectPath)).cursor, 1);

  result = runCli(projectPath, ["task", "start"]);
  assert.equal(result.status, 0, result.stderr);
  result = runCli(projectPath, ["verify"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "PROJECT_COMPLETE\n");
  const completed = await readState(projectPath);
  assert.equal(completed.cursor, 2);
  assert.deepEqual(
    completed.completed.map((task) => task.id),
    ["first", "second"],
  );
  assert.equal(runCli(projectPath, ["next"]).stdout, "PROJECT_COMPLETE\n");
  assert.equal(completed.next_authority, undefined);
});

test("every plan edit creates a revision and old-revision work cannot complete the replacement", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  await writeFile(resolve(projectPath, "subject.txt"), "bounded\n", "utf8");
  await writeFile(resolve(projectPath, "pass.mjs"), "process.exit(0);\n", "utf8");
  const base = [
    frozenTask("alpha"),
    outlineTask("beta"),
  ];
  const revisions = [];
  revisions.push((await installPlan(projectPath, base)).revision);

  const started = runCli(projectPath, ["task", "start"]);
  assert.equal(started.status, 0, started.stderr);
  const oldActive = (await readState(projectPath)).active_task;

  const variants = [
    [
      frozenTask("alpha", { title: "Edited alpha" }),
      outlineTask("beta"),
    ],
    [
      outlineTask("beta"),
      frozenTask("alpha", { title: "Edited alpha" }),
    ],
    [
      frozenTask("alpha", { title: "Edited alpha" }),
    ],
    [
      frozenTask("alpha", { title: "Edited alpha" }),
      frozenTask("beta"),
    ],
  ];
  for (const [index, variant] of variants.entries()) {
    const planFile = await writePlan(
      projectPath,
      `variant-${index}.json`,
      variant,
      0,
    );
    const evidence = propose(projectPath, planFile);
    revisions.push(evidence.revision);
    accept(projectPath, evidence);
  }
  assert.equal(new Set(revisions).size, revisions.length);

  const replacement = await readState(projectPath);
  assert.notEqual(replacement.plan_revision, oldActive.plan_revision);
  assert.equal(replacement.active_task, null);
  assert.equal(replacement.last_verification, null);
  assert.equal(replacement.cursor, 0);
  const cannotFinishOld = runCli(projectPath, ["verify"]);
  assert.notEqual(cannotFinishOld.status, 0);
  assert.equal((await readState(projectPath)).cursor, 0);

  const raceProject = await createProject(t);
  await initialize(raceProject);
  await writeFile(resolve(raceProject, "subject.txt"), "bounded\n", "utf8");
  await writeFile(resolve(raceProject, "pass.mjs"), "process.exit(0);\n", "utf8");
  await installPlan(raceProject, [frozenTask("old-revision")]);
  assert.equal(runCli(raceProject, ["task", "start"]).status, 0);
  const replacementFile = await writePlan(
    raceProject,
    "replacement.json",
    [frozenTask("replacement")],
  );
  const replacementEvidence = propose(raceProject, replacementFile);
  const readyPath = resolve(raceProject, ".ohno", "pass-cas.ready");
  const releasePath = resolve(raceProject, ".ohno", "pass-cas.release");
  const verifying = spawn(process.execPath, [cliPath, "verify"], {
    cwd: raceProject,
    env: {
      ...process.env,
      NODE_ENV: "test",
      OHNO_TEST_PASS_CAS_READY: readyPath,
      OHNO_TEST_PASS_CAS_RELEASE: releasePath,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const verifyResultPromise = collectChild(verifying);
  await waitForPath(readyPath);
  accept(raceProject, replacementEvidence);
  await writeFile(releasePath, "release\n", "utf8");
  const raced = await verifyResultPromise;
  assert.notEqual(raced.status, 0);
  assert.match(raced.stderr, /UNKNOWN.*state.*changed/i);
  const racedState = await readState(raceProject);
  assert.equal(racedState.plan_revision, replacementEvidence.revision);
  assert.equal(racedState.cursor, 0);
  assert.equal(racedState.active_task, null);
  assert.equal(racedState.last_verification, null);
  assert.deepEqual(racedState.completed, []);
});

test("verification uses HEAD CAS but later commits preserve freshness until the scoped subject changes", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  await writeFile(resolve(projectPath, "subject.txt"), "verified\n", "utf8");
  await writeFile(resolve(projectPath, "pass.mjs"), "process.exit(0);\n", "utf8");
  commit(projectPath, ["subject.txt", "pass.mjs"], "verification baseline");
  await installPlan(projectPath, [frozenTask("freshness")]);
  assert.equal(runCli(projectPath, ["task", "start"]).status, 0);
  const passed = runCli(projectPath, ["verify"]);
  assert.equal(passed.status, 0, passed.stderr);

  await writeFile(resolve(projectPath, "unrelated.txt"), "later\n", "utf8");
  commit(projectPath, ["unrelated.txt"], "ordinary unrelated commit");
  let status = runCli(projectPath, ["status", "--json"]);
  assert.equal(status.status, 0, status.stderr);
  assert.equal(JSON.parse(status.stdout).proof_freshness, "FRESH");

  await writeFile(resolve(projectPath, "subject.txt"), "changed\n", "utf8");
  status = runCli(projectPath, ["status", "--json"]);
  assert.equal(status.status, 0, status.stderr);
  assert.equal(JSON.parse(status.stdout).proof_freshness, "STALE");

  const casProject = await createProject(t);
  await initialize(casProject);
  await writeFile(resolve(casProject, "subject.txt"), "stable\n", "utf8");
  await writeFile(
    resolve(casProject, "head-change.mjs"),
    [
      'import { spawnSync } from "node:child_process";',
      "const result = spawnSync(",
      '  "git",',
      "  [",
      '    "-c", "user.name=Oh No Test",',
      '    "-c", "user.email=ohno@example.invalid",',
      '    "commit", "--quiet", "--allow-empty", "-m", "during verify",',
      "  ],",
      '  { encoding: "utf8" },',
      ");",
      "process.exit(result.status ?? 1);",
      "",
    ].join("\n"),
    "utf8",
  );
  commit(casProject, ["subject.txt", "head-change.mjs"], "CAS baseline");
  await installPlan(casProject, [
    frozenTask("cas", {
      test_command: `"${process.execPath}" "head-change.mjs"`,
    }),
  ]);
  assert.equal(runCli(casProject, ["task", "start"]).status, 0);
  const unknown = runCli(casProject, ["verify"]);
  assert.notEqual(unknown.status, 0);
  assert.match(unknown.stderr, /UNKNOWN.*subject changed|UNKNOWN.*HEAD/i);
  const casState = await readState(casProject);
  assert.equal(casState.status, "ACTIVE");
  assert.equal(casState.active_task.id, "cas");
  assert.equal(casState.last_verification.result, "UNKNOWN");

  const failingCasProject = await createProject(t);
  await initialize(failingCasProject);
  await writeFile(resolve(failingCasProject, "subject.txt"), "stable\n", "utf8");
  await writeFile(
    resolve(failingCasProject, "head-change-fail.mjs"),
    [
      'import { spawnSync } from "node:child_process";',
      "const result = spawnSync(",
      '  "git",',
      "  [",
      '    "-c", "user.name=Oh No Test",',
      '    "-c", "user.email=ohno@example.invalid",',
      '    "commit", "--quiet", "--allow-empty", "-m", "during failing verify",',
      "  ],",
      '  { encoding: "utf8" },',
      ");",
      "process.exit(result.status === 0 ? 7 : 9);",
      "",
    ].join("\n"),
    "utf8",
  );
  commit(
    failingCasProject,
    ["subject.txt", "head-change-fail.mjs"],
    "failing CAS baseline",
  );
  await installPlan(failingCasProject, [
    frozenTask("failing-cas", {
      test_command: `"${process.execPath}" "head-change-fail.mjs"`,
    }),
  ]);
  assert.equal(runCli(failingCasProject, ["task", "start"]).status, 0);
  const failingUnknown = runCli(failingCasProject, ["verify"]);
  assert.notEqual(failingUnknown.status, 0);
  assert.match(failingUnknown.stderr, /UNKNOWN.*subject changed|UNKNOWN.*HEAD/i);
  const failingCasState = await readState(failingCasProject);
  assert.equal(failingCasState.status, "ACTIVE");
  assert.equal(failingCasState.active_task.id, "failing-cas");
  assert.equal(failingCasState.last_verification.result, "UNKNOWN");
});

test("pre-commit compares the staged subject separately from the verified worktree subject", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  await writeFile(resolve(projectPath, "subject.txt"), "index version\n", "utf8");
  await writeFile(resolve(projectPath, "pass.mjs"), "process.exit(0);\n", "utf8");
  git(projectPath, ["add", "--", "subject.txt"]);
  await writeFile(
    resolve(projectPath, "subject.txt"),
    "verified worktree version\n",
    "utf8",
  );
  await installPlan(projectPath, [frozenTask("precommit")]);
  assert.equal(runCli(projectPath, ["task", "start"]).status, 0);
  const passed = runCli(projectPath, ["verify"]);
  assert.equal(passed.status, 0, passed.stderr);

  let guarded = runCli(projectPath, ["git", "pre-commit"]);
  assert.notEqual(guarded.status, 0);
  assert.match(guarded.stderr, /staged subject.*verified subject|digest/i);

  git(projectPath, ["add", "--", "subject.txt"]);
  guarded = runCli(projectPath, ["git", "pre-commit"]);
  assert.equal(guarded.status, 0, guarded.stderr);

  await writeFile(resolve(projectPath, "outside.txt"), "outside\n", "utf8");
  git(projectPath, ["add", "--", "outside.txt"]);
  guarded = runCli(projectPath, ["git", "pre-commit"]);
  assert.notEqual(guarded.status, 0);
  assert.match(guarded.stderr, /outside.*frozen|outside.*allowed/i);
});

test("Truth inventory is classified at init and rescanned only at change begin with fail-closed drift", async (t) => {
  const unchangedProject = await createTruthProject(t);
  let state = await readState(unchangedProject);
  assert.match(state.truth_inventory.inventory_digest, /^[0-9a-f]{64}$/);
  assert.ok(state.truth_inventory.classification.length >= 7);
  const initialInventory = structuredClone(state.truth_inventory);
  const begun = runCli(unchangedProject, [
    "change",
    "begin",
    "--summary",
    "Clarify one reviewed requirement",
    "--concerns",
    "requirements",
  ]);
  assert.equal(begun.status, 0, begun.stderr);
  state = await readState(unchangedProject);
  assert.deepEqual(state.truth_inventory, initialInventory);

  const unclassifiedProject = await createTruthProject(t);
  await mkdir(resolve(unclassifiedProject, "deep"), { recursive: true });
  await writeFile(
    resolve(unclassifiedProject, "deep", "AGENTS.override.md"),
    "# New unclassified authority\n",
    "utf8",
  );
  for (const args of [
    ["status", "--json"],
    ["resume"],
    ["next"],
  ]) {
    const read = runCli(unclassifiedProject, args);
    assert.equal(read.status, 0, read.stderr);
  }
  const session = runHook(unclassifiedProject, "SessionStart", {
    source: "startup",
  });
  assert.equal(session.status, 0, session.stderr);
  const beforeUnclassified = await readStateBytes(unclassifiedProject);
  const unclassified = runCli(unclassifiedProject, [
    "change",
    "begin",
    "--summary",
    "Try to proceed past a new instruction entry",
    "--concerns",
    "requirements",
  ]);
  assert.notEqual(unclassified.status, 0);
  assert.match(
    unclassified.stderr,
    /UNCLASSIFIED_HIGH_RISK.*deep\/AGENTS\.override\.md/i,
  );
  assert.deepEqual(
    await readStateBytes(unclassifiedProject),
    beforeUnclassified,
  );

  const deletedProject = await createTruthProject(t);
  await rm(resolve(deletedProject, "docs", "PLAN.md"));
  const beforeDeleted = await readStateBytes(deletedProject);
  const deleted = runCli(deletedProject, [
    "change",
    "begin",
    "--summary",
    "Try to proceed without the governing plan",
    "--concerns",
    "requirements",
  ]);
  assert.notEqual(deleted.status, 0);
  assert.match(deleted.stderr, /GOVERNING_TARGET_(?:MISSING|RENAMED).*docs\/PLAN\.md/i);
  assert.deepEqual(await readStateBytes(deletedProject), beforeDeleted);

  const builtinDeletedProject = await createTruthProject(t);
  await rm(resolve(builtinDeletedProject, "docs", "DESIGN.md"));
  const beforeBuiltinDeleted = await readStateBytes(builtinDeletedProject);
  const builtinDeleted = runCli(builtinDeletedProject, [
    "change",
    "begin",
    "--summary",
    "Try to proceed without a classified built-in governing file",
    "--concerns",
    "requirements",
  ]);
  assert.notEqual(builtinDeleted.status, 0);
  assert.match(
    builtinDeleted.stderr,
    /GOVERNING_TARGET_(?:MISSING|RENAMED).*docs\/DESIGN\.md/i,
  );
  assert.deepEqual(
    await readStateBytes(builtinDeletedProject),
    beforeBuiltinDeleted,
  );

  const renamedProject = await createTruthProject(t);
  await rename(
    resolve(renamedProject, "README.md"),
    resolve(renamedProject, "README.en.md"),
  );
  const renamed = runCli(renamedProject, [
    "change",
    "begin",
    "--summary",
    "Try to proceed after renaming a governing entry",
    "--concerns",
    "requirements",
  ]);
  assert.notEqual(renamed.status, 0);
  assert.match(renamed.stderr, /GOVERNING_TARGET_(?:MISSING|RENAMED).*README\.md/i);
});
