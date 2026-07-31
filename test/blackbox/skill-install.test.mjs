import assert from "node:assert/strict";
import {
  mkdtemp,
  readFile,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  createProject,
  runCli,
} from "../helpers/blackbox.mjs";

test("skill install writes oh-no-control into a home skills dir", async (t) => {
  const projectPath = await createProject(t);
  const fakeHome = await mkdtemp(join(tmpdir(), "ohno-skill-home-"));
  t.after(async () => {
    await rm(fakeHome, { recursive: true, force: true });
  });

  // Isolate HOME so we do not touch the developer machine skills tree.
  const env = {
    ...process.env,
    HOME: fakeHome,
    USERPROFILE: fakeHome,
  };

  const installed = runCli(projectPath, ["skill", "install"], { env });
  assert.equal(installed.status, 0, installed.stderr + installed.stdout);
  assert.match(installed.stdout, /Installed Oh No skill suite|oh-no-verify/i);

  const hub = join(fakeHome, ".codex", "skills", "oh-no-control", "SKILL.md");
  const verify = join(fakeHome, ".codex", "skills", "oh-no-verify", "SKILL.md");
  const hubBody = await readFile(hub, "utf8");
  const verifyBody = await readFile(verify, "utf8");
  assert.match(hubBody, /name:\s*oh-no-control/);
  assert.match(verifyBody, /name:\s*oh-no-verify/);
  assert.match(verifyBody, /ohno verify/i);

  const status = runCli(projectPath, ["skill", "status"], { env });
  assert.equal(status.status, 0, status.stderr);
  assert.match(status.stdout, /INSTALLED: codex\/oh-no-verify/);
  assert.match(status.stdout, /INSTALLED: codex\/oh-no-task/);
});
