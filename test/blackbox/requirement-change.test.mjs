import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFile,
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
  readStateBytes,
  reviewPlan,
  runCli,
} from "../helpers/blackbox.mjs";

const ownerGoal = "Keep governing documents aligned with Owner changes";
const truthTargets = Object.freeze([
  {
    path: "README.md",
    concerns: ["public-capability"],
  },
  {
    path: "docs/PRODUCT.md",
    concerns: ["requirements", "public-capability"],
  },
  {
    path: "docs/PLAN.md",
    concerns: ["requirements", "plan"],
  },
  {
    path: "AGENTS.md",
    concerns: ["agent-rules"],
  },
]);
const allTargetPaths = truthTargets.map((target) => target.path);
const requirementPaths = ["docs/PRODUCT.md", "docs/PLAN.md"];

function runGit(cwd, args) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  return result;
}

function runGitBytes(cwd, args) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: null,
  });
  assert.equal(result.status, 0, result.stderr.toString("utf8"));
  return result.stdout;
}

function runCliBytes(cwd, args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: null,
  });
}

function runCliWithEnvironment(cwd, args, environment) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      ...environment,
    },
  });
}

function quoteForGitCommand(value) {
  return `"${value.replaceAll("\\", "/").replaceAll("\"", "\\\"")}"`;
}

