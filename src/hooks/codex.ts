import { needsAcceptanceBasisMigration } from "../state.js";
import { readModel } from "../read-model.js";
import type { ReadModel } from "../read-model.js";
import { serializeResumeWithWorktrees } from "../resume.js";
import { readState } from "../state.js";
import { isAbsolute } from "node:path";
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

function denial(reason: string): HookOutput {
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: `COOPERATIVE_GUARDRAIL: ${reason}`,
    },
  };
}

function limitation(reason: string): HookOutput {
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      additionalContext:
        `COOPERATIVE_GUARDRAIL limitation: ${reason}; ambiguous call allowed.`,
    },
  };
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

async function handlePreToolUse(
  projectPath: string,
  input: HookInput,
): Promise<HookOutput> {
  const rawTargets = applyPatchTargets(input);
  if (rawTargets === null) {
    if (input.tool_name === "Bash") {
      return limitation("cannot parse arbitrary shell targeting");
    }
    if (
      input.tool_name === "apply_patch"
      || input.tool_name === "Edit"
      || input.tool_name === "Write"
    ) {
      return denial("unsafe or unparseable apply_patch mutation target");
    }
    return limitation("unsupported or unparseable mutation targeting");
  }

  const targets = rawTargets.map((target) =>
    toProjectPath(projectPath, target)
  );
  let state;
  try {
    state = await readState(projectPath);
  } catch {
    return denial(
      "current state is unavailable; repair .ohno/state.json "
      + "or run ohno init",
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
      return {};
    }
    return denial(
      "next is MIGRATE_ACCEPTANCE_BASIS; only .ohno maintenance files may be "
        + "written until: ohno migrate acceptance-basis --file "
        + "<structured-basis.json>. "
        + `Outside: ${displayPaths(outsidePlan)}`,
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
      return {};
    }
    return denial(
      "document sync pending; next is SYNC_GOVERNING_DOCUMENTS; "
      + `mutation outside required paths: ${displayPaths(outsideRequired)}; `
      + `required paths: ${requiredPaths.join(", ")}`,
    );
  }

  if (state.active_task === null) {
    const model = await readModel(projectPath);
    const next = model.next_action;
    // Field trial / 0.1.6: FREEZE_TASK and plan propose need to write review
    // JSON under .ohno/ before task start. Blanket deny created a deadlock
    // (plan propose requires a file; apply_patch was always refused).
    if (isPlanMaintenanceNextAction(next)) {
      const outsidePlan = targets.filter(({ relativePath }) =>
        relativePath === null
        || !isOhnoPlanMaintenancePath(relativePath)
      );
      if (outsidePlan.length === 0) {
        return {};
      }
      return denial(
        `no active task; next is ${next}; only .ohno plan/maintenance files `
        + `(not state.json) may be written before task start. `
        + `Outside: ${displayPaths(outsidePlan)}. `
        + "Write .ohno/*plan*.json then: ohno plan propose --file … "
        + "&& ohno plan accept --revision … --diff …",
      );
    }
    return denial(
      `no active task; next is ${next}`,
    );
  }

  const outside = pathsOutsideGlobs(
    targets,
    state.active_task.allowed_files,
  );
  if (outside.length > 0) {
    return denial(
      `outside active task scope: ${displayPaths(outside)}; allowed: `
      + state.active_task.allowed_files.join(", "),
    );
  }
  return {};
}

/** Next actions where agents must author a plan file without an ACTIVE task. */
function isPlanMaintenanceNextAction(nextAction: string): boolean {
  return nextAction === "PROPOSE_PLAN"
    || nextAction === "PROJECT_COMPLETE"
    || nextAction.startsWith("FREEZE_TASK:");
}

/**
 * Cooperative allowance: plan review JSON and related maintenance under
 * `.ohno/`, never the sole authority `state.json`.
 */
