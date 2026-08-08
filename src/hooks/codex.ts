import {
  bashLooksLikeMutation,
  effectiveHarness,
  formatPipelineNext,
  looksLikeProductPath,
  maybeAutoDeclareChangeFromPrompt,
  phaseAllowsProductCode,
  productCodeBlockedReason,
  requiredTruthReadPaths,
  truthReadSatisfiesRecover,
} from "../harness.js";

import { needsAcceptanceBasisMigration } from "../state.js";
import { readModel } from "../read-model.js";
import type { ReadModel } from "../read-model.js";
import { serializeResumeWithWorktrees } from "../resume.js";
import { readState } from "../state.js";
import { isAbsolute } from "node:path";
import {
  clearPendingLatestRebind,
  looksLikeHostSystemCapture,
  recordHookRuntimeEvent,
  readHooksRuntime,
  sessionBootstrapRequired,
  sessionPendingLatestRebind,
} from "../hooks-runtime.js";
import { findProjectRoot } from "./project-root.js";
import {
  pathsOutsideGlobs,
  toProjectPath,
} from "./scope.js";
import type { ScopedPath } from "./scope.js";

type HookOutput = Record<string, unknown>;

interface HookInput extends Record<string, unknown> {
  cwd: string;
  hook_event_name: string;
}

const maximumInputBytes = 1024 * 1024;
const automaticContinuationPrefix = "OHNO_AUTO_CONTINUE";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object"
    && value !== null
    && !Array.isArray(value);
}

function validateHookInput(value: unknown): HookInput {
  if (
    !isRecord(value)
    || typeof value.cwd !== "string"
    || value.cwd.trim() === ""
    || typeof value.hook_event_name !== "string"
    || value.hook_event_name.trim() === ""
  ) {
    throw new Error("hook stdin must contain cwd and hook_event_name");
  }
  return value as HookInput;
}

export async function readHookInput(): Promise<HookInput> {
  const chunks: Buffer[] = [];
  let byteLength = 0;
  for await (const chunk of process.stdin) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    byteLength += bytes.length;
    if (byteLength > maximumInputBytes) {
      throw new Error("hook stdin exceeds 1 MiB");
    }
    chunks.push(bytes);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("hook stdin must be one valid JSON object");
  }
  return validateHookInput(parsed);
}

/**
 * PreToolUse control must be **background**, not chat spam.
 *
 * Root cause of field pain: we treated "inject more prompt text" as control on a
 * high-frequency event (every tool). That is control tax, not a harness.
 *
 * Correct shape:
 * - allow → empty output (nothing appears in the session)
 * - clear phase/scope violation → short hard deny (tool fails once; no rails dump)
 * - law / next action → rare Stop / Owner-turn pipeline only (not PreToolUse)
 */
function silentDeny(reason: string): HookOutput {
  const oneLine = reason.replace(/\s+/gu, " ").trim().slice(0, 280);
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: oneLine,
    },
  };
}

function allowQuietly(): HookOutput {
  return {};
}

function applyPatchTargets(input: HookInput): string[] | null {
  if (
    input.tool_name !== "apply_patch"
    && input.tool_name !== "Edit"
    && input.tool_name !== "Write"
  ) {
    return null;
  }
  if (
    !isRecord(input.tool_input)
    || typeof input.tool_input.command !== "string"
  ) {
    return null;
  }

  const lines = input.tool_input.command.split(/\r?\n/u);
  if (
    lines[0] !== "*** Begin Patch"
    || lines.at(-1) !== "*** End Patch"
  ) {
    return null;
  }

  const targets: string[] = [];
  for (const line of lines) {
    if (
      line === "*** Begin Patch"
      || line === "*** End Patch"
      || line === "*** End of File"
      || !line.startsWith("*** ")
    ) {
      continue;
    }
    const match =
      /^\*\*\* (?:Add File|Delete File|Update File|Move to): (.*)$/u.exec(
        line,
      );
    const target = match?.[1];
    if (
      target === undefined
      || target.trim() === ""
      || target !== target.trim()
    ) {
      return null;
    }
    const normalized = target.replaceAll("\\", "/");
    if (
      isAbsolute(target)
      || /^[a-zA-Z]:/u.test(target)
      || normalized.split("/").includes("..")
    ) {
      return null;
    }
    targets.push(target);
  }
  return targets.length === 0 ? null : [...new Set(targets)];
}

