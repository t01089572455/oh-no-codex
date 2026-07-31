/**
 * Measure P06: saved state becomes visible in Cockpit < 250 ms p95.
 * Uses system Chrome/Edge via puppeteer-core. Owner authorized external
 * browser after the in-app Browser rejected loopback navigation.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

import {
  cliPath,
  frozenPlanTask,
  reviewPlan,
  runCli,
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

async function createMeasuredProject() {
  const projectPath = await mkdtemp(resolve(tmpdir(), "ohno-p06-"));
  runGit(projectPath, ["init", "--quiet"]);
  await mkdir(resolve(projectPath, "src"), { recursive: true });
  await writeFile(resolve(projectPath, "subject.txt"), "subject\n", "utf8");
  await writeFile(resolve(projectPath, "pass.mjs"), "process.exit(0);\n", "utf8");
  const initialized = runCli(projectPath, [
    "init",
    "--goal",
    "Measure cockpit state visibility",
  ]);
  assert.equal(initialized.status, 0, initialized.stderr);
  reviewPlan(projectPath, {
    tasks: [
      frozenPlanTask({
        id: "p06-task",
        allowed_files: ["subject.txt"],
        test_command: `"${process.execPath}" "pass.mjs"`,
      }),
    ],
  });
  return projectPath;
}

async function measureOne(page, projectPath) {
  // Reset to idle projection, then start a task and wait for ACTIVE in DOM.
  // Visibility clock starts after the state write returns.
  const idleProbe = await page.evaluate(() => {
    const status = document.querySelector("#status-value, [data-field='status'], .status");
    return document.body.innerText;
  });
  assert.match(idleProbe, /IDLE|NO ACTIVE TASK|PROPOSE|START/i);

  const startedAt = process.hrtime.bigint();
  const started = runCli(projectPath, ["task", "start"]);
  assert.equal(started.status, 0, started.stderr);

  await page.waitForFunction(
    () => document.body.innerText.includes("ACTIVE")
      && document.body.innerText.includes("p06-task"),
    { timeout: 5_000, polling: 10 },
  );
  const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

  // Close the task so the next sample can start again from a clean cursor.
  const verified = runCli(projectPath, ["verify"]);
  assert.equal(verified.status, 0, verified.stderr);
  // Advance plan for next sample by proposing a fresh single-task plan.
  reviewPlan(projectPath, {
    tasks: [
      frozenPlanTask({
        id: `p06-task-${Date.now()}`,
        allowed_files: ["subject.txt"],
        test_command: `"${process.execPath}" "pass.mjs"`,
      }),
    ],
  });
  await page.waitForFunction(
    () => !document.body.innerText.includes("ACTIVE")
      || document.body.innerText.includes("PROJECT COMPLETE")
      || document.body.innerText.includes("START_TASK")
      || document.body.innerText.includes("IDLE"),
    { timeout: 5_000, polling: 20 },
  );
  return elapsedMs;
}

async function measureTrial(label) {
  const projectPath = await createMeasuredProject();
  const child = spawn(process.execPath, [cliPath, "cockpit"], {
    cwd: projectPath,
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
        return spawnSync(candidate, ["--version"], { encoding: "utf8" }).status === 0
          || spawnSync(candidate, ["--version"], { encoding: "utf8" }).error === undefined;
      } catch {
        return false;
      }
    });
    assert.ok(executablePath, "Chrome or Edge must be available for P06");

    const browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ["--no-sandbox", "--disable-gpu"],
    });
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1440, height: 900 });
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 15_000,
      });
      await page.waitForFunction(
        () => document.body.innerText.includes("OH NO, CODEX"),
        { timeout: 10_000 },
      );
      await page.waitForFunction(
        () => {
          const status = document.querySelector("#status-value");
          return status !== null && status.textContent !== "UNAVAILABLE"
            && status.textContent !== "";
        },
        { timeout: 10_000 },
      );

      // Warm-up
      await measureOne(page, projectPath);

      const raw = [];
      for (let index = 0; index < sampleCount; index += 1) {
        raw.push(await measureOne(page, projectPath));
      }
      const p95 = percentile95(raw);
      return {
        id: label,
        budget_ms_exclusive: 250,
        p95_ms: Number(p95.toFixed(3)),
        raw_ms: raw.map((sample) => Number(sample.toFixed(3))),
        result: p95 < 250 ? "TRIAL_PASS" : "TRIAL_FAIL",
        browser_executable: executablePath,
      };
    } finally {
      await browser.close();
    }
  } finally {
    child.kill("SIGTERM");
    await exitPromise.catch(() => {});
    await rm(projectPath, { force: true, recursive: true });
    if (stderr.trim() !== "") {
      // Keep stderr available for diagnostics without failing a green run.
      process.stderr.write(`${label} cockpit stderr:\n${stderr}\n`);
    }
  }
}

async function main() {
  const trials = [];
  for (const label of ["Trial A", "Trial B", "Trial C"]) {
    process.stdout.write(`P06 measuring ${label}\n`);
    trials.push(await measureTrial(label));
  }
  const allPass = trials.every((trial) => trial.result === "TRIAL_PASS");
  const evidence = {
    browser: "System Chrome/Edge via puppeteer-core",
    result: allPass ? "TRIAL_PASS" : "TRIAL_FAIL",
    trials: trials.map(({
      id,
      budget_ms_exclusive,
      p95_ms,
      raw_ms,
      result,
    }) => ({
      id,
      budget_ms_exclusive,
      p95_ms,
      raw_ms,
      result,
    })),
  };
  const outputPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "evidence",
    "p06-browser-receipt.json",
  );
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  process.stdout.write(`P06_RECEIPT_WRITTEN ${outputPath}\n`);
  process.stdout.write(JSON.stringify(evidence, null, 2) + "\n");
  process.exitCode = allPass ? 0 : 1;
}

await main();