async function createMutatingGitTextconv(projectPath) {
  const helperDirectory = resolve(projectPath, "git-textconv");
  const helperPath = resolve(helperDirectory, "mutate-on-fifth-call.mjs");
  const countPath = resolve(helperDirectory, "call-count.txt");
  const mutatePath = resolve(projectPath, "docs", "PLAN.md");
  await mkdir(helperDirectory, { recursive: true });
  await writeFile(
    helperPath,
    [
      'import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";',
      "const inputPath = process.argv[2];",
      "let count = 0;",
      "if (existsSync(process.env.OHNO_TEST_GIT_COUNT)) {",
      "  count = Number(readFileSync(process.env.OHNO_TEST_GIT_COUNT, \"utf8\"));",
      "}",
      "count += 1;",
      "writeFileSync(process.env.OHNO_TEST_GIT_COUNT, `${count}\\n`, \"utf8\");",
      "if (count === 5) {",
      "  appendFileSync(process.env.OHNO_TEST_MUTATE_PATH, \"changed during accept\\n\", \"utf8\");",
      "}",
      "process.stdout.write(readFileSync(inputPath));",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    resolve(projectPath, ".gitattributes"),
    [
      "docs/PRODUCT.md diff=ohno-test",
      "docs/PLAN.md diff=ohno-test",
      "",
    ].join("\n"),
    "utf8",
  );
  runGit(projectPath, [
    "config",
    "diff.ohno-test.textconv",
    `${quoteForGitCommand(process.execPath)} ${quoteForGitCommand(helperPath)}`,
  ]);

  return {
    countPath,
    environment: {
      OHNO_TEST_GIT_COUNT: countPath,
      OHNO_TEST_MUTATE_PATH: mutatePath,
    },
    mutatePath,
  };
}

async function writeTruth(projectPath, truth = {
  schema_version: 1,
  targets: truthTargets,
}) {
  await writeFile(
    resolve(projectPath, ".ohno", "truth.json"),
    `${JSON.stringify(truth, null, 2)}\n`,
    "utf8",
  );
}

async function initialize(projectPath) {
  const result = runCli(projectPath, ["init", "--goal", ownerGoal]);
  assert.equal(result.status, 0, result.stderr);
}

async function createGovernedProject(t) {
  const projectPath = await createProject(t);
  await mkdir(resolve(projectPath, ".ohno"), { recursive: true });
  await mkdir(resolve(projectPath, "docs"), { recursive: true });
  for (const target of truthTargets) {
    await writeFile(
      resolve(projectPath, target.path),
      `baseline for ${target.path}\n`,
      "utf8",
    );
  }
  await writeTruth(projectPath);
  runGit(projectPath, [
    "add",
    "--",
    ".ohno/truth.json",
    ...allTargetPaths,
  ]);
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
  return projectPath;
}

function reviewReplacementPlan(
  projectPath,
  id = "replacement-after-change",
) {
  return reviewPlan(projectPath, {
    tasks: [
      frozenPlanTask({
        id,
        title: "Replacement reviewed task",
        goal: "Resume only from the replacement plan",
        expected_behavior: "The replacement plan becomes current",
        test_command: "node --test replacement.test.mjs",
        stop_condition: "Stop at the replacement plan boundary",
        allowed_files: ["src/**"],
        time_budget_minutes: 30,
      }),
    ],
  });
}

function beginArguments({
  candidates,
  concerns,
  omitConcerns = false,
  summary = "Owner changed the user-visible requirements",
} = {}) {
  const args = ["change", "begin", "--summary", summary];
  if (!omitConcerns) {
    args.push("--concerns", concerns ?? "requirements");
  }
  if (candidates !== undefined) {
    args.push("--candidates", candidates);
  }
  return args;
}

function beginChange(projectPath, options) {
  const result = runCli(projectPath, beginArguments(options));
  assert.equal(result.status, 0, result.stderr);
  return result;
}

async function appendRequiredChanges(projectPath) {
  await appendFile(
    resolve(projectPath, "docs/PRODUCT.md"),
    "Owner-visible requirement replacement\n",
    "utf8",
  );
  await appendFile(
    resolve(projectPath, "docs/PLAN.md"),
    "Replacement current implementation plan\n",
    "utf8",
  );
  reviewReplacementPlan(projectPath);
}

function expectedExactDiff(projectPath, paths) {
  return runGitBytes(projectPath, [
    "--no-pager",
    "diff",
    "--no-ext-diff",
    "--no-color",
    "--binary",
    "HEAD",
    "--",
    ...paths,
  ]);
}

function parseDiffOutput(result) {
  assert.equal(result.status, 0, result.stderr.toString("utf8"));
  const marker = Buffer.from("EXACT_DIFF_BYTES: ", "utf8");
  const markerIndex = result.stdout.indexOf(marker);
  assert.notEqual(markerIndex, -1, "change diff must frame its exact diff bytes");
  const diffStart = result.stdout.indexOf(0x0a, markerIndex);
  assert.notEqual(diffStart, -1, "EXACT_DIFF_BYTES header must end with LF");

  const header = result.stdout.subarray(0, diffStart + 1).toString("utf8");
  const exactDiff = result.stdout.subarray(diffStart + 1);
  const byteCount = Number(
    header.match(/^EXACT_DIFF_BYTES: (\d+)$/mu)?.[1],
  );
  const digest = header.match(/^DIFF_DIGEST: ([a-f0-9]{64})$/mu)?.[1];
  const requiredPaths = JSON.parse(
    header.match(/^REQUIRED_PATHS_JSON: (.+)$/mu)?.[1] ?? "null",
  );
  const missingPaths = JSON.parse(
    header.match(/^MISSING_PATHS_JSON: (.+)$/mu)?.[1] ?? "null",
  );

  assert.equal(exactDiff.length, byteCount);
  assert.match(digest ?? "", /^[a-f0-9]{64}$/);
  return {
    digest,
    exactDiff,
    header,
    missingPaths,
    requiredPaths,
  };
}

function displayDiff(projectPath) {
  return parseDiffOutput(runCliBytes(projectPath, ["change", "diff"]));
}

function acceptArguments(changeId, digest) {
  return [
    "change",
    "accept",
    "--change",
    changeId,
    "--diff",
    digest,
  ];
}

test("change begin fails closed for missing, corrupt, non-v1, or unsafe Truth", async (t) => {
  const cases = [
    {
      name: "missing",
      write: async () => undefined,
    },
    {
      name: "corrupt",
      write: async (projectPath) => {
        await writeFile(
          resolve(projectPath, ".ohno", "truth.json"),
          '{"schema_version":\n',
          "utf8",
        );
      },
    },
    {
      name: "non-v1",
      write: async (projectPath) => {
        await writeTruth(projectPath, {
          schema_version: 2,
          targets: truthTargets,
        });
      },
    },
    {
      name: "unsafe target",
      write: async (projectPath) => {
        await writeTruth(projectPath, {
          schema_version: 1,
          targets: [{
            path: "../outside.md",
            concerns: ["requirements"],
          }],
        });
      },
    },
    {
      name: "exact parent target",
      write: async (projectPath) => {
        await writeTruth(projectPath, {
          schema_version: 1,
          targets: [{
            path: "..",
            concerns: ["requirements"],
          }],
        });
      },
    },
    {
      name: "drive-relative target",
      write: async (projectPath) => {
        await writeTruth(projectPath, {
          schema_version: 1,
          targets: [{
            path: "C:relative.md",
            concerns: ["requirements"],
          }],
        });
      },
    },
    {
      name: "Git pathspec target",
      write: async (projectPath) => {
        await writeTruth(projectPath, {
          schema_version: 1,
          targets: [{
            path: ":(glob)**",
            concerns: ["requirements"],
          }],
        });
      },
    },
  ];

  const unexpectedlyAccepted = [];
  for (const variant of cases) {
    const projectPath = await createProject(t);
    await initialize(projectPath);
    await variant.write(projectPath);
    const before = await readStateBytes(projectPath);

    const result = runCli(projectPath, beginArguments());
    if (result.status === 0) {
      unexpectedlyAccepted.push(variant.name);
      continue;
    }
    assert.match(result.stderr, /\btruth\b/i, variant.name);
    assert.deepEqual(await readStateBytes(projectPath), before, variant.name);
  }
  assert.deepEqual(
    unexpectedlyAccepted,
    [],
    `unsafe Truth targets were accepted: ${unexpectedlyAccepted.join(", ")}`,
  );
});

test("known confirmed concerns select the de-duplicated union of matching targets", async (t) => {
  const projectPath = await createGovernedProject(t);

  beginChange(projectPath, {
    concerns: "requirements,public-capability,requirements",
  });

  const state = await readState(projectPath);
  assert.equal(state.status, "BLOCKED_DOC_SYNC");
  assert.equal(state.active_task, null);
  assert.equal(state.document_sync.status, "PENDING_REVIEW");
  assert.deepEqual(state.document_sync.required_paths, [
    "README.md",
    "docs/PRODUCT.md",
    "docs/PLAN.md",
  ]);
  assert.match(state.document_sync.change_id, /^change-[a-f0-9-]+$/);
  assert.equal(state.document_sync.reviewed_diff_digest, null);
});

test("mixed unknown, empty, and omitted concerns conservatively select every target", async (t) => {
  const variants = [
    {
      name: "mixed unknown",
      options: { concerns: "requirements,not-owner-confirmed" },
    },
    {
      name: "empty",
      options: { concerns: "" },
    },
    {
      name: "omitted",
      options: { omitConcerns: true },
    },
  ];

  for (const variant of variants) {
    const projectPath = await createGovernedProject(t);
    beginChange(projectPath, variant.options);
    assert.deepEqual(
      (await readState(projectPath)).document_sync.required_paths,
      allTargetPaths,
      variant.name,
    );
  }
});

test("Agent candidates are additive Truth targets and cannot shrink the Owner set", async (t) => {
  const projectPath = await createGovernedProject(t);
  beginChange(projectPath, {
    candidates: "AGENTS.md,docs/PLAN.md,README.md",
    concerns: "requirements",
  });
  assert.deepEqual(
    (await readState(projectPath)).document_sync.required_paths,
    [
      "README.md",
      "docs/PRODUCT.md",
      "docs/PLAN.md",
      "AGENTS.md",
    ],
  );

  const invalidProject = await createGovernedProject(t);
  const before = await readStateBytes(invalidProject);
  const rejected = runCli(
    invalidProject,
    beginArguments({
      candidates: "docs/NOT-IN-TRUTH.md",
      concerns: "requirements",
    }),
  );
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /candidate.*truth/i);
  assert.deepEqual(await readStateBytes(invalidProject), before);

  const noPlanProject = await createGovernedProject(t);
  const noPlanBefore = await readStateBytes(noPlanProject);
  const noPlan = runCli(
    noPlanProject,
    beginArguments({ concerns: "public-capability" }),
  );
  assert.notEqual(noPlan.status, 0);
  assert.match(noPlan.stderr, /--candidates.*plan.*truth path/i);
  assert.deepEqual(await readStateBytes(noPlanProject), noPlanBefore);

  const withPlan = runCli(
    noPlanProject,
    beginArguments({
      candidates: "docs/PLAN.md",
      concerns: "public-capability",
    }),
  );
  assert.equal(withPlan.status, 0, withPlan.stderr);
  assert.deepEqual(
    (await readState(noPlanProject)).document_sync.required_paths,
    ["README.md", "docs/PRODUCT.md", "docs/PLAN.md"],
  );
});

