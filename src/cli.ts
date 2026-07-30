#!/usr/bin/env node

import {
  displayFieldByteLimits,
  displayTextIssue,
  initialState,
  stateExists,
  writeStateAtomic,
} from "./state.js";
import {
  acceptPlan,
  proposePlan,
} from "./plan.js";
import { runCockpit } from "./cockpit/server.js";
import { classifyTruthAtInit } from "./truth-inventory.js";
import {
  acceptChange,
  beginChange,
  displayChangeDiff,
} from "./change.js";
import {
  handleCodexHook,
  readHookInput,
} from "./hooks/codex.js";
import { checkPreCommit } from "./hooks/precommit.js";
import {
  hooksIntegrationStatus,
  installGuardrails,
} from "./install.js";
import { serializeNext } from "./next.js";
import { readModel } from "./read-model.js";
import { serializeResume } from "./resume.js";
import { serializeStatus } from "./status.js";
import { startTask } from "./task-start.js";
import { verifyTask } from "./verify.js";

const usageText = [
  "usage:",
  "  ohno init --goal <goal>",
  "  ohno plan propose --file <review.json>",
  "  ohno plan accept --revision <sha256> --diff <sha256>",
  "  ohno task start",
  "  ohno verify | ohno status [--json] | ohno resume | ohno next",
  "  ohno cockpit",
  "  ohno change begin --summary <owner words> [--concerns <labels>] [--candidates <Truth paths>]",
  "  ohno change diff | ohno change accept --change <id> --diff <displayed digest>",
  "  ohno install | ohno hooks status --json",
  "  ohno hook | ohno git pre-commit",
  "",
  "Hook classification: COOPERATIVE_GUARDRAIL.",
  "Codex hook feature and trust: UNVERIFIED until reviewed in Codex.",
  "Hosted and specialized mutation paths are outside complete hook coverage.",
  "",
].join("\n");

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

  const truthInventory = await classifyTruthAtInit(projectPath);
  await writeStateAtomic(projectPath, initialState(goal, truthInventory));
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

  if (
    (command === "--help" || command === "help")
    && subcommand === undefined
  ) {
    process.stdout.write(usageText);
    return;
  }

  if (
    command === "hook"
    && subcommand === undefined
    && args.length === 0
  ) {
    const output = await handleCodexHook(await readHookInput());
    process.stdout.write(`${JSON.stringify(output)}\n`);
    return;
  }

  if (
    command === "hooks"
    && subcommand === "status"
    && args.length === 1
    && args[0] === "--json"
  ) {
    process.stdout.write(
      `${JSON.stringify(await hooksIntegrationStatus(projectPath))}\n`,
    );
    return;
  }

  if (
    command === "install"
    && subcommand === undefined
    && args.length === 0
  ) {
    process.stdout.write(await installGuardrails(projectPath));
    return;
  }

  if (
    command === "git"
    && subcommand === "pre-commit"
    && args.length === 0
  ) {
    process.stdout.write(await checkPreCommit(projectPath));
    return;
  }

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

  if (
    command === "plan"
    && subcommand === "propose"
    && args.length === 2
    && args[0] === "--file"
  ) {
    const source = requiredValue(args, "--file");
    const proposal = await proposePlan(projectPath, source);
    process.stdout.write([
      `PLAN_REVISION: ${proposal.planRevision}`,
      `DIFF_DIGEST: ${proposal.diffDigest}`,
      `HEAD: ${proposal.head}`,
      `PROPOSED_AT: ${proposal.proposedAt}`,
      `EXACT_PLAN_DIFF_BYTES: ${
        Buffer.byteLength(proposal.exactDiff, "utf8")
      }`,
      "",
      proposal.exactDiff,
    ].join("\n"));
    return;
  }

  if (
    command === "plan"
    && subcommand === "accept"
    && args.length === 4
    && args[0] === "--revision"
    && args[2] === "--diff"
  ) {
    process.stdout.write(await acceptPlan(
      projectPath,
      requiredValue(args, "--revision"),
      requiredValue(args, "--diff"),
    ));
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
    command === "cockpit"
    && subcommand === undefined
    && args.length === 0
  ) {
    await runCockpit(projectPath);
    return;
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

  throw new Error(usageText.trimEnd());
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`ohno: ${message}\n`);
  process.exitCode = 1;
});
