#!/usr/bin/env node

import {
  initialState,
  stateExists,
  writeStateAtomic,
} from "./state.js";
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

async function initialize(projectPath: string, args: string[]): Promise<void> {
  const goal = requiredValue(args, "--goal");
  if (await stateExists(projectPath)) {
    throw new Error("project is already initialized");
  }

  await writeStateAtomic(projectPath, initialState(goal));
  process.stdout.write(`Initialized goal: ${goal}\n`);
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

  throw new Error(
    "usage: ohno init --goal <goal> | ohno task start --id <id> --expect <behavior> --test <command> --stop <condition> --files <globs> --minutes <integer> --next <action> | ohno verify",
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`ohno: ${message}\n`);
  process.exitCode = 1;
});