test("Owner change supersedes ACTIVE work and pending sync blocks task start", async (t) => {
  const projectPath = await createGovernedProject(t);
  reviewPlan(projectPath, {
    tasks: [
      frozenPlanTask({
        id: "superseded-active-task",
        title: "Superseded active task",
        goal: "Stop when requirements change",
        expected_behavior:
          "This task becomes stale when the Owner changes requirements",
        test_command: "node --test superseded.test.mjs",
        stop_condition:
          "Stop when the Owner changes the governing requirements",
        allowed_files: ["src/**"],
        time_budget_minutes: 30,
      }),
    ],
  });
  const active = runCli(projectPath, ["task", "start"]);
  assert.equal(active.status, 0, active.stderr);

  beginChange(projectPath, { concerns: "requirements" });
  const before = await readStateBytes(projectPath);

  const status = runCli(projectPath, ["status", "--json"]);
  assert.equal(status.status, 0, status.stderr);
  const model = JSON.parse(status.stdout);
  assert.equal(model.status, "BLOCKED_DOC_SYNC");
  assert.equal(model.current_task, null);
  assert.equal(model.blocker, "DOCUMENT_SYNC_PENDING");
  assert.equal(model.next_action, "SYNC_GOVERNING_DOCUMENTS");
  assert.equal(
    runCli(projectPath, ["next"]).stdout,
    "SYNC_GOVERNING_DOCUMENTS\n",
  );

  const started = runCli(projectPath, ["task", "start"]);
  assert.notEqual(started.status, 0);
  assert.match(started.stderr, /document sync|SYNC_GOVERNING_DOCUMENTS/i);
  assert.deepEqual(await readStateBytes(projectPath), before);
});

