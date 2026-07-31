import assert from "node:assert/strict";
import {
  mkdir,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  createProject,
  frozenPlanTask,
  readState,
  readStateBytes,
  reviewPlan,
  runCli,
} from "../helpers/blackbox.mjs";
import { computePackageSubjectSha256 } from "../helpers/package-subject.mjs";
import { readFile } from "node:fs/promises";

function runGit(cwd, args) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  return result;
}

async function writeTruth(projectPath, targets) {
  await writeFile(
    resolve(projectPath, ".ohno", "truth.json"),
    `${JSON.stringify({
      schema_version: 1,
      targets,
    }, null, 2)}\n`,
    "utf8",
  );
}

async function createGovernedProject(t, {
  targets = [
    {
      path: "docs/PLAN.md",
      concerns: ["plan", "requirements"],
    },
    {
      path: "docs/PRODUCT.md",
      concerns: ["requirements"],
    },
  ],
} = {}) {
  const projectPath = await createProject(t);
  await mkdir(resolve(projectPath, ".ohno"), { recursive: true });
  await mkdir(resolve(projectPath, "docs"), { recursive: true });
  for (const target of targets) {
    await writeFile(
      resolve(projectPath, target.path),
      `baseline for ${target.path}\n`,
      "utf8",
    );
  }
  await writeTruth(projectPath, targets);
  runGit(projectPath, [
    "add",
    "--",
    ".ohno/truth.json",
    ...targets.map(({ path }) => path),
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
  const initialized = runCli(projectPath, [
    "init",
    "--goal",
    "Keep Correction 2 bounded",
  ]);
  assert.equal(initialized.status, 0, initialized.stderr);
  return projectPath;
}

test("plan review rejects unbounded root globs without writing active authority", async (t) => {
  const projectPath = await createProject(t);
  const initialized = runCli(projectPath, [
    "init",
    "--goal",
    "Reject root-wide subject globs",
  ]);
  assert.equal(initialized.status, 0, initialized.stderr);
  const before = await readStateBytes(projectPath);

  for (const pattern of ["**", "*.ts", "**/*", "README*"]) {
    await writeFile(
      resolve(projectPath, ".ohno", "bad-plan.json"),
      `${JSON.stringify({
        cursor: 0,
        ordered_tasks: [
          frozenPlanTask({
            id: `reject-${pattern.replaceAll(/[^A-Za-z0-9]+/g, "-")}`,
            allowed_files: [pattern, "src/ok.ts"],
          }),
        ],
      }, null, 2)}\n`,
      "utf8",
    );
    const rejected = runCli(projectPath, [
      "plan",
      "propose",
      "--file",
      ".ohno/bad-plan.json",
    ]);
    assert.notEqual(rejected.status, 0, pattern);
    assert.match(
      rejected.stderr,
      /allowed_files|bounded|root|glob|scope/i,
      `stderr must name the unbounded pattern failure for ${pattern}:\n${rejected.stderr}`,
    );
    assert.deepEqual(await readStateBytes(projectPath), before, pattern);
  }

  const accepted = reviewPlan(projectPath, {
    tasks: [
      frozenPlanTask({
        allowed_files: ["src/**", "test/blackbox/correction-2.test.mjs"],
      }),
    ],
  });
  assert.equal(accepted.proposed.status, 0, accepted.proposed.stderr);
});

test("change begin fails closed when an Owner Truth target is removed from a built-in governing path", async (t) => {
  const projectPath = await createGovernedProject(t);
  const beforeBytes = await readStateBytes(projectPath);
  const before = JSON.parse(beforeBytes.toString("utf8"));
  const planEntry = before.truth_inventory.classification.find(
    (entry) => entry.path === "docs/PLAN.md",
  );
  assert.ok(planEntry, "docs/PLAN.md must be inventoried");
  assert.equal(planEntry.classification, "CANONICAL_GOVERNING");
  assert.equal(planEntry.truth_target, true);

  await writeTruth(projectPath, [
    {
      path: "docs/PRODUCT.md",
      concerns: ["requirements", "plan"],
    },
  ]);

  const rejected = runCli(projectPath, [
    "change",
    "begin",
    "--summary",
    "Owner removed docs/PLAN.md from Truth without rename",
    "--concerns",
    "requirements",
  ]);
  assert.notEqual(rejected.status, 0, rejected.stderr);
  assert.match(
    rejected.stderr,
    /GOVERNING_TARGET_MISSING_OR_RENAMED|docs\/PLAN\.md/i,
    rejected.stderr,
  );
  assert.deepEqual(await readStateBytes(projectPath), beforeBytes);
});

test("change begin persists bounded summary and binds pending identity to plan cursor authority", async (t) => {
  const projectPath = await createGovernedProject(t);
  reviewPlan(projectPath, {
    tasks: [
      frozenPlanTask({
        id: "task-before-change",
        allowed_files: ["src/**"],
      }),
    ],
  });
  const before = await readState(projectPath);
  assert.ok(before.plan_revision);
  assert.equal(before.cursor, 0);

  const summary = "Owner rewrote the acceptance denominator for Correction 2";
  const began = runCli(projectPath, [
    "change",
    "begin",
    "--summary",
    summary,
    "--concerns",
    "requirements",
  ]);
  assert.equal(began.status, 0, began.stderr);

  const pending = await readState(projectPath);
  assert.equal(pending.status, "BLOCKED_DOC_SYNC");
  assert.equal(pending.document_sync.status, "PENDING_REVIEW");
  assert.equal(pending.document_sync.summary, summary);
  assert.equal(pending.document_sync.base_plan_revision, before.plan_revision);
  assert.equal(pending.document_sync.base_cursor, before.cursor);
  assert.match(pending.document_sync.change_id, /^change-[a-f0-9]{16}-/);

  // A reviewed replacement plan may change live plan fields during pending
  // sync; only base authority bound into the change id must stay stable.
  const replaced = reviewPlan(projectPath, {
    tasks: [
      frozenPlanTask({
        id: "replacement-during-pending",
        allowed_files: ["src/**"],
      }),
    ],
  });
  assert.equal(replaced.proposed.status, 0, replaced.proposed.stderr);
  const afterReplacement = await readState(projectPath);
  assert.notEqual(afterReplacement.plan_revision, before.plan_revision);
  assert.equal(
    afterReplacement.document_sync.base_plan_revision,
    before.plan_revision,
  );
  const stillBound = runCli(projectPath, ["change", "diff"]);
  assert.equal(stillBound.status, 0, stillBound.stderr);

  // Mutating the frozen begin binding invalidates the change id.
  afterReplacement.document_sync.summary = "tampered summary";
  await writeFile(
    resolve(projectPath, ".ohno", "state.json"),
    `${JSON.stringify(afterReplacement, null, 2)}\n`,
    "utf8",
  );
  const drifted = runCli(projectPath, ["change", "diff"]);
  assert.notEqual(drifted.status, 0, drifted.stderr);
  assert.match(
    drifted.stderr,
    /pending state drift|change id|authority/i,
    drifted.stderr,
  );
});

test("performance evidence must bind a recomputable package subject digest", async () => {
  const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
  const evidence = JSON.parse(
    await readFile(
      resolve(root, "test", "evidence", "task7-real-project-trials.json"),
      "utf8",
    ),
  );
  assert.match(
    evidence.implementation.package_subject_sha256 ?? "",
    /^[a-f0-9]{64}$/u,
    "trial evidence must record package_subject_sha256",
  );
  assert.equal(
    evidence.implementation.package_subject_sha256,
    await computePackageSubjectSha256(root),
    "package subject digest must recompute from the current package files",
  );
});
