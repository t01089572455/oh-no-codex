import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { computePackageSubjectSha256 } from "../helpers/package-subject.mjs";

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const evidencePath = resolve(
  repositoryRoot,
  "test",
  "evidence",
  "task7-real-project-trials.json",
);
const cliPath = resolve(repositoryRoot, "dist", "cli.js");
const sampleCount = 30;
const budgets = Object.freeze({
  status: 250,
  next: 250,
  resume: 500,
  task_start: 2_000,
});

function percentile95(samples) {
  const sorted = samples.toSorted((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * 0.95) - 1];
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function readEvidence() {
  return JSON.parse(await readFile(evidencePath, "utf8"));
}

test("three anonymous real-project receipts prove P01-P05 and the maximum P04 fixture", async () => {
  const evidence = await readEvidence();
  assert.equal(evidence.schema_version, 1);
  assert.equal(evidence.classification, "TRIAL_EVIDENCE");
  assert.match(evidence.generated_at, /^\d{4}-\d{2}-\d{2}T/u);
  assert.equal(
    evidence.implementation.dist_cli_sha256,
    sha256(await readFile(cliPath)),
    "trial evidence must remain bound to the built CLI bytes",
  );
  assert.match(
    evidence.implementation.package_subject_sha256 ?? "",
    /^[a-f0-9]{64}$/u,
    "trial evidence must bind a package subject digest",
  );
  assert.equal(
    evidence.implementation.package_subject_sha256,
    await computePackageSubjectSha256(repositoryRoot),
    "package subject digest must recompute from current package runtime files",
  );
  const ancestor = spawnSync(
    "git",
    ["merge-base", "--is-ancestor", evidence.implementation.head, "HEAD"],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
    },
  );
  assert.equal(
    ancestor.status,
    0,
    `trial implementation ${evidence.implementation.head} is not an ancestor of HEAD`,
  );
  assert.equal(evidence.sample_method.samples_per_command_per_copy, sampleCount);
  assert.equal(evidence.sample_method.untimed_warmups_per_command_per_copy, 1);
  assert.equal(evidence.trials.length, 3);
  assert.equal(
    new Set(evidence.trials.map((trial) => trial.stack)).size,
    3,
    "the trial copies must represent three different stacks",
  );
  assert.equal(
    new Set(
      evidence.trials.map((trial) => trial.copy_identity.identity_sha256),
    ).size,
    3,
    "each copied project needs a distinct anonymous identity",
  );

  for (const trial of evidence.trials) {
    assert.match(trial.id, /^Trial [A-C]$/u);
    assert.match(trial.copy_identity.identity_sha256, /^[a-f0-9]{64}$/u);
    assert.ok(trial.copy_identity.file_count > 0);
    assert.ok(trial.copy_identity.total_bytes > 0);
    for (const [flow, passed] of Object.entries(trial.flows)) {
      assert.equal(passed, true, `${trial.id} did not exercise ${flow}`);
    }
    for (const [command, budget] of Object.entries(budgets)) {
      const measurement = trial.measurements[command];
      assert.equal(
        measurement.raw_ms.length,
        sampleCount,
        `${trial.id} ${command} raw sample count`,
      );
      assert.ok(
        measurement.raw_ms.every(
          (sample) => Number.isFinite(sample) && sample >= 0,
        ),
        `${trial.id} ${command} has an invalid raw sample`,
      );
      const recomputed = percentile95(measurement.raw_ms);
      assert.equal(
        measurement.p95_ms,
        Number(recomputed.toFixed(3)),
        `${trial.id} ${command} p95 must be reproducible from raw samples`,
      );
      assert.equal(measurement.budget_ms_exclusive, budget);
      assert.ok(
        recomputed < budget,
        `${trial.id} ${command} p95 ${recomputed} exceeded ${budget}`,
      );
      assert.equal(measurement.result, "TRIAL_PASS");
    }
  }

  assert.deepEqual(evidence.p04.fixture, {
    completed_history_entries: 120,
    expected_behavior_bytes: 512,
    goal_bytes: 256,
    stable_task_id_bytes: 96,
    test_command_bytes: 1_024,
  });
  assert.equal(evidence.p04.budget_bytes_exclusive, 4_096);
  assert.ok(evidence.p04.serialized_resume_bytes < 4_096);
  assert.equal(evidence.p04.result, "TRIAL_PASS");
});

test("P06 requires three real browser sample sets and cannot pass from HTTP checks", async () => {
  const evidence = await readEvidence();
  assert.equal(
    evidence.p06.result,
    "TRIAL_PASS",
    `P06_NOT_MEASURED: ${evidence.p06.reason ?? "missing browser receipt"}`,
  );
  assert.match(
    evidence.p06.browser ?? "",
    /Browser|Chrome|Chromium|Edge/iu,
    "P06 must name a real browser surface, not an HTTP-only substitute",
  );
  assert.doesNotMatch(
    evidence.p06.browser ?? "",
    /HTTP-only/iu,
  );
  assert.equal(evidence.p06.trials.length, 3);
  for (const trial of evidence.p06.trials) {
    assert.match(trial.id, /^Trial [A-C]$/u);
    assert.equal(trial.raw_ms.length, sampleCount);
    const recomputed = percentile95(trial.raw_ms);
    assert.equal(trial.p95_ms, Number(recomputed.toFixed(3)));
    assert.ok(recomputed < 250, `${trial.id} P06 p95 ${recomputed}`);
    assert.equal(trial.result, "TRIAL_PASS");
  }
});
