/**
 * Measure P06: atomic save → Cockpit DOM reflects the new read model
 * (status, proof, blocker, next + task id) within 250 ms p95.
 *
 * Clock: harness Date.now() at first observation of sole authority
 * `.ohno/state.json` ACTIVE for the started task (post atomic rename).
 * End: exact DOM match. No second product marker file.
 *
 *   node test/browser/measure-p06.mjs \
 *     --batch-id <id> [--output path] \
 *     --project <copyA> --stack "WeChat miniprogram" \
 *     --project <copyB> --stack "React Vite Web" \
 *     --project <copyC> --stack "Python toolkit"
 */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { watch } from "node:fs";
import { once } from "node:events";
import {
  access,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { setTimeout as delay } from "node:timers/promises";

import {
  cliPath,
  frozenPlanTask,
  reviewPlan,
  runCli,
  runInit,
} from "../helpers/blackbox.mjs";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");

const sampleCount = 30;
const chromeCandidates = [
  process.env.OHNO_BROWSER_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);

function percentile95(samples) {
  const sorted = samples.toSorted((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * 0.95) - 1];
}

function runGit(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result;
}

function parseArguments(argv) {
  const projects = [];
  let pending;
  let batchId = process.env.OHNO_MEASUREMENT_BATCH_ID ?? "";
  let outputPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "evidence",
    "p06-browser-receipt.json",
  );
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = argv[i + 1];
    if (arg === "--batch-id") {
      assert.ok(value, "--batch-id requires a value");
      batchId = value;
      i += 1;
      continue;
    }
    if (arg === "--output") {
      assert.ok(value, "--output requires a path");
      outputPath = resolve(value);
      i += 1;
      continue;
    }
    if (arg === "--project") {
      assert.ok(value, "--project requires a path");
      pending = value;
      i += 1;
      continue;
    }
    if (arg === "--stack") {
      assert.ok(value, "--stack requires a label");
      assert.ok(pending, "--stack must follow --project");
      projects.push({ path: resolve(pending), stack: value });
      pending = undefined;
      i += 1;
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }
  assert.equal(pending, undefined, "each --project needs --stack");
  assert.equal(projects.length, 3, "exactly three real project copies required");
  assert.match(batchId, /^[A-Za-z0-9._:-]{8,128}$/u, "batch id required");
  const stacks = new Set(projects.map((p) => p.stack));
  assert.equal(
    stacks.size,
    3,
    "three different technology-stack labels are required",
  );
  return { batchId, outputPath, projects };
}

async function collectIdentity(rootPath) {
  const records = [];
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name, "en"));
    for (const entry of entries) {
      const absolutePath = resolve(directory, entry.name);
      const relativePath = relative(rootPath, absolutePath).replaceAll("\\", "/");
      const first = relativePath.split("/")[0];
      if (
        first.startsWith(".git")
        || [".ohno", ".codex", "ohno-trial", "node_modules", ".venv", "__pycache__"]
          .includes(first)
        // P06 harness + Oh No projections — must match P01–P05 pre-init identity.
        || relativePath === "p06-subject.txt"
        || relativePath === "p06-pass.mjs"
        || relativePath === "AGENTS.md"
        || relativePath === "PROGRESS.md"
        || relativePath === "REQUIREMENTS.md"
        || relativePath === "COCKPIT-URL.txt"
        || relativePath === "cockpit.runtime.json"
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
    identity_sha256: createHash("sha256").update(canonical).digest("hex"),
    total_bytes: records.reduce((total, [, size]) => total + size, 0),
  };
}

async function waitForCockpitUrl(child) {
  let stdout = "";
  return await new Promise((resolvePromise, rejectPromise) => {
    const timeout = setTimeout(() => {
      rejectPromise(new Error(`no cockpit URL\n${stdout}`));
    }, 8_000);
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      const match = /^Cockpit: (http:\/\/127\.0\.0\.1:\d+\/)\r?$/m.exec(stdout);
      if (match?.[1]) {
        clearTimeout(timeout);
        resolvePromise(match[1]);
      }
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timeout);
      rejectPromise(new Error(`cockpit exited ${code}/${signal}\n${stdout}`));
    });
  });
}