test("change diff emits the exact staged plus unstaged required diff and its SHA-256", async (t) => {
  const projectPath = await createGovernedProject(t);
  beginChange(projectPath, { concerns: "requirements" });
  await appendFile(
    resolve(projectPath, "docs/PRODUCT.md"),
    "staged requirement replacement\n",
    "utf8",
  );
  runGit(projectPath, ["add", "--", "docs/PRODUCT.md"]);
  await appendFile(
    resolve(projectPath, "docs/PLAN.md"),
    "unstaged replacement plan\n",
    "utf8",
  );
  await appendFile(
    resolve(projectPath, "AGENTS.md"),
    "unrelated change excluded from required diff\n",
    "utf8",
  );

  const expected = expectedExactDiff(projectPath, requirementPaths);
  const displayed = displayDiff(projectPath);
  assert.deepEqual(displayed.requiredPaths, requirementPaths);
  assert.deepEqual(displayed.missingPaths, []);
  assert.deepEqual(displayed.exactDiff, expected);
  assert.equal(
    displayed.digest,
    createHash("sha256").update(expected).digest("hex"),
  );
  assert.equal(
    (await readState(projectPath)).document_sync.reviewed_diff_digest,
    displayed.digest,
  );
  assert.equal(
    displayed.exactDiff.includes(Buffer.from("unrelated change excluded")),
    false,
  );
});

