import { readModel } from "../read-model.js";
import { serializeResume } from "../resume.js";
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
      + "or run ohno init --goal <goal>",
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
    return denial(
      "no active task; run ohno task start with a bounded contract",
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

interface CompletionMarker {
  id: string;
  hasExactStartBoundary: boolean;
}

function completionMarkers(message: unknown): CompletionMarker[] {
  if (typeof message !== "string") {
    return [];
  }
  return [...message.matchAll(/OHNO_COMPLETE:([^\s]+)/gu)]
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

function continuation(reason: string): HookOutput {
  return {
    decision: "block",
    reason,
  };
}

async function handleStop(
  projectPath: string,
  input: HookInput,
): Promise<HookOutput> {
  const markers = completionMarkers(input.last_assistant_message);
  if (markers.length === 0) {
    return {};
  }
  if (markers.some(({ hasExactStartBoundary }) => !hasExactStartBoundary)) {
    return continuation(
      "Exact completion marker required; it must be token-bounded: "
      + "OHNO_COMPLETE:<task-id>.",
    );
  }

  let state;
  try {
    state = await readState(projectPath);
  } catch {
    return continuation(
      "Oh No state is unavailable; repair it before using a completion marker.",
    );
  }

  const currentId = state.active_task?.id;
  const completedId = state.completed.at(-1)?.id;
  const expectedIds = [currentId, completedId].filter(
    (value): value is string => value !== undefined,
  );
  const wrongId = markers
    .map(({ id }) => id)
    .find((marker) => !expectedIds.includes(marker));
  if (wrongId !== undefined) {
    return continuation(
      `Wrong task id ${wrongId}; expected ${currentId ?? completedId ?? "NONE"}.`,
    );
  }

  const model = await readModel(projectPath);
  const marker = markers[0]?.id;
  if (
    marker !== undefined
    && marker === completedId
    && model.proof_freshness === "FRESH"
  ) {
    return {};
  }

  const stalePrefix = model.proof_freshness === "STALE" ? "STALE: " : "";
  return continuation(
    `${stalePrefix}fresh PASS evidence is required for `
    + `${marker ?? currentId ?? completedId ?? "the task"}; run ohno verify.`,
  );
}

async function capsule(projectPath: string): Promise<string> {
  return serializeResume(await readModel(projectPath));
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
  if (input.hook_event_name === "PreToolUse") {
    return handlePreToolUse(projectPath, input);
  }
  if (input.hook_event_name === "Stop") {
    return handleStop(projectPath, input);
  }
  throw new Error(`unsupported hook event ${input.hook_event_name}`);
}