async function ensureProjectReady(projectPath) {
  try {
    await access(resolve(projectPath, ".ohno", "state.json"));
  } catch {
    try {
      await access(resolve(projectPath, ".git"));
    } catch {
      runGit(projectPath, ["init", "--quiet"]);
    }
    const init = runInit(projectPath, "P06 real-copy visibility trial");
    assert.equal(init.status, 0, init.stderr);
  }
  await writeFile(resolve(projectPath, "p06-subject.txt"), "p06 subject\n", "utf8");
  await writeFile(resolve(projectPath, "p06-pass.mjs"), "process.exit(0);\n", "utf8");
}

function reviewVisibilityPlan(projectPath, taskId) {
  return reviewPlan(projectPath, {
    tasks: [
      frozenPlanTask({
        id: taskId,
        title: "P06 visibility",
        goal: "Show ACTIVE in cockpit after save",
        expected_behavior: "Cockpit reflects ACTIVE after atomic task start",
        test_command: `"${process.execPath}" "p06-pass.mjs"`,
        stop_condition: "Stop after visibility sample",
        allowed_files: ["p06-subject.txt", "p06-pass.mjs"],
        time_budget_minutes: 15,
      }),
    ],
    fileName: ".ohno/p06-plan.json",
  });
}

/**
 * Wait until sole authority `.ohno/state.json` is ACTIVE for taskId.
 * Start clock is harness Date.now() at first durable observation (post rename).
 */
function waitForSaveObservation(projectPath, taskId) {
  const stateDir = resolve(projectPath, ".ohno");
  const statePath = resolve(stateDir, "state.json");
  return new Promise((resolvePromise, rejectPromise) => {
    let settled = false;
    let watcher = { close() {} };
    let interval;
    let timer;

    const finish = (value) => {
      if (settled) {
        return;
      }
      settled = true;
      clearInterval(interval);
      clearTimeout(timer);
      try {
        watcher.close();
      } catch {
        // ignore
      }
      resolvePromise(value);
    };
    const fail = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearInterval(interval);
      clearTimeout(timer);
      try {
        watcher.close();
      } catch {
        // ignore
      }
      rejectPromise(error);
    };

    const tryFinishFromSave = () => {
      try {
        const raw = readFileSyncSafe(statePath);
        if (raw === null) {
          return;
        }
        const state = JSON.parse(raw);
        if (state.status !== "ACTIVE" || state.active_task?.id !== taskId) {
          return;
        }
        const startWallMs = Date.now();
        const expected = {
          status: "ACTIVE",
          proof: "NONE",
          // Cockpit localizes bare NONE for blocker/next presentation.
          blockerEn: "NONE",
          blockerZh: "无",
          nextEn:
            `CONTINUE_ACTIVE:${taskId} (automatic work → repair → ohno verify)`,
          nextZh:
            `CONTINUE_ACTIVE:${taskId}（自动工作 → 修复 → ohno verify）`,
          taskId,
        };
        finish({ startWallMs, expected, state });
      } catch {
        // retry
      }
    };

    try {
      watcher = watch(stateDir, { persistent: false }, () => {
        tryFinishFromSave();
      });
    } catch {
      watcher = { close() {} };
    }
    interval = setInterval(tryFinishFromSave, 1);
    timer = setTimeout(() => {
      fail(new Error(`state.json never showed ACTIVE ${taskId}`));
    }, 20_000);
  });
}