test("accept rejects incomplete non-plan coverage and preserves pending state", async (t) => {
  const projectPath = await createGovernedProject(t);
  beginChange(projectPath, { concerns: "requirements" });
  await appendFile(
    resolve(projectPath, "docs/PLAN.md"),
    "replacement plan exists\n",
    "utf8",
  );
  reviewReplacementPlan(projectPath);
  const displayed = displayDiff(projectPath);
  assert.deepEqual(displayed.missingPaths, ["docs/PRODUCT.md"]);
  const state = await readState(projectPath);
  const before = await readStateBytes(projectPath);

  const accepted = runCli(
    projectPath,
    acceptArguments(state.document_sync.change_id, displayed.digest),
  );
  assert.notEqual(accepted.status, 0);
  assert.match(accepted.stderr, /missing.*docs\/PRODUCT\.md/i);
  assert.deepEqual(await readStateBytes(projectPath), before);
});

test("accept rejects a missing replacement plan even when other required coverage exists", async (t) => {
  const projectPath = await createGovernedProject(t);
  beginChange(projectPath, { concerns: "requirements" });
  await appendFile(
    resolve(projectPath, "docs/PRODUCT.md"),
    "requirements changed without a replacement plan\n",
    "utf8",
  );
  reviewReplacementPlan(projectPath);
  const displayed = displayDiff(projectPath);
  assert.deepEqual(displayed.missingPaths, ["docs/PLAN.md"]);
  const state = await readState(projectPath);
  const before = await readStateBytes(projectPath);

  const accepted = runCli(
    projectPath,
    acceptArguments(state.document_sync.change_id, displayed.digest),
  );
  assert.notEqual(accepted.status, 0);
  assert.match(accepted.stderr, /replacement plan.*docs\/PLAN\.md/i);
  assert.deepEqual(await readStateBytes(projectPath), before);
});

test("a deleted plan diff is coverage but not a replacement current plan", async (t) => {
  const projectPath = await createGovernedProject(t);
  beginChange(projectPath, { concerns: "requirements" });
  await appendFile(
    resolve(projectPath, "docs/PRODUCT.md"),
    "requirements changed while the plan was deleted\n",
    "utf8",
  );
  await rm(resolve(projectPath, "docs/PLAN.md"));
  reviewReplacementPlan(projectPath);
  const displayed = displayDiff(projectPath);
  assert.deepEqual(
    displayed.missingPaths,
    [],
    "Git deletion is diff coverage even though it is not a replacement plan",
  );
  const state = await readState(projectPath);
  const before = await readStateBytes(projectPath);

  const accepted = runCli(
    projectPath,
    acceptArguments(state.document_sync.change_id, displayed.digest),
  );
  assert.notEqual(accepted.status, 0);
  assert.match(accepted.stderr, /replacement plan.*docs\/PLAN\.md/i);
  assert.deepEqual(await readStateBytes(projectPath), before);
});

test("accept rejects a wrong change id or undisplayed digest without state damage", async (t) => {
  const projectPath = await createGovernedProject(t);
  beginChange(projectPath, { concerns: "requirements" });
  await appendRequiredChanges(projectPath);
  const displayed = displayDiff(projectPath);
  const state = await readState(projectPath);
  const before = await readStateBytes(projectPath);

  const wrongChange = runCli(
    projectPath,
    acceptArguments("change-wrong", displayed.digest),
  );
  assert.notEqual(wrongChange.status, 0);
  assert.match(wrongChange.stderr, /change id/i);
  assert.deepEqual(await readStateBytes(projectPath), before);

  const wrongDigest = runCli(
    projectPath,
    acceptArguments(state.document_sync.change_id, "0".repeat(64)),
  );
  assert.notEqual(wrongDigest.status, 0);
  assert.match(wrongDigest.stderr, /displayed digest/i);
  assert.deepEqual(await readStateBytes(projectPath), before);
});

