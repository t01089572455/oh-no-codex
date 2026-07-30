import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

export const cliPath = resolve(repositoryRoot, "dist", "cli.js");

export async function createProject(t) {
  const projectPath = await mkdtemp(resolve(tmpdir(), "ohno-task-start-"));
  t.after(async () => {
    await rm(projectPath, { force: true, recursive: true });
  });

  const git = spawnSync("git", ["init", "--quiet"], {
    cwd: projectPath,
    encoding: "utf8",
  });
  assert.equal(
    git.status,
    0,
    `failed to initialize disposable Git repository:\n${git.stderr}`,
  );

  return projectPath;
}

export function runCli(cwd, args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8",
  });
}

export function spawnCli(cwd, args) {
  return spawn(process.execPath, [cliPath, ...args], {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

export async function readState(cwd) {
  return JSON.parse(await readFile(resolve(cwd, ".ohno", "state.json"), "utf8"));
}

export async function readStateBytes(cwd) {
  return readFile(resolve(cwd, ".ohno", "state.json"));
}

export const completeTaskArguments = Object.freeze([
  "task",
  "start",
  "--id",
  "task-001",
  "--expect",
  "A user can start one bounded task",
  "--test",
  "node --test test/blackbox/task-start.test.mjs",
  "--stop",
  "Stop after the task-start black box passes",
  "--files",
  "src/**,test/blackbox/task-start.test.mjs",
  "--minutes",
  "60",
  "--next",
  "Write the verify-finish black box",
]);

export function withoutFlag(args, flag) {
  const flagIndex = args.indexOf(flag);
  assert.notEqual(flagIndex, -1, `fixture does not contain ${flag}`);
  return args.toSpliced(flagIndex, 2);
}

export function withBlankFlag(args, flag) {
  const flagIndex = args.indexOf(flag);
  assert.notEqual(flagIndex, -1, `fixture does not contain ${flag}`);
  return args.with(flagIndex + 1, "   ");
}
