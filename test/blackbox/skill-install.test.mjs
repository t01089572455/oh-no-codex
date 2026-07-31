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
  assert.match(installed.stdout, /oh-no-control|Installed Oh No control skill/i);

  const skillPath = join(
    fakeHome,
    ".codex",
    "skills",
    "oh-no-control",
    "SKILL.md",
  );
  const body = await readFile(skillPath, "utf8");
  assert.match(body, /name:\s*oh-no-control/);
  assert.match(body, /ohno verify/i);
  assert.match(body, /description:/);

  const status = runCli(projectPath, ["skill", "status"], { env });
  assert.equal(status.status, 0, status.stderr);
  assert.match(status.stdout, /INSTALLED: codex/);
});
