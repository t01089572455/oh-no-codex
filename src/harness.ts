/**
 * Owner-vision harness control: phase gates, seals, truth-read receipts.
 * Human surface stays tiny; Agent/hooks call these internals.
 */

import { createHash } from "node:crypto";
import {
  access,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  formatOwnerPromptRails,
  formatOwnerPromptRailsStamp,
} from "./prompt-rails.js";
import {
  compareAndSwapStateAtomic,
  readState,
} from "./state.js";
import type {
  HarnessControl,
  HarnessPhase,
  ProjectState,
  TruthReadReceipt,
} from "./state.js";

export {
  formatOwnerPromptRails,
  formatOwnerPromptRailsStamp,
} from "./prompt-rails.js";

export const REQUIREMENTS_PATH = ".ohno/REQUIREMENTS.md";
export const OWNER_INPUTS_PATH = ".ohno/OWNER-INPUTS.md";
export const DESIGN_PATH = ".ohno/DESIGN.md";

const PRODUCT_CODE =
  /^(src|lib|app|apps|packages|services|server|cmd|internal|miniprogram|cloudfunctions)\//iu;

export function defaultHarness(): HarnessControl {
  return {
    phase: "DISCOVER",
    requirements_digest: null,
    design_digest: null,
    truth_read: null,
    owner_head: null,
  };
}

export function effectiveHarness(state: ProjectState): HarnessControl {
  if (state.harness == null) {
    return {
      phase: "OPEN",
      requirements_digest: null,
      design_digest: null,
      truth_read: null,
      owner_head: null,
    };
  }
  const read = state.harness.truth_read;
  return {
    phase: state.harness.phase,
    requirements_digest: state.harness.requirements_digest,
    design_digest: state.harness.design_digest,
    owner_head: state.harness.owner_head ?? null,
    truth_read: read == null
      ? null
      : {
        read_at: read.read_at,
        paths: read.paths,
        paths_digest: read.paths_digest,
        mode: read.mode === "B" ? "B" : "A",
      },
  };
}

/** Legacy OPEN = pre-0.3 projects: no phase gates. */
export function isOpenHarness(state: ProjectState): boolean {
  return state.harness == null || state.harness.phase === "OPEN";
}

export function phaseAllowsProductCode(state: ProjectState): boolean {
  if (isOpenHarness(state)) {
    return true;
  }
  const phase = effectiveHarness(state).phase;
  return phase === "EXECUTE" || phase === "RECOVER";
}

export function productCodeBlockedReason(state: ProjectState): string | null {
  if (phaseAllowsProductCode(state)) {
    return null;
  }
  const phase = effectiveHarness(state).phase;
  if (phase === "DISCOVER") {
    return "phase DISCOVER: clarify ALL requirements first; "
      + "seal with `ohno phase seal-requirements` before product code";
  }
  if (phase === "DESIGN") {
    return "phase DESIGN: finish design then `ohno phase seal-design` "
      + "and accept a plan before product code";
  }
  if (phase === "PLAN_READY") {
    return "phase PLAN_READY: run plan propose/accept then task start "
      + "before product code";
  }
  if (phase === "CHANGE") {
    return "phase CHANGE: re-clarify, seal requirements+design, new plan "
      + "before product code again";
  }
  return `phase ${phase}: product code not allowed`;
}

export function looksLikeProductPath(relativePath: string): boolean {
  const path = relativePath.replaceAll("\\", "/");
  if (PRODUCT_CODE.test(path)) {
    return true;
  }
  // Loose product sources at repo root
  return /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|swift|cs)$/iu.test(path)
    && !path.startsWith(".ohno/")
    && !path.startsWith("docs/")
    && !path.startsWith("test/")
    && !path.startsWith("tests/")
    && path !== "AGENTS.md";
}

async function fileDigest(
  projectPath: string,
  relativePath: string,
): Promise<string | null> {
  try {
    const bytes = await readFile(resolve(projectPath, relativePath));
    return createHash("sha256").update(bytes).digest("hex");
  } catch {
    return null;
  }
}

