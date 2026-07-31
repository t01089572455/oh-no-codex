import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
  cliPath,
  createProject,
  frozenPlanTask,
  readStateBytes,
  reviewPlan,
  runCli,
} from "../helpers/blackbox.mjs";

const goal = "Keep one local Cockpit projection honest";

async function initialize(projectPath) {
  const initialized = runCli(projectPath, ["init"]);
  assert.equal(initialized.status, 0, initialized.stderr);
}

function statusJson(projectPath) {
  const status = runCli(projectPath, ["status", "--json"]);
  assert.notEqual(status.stdout, "", status.stderr);
  return {
    code: status.status,
    value: JSON.parse(status.stdout),
  };
}

function waitForCockpitUrl(child, stderrText) {
  return new Promise((resolvePromise, rejectPromise) => {
    let stdout = "";
    const timeout = setTimeout(() => {
      cleanup();
      rejectPromise(
        new Error(
          `timed out waiting for Cockpit URL\nstdout: ${stdout}`
          + `\nstderr: ${stderrText()}`,
        ),
      );
    }, 5_000);
    const onData = (chunk) => {
      stdout += chunk;
      const match = /^Cockpit: (http:\/\/127\.0\.0\.1:\d+\/)\r?$/m.exec(
        stdout,
      );
      if (match?.[1] !== undefined) {
        cleanup();
        resolvePromise(match[1]);
      }
    };
    const onExit = (code, signal) => {
      cleanup();
      rejectPromise(
        new Error(
          `Cockpit exited before announcing a URL: code=${code} `
          + `signal=${signal}\nstderr: ${stderrText()}`,
        ),
      );
    };
    const cleanup = () => {
      clearTimeout(timeout);
      child.stdout.off("data", onData);
      child.off("exit", onExit);
    };
    child.stdout.on("data", onData);
    child.once("exit", onExit);
  });
}

async function startCockpit(t, projectPath) {
  const child = spawn(
    process.execPath,
    [cliPath, "cockpit"],
    {
      cwd: projectPath,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const exitPromise = once(child, "exit");
  const url = await waitForCockpitUrl(child, () => stderr);
  let stopped = false;
  const stop = async () => {
    if (stopped) {
      return;
    }
    stopped = true;
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
    }
    const [code, signal] = await exitPromise;
    if (process.platform === "win32") {
      assert.equal(code, null, stderr);
      assert.equal(signal, "SIGTERM", stderr);
    } else {
      assert.equal(signal, null, stderr);
      assert.equal(code, 0, stderr);
    }
  };
  t.after(stop);
  return {
    child,
    stop,
    url,
  };
}

async function responseJson(url, options) {
  const response = await fetch(url, options);
  return {
    response,
    value: JSON.parse(await response.text()),
  };
}

test("cockpit serves the locked local shell and shuts down cleanly", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  const cockpit = await startCockpit(t, projectPath);
  try {

  const page = await fetch(cockpit.url);
  assert.equal(page.status, 200);
  assert.match(page.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await page.text();
  assert.match(html, /OH NO, CODEX!/);
  assert.match(html, />NOW</);
  assert.match(html, />PROOF</);
  assert.match(html, />DRIFT</);
  assert.match(html, />NEXT</);
  assert.match(html, /CALIBRATION RAIL/);
  assert.match(html, /PLAN BOARD/);
  assert.match(html, /top-nav|OVERALL PROGRESS|CURRENT STAGE/);
  assert.match(html, /oh-no-codex-plush-hero\.png/);
  assert.doesNotMatch(html, /<form\b/i);

  const css = await fetch(new URL("assets/cockpit.css", cockpit.url));
  assert.equal(css.status, 200);
  const cssBytes = await css.text();
  assert.match(cssBytes, /--field:\s*#F0EDF8/i);
  assert.match(cssBytes, /backdrop-filter/i);
  assert.match(cssBytes, /prefers-reduced-motion:\s*reduce/i);
  assert.match(cssBytes, /max-width:\s*719px/i);
  assert.doesNotMatch(cssBytes, /https?:\/\//i);

  const script = await fetch(new URL("assets/cockpit.js", cockpit.url));
  assert.equal(script.status, 200);
  const scriptBytes = await script.text();
  assert.doesNotMatch(
    scriptBytes,
    /localStorage|sessionStorage|indexedDB|serviceWorker/i,
  );

  for (const [path, contentType] of [
    ["brand/oh-no-codex-plush-hero.png", /^image\/png\b/i],
    ["assets/fonts/IBMPlexSans-Regular.woff2", /^font\/woff2\b/i],
    ["assets/fonts/OFL.txt", /^text\/plain\b/i],
  ]) {
    const asset = await fetch(new URL(path, cockpit.url));
    assert.equal(asset.status, 200, path);
    assert.match(asset.headers.get("content-type") ?? "", contentType, path);
    assert.ok((await asset.arrayBuffer()).byteLength > 0, path);
  }

  await cockpit.stop();
  await assert.rejects(
    fetch(cockpit.url, { signal: AbortSignal.timeout(500) }),
  );
  } finally {
    await cockpit.stop();
  }
});

test("state endpoint equals status JSON and does not rescan Truth inventory", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  const cockpit = await startCockpit(t, projectPath);
  try {

  const expected = statusJson(projectPath);
  assert.equal(expected.code, 0);
  const first = await responseJson(new URL("api/state", cockpit.url));
  assert.equal(first.response.status, 200);
  assert.match(
    first.response.headers.get("content-type") ?? "",
    /^application\/json\b/i,
  );
  assert.equal(first.response.headers.get("cache-control"), "no-store");
  assert.deepEqual(first.value, expected.value);

  const before = await readStateBytes(projectPath);
  await mkdir(resolve(projectPath, "deep"), { recursive: true });
  await writeFile(
    resolve(projectPath, "deep", "AGENTS.override.md"),
    "# New unclassified governing entry\n",
    "utf8",
  );
  const second = await responseJson(new URL("api/state", cockpit.url));
  assert.equal(second.response.status, 200);
  assert.deepEqual(second.value, statusJson(projectPath).value);
  assert.deepEqual(await readStateBytes(projectPath), before);
  } finally {
    await cockpit.stop();
  }
});

test("every HTTP write method is rejected without changing current state", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  const cockpit = await startCockpit(t, projectPath);
  const before = await readStateBytes(projectPath);
  try {

  for (const path of ["", "api/state", "assets/cockpit.css"]) {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      const response = await fetch(new URL(path, cockpit.url), {
        method,
        body: method === "DELETE" ? undefined : "{}",
        headers: {
          "content-type": "application/json",
        },
      });
      assert.equal(response.status, 405, `${method} ${path}`);
      assert.match(response.headers.get("allow") ?? "", /GET/i);
      assert.deepEqual(
        await readStateBytes(projectPath),
        before,
        `${method} ${path}`,
      );
    }
  }
  } finally {
    await cockpit.stop();
  }
});

