#!/usr/bin/env node

import {
  displayFieldByteLimits,
  displayTextIssue,
  initialState,
  stateExists,
  writeStateAtomic,
} from "./state.js";
import {
  acceptChange,
  beginChange,
  displayChangeDiff,
} from "./change.js";
import { serializeNext } from "./next.js";
import { readModel } from "./read-model.js";
import { serializeResume } from "./resume.js";
import { serializeStatus } from "./status.js";
import { startTask } from "./task-start.js";
import { verifyTask } from "./verify.js";

function requiredValue(args: string[], flag: string): string {
  const index = args.indexOf(flag);
  const value = index === -1 ? undefined : args[index + 1];

  if (value === undefined || value.startsWith("--") || value.trim() === "") {
    throw new Error(`${flag} is required and cannot be blank`);
  }

  return value.trim();
}

function boundedDisplayValue(
  value: string,
  flag: string,
  byteLimit: number,
): string {
  const issue = displayTextIssue(value, byteLimit);
  if (issue === "LINE_BREAK") {
    throw new Error(`${flag} must be a single line without CR or LF`);
  }
  if (issue === "TOO_LARGE") {
    throw new Error(`${flag} must be at most ${byteLimit} UTF-8 bytes`);
  }
  return value;
}

async function initialize(projectPath: string, args: string[]): Promise<void> {
  const goal = boundedDisplayValue(
    requiredValue(args, "--goal"),
    "--goal",
    displayFieldByteLimits.goal,
  );
  if (await stateExists(projectPath)) {
    throw new Error("project is already initialized");
  }

  await writeStateAtomic(projectPath, initialState(goal));
  process.stdout.write(`Initialized goal: ${goal}\n`);
}

async function writeReadSurface(
  projectPath: string,
  surface: "status" | "resume" | "next",
  json = false,
): Promise<void> {
  const model = await readModel(projectPath);
  if (surface === "status") {
    process.stdout.write(serializeStatus(model, json));
  } else if (surface === "resume") {
    process.stdout.write(serializeResume(model));
  } else {
    process.stdout.write(serializeNext(model));
  }

  if (model.availability === "UNAVAILABLE") {
    process.stderr.write(
      "UNAVAILABLE: project state is missing, corrupt, or unsupported\n",
    );
    process.exitCode = 1;
  }
}

async function main(): Promise<void> {
  const [command, subcommand, ...args] = process.argv.slice(2);
  const projectPath = process.cwd();

  if (command === "init") {
    await initialize(projectPath, [subcommand, ...args].filter(
      (value): value is string => value !== undefined,
    ));
    return;
  }

  if (command === "task" && subcommand === "start") {
    const contract = await startTask(projectPath, args);
    process.stdout.write(`Started task ${contract.id}\n`);
    return;
  }

  if (command === "verify" && subcommand === undefined) {
    const outcome = await verifyTask(projectPath);
    if (outcome.result === "PASS") {
      process.stdout.write(`${outcome.nextAction}\n`);
      return;
    }
    throw new Error(outcome.message);
  }

  if (
    command === "status"
    && (subcommand === undefined || subcommand === "--json")
    && args.length === 0
  ) {
    await writeReadSurface(projectPath, "status", subcommand === "--json");
    return;
  }

  if (command === "resume" && subcommand === undefined) {
    await writeReadSurface(projectPath, "resume");
    return;
  }

  if (command === "next" && subcommand === undefined) {
    await writeReadSurface(projectPath, "next");
    return;
  }

  if (command === "change" && subcommand === "begin") {
    process.stdout.write(await beginChange(projectPath, args));
    return;
  }

  if (
    command === "change"
    && subcommand === "diff"
    && args.length === 0
  ) {
    process.stdout.write(await displayChangeDiff(projectPath));
    return;
  }

  if (command === "change" && subcommand === "accept") {
    process.stdout.write(await acceptChange(projectPath, args));
    return;
  }

  throw new Error(
    "usage: ohno init --goal <goal> | ohno task start --id <id> --expect <behavior> --test <command> --stop <condition> --files <globs> --minutes <integer> --next <action> | ohno verify | ohno status [--json] | ohno resume | ohno next | ohno change begin --summary <owner words> [--concerns <labels>] [--candidates <Truth paths>] | ohno change diff | ohno change accept --change <id> --diff <displayed digest>",
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`ohno: ${message}\n`);
  process.exitCode = 1;
});
