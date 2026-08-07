#!/usr/bin/env node

import { realpathSync } from "node:fs";
import {
  access,
  readFile,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";

import {
  displayFieldByteLimits,
  displayTextIssue,
  initialState,
  readState as readProjectState,
  stateExists,
  writeStateAtomic,
} from "./state.js";
import {
  acceptPlan,
  proposePlan,
} from "./plan.js";
import { parseCockpitCliArgs } from "./cockpit/lifecycle.js";
import { runCockpit, runCockpitStop } from "./cockpit/server.js";
import {
  ensureDefaultTruth,
  ensureOhnoRuntimeGitignore,
} from "./truth.js";
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
import {
  installOhNoSkill,
  serializeSkillInstallResult,
  serializeSkillStatus,
  skillInstallStatus,
} from "./skill-install.js";
import { serializeNext } from "./next.js";
import {
  runDoctor,
  serializeDoctor,
} from "./doctor.js";
import {
  agentsBeginMarker,
  agentsEndMarker,
  refreshProjectors,
} from "./projectors.js";
import { readModel } from "./read-model.js";
import {
  ensurePreferences,
  resetPreferences,
  serializePreferences,
  setPreferenceRule,
} from "./preferences.js";
import {
  appendRequirementsNote,
  showRequirements,
} from "./requirements.js";
import {
  serializeResume,
  serializeResumeWithWorktrees,
} from "./resume.js";
import {
  serializeHarnessBrief,
  serializeHarnessBriefAsync,
  serializeStatus,
} from "./status.js";
import { startTask } from "./task-start.js";
import { reopenLastCompletedTask } from "./task-reopen.js";
import { verifyTask } from "./verify.js";
import { migrateAcceptanceBasis } from "./migrate-acceptance.js";
import {
  declareHarnessChange,
  formatPipelineNext,
  recordTruthRead,
  sealDesign,
  sealRequirements,
  tryPipelineAdvance,
} from "./harness.js";

const usageText = [
  "usage: (Owner)",
  "  ohno setup                        # once: init + install + skills",
  "  ohno                              # where am I + pipeline",
  "  ohno pipeline                     # exact next Agent commands (short)",
  "  ohno pipeline --full              # next + full OHNO_PROMPT_RAILS once",
  "",
  "pipeline (Codex runs these):",
  "  ohno phase advance                # try seal-requirements or seal-design",
  "  ohno phase seal-requirements | seal-design",
  "  ohno plan propose|accept …  |  ohno task start  |  ohno verify",
  "  ohno truth-read [--paths a,b] --mode A|B   # after FAIL (A=code B=plan)",
  "  ohno phase declare-change --summary <words>",
  "  ohno requirements note --text \"…\" | --file <path>",
  "",
  "Harness: DISCOVER→DESIGN→PLAN→EXECUTE; FAIL→RECOVER A/B; CHANGE re-walks.",
  "Hook classification: COOPERATIVE_GUARDRAIL.",
  "When unsure: ohno pipeline   (do not invent flags)",
  "",
].join("\n");

/** Field-trial: bare usage dumps caused agents to thrash. Always attach next. */
function formatCliError(message: string): string {
  const lines = [message.trimEnd()];
  const m = message;
  if (/usage:\s*\(Owner\)/iu.test(m) || m.includes("ohno setup")) {
    lines.push("hint: run `ohno pipeline` for the exact next Agent command");
  }
  if (/task start takes no arguments/iu.test(m)) {
    lines.push("hint: exact form is `ohno task start` (no ids/flags)");
  }
  if (/--text must be a single line/iu.test(m)) {
    lines.push(
      "hint: multi-line notes: `ohno requirements note --file <path.md>`",
    );
  }
  if (/UNCLASSIFIED_HIGH_RISK/iu.test(m)) {
    lines.push(
      "hint: new governing path — add to `.ohno/truth.json` or drop the file",
    );
    lines.push("hint: then `ohno pipeline`");
  }
  if (/outside task scope/iu.test(m)) {
    lines.push(
      "hint: stay in active allowed_files, or `ohno truth-read --mode B` / change",
    );
  }
  if (/no active task/iu.test(m)) {
    lines.push("hint: `ohno task start` or `ohno pipeline`");
  }
  if (/not initialized/iu.test(m)) {
    lines.push("hint: cd to the git repo root, then `ohno setup`");
  }
  if (/invalid or duplicate change|document sync is pending|PENDING_REVIEW/iu.test(m)) {
    lines.push(
      "hint: ohno change diff → ohno change accept --change <id> --diff <sha>",
    );
  }
  if (/replacement plan is required|not an Owner Truth target/iu.test(m)) {
    lines.push(
      "hint: put plan path on Truth targets, or pass --candidates "
        + ".ohno/review-plan.json after registering it",
    );
  }
  if (!lines.some((line) => line.startsWith("hint:"))) {
    lines.push("hint: `ohno pipeline`");
  }
  return lines.join("\n");
}

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

async function ensureAgentsShell(projectPath: string): Promise<"created" | "preserved"> {
  const agentsPath = resolve(projectPath, "AGENTS.md");
  try {
    await access(agentsPath);
    return "preserved";
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
  await writeFile(
    agentsPath,
    [
      "# Agent instructions",
      "",
      "Owner rules live outside the Oh No managed block below.",
      "",
    ].join("\n"),
    "utf8",
  );
  return "created";
}

async function initialize(projectPath: string, args: string[]): Promise<void> {
  // Project-level goal is optional and unused at install: real intent lives in
  // plan task goals, OWNER-INPUTS, and REQUIREMENTS. Keep state.goal="" .
  if (args.length > 0) {
    throw new Error("usage: ohno init");
  }
  if (await stateExists(projectPath)) {
    throw new Error("project is already initialized");
  }

  // AGENTS shell before default Truth (targets must exist when classified).
  const agentsMode = await ensureAgentsShell(projectPath);
  await ensureOhnoRuntimeGitignore(projectPath);
  const truthSeeded = await ensureDefaultTruth(projectPath);
  const truthInventory = await classifyTruthAtInit(projectPath);
  await writeStateAtomic(projectPath, initialState("", truthInventory));
  await ensurePreferences(projectPath);
  await appendRequirementsNote(
    projectPath,
    "Project initialized (no project-level goal; capture Owner intent with "
      + "requirements notes and plan tasks).",
    "init",
  ).catch(() => undefined);
  await appendRequirementsNote(
    projectPath,
    "Default working method ON: research before implement; prefer existing OSS; "
    + "frontend adapt-not-invent. Configure: ohno preferences show|set|reset",
    "init-preferences",
  ).catch(() => undefined);
  // Upserts managed block; never wipes Owner prose outside markers.
  await refreshProjectors(projectPath).catch(() => undefined);
  process.stdout.write(
    "Initialized\n"
    + "GOAL: (none — use plan task goals and requirements notes)\n"
    + `AGENTS: ${agentsMode === "preserved" ? "preserved existing file; " : ""}`
    + `managed block ${agentsBeginMarker} … ${agentsEndMarker}\n`
    + "REQUIREMENTS: .ohno/REQUIREMENTS.md\n"
    + "PREFERENCES: .ohno/preferences.json\n"
    + `TRUTH: ${
      truthSeeded
        ? "seeded .ohno/truth.json (present high-risk paths)"
        : "kept existing .ohno/truth.json"
    }\n`
    + "RUNTIME_GITIGNORE: .ohno/.gitignore (locks/cockpit.runtime.json)\n"
    + "TIP: after a fresh PASS, pre-commit allows (1) in-scope product files "
    + "covered by that PASS and/or (2) harness projections only:\n"
    + "  git add .ohno/state.json .ohno/PROGRESS.md .ohno/.gitignore\n"
    + "  Owner-governed files (AGENTS.md, truth, basis, REQUIREMENTS, "
    + "preferences) must be in the task allowed_files or committed under an "
    + "active in-scope task — they do not free-ride on an unrelated PASS.\n"
    + "  (do not commit verify.lock / cockpit.runtime.json)\n"
    + "Next: ohno install  (hooks + skills), then ohno cockpit when you want the board\n",
  );
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
    process.stdout.write(
      await serializeResumeWithWorktrees(model, projectPath),
    );
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

function ensureCliUtf8(): void {
  // FT-19/33: best-effort UTF-8 on Windows consoles that default to legacy CP.
  try {
    if (process.platform === "win32") {
      process.stdout.setDefaultEncoding?.("utf8");
      process.stderr.setDefaultEncoding?.("utf8");
    }
  } catch {
    // ignore
  }
}

async function main(): Promise<void> {
  ensureCliUtf8();
  const [command, subcommand, ...args] = process.argv.slice(2);
  let projectPath = process.cwd();
  try {
    projectPath = realpathSync(projectPath);
  } catch {
    // keep cwd
  }

  if (
    (command === "--help" || command === "help")
    && subcommand === undefined
  ) {
    process.stdout.write(usageText);
    return;
  }

  // Bare `ohno`: one-screen + live pipeline next commands.
  if (command === undefined) {
    try {
      const model = await readModel(projectPath);
      process.stdout.write(
        await serializeHarnessBriefAsync(projectPath, model),
      );
      if (model.availability === "UNAVAILABLE") {
        process.exitCode = 1;
      }
    } catch {
      process.stdout.write(usageText);
    }
    return;
  }

  if (
    command === "pipeline"
    && subcommand === undefined
    && (args.length === 0 || (args.length === 1 && args[0] === "--full"))
  ) {
    const state = await readProjectState(projectPath);
    const model = await readModel(projectPath);
    // Default: short next + stamp. --full pastes complete OHNO_PROMPT_RAILS once.
    process.stdout.write(
      formatPipelineNext(state, model.next_action, {
        rails: args[0] === "--full" ? "full" : "stamp",
      }),
    );
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
    (command === "setup" || command === "bootstrap")
    && subcommand === undefined
    && args.length === 0
  ) {
    const chunks: string[] = [];
    if (!(await stateExists(projectPath))) {
      await initialize(projectPath, []);
      chunks.push("setup: initialized .ohno (phase DISCOVER)");
    } else {
      chunks.push("setup: already initialized (skipped init)");
    }
    chunks.push((await installGuardrails(projectPath)).trimEnd());
    chunks.push(
      serializeSkillInstallResult(await installOhNoSkill()).trimEnd(),
    );
    chunks.push(
      "",
      "SETUP_OK: talk to Codex only.",
      "Pipeline: clarify → seal-requirements → design → seal-design → plan → execute.",
      "FAIL: truth-read then fix. CHANGE: phase declare-change then re-seal.",
      "",
    );
    process.stdout.write(`${chunks.join("\n")}\n`);
    return;
  }

  if (command === "phase" && subcommand === "seal-requirements") {
    process.stdout.write(await sealRequirements(projectPath));
    return;
  }
  if (command === "phase" && subcommand === "seal-design") {
    process.stdout.write(await sealDesign(projectPath));
    return;
  }
  if (command === "phase" && subcommand === "advance" && args.length === 0) {
    process.stdout.write(await tryPipelineAdvance(projectPath));
    return;
  }
  if (command === "phase" && subcommand === "declare-change") {
    const summary = requiredValue(args, "--summary");
    process.stdout.write(await declareHarnessChange(projectPath, summary));
    return;
  }
  if (command === "truth-read" && subcommand === undefined) {
    const pathsFlag = args.indexOf("--paths");
    const modeFlag = args.indexOf("--mode");
    const modeRaw = modeFlag === -1 ? "A" : String(args[modeFlag + 1] ?? "A");
    const mode = modeRaw.toUpperCase() === "B" ? "B" as const : "A" as const;
    const list = pathsFlag === -1 || args[pathsFlag + 1] === undefined
      ? []
      : String(args[pathsFlag + 1])
        .split(",")
        .map((path) => path.trim())
        .filter(Boolean);
    process.stdout.write(await recordTruthRead(projectPath, list, mode));
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
    command === "skill"
    && subcommand === "install"
    && args.length === 0
  ) {
    process.stdout.write(
      serializeSkillInstallResult(await installOhNoSkill()),
    );
    return;
  }

  if (
    command === "skill"
    && subcommand === "status"
    && args.length === 0
  ) {
    process.stdout.write(
      serializeSkillStatus(await skillInstallStatus()),
    );
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

  if (
    command === "migrate"
    && subcommand === "acceptance-basis"
  ) {
    const file = requiredValue(args, "--file");
    const hasDiff = args.includes("--diff");
    const hasHead = args.includes("--head");
    if (hasDiff !== hasHead) {
      throw new Error(
        "migrate apply requires both --diff <sha256> and --head <git-head> "
          + "(omit both for zero-write preview)",
      );
    }
    const apply = hasDiff
      ? {
        diffDigest: requiredValue(args, "--diff"),
        head: requiredValue(args, "--head"),
      }
      : null;
    const consumed = new Set(["--file", "--diff", "--head"]);
    const leftover = args.filter((arg, index) => {
      if (consumed.has(arg)) {
        return false;
      }
      if (index > 0 && consumed.has(args[index - 1] ?? "")) {
        return false;
      }
      return true;
    });
    if (leftover.length > 0) {
      throw new Error(
        "usage: ohno migrate acceptance-basis --file <structured-basis.json> "
          + "[--diff <sha256> --head <git-head>]",
      );
    }
    const message = await migrateAcceptanceBasis(projectPath, file, apply);
    // Preview is zero-write — do not refresh projectors (would create AGENTS.md
    // and drift the migrate inventory digest between preview and apply).
    if (apply !== null) {
      await refreshProjectors(projectPath).catch(() => undefined);
    }
    process.stdout.write(message);
    return;
  }

  if (command === "task" && subcommand === "start") {
    const contract = await startTask(projectPath, args);
    await refreshProjectors(projectPath).catch(() => undefined);
    process.stdout.write(`Started task ${contract.id}\n`);
    return;
  }

  if (command === "task" && subcommand === "reopen" && args.length === 0) {
    const result = await reopenLastCompletedTask(projectPath);
    await refreshProjectors(projectPath).catch(() => undefined);
    process.stdout.write(
      [
        `TASK: ${result.task_id}`,
        `TEST: ${result.test_command}`,
        result.message,
        "",
      ].join("\n"),
    );
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
      `ACCEPTANCE_SOURCE: ${proposal.acceptanceSourcePath}`,
      `ACCEPTANCE_DIGEST: ${proposal.acceptanceSourceDigest}`,
      `EXACT_PLAN_DIFF_BYTES: ${
        Buffer.byteLength(proposal.exactDiff, "utf8")
      }`,
      ...(proposal.warnings ?? []).map((line) => line),
      "",
      proposal.exactDiff,
    ].join("\n"));
    return;
  }

  if (command === "plan" && subcommand === "accept") {
    const allowWeakPlan = args.includes("--allow-weak-plan");
    const filtered = args.filter((a) => a !== "--allow-weak-plan");
    if (
      filtered.length === 4
      && filtered[0] === "--revision"
      && filtered[2] === "--diff"
    ) {
      const message = await acceptPlan(
        projectPath,
        requiredValue(filtered, "--revision"),
        requiredValue(filtered, "--diff"),
        { allowWeakPlan },
      );
      await appendRequirementsNote(
        projectPath,
        `Plan accepted revision=${requiredValue(filtered, "--revision")}`
          + (allowWeakPlan ? " allow_weak_plan=true" : ""),
        "plan-accept",
      ).catch(() => undefined);
      await refreshProjectors(projectPath).catch(() => undefined);
      process.stdout.write(message);
      return;
    }
  }

  if (command === "verify" && subcommand === undefined) {
    const outcome = await verifyTask(projectPath);
    if (outcome.result === "PASS") {
      await refreshProjectors(projectPath).catch(() => undefined);
      process.stdout.write(`${outcome.nextAction}\n`);
      return;
    }
    await refreshProjectors(projectPath).catch(() => undefined);
    throw new Error(outcome.message);
  }

  if (
    command === "projectors"
    && subcommand === "refresh"
    && (args.length === 0 || (args.length === 1 && args[0] === "--no-agents"))
  ) {
    const result = await refreshProjectors(projectPath, {
      agents: args[0] !== "--no-agents",
    });
    process.stdout.write([
      `PROGRESS: ${result.progress_path}`,
      `REQUIREMENTS: ${result.requirements_path}`,
      result.agents_path === null
        ? "AGENTS: SKIPPED"
        : `AGENTS: ${result.agents_path}`,
      `NEXT: ${result.model.next_action}`,
      "",
    ].join("\n"));
    return;
  }

  if (command === "requirements" && subcommand === "note") {
    let noteText: string | undefined;
    if (args.length >= 2 && args[0] === "--text") {
      // Join remaining tokens so unquoted multi-word notes still work.
      noteText = args.slice(1).join(" ");
      if (noteText.startsWith("--")) {
        throw new Error(
          "--text requires a value"
            + " | next: ohno requirements note --text \"…\" "
            + "or --file <path>",
        );
      }
    } else if (args.length === 2 && args[0] === "--file") {
      const filePath = resolve(projectPath, requiredValue(args, "--file"));
      noteText = await readFile(filePath, "utf8");
    } else {
      throw new Error(
        "usage: ohno requirements note --text \"…\" | --file <path>"
          + " | next: ohno pipeline",
      );
    }
    const path = await appendRequirementsNote(
      projectPath,
      noteText,
      "owner-note",
    );
    process.stdout.write(`REQUIREMENTS: ${path}\n`);
    return;
  }

  if (
    command === "requirements"
    && subcommand === "show"
    && args.length === 0
  ) {
    process.stdout.write(await showRequirements(projectPath));
    return;
  }

  if (
    command === "preferences"
    && subcommand === "show"
    && args.length === 0
  ) {
    const prefs = await ensurePreferences(projectPath);
    process.stdout.write(serializePreferences(prefs));
    return;
  }

  if (command === "preferences" && subcommand === "reset" && args.length === 0) {
    const prefs = await resetPreferences(projectPath);
    await refreshProjectors(projectPath).catch(() => undefined);
    process.stdout.write(serializePreferences(prefs));
    return;
  }

  if (command === "preferences" && subcommand === "set") {
    const id = requiredValue(args, "--id");
    const enabledIndex = args.indexOf("--enabled");
    const textIndex = args.indexOf("--text");
    let enabled: boolean | undefined;
    if (enabledIndex !== -1) {
      const raw = args[enabledIndex + 1];
      if (raw === undefined || raw.startsWith("--")) {
        throw new Error("--enabled requires true or false");
      }
      if (raw === "true" || raw === "1" || raw === "on") {
        enabled = true;
      } else if (raw === "false" || raw === "0" || raw === "off") {
        enabled = false;
      } else {
        throw new Error("--enabled must be true or false");
      }
    }
    let text: string | undefined;
    if (textIndex !== -1) {
      text = requiredValue(args, "--text");
    }
    const patch: { enabled?: boolean; text?: string } = {};
    if (enabled !== undefined) {
      patch.enabled = enabled;
    }
    if (text !== undefined) {
      patch.text = text;
    }
    const prefs = await setPreferenceRule(projectPath, id, patch);
    await refreshProjectors(projectPath).catch(() => undefined);
    process.stdout.write(serializePreferences(prefs));
    return;
  }

  if (
    command === "doctor"
    && (subcommand === undefined || subcommand === "--json")
    && args.length === 0
  ) {
    const report = await runDoctor(projectPath);
    if (subcommand === "--json") {
      process.stdout.write(`${JSON.stringify(report)}\n`);
    } else {
      process.stdout.write(serializeDoctor(report));
    }
    if (!report.ok) {
      process.exitCode = 1;
    }
    return;
  }

  if (command === "cockpit") {
    const cockpitArgs = [
      ...(subcommand === undefined ? [] : [subcommand]),
      ...args,
    ];
    const options = parseCockpitCliArgs(cockpitArgs);
    if (options.stop) {
      await runCockpitStop(projectPath);
      return;
    }
    const startOptions: {
      port?: number;
      replace?: boolean;
    } = {};
    if (options.port !== undefined) {
      startOptions.port = options.port;
    }
    if (options.replace) {
      startOptions.replace = true;
    }
    await runCockpit(projectPath, startOptions);
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
    const message = await beginChange(projectPath, args);
    const summaryIndex = args.indexOf("--summary");
    const summary = summaryIndex === -1 ? "" : args[summaryIndex + 1] ?? "";
    if (summary.trim() !== "") {
      await appendRequirementsNote(
        projectPath,
        `Change begin: ${summary.trim()}`,
        "change-begin",
      ).catch(() => undefined);
    }
    await refreshProjectors(projectPath).catch(() => undefined);
    process.stdout.write(message);
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
    const message = await acceptChange(projectPath, args);
    await refreshProjectors(projectPath).catch(() => undefined);
    process.stdout.write(message);
    return;
  }

  throw new Error(usageText.trimEnd());
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`ohno: ${formatCliError(message)}\n`);
  process.exitCode = 1;
});
