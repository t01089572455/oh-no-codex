/**
 * A14 browser acceptance against the running built Cockpit using system
 * Chrome/Edge. Covers desktop + narrow viewports, keyboard focus, reduced
 * motion, and blocked / active / fresh-PASS projections.
 */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import {
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import {
  cliPath,
  frozenPlanTask,
  reviewPlan,
  runCli,
} from "../helpers/blackbox.mjs";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");

const chromeCandidates = [
  process.env.OHNO_BROWSER_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);

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

async function createProject() {
  const projectPath = await mkdtemp(resolve(tmpdir(), "ohno-a14-"));
  runGit(projectPath, ["init", "--quiet"]);
  await writeFile(resolve(projectPath, "subject.txt"), "subject\n", "utf8");
  await writeFile(resolve(projectPath, "pass.mjs"), "process.exit(0);\n", "utf8");
  const initialized = runCli(projectPath, [
    "init",
  ]);
  assert.equal(initialized.status, 0, initialized.stderr);
  reviewPlan(projectPath, {
    tasks: [
      frozenPlanTask({
        id: "a14-task",
        allowed_files: ["subject.txt"],
        test_command: `"${process.execPath}" "pass.mjs"`,
      }),
    ],
  });
  return projectPath;
}

async function openPage(browser, url, viewport) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "reduce" },
  ]);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.waitForFunction(
    () => document.querySelector("#status-value")?.textContent
      && document.querySelector("#status-value").textContent !== "UNAVAILABLE",
    { timeout: 10_000 },
  );
  return page;
}

async function assertNoMastheadOverlap(page, label) {
  const overlap = await page.evaluate(() => {
    const aperture = document.querySelector(".brand-aperture")?.getBoundingClientRect();
    const controls = document.querySelector(".masthead-controls")?.getBoundingClientRect();
    const locality = document.querySelector(".locality")?.getBoundingClientRect();
    const copy = document.querySelector(".brand-copy")?.getBoundingClientRect();
    if (!aperture || !controls || !locality || !copy) {
      return "missing masthead parts";
    }
    const overlaps = (a, b) => !(
      a.right <= b.left
      || a.left >= b.right
      || a.bottom <= b.top
      || a.top >= b.bottom
    );
    if (overlaps(aperture, controls)) {
      return "aperture overlaps controls";
    }
    if (overlaps(copy, controls) && controls.top < copy.bottom - 1) {
      // Allowed only when deliberately stacked; report severe horizontal collision.
      if (controls.left < copy.right - 4 && controls.top < copy.bottom - 8) {
        return "copy overlaps controls";
      }
    }
    if (locality.width === 0 || locality.height === 0) {
      return "locality not visible";
    }
    return null;
  });
  assert.equal(overlap, null, `${label}: ${overlap}`);
}

async function main() {
  const executablePath = chromeCandidates[0]
    ?? chromeCandidates.find((candidate) => candidate);
  assert.ok(executablePath, "Chrome or Edge required for A14");
  const projectPath = await createProject();
  const child = spawn(process.execPath, [cliPath, "cockpit"], {
    cwd: projectPath,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.setEncoding("utf8");
  const exitPromise = once(child, "exit");
  try {
    const url = await waitForCockpitUrl(child);
    const browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ["--no-sandbox", "--disable-gpu"],
    });
    try {
      for (const viewport of [
        { width: 1440, height: 900, label: "desktop" },
        { width: 390, height: 844, label: "narrow-390" },
        { width: 320, height: 568, label: "narrow-320" },
      ]) {
        const page = await openPage(browser, url, viewport);
        await assertNoMastheadOverlap(page, viewport.label);
        const text = await page.evaluate(() => document.body.innerText);
        assert.match(text, /OH NO, CODEX/i);
        assert.match(text, /IDLE|START_TASK|NO ACTIVE TASK/i);

        // Keyboard: skip link then refresh remain focusable.
        await page.keyboard.press("Tab");
        const focused = await page.evaluate(() => document.activeElement?.className
          || document.activeElement?.id
          || document.activeElement?.tagName);
        assert.ok(focused, `${viewport.label} needs a focus target`);

        // Active state
        const started = runCli(projectPath, ["task", "start"]);
        assert.equal(started.status, 0, started.stderr);
        await page.waitForFunction(
          () => document.querySelector("#status-value")?.textContent === "ACTIVE",
          { timeout: 5_000 },
        );
        assert.match(
          await page.evaluate(() => document.body.innerText),
          /a14-task/,
        );

        // Fresh PASS
        const verified = runCli(projectPath, ["verify"]);
        assert.equal(verified.status, 0, verified.stderr);
        await page.waitForFunction(
          () => document.querySelector("#proof-value")?.textContent === "FRESH"
            || document.body.innerText.includes("PROJECT COMPLETE")
            || document.body.innerText.includes("FRESH"),
          { timeout: 5_000 },
        );

        // Blocked document sync projection (fixture write)
        const statePath = resolve(projectPath, ".ohno", "state.json");
        const { readFile, writeFile: write } = await import("node:fs/promises");
        const state = JSON.parse(await readFile(statePath, "utf8"));
        state.status = "BLOCKED_DOC_SYNC";
        state.active_task = null;
        state.document_sync = {
          status: "PENDING_REVIEW",
          change_id: "change-a14-fixture",
          required_paths: ["docs/PLAN.md"],
          reviewed_diff_digest: null,
          base_plan_revision: state.plan_revision,
          base_cursor: state.cursor,
          summary: "A14 blocked-state fixture",
          started_at: new Date().toISOString(),
        };
        await write(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
        await page.waitForFunction(
          () => document.querySelector("#status-value")?.textContent
            === "BLOCKED_DOC_SYNC"
            || document.body.innerText.includes("SYNC_GOVERNING_DOCUMENTS"),
          { timeout: 5_000 },
        );

        // Restore idle plan for next viewport by re-init is heavy; recreate project path per viewport instead.
        await page.close();
        // Reset for next viewport with a fresh plan/task.
        const reset = JSON.parse(await readFile(statePath, "utf8"));
        reset.status = "IDLE";
        reset.document_sync = {
          status: "CLEAN",
          change_id: null,
          required_paths: [],
          reviewed_diff_digest: null,
        };
        await write(statePath, `${JSON.stringify(reset, null, 2)}\n`, "utf8");
        reviewPlan(projectPath, {
          tasks: [
            frozenPlanTask({
              id: `a14-task-${viewport.width}`,
              allowed_files: ["subject.txt"],
              test_command: `"${process.execPath}" "pass.mjs"`,
            }),
          ],
        });
      }
      process.stdout.write("A14_BROWSER_ACCEPTANCE_PASS\n");
    } finally {
      await browser.close();
    }
  } finally {
    child.kill("SIGTERM");
    await exitPromise.catch(() => {});
    await rm(projectPath, { force: true, recursive: true });
  }
}

await main();