function displayPaths(paths: ScopedPath[]): string {
  return paths.map(({ relativePath, display }) =>
    relativePath ?? display
  ).join(", ");
}

async function ensureLatestRebindAfterOwner(
  projectPath: string,
  sessionId?: string,
): Promise<string | null> {
  const runtime = await readHooksRuntime(projectPath);
  if (!sessionPendingLatestRebind(runtime, sessionId)) {
    return null;
  }
  const { rebindLatestAfterOwnerPrompt } = await import("../harness.js");
  await rebindLatestAfterOwnerPrompt(projectPath).catch(() => undefined);
  await clearPendingLatestRebind(projectPath, sessionId);
  try {
    const state = await readState(projectPath);
    const model = await readModel(projectPath);
    return (
      "LATEST_REBIND: Owner spoke since last tool mutation — follow "
      + ".ohno/REQUIREMENTS.md Latest; do not keep obsolete plan choices\n"
      + formatPipelineNext(state, model.next_action, { rails: "none" }).trimEnd()
    );
  } catch {
    return (
      "LATEST_REBIND: Owner spoke since last tool mutation — open "
      + ".ohno/REQUIREMENTS.md Latest before mutating"
    );
  }
}

function allowWithOptionalContext(context: string | null): HookOutput {
  if (context == null || context.trim() === "") {
    return allowQuietly();
  }
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      additionalContext: context.slice(0, 2_000),
    },
  };
}