function readFileSyncSafe(path) {
  try {
    return require("node:fs").readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

async function measureOne(page, projectPath, sampleIndex) {
  const taskId = `p06vis${sampleIndex}${Date.now().toString(36)}`.replace(
    /[^A-Za-z0-9._-]/g,
    "",
  ).slice(0, 48);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      reviewVisibilityPlan(projectPath, taskId);
      break;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/EPERM/u.test(message) || attempt === 5) {
        throw error;
      }
      await delay(40 * (attempt + 1));
    }
  }

  await page.waitForFunction(
    () => {
      const status = document.querySelector("#status-value")?.textContent ?? "";
      return status !== "ACTIVE" && status !== "UNAVAILABLE" && status !== "";
    },
    { timeout: 10_000, polling: 20 },
  );

  // Snapshot pre-start field texts so we can demand a change where needed.
  const before = await page.evaluate(() => ({
    status: document.querySelector("#status-value")?.textContent ?? "",
    proof: document.querySelector("#proof-value")?.textContent ?? "",
    blocker: document.querySelector("#blocker-value")?.textContent ?? "",
    next: document.querySelector("#next-value")?.textContent ?? "",
  }));

  let saveObservation = null;
  let lastErr = "";
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const observationPromise = waitForSaveObservation(projectPath, taskId);
    const child = spawn(process.execPath, [cliPath, "task", "start"], {
      cwd: projectPath,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (c) => {
      stderr += c;
    });
    const exitPromise = once(child, "exit");
    try {
      saveObservation = await observationPromise;
      const [code] = await exitPromise;
      if (code !== 0) {
        lastErr = stderr || `exit ${code}`;
        await delay(40 * (attempt + 1));
        continue;
      }
      break;
    } catch (error) {
      child.kill("SIGTERM");
      await exitPromise.catch(() => undefined);
      lastErr = error instanceof Error ? error.message : String(error);
      await delay(40 * (attempt + 1));
    }
  }
  assert.ok(saveObservation, `task start never saved ACTIVE: ${lastErr}`);
  const { startWallMs, expected } = saveObservation;

  await page.waitForFunction(
    (exp, beforeFields) => {
      const status = (document.querySelector("#status-value")?.textContent ?? "")
        .trim();
      const proof = (document.querySelector("#proof-value")?.textContent ?? "")
        .trim();
      const blocker = (document.querySelector("#blocker-value")?.textContent ?? "")
        .trim();
      const next = (document.querySelector("#next-value")?.textContent ?? "")
        .trim();
      const nowHeading = (
        document.querySelector("#now-heading")?.textContent ?? ""
      ).trim();
      // Exact field match against the new read model — not "non-empty" / body scan.
      if (status !== exp.status) {
        return false;
      }
      if (proof !== exp.proof) {
        return false;
      }
      if (blocker !== exp.blockerEn && blocker !== exp.blockerZh) {
        return false;
      }
      if (next !== exp.nextEn && next !== exp.nextZh) {
        return false;
      }
      // Current-task presentation must show the new id (not stale board text).
      if (nowHeading !== exp.taskId) {
        return false;
      }
      // Require visible change from pre-start snapshot for status and next.
      if (status === beforeFields.status && next === beforeFields.next) {
        return false;
      }
      return true;
    },
    { timeout: 15_000, polling: 10 },
    expected,
    before,
  );
  const elapsedMs = Date.now() - startWallMs;

  let verified;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    verified = runCli(projectPath, ["verify"]);
    if (verified.status === 0) {
      break;
    }
    if (!/EPERM/u.test(verified.stderr ?? "")) {
      break;
    }
    await delay(30 * (attempt + 1));
  }
  assert.equal(verified.status, 0, verified.stderr);
  await page.waitForFunction(
    () => {
      const status = document.querySelector("#status-value")?.textContent ?? "";
      return status !== "ACTIVE";
    },
    { timeout: 10_000, polling: 20 },
  );
  return elapsedMs;
}