async function combinedDigest(
  projectPath: string,
  relativePaths: string[],
): Promise<string> {
  const hash = createHash("sha256");
  hash.update("ohno-seal-v1\n");
  for (const relative of relativePaths) {
    hash.update(relative);
    hash.update("\0");
    const absolute = resolve(projectPath, relative);
    try {
      hash.update(await readFile(absolute));
    } catch {
      hash.update("MISSING\n");
    }
    hash.update("\n");
  }
  return hash.digest("hex");
}

function nonTrivialMarkdown(text: string): boolean {
  const body = text
    .replace(/^#.*$/gmu, "")
    .replace(/Project initialized/giu, "")
    .replace(/Default working method/giu, "")
    .replace(/Owner intent \(test seal\)/giu, "")
    .trim();
  if (Buffer.byteLength(body, "utf8") < 120) {
    return false;
  }
  // Require at least two intent signals so seal is not empty padding.
  const signals = [
    /目标|goal|intent|需求|requirement/iu,
    /验收|accept|expect|用户可见|user-visible|black.?box|测试/iu,
    /非目标|non-?goal|不做|out of scope|不包含/iu,
    /约束|constraint|必须|must|禁止|forbid/iu,
  ];
  const hits = signals.filter((re) => re.test(body)).length;
  return hits >= 2;
}

/**
 * Owner prompt likely means requirements changed (auto-enter CHANGE).
 * Conservative: only clear pivot language, not ordinary "continue".
 */
export function looksLikeRequirementChangePrompt(prompt: string): boolean {
  const text = prompt.trim();
  if (text.length < 4) {
    return false;
  }
  if (
    /^(继续|go on|continue|接着|往下|verify|验收|测一下|ohno\b)/iu.test(text)
  ) {
    return false;
  }
  return (
    /需求\s*(变了|变更|改了|调整|更新)|改(一?下)?需求|新需求|需求变更/u.test(text)
    || /requirements?\s+(changed|change|update)|change\s+the\s+requirements?/iu
      .test(text)
    || /不要\s*.{0,40}了|取消(这个|该)?(功能|需求)|推翻|推倒重来|重新来过/u
      .test(text)
    || /\bpivot\b|\bscrap\b|\bfrom\s+scratch\b|\brestart\s+the\s+plan\b/iu
      .test(text)
    || /换成|改为|改成|instead\s+we\s+(need|want)|不再(做|要)/iu.test(text)
  );
}

/** Paths that RECOVER truth-read must cover (subset match). */
export function requiredTruthReadPaths(state: ProjectState): string[] {
  const required = [REQUIREMENTS_PATH];
  if (effectiveHarness(state).design_digest != null) {
    required.push(DESIGN_PATH);
  }
  const truth = state.truth_inventory.classification
    .filter((entry) => entry.truth_target)
    .map((entry) => entry.path)
    .filter((path) =>
      /REQUIREMENTS|DESIGN|playbook|matrix|ACCEPT|PRODUCT|PLAN/iu.test(path)
    )
    .slice(0, 4);
  for (const path of truth) {
    if (!required.includes(path)) {
      required.push(path);
    }
  }
  return required;
}

/**
 * Fresh receipt must include every required path (or a parent path prefix).
 */
export function truthReadSatisfiesRecover(state: ProjectState): boolean {
  if (!truthReadIsFresh(state)) {
    return false;
  }
  const receipt = effectiveHarness(state).truth_read;
  if (receipt == null) {
    return false;
  }
  const read = new Set(receipt.paths.map((path) => path.replaceAll("\\", "/")));
  for (const need of requiredTruthReadPaths(state)) {
    const ok = [...read].some(
      (path) => path === need || path.endsWith(`/${need}`) || need.endsWith(`/${path}`),
    );
    if (!ok) {
      return false;
    }
  }
  return true;
}

/** True when a fresh truth-read covers REQUIREMENTS (Latest surface). */
export function truthReadCoversRequirements(state: ProjectState): boolean {
  if (!truthReadIsFresh(state)) {
    return false;
  }
  const receipt = effectiveHarness(state).truth_read;
  if (receipt == null) {
    return false;
  }
  const need = REQUIREMENTS_PATH.replaceAll("\\", "/");
  return receipt.paths.some((path) => {
    const p = path.replaceAll("\\", "/");
    return p === need || p.endsWith(`/${need}`) || need.endsWith(`/${p}`);
  });
}

/**
 * Bind every task start to Owner Latest surface without ceremony.
 * Field (radar): OWNER-INPUTS were large but execution ignored Latest.
 * OPEN legacy harness: no-op.
 */
export async function bindLatestOnTaskStart(
  projectPath: string,
): Promise<string | null> {
  const state = await readState(projectPath);
  if (isOpenHarness(state)) {
    return null;
  }
  if (
    truthReadCoversRequirements(state)
    && await truthReadContentMatches(projectPath, state)
  ) {
    return null;
  }
  // Prefer full recover set when design is sealed; always include REQUIREMENTS.
  const paths = requiredTruthReadPaths(state);
  const out = await recordTruthRead(projectPath, paths, "A");
  return out.trimEnd();
}

/**
 * Re-hash receipt paths; false when Latest/REQUIREMENTS changed since last read.
 */
export async function truthReadContentMatches(
  projectPath: string,
  state: ProjectState,
): Promise<boolean> {
  const receipt = effectiveHarness(state).truth_read;
  if (receipt == null || receipt.paths.length === 0) {
    return false;
  }
  const digests: string[] = [];
  for (const relative of receipt.paths) {
    const digest = await fileDigest(projectPath, relative);
    if (digest === null) {
      return false;
    }
    digests.push(`${relative.replaceAll("\\", "/")}=${digest}`);
  }
  const now = createHash("sha256").update(digests.join("\n")).digest("hex");
  return now === receipt.paths_digest;
}

/**
 * After every real Owner prompt: rewrite Latest (caller) then re-bind receipts
 * so ACTIVE work cannot keep an obsolete REQUIREMENTS digest.
 */
export async function rebindLatestAfterOwnerPrompt(
  projectPath: string,
): Promise<string | null> {
  const state = await readState(projectPath);
  if (isOpenHarness(state)) {
    return null;
  }
  const phase = effectiveHarness(state).phase;
  if (
    phase !== "EXECUTE"
    && phase !== "RECOVER"
    && phase !== "PLAN_READY"
    && state.active_task === null
  ) {
    // DISCOVER/DESIGN still benefit from REQUIREMENTS bind when sealing soon.
    if (phase !== "DISCOVER" && phase !== "CHANGE" && phase !== "DESIGN") {
      return null;
    }
  }
  const paths = requiredTruthReadPaths(state);
  const mode =
    phase === "RECOVER" && effectiveHarness(state).truth_read?.mode === "B"
      ? "B" as const
      : "A" as const;
  const out = await recordTruthRead(projectPath, paths, mode);
  return out.trimEnd();
}

/**
 * Ensure Latest is bound before verify. Auto-rebinds when receipts are missing
 * or REQUIREMENTS content moved (including projector rewrites after task start).
 * Does not throw for OPEN harness.
 */
export async function ensureLatestBoundForVerify(
  projectPath: string,
): Promise<string | null> {
  const state = await readState(projectPath);
  if (isOpenHarness(state)) {
    return null;
  }
  if (
    truthReadCoversRequirements(state)
    && await truthReadContentMatches(projectPath, state)
  ) {
    return null;
  }
  const paths = requiredTruthReadPaths(state);
  const mode =
    effectiveHarness(state).phase === "RECOVER"
    && effectiveHarness(state).truth_read?.mode === "B"
      ? "B" as const
      : "A" as const;
  return (await recordTruthRead(projectPath, paths, mode)).trimEnd();
}

export function bashLooksLikeMutation(command: string): boolean {
  const cmd = command.trim();
  if (cmd === "") {
    return false;
  }
  // Read-only / status-ish: allow under DISCOVER.
  if (
    /^(git\s+(status|log|diff|show|branch|rev-parse)|ls|dir|type|cat|Get-Content|rg|findstr|ohno\s+)/iu
      .test(cmd)
    && !/(>|>>|Out-File|Set-Content|Remove-Item|rm\s|del\s)/iu.test(cmd)
  ) {
    return false;
  }
  return (
    /(^|[;&|\n]\s*)(rm\s|del\s|Remove-Item|mv\s|move\s|cp\s|copy\s|tee\s|sed\s+-i)/iu
      .test(cmd)
    || /(>|\bOut-File\b|\bSet-Content\b|\bAdd-Content\b|\bNew-Item\b)/iu.test(cmd)
    || /\bnpm\s+(install|i|uninstall)\b|\bpnpm\s+add\b|\byarn\s+add\b/iu.test(cmd)
  );
}

/**
 * Seal requirements after DISCOVER (or CHANGE).
 * Requires non-trivial REQUIREMENTS.md (Owner intent captured).
 */
export async function sealRequirements(projectPath: string): Promise<string> {
  const state = await readState(projectPath);
  let requirements: string;
  try {
    requirements = await readFile(
      resolve(projectPath, REQUIREMENTS_PATH),
      "utf8",
    );
  } catch {
    throw new Error(
      `missing ${REQUIREMENTS_PATH}; capture Owner intent (notes / Codex) first`,
    );
  }
  if (!nonTrivialMarkdown(requirements)) {
    throw new Error(
      `${REQUIREMENTS_PATH} is too thin for seal; clarify demand details `
        + "(need substantial Owner-intent prose: goal/acceptance/non-goals)",
    );
  }
  // Prefer real Owner prompts on ledger; allow Latest Owner section as proxy.
  let ownerInputs = "";
  try {
    ownerInputs = await readFile(resolve(projectPath, OWNER_INPUTS_PATH), "utf8");
  } catch {
    ownerInputs = "";
  }
  const hasLedger = /^## Input `/mu.test(ownerInputs)
    || /## Latest Owner words/u.test(requirements);
  if (!hasLedger) {
    throw new Error(
      "no Owner prompt ledger yet; talk to Codex first so prompts land in "
        + "OWNER-INPUTS / Latest Owner words, then seal",
    );
  }
  const digest = await combinedDigest(projectPath, [
    REQUIREMENTS_PATH,
    OWNER_INPUTS_PATH,
  ]);
  const ok = await compareAndSwapStateAtomic(projectPath, state, {
    ...state,
    harness: {
      phase: "DESIGN",
      requirements_digest: digest,
      design_digest: null,
      truth_read: null,
      owner_head: effectiveHarness(state).owner_head,
    },
  });
  if (!ok) {
    throw new Error("state changed while sealing requirements");
  }
  // Give Codex a design file to fill (not seal-ready stub alone).
  await ensureDesignStub(projectPath);
  return (
    `SEALED_REQUIREMENTS: ${digest}\n`
    + "PHASE: DESIGN\n"
    + `OWNER_HEAD: ${effectiveHarness(state).owner_head ?? "none"}\n`
    + "Next: expand .ohno/DESIGN.md (full route OK) then "
    + "`ohno phase seal-design` (or `ohno phase advance`)\n"
  );
}

/**
 * Seal design after DESIGN phase.
 */
export async function sealDesign(projectPath: string): Promise<string> {
  const state = await readState(projectPath);
  const current = effectiveHarness(state);
  if (state.harness != null) {
    if (current.phase === "EXECUTE" || current.phase === "RECOVER") {
      throw new Error(
        `cannot seal design in phase ${current.phase}; `
          + "run `ohno phase declare-change` first",
      );
    }
    if (current.requirements_digest == null && current.phase !== "OPEN") {
      throw new Error(
        "requirements not sealed; run `ohno phase seal-requirements` first",
      );
    }
  }

  const designPath = resolve(projectPath, DESIGN_PATH);
  let design: string;
  try {
    design = await readFile(designPath, "utf8");
  } catch {
    throw new Error(
      `missing ${DESIGN_PATH}; Codex must write detailed design + route first`,
    );
  }
  if (!nonTrivialMarkdown(design)) {
    throw new Error(
      `${DESIGN_PATH} is too thin; write real design/route before seal`,
    );
  }
  const digest = await combinedDigest(projectPath, [DESIGN_PATH]);
  const requirementsDigest = current.requirements_digest
    ?? await combinedDigest(projectPath, [REQUIREMENTS_PATH, OWNER_INPUTS_PATH]);
  const ok = await compareAndSwapStateAtomic(projectPath, state, {
    ...state,
    harness: {
      phase: "PLAN_READY",
      requirements_digest: requirementsDigest,
      design_digest: digest,
      truth_read: null,
      owner_head: current.owner_head,
    },
  });
  if (!ok) {
    throw new Error("state changed while sealing design");
  }
  return (
    `SEALED_DESIGN: ${digest}\n`
    + "PHASE: PLAN_READY\n"
    + "Next: plan propose/accept (id+expect+test+scope), then task start\n"
  );
}

/**
 * Record that Truth paths were actually read (file bytes hashed).
 * mode A = fix implementation; mode B = fix plan/design.
 */
export async function recordTruthRead(
  projectPath: string,
  relativePaths: string[],
  mode: "A" | "B" = "A",
): Promise<string> {
  const state = await readState(projectPath);
  let paths = relativePaths.map((path) => path.replaceAll("\\", "/"));
  if (paths.length === 0) {
    paths = requiredTruthReadPaths(state);
  }
  if (paths.length === 0) {
    throw new Error("truth-read needs at least one project-relative path");
  }
  const digests: string[] = [];
  for (const relative of paths) {
    const digest = await fileDigest(projectPath, relative);
    if (digest === null) {
      throw new Error(`cannot read Truth path: ${relative}`);
    }
    digests.push(`${relative}=${digest}`);
  }
  const pathsDigest = createHash("sha256")
    .update(digests.join("\n"))
    .digest("hex");
  const receipt: TruthReadReceipt = {
    read_at: new Date().toISOString(),
    paths,
    paths_digest: pathsDigest,
    mode,
  };
  const nextHarness: HarnessControl = {
    ...effectiveHarness(state),
    truth_read: receipt,
  };
  if (state.harness == null) {
    nextHarness.phase = "OPEN";
  }
  const ok = await compareAndSwapStateAtomic(projectPath, state, {
    ...state,
    harness: nextHarness,
  });
  if (!ok) {
    throw new Error("state changed while recording truth-read");
  }
  return (
    `TRUTH_READ: ${pathsDigest}\n`
    + `MODE: ${mode} (${mode === "A" ? "fix implementation" : "fix plan/design"})\n`
    + `PATHS: ${paths.join(", ")}\n`
    + `AT: ${receipt.read_at}\n`
  );
}

/**
 * Project every Owner prompt into REQUIREMENTS (latest-wins log).
 * Raw full text remains in OWNER-INPUTS; this is the working Truth surface.
 */
export async function projectLatestOwnerWords(
  projectPath: string,
  prompt: string,
  inputId: string,
): Promise<void> {
  const reqPath = resolve(projectPath, REQUIREMENTS_PATH);
  await mkdir(dirname(reqPath), { recursive: true });
  let existing = "";
  try {
    existing = await readFile(reqPath, "utf8");
  } catch {
    existing = "# Requirements\n\n";
  }
  const stamp = new Date().toISOString();
  const block = [
    "",
    "## Latest Owner words (auto, latest wins)",
    "",
    `- **at:** ${stamp}`,
    `- **input_id:** \`${inputId}\``,
    "",
    "```text",
    prompt.trim().slice(0, 4_000),
    "```",
    "",
    "> Older Owner words remain above/in OWNER-INPUTS. **Latest entry wins** on conflict.",
    "",
  ].join("\n");
  // Replace previous auto section or append.
  const marker = "## Latest Owner words (auto, latest wins)";
  const idx = existing.indexOf(marker);
  const base = idx === -1 ? existing : existing.slice(0, idx).trimEnd();
  await writeFile(reqPath, `${base}\n${block}`, "utf8");

  // Bind owner_head on harness when present.
  try {
    const state = await readState(projectPath);
    if (state.harness == null) {
      return;
    }
    await compareAndSwapStateAtomic(projectPath, state, {
      ...state,
      harness: {
        ...effectiveHarness(state),
        owner_head: inputId,
      },
    });
  } catch {
    // non-fatal
  }
}

export function truthReadIsFresh(
  state: ProjectState,
  maxAgeMs = 2 * 60 * 60 * 1000,
): boolean {
  const receipt = effectiveHarness(state).truth_read;
  if (receipt == null) {
    return false;
  }
  const at = Date.parse(receipt.read_at);
  if (Number.isNaN(at)) {
    return false;
  }
  return Date.now() - at <= maxAgeMs;
}

/**
 * Auto-revoke EXECUTE when Owner prompt signals requirement change.
 * Returns message if phase flipped; null if no-op.
 */
export async function maybeAutoDeclareChangeFromPrompt(
  projectPath: string,
  prompt: string,
): Promise<string | null> {
  if (!looksLikeRequirementChangePrompt(prompt)) {
    return null;
  }
  let state: ProjectState;
  try {
    state = await readState(projectPath);
  } catch {
    return null;
  }
  if (state.harness == null || state.harness.phase === "OPEN") {
    return null;
  }
  const phase = state.harness.phase;
  if (
    phase !== "EXECUTE"
    && phase !== "RECOVER"
    && phase !== "PLAN_READY"
  ) {
    return null;
  }
  // Only revoke when there is something to revoke (plan or active work).
  if (state.plan_revision == null && state.active_task == null) {
    return null;
  }
  const summary = prompt.trim().slice(0, 200);
  await declareHarnessChange(projectPath, summary);
  return (
    "AUTO_CHANGE: Owner prompt looks like a requirement change. "
    + "Execution revoked (phase CHANGE). Re-clarify, seal-requirements, "
    + "seal-design, then new plan/tests."
  );
}

/**
 * After verify FAIL: enter RECOVER and clear truth-read (must re-read).
 */
export async function enterRecoverAfterFail(
  projectPath: string,
  previous: ProjectState,
): Promise<void> {
  if (isOpenHarness(previous) && previous.harness == null) {
    return;
  }
  if (previous.harness == null) {
    return;
  }
  const phase = previous.harness.phase;
  if (phase !== "EXECUTE" && phase !== "RECOVER") {
    return;
  }
  const latest = await readState(projectPath);
  if (latest.harness == null) {
    return;
  }
  await compareAndSwapStateAtomic(projectPath, latest, {
    ...latest,
    harness: {
      ...latest.harness,
      phase: "RECOVER",
      truth_read: null,
    },
  });
}

/**
 * After verify PASS with active progression: stay EXECUTE.
 */
export async function markExecuteAfterPass(
  projectPath: string,
  previous: ProjectState,
): Promise<void> {
  if (previous.harness == null) {
    return;
  }
  const latest = await readState(projectPath);
  if (latest.harness == null) {
    return;
  }
  if (
    latest.harness.phase !== "RECOVER"
    && latest.harness.phase !== "EXECUTE"
    && latest.harness.phase !== "PLAN_READY"
  ) {
    return;
  }
  await compareAndSwapStateAtomic(projectPath, latest, {
    ...latest,
    harness: {
      ...latest.harness,
      phase: "EXECUTE",
    },
  });
}

/**
 * Requirement change: revoke execution authority, back to CHANGE/DISCOVER.
 */
export async function declareHarnessChange(
  projectPath: string,
  summary: string,
): Promise<string> {
  if (summary.trim() === "") {
    throw new Error("change summary must be non-empty");
  }
  const state = await readState(projectPath);
  const ok = await compareAndSwapStateAtomic(projectPath, state, {
    ...state,
    status: state.document_sync.status === "PENDING_REVIEW"
      ? state.status
      : "IDLE",
    active_task: null,
    // Keep plan bytes for audit but revoke execution via phase
    harness: {
      phase: "CHANGE",
      requirements_digest: null,
      design_digest: null,
      truth_read: null,
      owner_head: effectiveHarness(state).owner_head,
    },
  });
  if (!ok) {
    throw new Error("state changed while declaring change");
  }
  const note = `${new Date().toISOString()} CHANGE: ${summary.trim()}\n`;
  const reqPath = resolve(projectPath, REQUIREMENTS_PATH);
  try {
    await access(reqPath);
    await writeFile(reqPath, `${await readFile(reqPath, "utf8")}\n${note}`, "utf8");
  } catch {
    await mkdir(dirname(reqPath), { recursive: true });
    await writeFile(reqPath, `# Requirements\n\n${note}`, "utf8");
  }
  return (
    `PHASE: CHANGE\n`
    + "Execution revoked. Re-clarify details, then:\n"
    + "  ohno phase seal-requirements\n"
    + "  ohno phase seal-design\n"
    + "  plan propose/accept with updated expects/tests\n"
    + `SUMMARY: ${summary.trim()}\n`
  );
}

export function assertPlanAcceptAllowed(state: ProjectState): void {
  if (state.harness == null || state.harness.phase === "OPEN") {
    return;
  }
  const { phase, requirements_digest, design_digest } = state.harness;
  if (phase === "DISCOVER" || phase === "CHANGE") {
    throw new Error(
      `HARNESS_GATE: phase ${phase} cannot accept plan; `
        + "seal requirements+design first",
    );
  }
  if (requirements_digest == null) {
    throw new Error(
      "HARNESS_GATE: seal requirements before plan accept "
        + "(`ohno phase seal-requirements`)",
    );
  }
  if (design_digest == null) {
    throw new Error(
      "HARNESS_GATE: seal design before plan accept "
        + "(`ohno phase seal-design`)",
    );
  }
}

export async function onPlanAccepted(projectPath: string): Promise<void> {
  const state = await readState(projectPath);
  if (state.harness == null) {
    return;
  }
  await compareAndSwapStateAtomic(projectPath, state, {
    ...state,
    harness: {
      ...state.harness,
      phase: "EXECUTE",
      truth_read: null,
    },
  });
}

export function harnessBriefLines(state: ProjectState): string[] {
  const h = effectiveHarness(state);
  if (state.harness == null && h.phase === "OPEN") {
    return ["harness: OPEN (legacy — no phase gates)"];
  }
  return [
    `harness.phase: ${h.phase}`,
    `harness.requirements_sealed: ${h.requirements_digest != null}`,
    `harness.design_sealed: ${h.design_digest != null}`,
    `harness.truth_read_ok: ${truthReadSatisfiesRecover(state)}`,
    `harness.owner_head: ${h.owner_head ?? "none"}`,
  ];
}

/**
 * Full Owner prompt rails (lifecycle + 十八宗罪 + solutions).
 * Prompt-first hybrid: this is the semantic law text; structural PreToolUse
 * short hard-deny remains for clear phase/scope/sync/recover only.
 */
export function formatHarnessRulesPrompt(): string {
  return formatOwnerPromptRails();
}

export type PipelineRailsMode = "none" | "stamp" | "full";

/**
 * Exact next commands for Agent (and SessionStart/Stop injection).
 * This is the "internal autopilot script" surface.
 *
 * Rails policy (field-trial: injecting law on high-frequency hooks is spam):
 * - Stop / UserPromptSubmit / bare `ohno` → default **none** (pipeline only)
 * - explicit `ohno pipeline --full` → full law once
 */
export function formatPipelineNext(
  state: ProjectState,
  nextAction = "NONE",
  options: { rails?: PipelineRailsMode } = {},
): string {
  const railsMode: PipelineRailsMode = options.rails ?? "none";
  const h = effectiveHarness(state);
  const need = requiredTruthReadPaths(state).join(",");
  const lines = [
    "OHNO_PIPELINE",
    `phase: ${h.phase}`,
    `plan_next: ${nextAction}`,
  ];
  if (state.document_sync.status === "PENDING_REVIEW") {
    lines.push(
      "blocker: document sync PENDING_REVIEW (coding blocked until accept)",
      "run: ohno change diff",
      "run: ohno change accept --change <id> --diff <sha-from-diff>",
      "rule: Latest Owner words win; do not freestyle product code",
    );
    if (railsMode === "full") {
      lines.push("", formatHarnessRulesPrompt());
    }
    return `${lines.join("\n")}\n`;
  }
  switch (h.phase) {
    case "DISCOVER":
    case "CHANGE":
      lines.push(
        "role: product manager — clarify ALL demand details; tech/arch you decide",
        "write: .ohno/REQUIREMENTS.md (Owner prompts auto-log to OWNER-INPUTS + Latest)",
        "forbid: product code (src/** etc.) until seals",
        "run: ohno phase seal-requirements",
        "or: ohno phase advance   # auto-seal when REQUIREMENTS is ready",
      );
      break;
    case "DESIGN":
      lines.push(
        "role: designer — detailed design + full route from Truth (one-shot OK)",
        "write: .ohno/DESIGN.md (expand stub; not seal-ready until real design)",
        "run: ohno phase seal-design",
        "or: ohno phase advance",
      );
      break;
    case "PLAN_READY":
      lines.push(
        "role: planner — tasks with id+expect+hard test+scope (full board OK)",
        "run: ohno plan propose --file .ohno/review-plan.json",
        "run: ohno plan accept --revision <sha> --diff <sha>",
        "run: ohno task start",
      );
      break;
    case "EXECUTE":
      lines.push(
        "role: implementer — only active scope; no freestyle",
        "latest: open .ohno/REQUIREMENTS.md Latest before changing product direction",
        "ask: never 请确认 for cases/design/tech — only secrets/devices/accounts",
        `run: work then ohno verify   (canonical next: ${nextAction})`,
      );
      break;
    case "RECOVER":
      lines.push(
        "role: recover — MUST read Truth before deciding",
        `PATH_A implement: ohno truth-read --paths ${need} --mode A`,
        "  then fix files in active allowed_files only; ohno verify",
        `PATH_B plan/design: ohno truth-read --paths ${need} --mode B`,
        "  then update DESIGN/plan/expects from Truth; re-accept if needed; verify",
      );
      break;
    case "OPEN":
      lines.push("legacy OPEN: phase gates off; prefer re-setup for full harness");
      break;
    default:
      lines.push(`run: ohno pipeline`);
  }
  if (railsMode === "full") {
    lines.push("", formatHarnessRulesPrompt());
  } else if (railsMode === "stamp") {
    lines.push("", formatOwnerPromptRailsStamp());
  }
  return `${lines.join("\n")}\n`;
}

/**
 * Try to advance seals automatically when files are ready (Agent convenience).
 */
export async function tryPipelineAdvance(
  projectPath: string,
): Promise<string> {
  const state = await readState(projectPath);
  const h = effectiveHarness(state);
  if (h.phase === "OPEN" && state.harness == null) {
    return "PHASE: OPEN (legacy)\n";
  }
  if (h.phase === "DISCOVER" || h.phase === "CHANGE") {
    try {
      return await sealRequirements(projectPath);
    } catch (error) {
      return (
        `BLOCKED_SEAL_REQUIREMENTS: ${
          error instanceof Error ? error.message : String(error)
        }\n`
        + formatPipelineNext(state)
      );
    }
  }
  if (h.phase === "DESIGN") {
    try {
      return await sealDesign(projectPath);
    } catch (error) {
      return (
        `BLOCKED_SEAL_DESIGN: ${
          error instanceof Error ? error.message : String(error)
        }\n`
        + formatPipelineNext(state)
      );
    }
  }
  return formatPipelineNext(state);
}

export async function ensureDesignStub(projectPath: string): Promise<void> {
  const path = resolve(projectPath, DESIGN_PATH);
  try {
    await access(path);
  } catch {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(
      path,
      [
        "# Design (Oh No)",
        "",
        "Replace this stub with detailed design and full route from Truth.",
        "",
      ].join("\n"),
      "utf8",
    );
  }
}

export type { HarnessPhase };