function isOhnoPlanMaintenancePath(relativePath: string): boolean {
  if (relativePath === ".ohno/state.json") {
    return false;
  }
  if (!relativePath.startsWith(".ohno/")) {
    return false;
  }
  // Runtime pointer only — agents should use ohno cockpit, not hand-edit.
  if (relativePath === ".ohno/cockpit.runtime.json") {
    return false;
  }
  return relativePath.endsWith(".json")
    || relativePath.endsWith(".md");
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

function automaticContinuation(
  model: ReadModel,
  note?: string,
): HookOutput {
  return continuation([
    ...(note === undefined ? [] : [`NOTE: ${note}`]),
    `PROOF: ${model.proof_freshness}`,
    `BLOCKER: ${model.blocker}`,
    `CANONICAL_NEXT: ${model.next_action}`,
    "Continue autonomously under the accepted plan without asking the Owner "
      + "to confirm start, continue, repair, verify, or task transition.",
  ].join("\n"));
}

async function handleStop(
  projectPath: string,
  input: HookInput,
): Promise<HookOutput> {
  const markers = completionMarkers(input.last_assistant_message);
  const inputMarkers = needsInputMarkers(input.last_assistant_message);

  let state;
  try {
    state = await readState(projectPath);
  } catch {
    if (markers.length === 0 && inputMarkers.length === 0) {
      return {};
    }
    return continuation(
      "Oh No state is unavailable; repair it before using a completion marker.",
    );
  }

  const currentId = state.active_task?.id;
  const completedId = state.completed.at(-1)?.id;
  const model = await readModel(projectPath);

  if (inputMarkers.length > 0) {
    if (
      inputMarkers.some(({ hasExactStartBoundary }) => !hasExactStartBoundary)
    ) {
      const note = "Exact NEEDS_INPUT marker required; it must be token-bounded: "
        + "OHNO_NEEDS_INPUT:<active-task-id>.";
      return state.plan_revision === null
        ? continuation(note)
        : automaticContinuation(model, note);
    }
    const wrongInputId = inputMarkers
      .map(({ id }) => id)
      .find((id) => id !== currentId);
    if (currentId === undefined || wrongInputId !== undefined) {
      const note = `Wrong NEEDS_INPUT task id ${wrongInputId ?? inputMarkers[0]?.id}; `
        + `expected active task ${currentId ?? "NONE"}.`;
      return state.plan_revision === null
        ? continuation(note)
        : automaticContinuation(model, note);
    }
    return {};
  }

  if (markers.some(({ hasExactStartBoundary }) => !hasExactStartBoundary)) {
    const note = "Exact completion marker required; it must be token-bounded: "
      + "OHNO_COMPLETE:<task-id>.";
    return state.plan_revision === null
      ? continuation(note)
      : automaticContinuation(model, note);
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
      : automaticContinuation(model, note);
  }

  if (needsAcceptanceBasisMigration(state)) {
    return state.plan_revision === null
      ? continuation(
        "next is MIGRATE_ACCEPTANCE_BASIS; run "
          + "ohno migrate acceptance-basis --file <structured-basis.json>",
      )
      : automaticContinuation(model);
  }

  const marker = markers[0]?.id;
  if (
    marker !== undefined
    && marker === completedId
    && model.proof_freshness === "FRESH"
  ) {
    return model.next_action === "PROJECT_COMPLETE"
      ? {}
      : automaticContinuation(model);
  }

  if (marker !== undefined) {
    const stalePrefix = model.proof_freshness === "STALE" ? "STALE: " : "";
    const note = `${stalePrefix}fresh PASS evidence is required for `
      + `${marker ?? currentId ?? completedId ?? "the task"}; run ohno verify.`;
    return state.plan_revision === null
      ? continuation(note)
      : automaticContinuation(model, note);
  }

  if (model.next_action === "PROJECT_COMPLETE") {
    return {};
  }
  if (state.plan_revision !== null) {
    return automaticContinuation(model);
  }
  return {};
}

async function capsule(projectPath: string): Promise<string> {
  // DESIGN: SessionStart/PostCompact are read-only on the normal path.
  // Projector refresh is explicit (`ohno projectors refresh`), not a hook write.
  return serializeResumeWithWorktrees(
    await readModel(projectPath),
    projectPath,
  );
}

export async function handleCodexHook(
  input: HookInput,
): Promise<HookOutput> {
  const projectPath = findProjectRoot(input.cwd);
  if (input.hook_event_name === "SessionStart") {
    return {
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: await capsule(projectPath),
      },
    };
  }
  if (input.hook_event_name === "PostCompact") {
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
    if (!input.prompt.startsWith(`${automaticContinuationPrefix}\n`)) {
      // Keep prompt-log hashing/locking off ordinary status/next/resume startup.
      const { appendOwnerInput } = await import("../owner-inputs.js");
      await appendOwnerInput(projectPath, {
        sessionId: input.session_id,
        turnId: input.turn_id,
        prompt: input.prompt,
      });
    }
    return {};
  }
  if (input.hook_event_name === "PreToolUse") {
    return handlePreToolUse(projectPath, input);
  }
  if (input.hook_event_name === "Stop") {
    return handleStop(projectPath, input);
  }
  throw new Error(`unsupported hook event ${input.hook_event_name}`);
}