async function measureTrial(project, label) {
  await ensureProjectReady(project.path);
  const identity = await collectIdentity(project.path);
  // Fixed Chromium-safe port (harness-only; product uses ephemeral bind).
  const child = spawn(process.execPath, [cliPath, "cockpit", "--port", "18765"], {
    cwd: project.path,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const exitPromise = once(child, "exit");
  try {
    const url = await waitForCockpitUrl(child);
    const executablePath = chromeCandidates.find((candidate) => {
      try {
        return spawnSync(candidate, ["--version"], { encoding: "utf8" }).status
          === 0;
      } catch {
        return false;
      }
    });
    assert.ok(executablePath, "Chrome or Edge must be available for P06");

    const browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-gpu",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
      ],
    });
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1440, height: 900 });
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15_000 });
      await page.bringToFront();
      await page.waitForFunction(
        () => document.querySelector("#status-value")?.textContent
          && document.querySelector("#status-value").textContent !== "UNAVAILABLE",
        { timeout: 10_000 },
      );

      await measureOne(page, project.path, "warm");

      const raw = [];
      for (let index = 0; index < sampleCount; index += 1) {
        raw.push(await measureOne(page, project.path, index));
      }
      const p95 = percentile95(raw);
      return {
        id: label,
        stack: project.stack,
        copy_identity: identity,
        budget_ms_exclusive: 250,
        p95_ms: Number(p95.toFixed(3)),
        raw_ms: raw.map((sample) => Number(sample.toFixed(3))),
        result: p95 < 250 ? "TRIAL_PASS" : "TRIAL_FAIL",
      };
    } finally {
      await browser.close();
    }
  } finally {
    child.kill("SIGTERM");
    await exitPromise.catch(() => {});
    if (stderr.trim() !== "") {
      process.stderr.write(`${label} cockpit stderr:\n${stderr}\n`);
    }
  }
}

async function main() {
  const { batchId, outputPath, projects } = parseArguments(process.argv.slice(2));
  const repositoryRoot = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
  );
  const {
    computePackageSubjectSha256,
    computeRuntimeSubjectSha256,
  } = await import("../helpers/package-subject.mjs");
  const implementation = {
    dist_cli_sha256: createHash("sha256")
      .update(await readFile(cliPath))
      .digest("hex"),
    package_subject_sha256: await computePackageSubjectSha256(repositoryRoot),
    runtime_subject_sha256: await computeRuntimeSubjectSha256(repositoryRoot),
    head: runGit(repositoryRoot, ["rev-parse", "HEAD"]).stdout.trim(),
    tree: runGit(repositoryRoot, ["rev-parse", "HEAD^{tree}"]).stdout.trim(),
  };

  const trials = [];
  for (let index = 0; index < projects.length; index += 1) {
    const label = `Trial ${String.fromCharCode(65 + index)}`;
    process.stdout.write(`P06 measuring ${label} (${projects[index].stack})\n`);
    trials.push(await measureTrial(projects[index], label));
  }
  const allPass = trials.every((trial) => trial.result === "TRIAL_PASS");
  const evidence = {
    schema_version: 1,
    classification: "P06_BROWSER_RECEIPT",
    generated_at: new Date().toISOString(),
    measurement_batch_id: batchId,
    measurement_binding: "LIVE",
    browser: "System Chrome/Edge via puppeteer-core",
    sample_method: {
      clock: "Date.now epoch ms (cross-process)",
      start:
        "harness first observation of sole authority .ohno/state.json ACTIVE "
        + "for the started task id (post atomic rename; no second marker file)",
      end:
        "DOM exact match for status/proof/blocker/next and #now-heading===taskId",
      p95: "nearest-rank ceil(0.95*n)-1",
      samples_per_copy: sampleCount,
      untimed_warmups_per_copy: 1,
    },
    implementation,
    result: allPass ? "TRIAL_PASS" : "TRIAL_FAIL",
    trials,
  };
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  process.stdout.write(`P06_RECEIPT_WRITTEN ${outputPath}\n`);
  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
  process.exitCode = allPass ? 0 : 1;
}

await main();