async function handlePreToolUse(
  projectPath: string,
  input: HookInput,
): Promise<HookOutput> {
  const sessionId =
    typeof input.session_id === "string" ? input.session_id : undefined;
  const rebindNote = await ensureLatestRebindAfterOwner(projectPath, sessionId);

  const rawTargets = applyPatchTargets(input);
  if (rawTargets === null) {
    if (input.tool_name === "Bash" || input.tool_name === "Shell") {
      let stateForBash;
      try {
        stateForBash = await readState(projectPath);
      } catch {
        return silentDeny(
          "state unavailable — repair .ohno/state.json or run ohno setup",
        );
      }
      const cmd = isRecord(input.tool_input)
        && typeof input.tool_input.command === "string"
        ? input.tool_input.command
        : "";
      if (bashLooksLikeMutation(cmd)) {
        if (!phaseAllowsProductCode(stateForBash)) {
          return silentDeny(
            (productCodeBlockedReason(stateForBash)
              ?? "product mutations blocked in this phase")
            + " — seal/plan first or edit Truth/.ohno only",
          );
        }
        if (
          stateForBash.harness?.phase === "RECOVER"
          && !truthReadSatisfiesRecover(stateForBash)
        ) {
          const need = requiredTruthReadPaths(stateForBash).join(",");
          return silentDeny(
            `RECOVER: run ohno truth-read --paths ${need} --mode A|B first`,
          );
        }
      }
      return allowWithOptionalContext(rebindNote);
    }
    if (
      input.tool_name === "apply_patch"
      || input.tool_name === "Edit"
      || input.tool_name === "Write"
    ) {
      return silentDeny("unsafe or unparseable apply_patch target");
    }
    return allowWithOptionalContext(rebindNote);
  }

  const targets = rawTargets.map((target) =>
    toProjectPath(projectPath, target)
  );
  let state;
  try {
    state = await readState(projectPath);
  } catch {
    return silentDeny(
      "state unavailable — repair .ohno/state.json or run ohno setup",
    );
  }

  // Schema 2 pre-basis: only allow .ohno maintenance files so Owner can
  // stage basis/truth for migrate; block product work and completion.
  if (needsAcceptanceBasisMigration(state)) {
    const outsidePlan = targets.filter(({ relativePath }) =>
      relativePath === null
      || !isOhnoPlanMaintenancePath(relativePath)
    );
    if (outsidePlan.length === 0) {
      return allowWithOptionalContext(rebindNote);
    }
    return silentDeny(
      "MIGRATE_ACCEPTANCE_BASIS first — only .ohno maintenance writes allowed; "
        + `outside: ${displayPaths(outsidePlan)}`,
    );
  }

  if (state.document_sync.status === "PENDING_REVIEW") {
    const requiredPaths: readonly string[] =
      state.document_sync.required_paths;
    const outsideRequired = targets.filter(({ relativePath }) =>
      relativePath === null
      || !requiredPaths.includes(relativePath)
    );
    if (outsideRequired.length === 0) {
      return allowWithOptionalContext(rebindNote);
    }
    return silentDeny(
      "document sync pending — only required Truth paths; "
        + `outside: ${displayPaths(outsideRequired)}`,
    );
  }

  // Phase gate: DISCOVER/DESIGN/PLAN_READY/CHANGE cannot touch product code.
  if (!phaseAllowsProductCode(state)) {
    const productHits = targets.filter(({ relativePath }) =>
      relativePath !== null && looksLikeProductPath(relativePath)
    );
    if (productHits.length > 0) {
      return silentDeny(
        (productCodeBlockedReason(state)
          ?? "product code blocked by harness phase")
        + `; ${displayPaths(productHits)}`,
      );
    }
  }

  if (state.active_task === null) {
    const model = await readModel(projectPath);
    const next = model.next_action;
    // PREPARE (no active task): allow Truth / requirements / design / .ohno
    // plan files. Deny product code so Codex cannot skip clarify→design.
    if (isPlanMaintenanceNextAction(next) || !phaseAllowsProductCode(state)) {
      const allowed = prepareAllowedRelativePaths(state);
      const outside = targets.filter(({ relativePath }) =>
        relativePath === null
        || !isPrepareAllowedPath(relativePath, allowed)
      );
      if (outside.length === 0) {
        return allowWithOptionalContext(rebindNote);
      }
      return silentDeny(
        `PREPARE (${next}): only Truth/design/.ohno plan files; `
          + `blocked ${displayPaths(outside)}`,
      );
    }
    return silentDeny(
      `no active task (next ${next}) — plan accept + task start first`,
    );
  }

  // RECOVER: PATH A = product (implement); PATH B = plan/design Truth files.
  if (state.harness?.phase === "RECOVER") {
    const productHits = targets.filter(({ relativePath }) =>
      relativePath !== null && looksLikeProductPath(relativePath)
    );
    const planHits = targets.filter(({ relativePath }) =>
      relativePath !== null
      && !looksLikeProductPath(relativePath)
      && isPrepareAllowedPath(
        relativePath,
        prepareAllowedRelativePaths(state),
      )
    );
    const receipt = effectiveHarness(state).truth_read;
    const okRead = truthReadSatisfiesRecover(state);
    if (productHits.length > 0) {
      if (!okRead || receipt?.mode !== "A") {
        const need = requiredTruthReadPaths(state).join(",");
        return silentDeny(
          `RECOVER A: ohno truth-read --paths ${need} --mode A first`,
        );
      }
    }
    if (planHits.length > 0 && productHits.length === 0) {
      if (!okRead || (receipt?.mode !== "B" && receipt?.mode !== "A")) {
        const need = requiredTruthReadPaths(state).join(",");
        return silentDeny(
          `RECOVER B: ohno truth-read --paths ${need} --mode B first`,
        );
      }
    }
  }

  const outside = pathsOutsideGlobs(
    targets,
    state.active_task.allowed_files,
  );
  if (outside.length > 0) {
    return silentDeny(
      `outside task scope: ${displayPaths(outside)}`,
    );
  }
  return allowWithOptionalContext(rebindNote);
}

/** Next actions where agents prepare Truth/plan without an ACTIVE task. */
function isPlanMaintenanceNextAction(nextAction: string): boolean {
  return nextAction === "PROPOSE_PLAN"
    || nextAction === "PROJECT_COMPLETE"
    || nextAction.startsWith("FREEZE_TASK:");
}

/**
 * Cooperative allowance under `.ohno/` (never sole authority state.json).
 */
function isOhnoPlanMaintenancePath(relativePath: string): boolean {
  if (relativePath === ".ohno/state.json") {
    return false;
  }
  if (!relativePath.startsWith(".ohno/")) {
    return false;
  }
  if (relativePath === ".ohno/cockpit.runtime.json") {
    return false;
  }
  return relativePath.endsWith(".json")
    || relativePath.endsWith(".md");
}

/**
 * PREPARE writes: Truth-listed paths + common governing docs + .ohno plans.
 * Product source trees stay denied until an active frozen task exists.
 */