test("accept rejects a diff changed after display or drifted pending state", async (t) => {
  const changedProject = await createGovernedProject(t);
  beginChange(changedProject, { concerns: "requirements" });
  await appendRequiredChanges(changedProject);
  const changedDisplay = displayDiff(changedProject);
  const changedState = await readState(changedProject);
  await appendFile(
    resolve(changedProject, "docs/PRODUCT.md"),
    "changed again after exact display\n",
    "utf8",
  );
  const stateBeforeChangedAccept = await readStateBytes(changedProject);
  const changedAccept = runCli(
    changedProject,
    acceptArguments(
      changedState.document_sync.change_id,
      changedDisplay.digest,
    ),
  );
  assert.notEqual(changedAccept.status, 0);
  assert.match(changedAccept.stderr, /changed since display|diff drift/i);
  assert.deepEqual(
    await readStateBytes(changedProject),
    stateBeforeChangedAccept,
  );

  const driftedProject = await createGovernedProject(t);
  beginChange(driftedProject, { concerns: "requirements" });
  await appendRequiredChanges(driftedProject);
  const driftedDisplay = displayDiff(driftedProject);
  const driftedState = await readState(driftedProject);
  driftedState.document_sync.required_paths.reverse();
  const driftedBytes = Buffer.from(`${JSON.stringify(driftedState, null, 2)}\n`);
  await writeFile(
    resolve(driftedProject, ".ohno", "state.json"),
    driftedBytes,
  );
  const driftedAccept = runCli(
    driftedProject,
    acceptArguments(
      driftedState.document_sync.change_id,
      driftedDisplay.digest,
    ),
  );
  assert.notEqual(driftedAccept.status, 0);
  assert.match(driftedAccept.stderr, /pending state.*drift/i);
  assert.deepEqual(await readStateBytes(driftedProject), driftedBytes);

  const goalDriftProject = await createGovernedProject(t);
  beginChange(goalDriftProject, { concerns: "requirements" });
  await appendRequiredChanges(goalDriftProject);
  const goalDriftDisplay = displayDiff(goalDriftProject);
  const goalDriftState = await readState(goalDriftProject);
  goalDriftState.goal = "A different but valid Owner goal";
  const goalDriftBytes = Buffer.from(
    `${JSON.stringify(goalDriftState, null, 2)}\n`,
  );
  await writeFile(
    resolve(goalDriftProject, ".ohno", "state.json"),
    goalDriftBytes,
  );
  const goalDriftAccept = runCli(
    goalDriftProject,
    acceptArguments(
      goalDriftState.document_sync.change_id,
      goalDriftDisplay.digest,
    ),
  );
  assert.notEqual(goalDriftAccept.status, 0);
  assert.match(goalDriftAccept.stderr, /pending state.*drift/i);
  assert.deepEqual(await readStateBytes(goalDriftProject), goalDriftBytes);

  const idDriftProject = await createGovernedProject(t);
  beginChange(idDriftProject, { concerns: "requirements" });
  await appendRequiredChanges(idDriftProject);
  const idDriftDisplay = displayDiff(idDriftProject);
  const idDriftState = await readState(idDriftProject);
  const replacementNonce = idDriftState.document_sync.change_id.endsWith(
    "00000000-0000-4000-8000-000000000000",
  )
    ? "11111111-1111-4111-8111-111111111111"
    : "00000000-0000-4000-8000-000000000000";
  idDriftState.document_sync.change_id =
    idDriftState.document_sync.change_id.replace(
      /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u,
      replacementNonce,
    );
  const idDriftBytes = Buffer.from(
    `${JSON.stringify(idDriftState, null, 2)}\n`,
  );
  await writeFile(
    resolve(idDriftProject, ".ohno", "state.json"),
    idDriftBytes,
  );
  const idDriftAccept = runCli(
    idDriftProject,
    acceptArguments(
      idDriftState.document_sync.change_id,
      idDriftDisplay.digest,
    ),
  );
  assert.notEqual(idDriftAccept.status, 0);
  assert.match(idDriftAccept.stderr, /pending state.*drift/i);
  assert.deepEqual(await readStateBytes(idDriftProject), idDriftBytes);
});