test("corrupt state returns the canonical unavailable model without overwrite", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  const cockpit = await startCockpit(t, projectPath);
  try {
  const statePath = resolve(projectPath, ".ohno", "state.json");
  const validBytes = await readFile(statePath);
  await writeFile(statePath, "{corrupt", "utf8");

  const expected = statusJson(projectPath);
  assert.notEqual(expected.code, 0);
  assert.equal(expected.value.availability, "UNAVAILABLE");
  const unavailable = await responseJson(new URL("api/state", cockpit.url));
  assert.equal(unavailable.response.status, 503);
  assert.deepEqual(unavailable.value, expected.value);
  assert.equal(await readFile(statePath, "utf8"), "{corrupt");

  const page = await fetch(cockpit.url);
  assert.equal(page.status, 200);
  await writeFile(statePath, validBytes);
  const recovered = await responseJson(new URL("api/state", cockpit.url));
  assert.equal(recovered.response.status, 200);
  assert.equal(recovered.value.availability, "AVAILABLE");
  } finally {
    await cockpit.stop();
  }
});

test("one running cockpit reflects task and proof changes from canonical state", async (t) => {
  const projectPath = await createProject(t);
  await initialize(projectPath);
  await writeFile(resolve(projectPath, "subject.txt"), "bounded\n", "utf8");
  await writeFile(resolve(projectPath, "pass.mjs"), "process.exit(0);\n", "utf8");
  const cockpit = await startCockpit(t, projectPath);
  try {

  const initial = await responseJson(new URL("api/state", cockpit.url));
  assert.equal(initial.value.next_action, "PROPOSE_PLAN");

  reviewPlan(projectPath, {
    tasks: [
      frozenPlanTask({
        id: "cockpit-reflection",
        title: "Reflect one saved state",
        goal: "Prove the running Cockpit has no cached authority",
        expected_behavior:
          "A running Cockpit reflects the canonical task and proof",
        test_command: `"${process.execPath}" "pass.mjs"`,
        stop_condition: "Stop after the Cockpit reflection test passes",
        allowed_files: ["subject.txt"],
        time_budget_minutes: 30,
      }),
    ],
  });
  const started = runCli(projectPath, ["task", "start"]);
  assert.equal(started.status, 0, started.stderr);
  const active = await responseJson(new URL("api/state", cockpit.url));
  assert.deepEqual(active.value, statusJson(projectPath).value);
  assert.equal(active.value.current_task.id, "cockpit-reflection");
  assert.equal(active.value.proof_freshness, "NONE");

  const verified = runCli(projectPath, ["verify"]);
  assert.equal(verified.status, 0, verified.stderr);
  const fresh = await responseJson(new URL("api/state", cockpit.url));
  assert.deepEqual(fresh.value, statusJson(projectPath).value);
  assert.equal(fresh.value.current_task, null);
  assert.equal(fresh.value.proof_freshness, "FRESH");
  assert.equal(fresh.value.next_action, "PROJECT_COMPLETE");
  } finally {
    await cockpit.stop();
  }
});