function prepareAllowedRelativePaths(state: {
  truth_inventory?: {
    classification?: ReadonlyArray<{ path?: string; truth_target?: boolean }>;
  };
}): Set<string> {
  const allowed = new Set<string>();
  for (const entry of state.truth_inventory?.classification ?? []) {
    if (entry.truth_target === true && typeof entry.path === "string") {
      allowed.add(entry.path.replaceAll("\\", "/"));
    }
  }
  for (const path of [
    "AGENTS.md",
    "README.md",
    "README.zh-CN.md",
    "docs/PRODUCT-CONTRACT.md",
    "docs/DESIGN.md",
    "docs/ACCEPTANCE.md",
    "docs/IMPLEMENTATION-PLAN.md",
  ]) {
    allowed.add(path);
  }
  return allowed;
}

function isPrepareAllowedPath(
  relativePath: string,
  truthPaths: ReadonlySet<string>,
): boolean {
  if (isOhnoPlanMaintenancePath(relativePath)) {
    return true;
  }
  if (truthPaths.has(relativePath)) {
    return true;
  }
  // Governing prose under docs/ (design dump during DISCOVER/DESIGN).
  if (
    relativePath.startsWith("docs/")
    && (relativePath.endsWith(".md") || relativePath.endsWith(".json"))
  ) {
    return true;
  }
  return false;
}

interface TaskMarker {
  id: string;
  hasExactStartBoundary: boolean;
}

function taskMarkers(message: unknown, prefix: string): TaskMarker[] {
  if (typeof message !== "string") {
    return [];
  }
  const pattern = new RegExp(`${prefix}:([^\\s]+)`, "gu");
  return [...message.matchAll(pattern)]
    .flatMap((match) => {
      const id = match[1];
      if (id === undefined || match.index === undefined) {
        return [];
      }
      const preceding = match.index === 0
        ? undefined
        : message[match.index - 1];
      return [{
        id,
        hasExactStartBoundary:
          preceding === undefined || !/[\p{L}\p{N}_]/u.test(preceding),
      }];
    });
}

function completionMarkers(message: unknown): TaskMarker[] {
  return taskMarkers(message, "OHNO_COMPLETE");
}

function needsInputMarkers(message: unknown): TaskMarker[] {
  return taskMarkers(message, "OHNO_NEEDS_INPUT");
}

function continuation(reason: string): HookOutput {
  return {
    decision: "block",
    reason: `${automaticContinuationPrefix}\n${reason}`,
  };
}

/**
 * Short cooperative continue card (harness 0.2).
 * Codex uses decision=block as the continue channel — it is not a work stop.
 */
export const STUCK_FAIL_THRESHOLD = 5;

function continueMode(
  model: ReadModel,
  failCount: number,
  harnessPhase?: string,
): string {
  if (harnessPhase === "RECOVER") {
    return failCount >= STUCK_FAIL_THRESHOLD ? "STUCK" : "REPAIR";
  }
  if (
    harnessPhase === "DISCOVER"
    || harnessPhase === "CHANGE"
    || harnessPhase === "DESIGN"
    || harnessPhase === "PLAN_READY"
  ) {
    return "PREPARE";
  }
  if (model.next_action === "PROJECT_COMPLETE") {
    return "DONE";
  }
  if (failCount >= STUCK_FAIL_THRESHOLD) {
    return "STUCK";
  }
  if (model.next_action.startsWith("START_TASK:")) {
    return "START";
  }
  if (model.next_action.startsWith("RUN_EXACT_TEST:")) {
    return "VERIFY";
  }
  if (
    model.proof_freshness === "FAIL"
    || model.proof_freshness === "UNKNOWN"
    || model.proof_freshness === "STALE"
  ) {
    return "REPAIR";
  }
  if (model.next_action.startsWith("CONTINUE_ACTIVE:")) {
    return "WORK";
  }
  if (
    model.next_action.startsWith("FREEZE_TASK:")
    || model.next_action === "PROPOSE_PLAN"
  ) {
    return "PREPARE";
  }
  return "ADVANCE";
}

function oneLineDo(mode: string, model: ReadModel): string {
  switch (mode) {
    case "START":
      return "ohno task start; implement in scope; ohno verify";
    case "WORK":
      return "implement in scope; ohno verify";
    case "VERIFY":
    case "REPAIR":
      return "ohno truth-read --paths .ohno/REQUIREMENTS.md,.ohno/DESIGN.md; "
        + "then fix implement OR plan; ohno verify";
    case "STUCK":
      return "truth-read required paths; fix contract/test or declare-change";
    case "DONE":
      return "this linear plan is complete (not whole product)";
    case "PREPARE":
      return "clarify → ohno phase seal-requirements → write DESIGN → seal-design → plan";
    default:
      return `execute ${model.next_action}`;
  }
}