test("accept rechecks the required diff immediately before CLEAN write", async (t) => {
  const projectPath = await createGovernedProject(t);
  beginChange(projectPath, { concerns: "requirements" });
  await appendRequiredChanges(projectPath);
  const displayed = displayDiff(projectPath);
  const pending = await readState(projectPath);
  const before = await readStateBytes(projectPath);
  const wrapper = await createMutatingGitTextconv(projectPath);
  await rm(wrapper.countPath, { force: true });

  const accepted = runCliWithEnvironment(
    projectPath,
    acceptArguments(pending.document_sync.change_id, displayed.digest),
    wrapper.environment,
  );
  const wrapperCalls = Number(
    (await readFile(wrapper.countPath, "utf8")).trim(),
  );
  assert.ok(wrapperCalls >= 2, "the Git wrapper must reach its mutation point");
  assert.match(
    await readFile(wrapper.mutatePath, "utf8"),
    /changed during accept/,
  );
  assert.notEqual(accepted.status, 0);
  assert.match(accepted.stderr, /changed since display|diff drift/i);
  assert.deepEqual(await readStateBytes(projectPath), before);
});

test("exact local acceptance restores CLEAN IDLE, clears old proof, and resumes task start", async (t) => {
  const projectPath = await createGovernedProject(t);
  await writeFile(resolve(projectPath, "subject.txt"), "verified subject\n", "utf8");
  await writeFile(
    resolve(projectPath, "pass.mjs"),
    "process.exit(0);\n",
    "utf8",
  );
  reviewPlan(projectPath, {
    tasks: [
      frozenPlanTask({
        id: "before-change",
        title: "Plan before requirement change",
        goal: "Prove old plan evidence cannot survive replacement",
        expected_behavior:
          "A prior task must not authorize work after requirement change",
        test_command: `"${process.execPath}" "pass.mjs"`,
        stop_condition: "Stop after the prior exact test passes",
        allowed_files: ["subject.txt"],
        time_budget_minutes: 30,
      }),
    ],
  });
  const started = runCli(projectPath, ["task", "start"]);
  assert.equal(started.status, 0, started.stderr);
  assert.equal(runCli(projectPath, ["verify"]).status, 0);

  beginChange(projectPath, { concerns: "requirements" });
  await appendRequiredChanges(projectPath);
  const displayed = displayDiff(projectPath);
  const pending = await readState(projectPath);
  const accepted = runCli(
    projectPath,
    acceptArguments(pending.document_sync.change_id, displayed.digest),
  );
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.equal(
    accepted.stdout,
    `Accepted ${pending.document_sync.change_id}: LOCAL_REVIEW_RECORDED\n`,
  );

  const clean = await readState(projectPath);
  assert.equal(clean.status, "IDLE");
  assert.equal(clean.active_task, null);
  assert.equal(clean.completed.length, 1);
  assert.deepEqual(clean.document_sync, {
    status: "CLEAN",
    change_id: null,
    required_paths: [],
    reviewed_diff_digest: null,
  });
  const status = runCli(projectPath, ["status", "--json"]);
  assert.equal(status.status, 0, status.stderr);
  assert.deepEqual(
    {
      blocker: JSON.parse(status.stdout).blocker,
      next_action: JSON.parse(status.stdout).next_action,
      proof_freshness: JSON.parse(status.stdout).proof_freshness,
    },
    {
      blocker: "NONE",
      next_action: "START_TASK:replacement-after-change",
      proof_freshness: "NONE",
    },
  );

  const resumed = runCli(projectPath, ["task", "start"]);
  assert.equal(resumed.status, 0, resumed.stderr);
  assert.equal(
    (await readState(projectPath)).active_task.id,
    "replacement-after-change",
  );
});