function topTruthHint(model: ReadModel): string | undefined {
  const targets = model.truth_targets ?? [];
  if (targets.length === 0) {
    return undefined;
  }
  const preferred = targets.filter((path) =>
    /playbook|matrix|accept|REQUIREMENTS|PRODUCT|DESIGN/iu.test(path)
  );
  const pick = (preferred.length > 0 ? preferred : targets).slice(0, 3);
  return pick.join(", ");
}

function automaticContinuation(
  model: ReadModel,
  note?: string,
  failCount = 0,
  pipelineBlock?: string,
  harnessPhase?: string,
): HookOutput {
  const mode = continueMode(model, failCount, harnessPhase);
  const task = model.current_task?.id
    ?? (model.next_action.includes(":")
      ? model.next_action.split(":").slice(1).join(":")
      : "—");
  const lines = [
    // Platform: decision=block + reason = force another agent turn (continue).
    "OHNO_CONTINUE  # decision=block means continue, not stop",
    `mode: ${mode}`,
    `task: ${task}`,
    `proof: ${model.proof_freshness}`,
    `next: ${model.next_action}`,
    `do: ${oneLineDo(mode, model)}`,
    // Field (radar): Agent still spammed 请确认 — ban in short continue card.
    "ask: ONLY secrets / physical devices / account-type / pure business unknowns",
    "ask: NEVER 请确认/请选择/等你回复 for tech, case picks, design, or SOP",
    "latest: re-open .ohno/REQUIREMENTS.md Latest before material decisions",
  ];
  // Continue card only: next action. No stamp/law dump (Owner: background).
  if (pipelineBlock !== undefined && pipelineBlock.trim() !== "") {
    lines.push("", pipelineBlock.trimEnd());
  }
  if (mode === "REPAIR" || mode === "VERIFY" || mode === "STUCK") {
    const hint = topTruthHint(model);
    lines.push(
      "rule: MUST read Truth before any new decision "
        + "(no freestyle without Truth)",
    );
    lines.push(
      "branch: (A) implementation wrong → fix in scope  "
        + "(B) plan/design wrong → update plan/design from Truth then continue",
    );
    if (hint !== undefined) {
      lines.push(`truth: ${hint}`);
    }
  }
  if (mode === "PREPARE") {
    lines.push(
      "rule: clarify ALL demand details before product code; "
        + "Owner prompts are Truth (latest wins)",
    );
  }
  if (failCount > 0) {
    lines.push(`fails: ${failCount}`);
  }
  if (note !== undefined && note.trim() !== "") {
    lines.push(`note: ${note}`);
  }
  if (mode === "STUCK") {
    lines.push(
      "STUCK: repeated FAIL — re-read Truth; fix contract/test or re-walk change; "
        + "do not invent softer tests.",
    );
  } else if (mode !== "DONE") {
    lines.push(
      "auto-adjust under harness; only ohno verify proves done",
    );
  }
  return continuation(lines.join("\n"));
}

/** Agent asked Owner for a non-secret decision — continue with hard anti-ask. */
function looksLikeBannedOwnerAsk(text: string | undefined): boolean {
  if (text === undefined || text.trim() === "") {
    return false;
  }
  // Allow rare secret/device language without treating as banned product ask.
  if (
    /密钥|secret|API[_ ]?KEY|密码|token|设备|平板|真机|AppID|账号类型|登录/iu
      .test(text)
    && !/请确认主推|请确认案例|请选择方案|请确认设计|请确认.*skill/iu.test(text)
  ) {
    // Still ban if it is clearly a case/design confirm even with device words.
    if (!/请确认|请选择|需要你确认|等你回复|是否保留/iu.test(text)) {
      return false;
    }
  }
  // Field (x4/radar): design draft / case board / “wait for your pick” soft stops.
  return /请确认|需要你确认|请选择|等你回复|回复「确认|确认主推|请你决定|要不要我|回复[「"']按这个|需要你确认后|方便你直接选|待\s*Owner\s*批准|待你确认|等你选|等你决定/iu
    .test(text);
}

/**
 * Field (radar): Owner said 先别做 / 先别计划 — auto-continue must not override.
 * Resume phrases in a later Owner prompt clear the pause.
 */
export function looksLikeOwnerResume(text: string): boolean {
  const t = text.trim();
  if (t === "") {
    return false;
  }
  return /^(继续|来吧|好的\s*继续|继续做|继续完成|恢复执行|可以继续|你继续|好了\s*继续|继续刚才)/mu
    .test(t)
    || /继续未完成|继续做完|继续完成目标|继续工作|开始循环/u.test(t);
}

export function looksLikeOwnerPause(text: string): boolean {
  const t = text.trim();
  if (t === "" || looksLikeOwnerResume(t)) {
    return false;
  }
  return /先别做|先别执行|先别自己|现在先别|先别计划|先别开工|先不要做|先别写|先不要执行|先暂停|先别继续做|先别的/u
    .test(t)
    || /等一下\s*[，,]?\s*你先别/u.test(t)
    || /先别.*瞎猜|先别.*计划|现在先别做/u.test(t);
}

/** Last decisive pause/resume in OWNER-INPUTS wins (scan a short tail). */
async function ownerWorkIsPaused(projectPath: string): Promise<boolean> {
  try {
    const { readOwnerInputs } = await import("../owner-inputs.js");
    const text = await readOwnerInputs(projectPath);
    const blocks = [...text.matchAll(/```text\r?\n([\s\S]*?)\r?\n```/gu)];
    const start = Math.max(0, blocks.length - 12);
    for (let i = blocks.length - 1; i >= start; i -= 1) {
      const body = blocks[i]?.[1] ?? "";
      if (looksLikeOwnerResume(body)) {
        return false;
      }
      if (looksLikeOwnerPause(body)) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

async function handleStop(
  projectPath: string,
  input: HookInput,
): Promise<HookOutput> {
  const markers = completionMarkers(input.last_assistant_message);
  const inputMarkers = needsInputMarkers(input.last_assistant_message);
  const bannedAsk = looksLikeBannedOwnerAsk(
    typeof input.last_assistant_message === "string"
      ? input.last_assistant_message
      : undefined,
  );

  let state;
  try {
    state = await readState(projectPath);
  } catch {
    if (markers.length === 0 && inputMarkers.length === 0 && !bannedAsk) {
      return {};
    }
    return continuation(
      "Oh No state is unavailable; repair .ohno/state.json in this cwd "
        + "(git rev-parse --show-toplevel) then ohno doctor.",
    );
  }

  const currentId = state.active_task?.id;
  const completedId = state.completed.at(-1)?.id;
  const model = await readModel(projectPath);
  const failCount = state.last_verification?.consecutive_failures ?? 0;
  const harnessPhase = effectiveHarness(state).phase;
  const pipelineBlock = formatPipelineNext(state, model.next_action, {
    rails: "none",
  });
  const cont = (note?: string) =>
    automaticContinuation(model, note, failCount, pipelineBlock, harnessPhase);

  // Field (radar): Owner pause beats auto-continue / phase inject / anti-ask.
  // Completion markers still force the verify path (do not fake-done under pause).
  if (
    markers.length === 0
    && inputMarkers.length === 0
    && await ownerWorkIsPaused(projectPath)
  ) {
    return {};
  }

  // Field (Desktop mid-enable): per-session SessionStart missing — do NOT
  // auto REOPEN/CONTINUE old board work. Force re-bind (Correction 6R).
  if (markers.length === 0 && inputMarkers.length === 0) {
    const runtime = await readHooksRuntime(projectPath);
    const sid =
      typeof input.session_id === "string" ? input.session_id : undefined;
    if (sessionBootstrapRequired(runtime, sid)) {
      return {
        decision: "block",
        reason: [
          "OHNO_AUTO_CONTINUE",
          "HOOK_BOOTSTRAP_REQUIRED / OWNER_HISTORY_INCOMPLETE: hooks became "
            + "active mid-session (this session had no SessionStart).",
          "mode: BOOTSTRAP",
          "next: REBIND_LATEST_AND_CONFIRM_GOAL",
          "do: re-read Latest REQUIREMENTS + current Owner chat; do NOT reopen "
            + "old REOPEN_TASK/CONTINUE_ACTIVE until the active goal is confirmed",
          "prefer: new Codex session after /hooks trust so SessionStart runs",
        ].join("\n"),
      };
    }
  }

  // Field (radar): Agent stopped to 请确认 cases/design — force continue.
  if (
    bannedAsk
    && markers.length === 0
    && state.plan_revision !== null
  ) {
    return cont(
      "ANTI_ASK: do not wait for Owner confirm on cases/design/tech/SOP — "
        + "self-decide smallest path under Latest REQUIREMENTS, implement, "
        + "ohno verify. Ask only secrets/devices/account-type.",
    );
  }

  // Non-EXECUTE phases: always inject pipeline (do not freestyle product work).
  if (
    state.harness != null
    && harnessPhase !== "OPEN"
    && harnessPhase !== "EXECUTE"
    && markers.length === 0
    && inputMarkers.length === 0
  ) {
    return cont(`phase ${harnessPhase}: follow OHNO_PIPELINE exactly`);
  }

  // NEEDS_INPUT is not an Owner-handoff stop. Under an accepted plan it only
  // adds recovery guidance; the turn must continue (re-read Truth, re-approach).
  if (inputMarkers.length > 0) {
    if (
      inputMarkers.some(({ hasExactStartBoundary }) => !hasExactStartBoundary)
    ) {
      const note = "OHNO_NEEDS_INPUT is not a stop hatch; marker must be "
        + "token-bounded as OHNO_NEEDS_INPUT:<active-task-id>. Re-read Truth "
        + "docs and continue inside the contract.";
      return state.plan_revision === null
        ? continuation(note)
        : cont(note);
    }
    const wrongInputId = inputMarkers
      .map(({ id }) => id)
      .find((id) => id !== currentId);
    if (currentId === undefined || wrongInputId !== undefined) {
      const note = `OHNO_NEEDS_INPUT id ${wrongInputId ?? inputMarkers[0]?.id} `
        + `does not match active ${currentId ?? "NONE"}; re-read Truth docs `
        + "and continue — do not stop to ask the Owner.";
      return state.plan_revision === null
        ? continuation(note)
        : cont(note);
    }
    return state.plan_revision === null
      ? continuation(
        "OHNO_NEEDS_INPUT is ignored as a stop. No accepted plan yet — "
          + "finish PREPARE from Truth docs; do not block on Owner chat.",
      )
      : cont(
        "OHNO_NEEDS_INPUT is recovery only: re-read Truth, stay in scope, "
          + "ohno verify — never invent secret values.",
      );
  }
  if (markers.some(({ hasExactStartBoundary }) => !hasExactStartBoundary)) {
    const note = "Exact completion marker required; it must be token-bounded: "
      + "OHNO_COMPLETE:<task-id>.";
    return state.plan_revision === null
      ? continuation(note)
      : cont(note);
  }

  const expectedIds = [currentId, completedId].filter(
    (value): value is string => value !== undefined,
  );
  const wrongId = markers
    .map(({ id }) => id)
    .find((marker) => !expectedIds.includes(marker));
  if (wrongId !== undefined) {
    const note = `Wrong task id ${wrongId}; expected ${currentId ?? completedId ?? "NONE"}.`;
    return state.plan_revision === null
      ? continuation(note)
      : cont(note);
  }

  if (needsAcceptanceBasisMigration(state)) {
    return state.plan_revision === null
      ? continuation(
        "next is MIGRATE_ACCEPTANCE_BASIS; run "
          + "ohno migrate acceptance-basis --file <structured-basis.json>",
      )
      : cont();
  }

  const marker = markers[0]?.id;
  if (
    marker !== undefined
    && marker === completedId
    && model.proof_freshness === "FRESH"
  ) {
    return model.next_action === "PROJECT_COMPLETE"
      ? {}
      : cont();
  }

  if (marker !== undefined) {
    const stalePrefix = model.proof_freshness === "STALE" ? "STALE: " : "";
    const note = `${stalePrefix}fresh PASS evidence is required for `
      + `${marker ?? currentId ?? completedId ?? "the task"}; run ohno verify.`;
    return state.plan_revision === null
      ? continuation(note)
      : cont(note);
  }

  if (model.next_action === "PROJECT_COMPLETE") {
    return {};
  }
  if (state.plan_revision !== null) {
    return cont();
  }
  return {};
}

async function capsule(projectPath: string): Promise<string> {
  // Resume (≤4KiB) includes PROMPT_RAILS stamp; full rails on Stop / UserPromptSubmit.
  return serializeResumeWithWorktrees(
    await readModel(projectPath),
    projectPath,
  );
}

export async function handleCodexHook(
  input: HookInput,
): Promise<HookOutput> {
  const projectPath = findProjectRoot(input.cwd);
  const sessionId =
    typeof input.session_id === "string" ? input.session_id : undefined;
  if (input.hook_event_name === "SessionStart") {
    await recordHookRuntimeEvent(projectPath, "SessionStart", sessionId);
    return {
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: await capsule(projectPath),
      },
    };
  }
  if (input.hook_event_name === "PostCompact") {
    await recordHookRuntimeEvent(projectPath, "PostCompact", sessionId);
    return {
      systemMessage: await capsule(projectPath),
    };
  }
  if (input.hook_event_name === "UserPromptSubmit") {
    if (
      typeof input.session_id !== "string"
      || typeof input.turn_id !== "string"
      || typeof input.prompt !== "string"
    ) {
      throw new Error(
        "UserPromptSubmit requires session_id, turn_id, and prompt",
      );
    }
    // Synthetic Stop-continue prompts are not Owner Truth and must not log.
    if (input.prompt.startsWith(`${automaticContinuationPrefix}\n`)) {
      return {};
    }
    // Desktop host noise (personalized suggestions, etc.) must not become
    // Owner authority / Latest / change triggers (field radar Desktop).
    if (looksLikeHostSystemCapture(input.prompt)) {
      await recordHookRuntimeEvent(
        projectPath,
        "UserPromptSubmit",
        input.session_id,
        { ownerInput: false },
      );
      return {};
    }
    await recordHookRuntimeEvent(
      projectPath,
      "UserPromptSubmit",
      input.session_id,
      { ownerInput: true },
    );
    const { appendOwnerInput } = await import("../owner-inputs.js");
    const {
      projectLatestOwnerWords,
    } = await import("../harness.js");
    const logged = await appendOwnerInput(projectPath, {
      sessionId: input.session_id,
      turnId: input.turn_id,
      prompt: input.prompt,
    });
    await projectLatestOwnerWords(
      projectPath,
      input.prompt,
      logged.id,
    ).catch(() => undefined);
    // Mid-task Latest re-bind: Owner spoke → REQUIREMENTS changed → refresh
    // truth-read so verify cannot pass on obsolete Latest (radar field).
    const { rebindLatestAfterOwnerPrompt } = await import("../harness.js");
    await rebindLatestAfterOwnerPrompt(projectPath).catch(() => undefined);
    const parts: string[] = [];
    const autoChange = await maybeAutoDeclareChangeFromPrompt(
      projectPath,
      input.prompt,
    );
    if (autoChange !== null) {
      parts.push(autoChange.trimEnd());
    }
    // Every real Owner prompt re-binds the Agent to the live pipeline phase.
    try {
      const state = await readState(projectPath);
      const model = await readModel(projectPath);
      parts.push(
        formatPipelineNext(state, model.next_action, { rails: "none" })
          .trimEnd(),
      );
      parts.push(
        "latest: REQUIREMENTS re-bound after this Owner message — "
          + "follow Latest; do not keep obsolete case/SOP choices",
      );
    } catch {
      // state missing: still return change note if any
    }
    // Field (radar): explicit pause must win over Stop auto-continue.
    if (looksLikeOwnerPause(input.prompt)) {
      parts.push(
        "OWNER_PAUSE: Owner ordered a pause. Do NOT plan accept, task start, "
          + "product code, or freestyle next steps until Owner clearly says "
          + "continue. Documentation notes only if Owner asked for them.",
      );
    } else if (looksLikeOwnerResume(input.prompt)) {
      parts.push(
        "OWNER_RESUME: Owner released the pause — follow OHNO_PIPELINE + Latest.",
      );
    }
    if (parts.length === 0) {
      return {};
    }
    return {
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: parts.join("\n\n"),
      },
    };
  }
  if (input.hook_event_name === "PreToolUse") {
    await recordHookRuntimeEvent(projectPath, "PreToolUse", sessionId);
    return handlePreToolUse(projectPath, input);
  }
  if (input.hook_event_name === "Stop") {
    await recordHookRuntimeEvent(projectPath, "Stop", sessionId);
    return handleStop(projectPath, input);
  }
  throw new Error(`unsupported hook event ${input.hook_event_name}`);
}
