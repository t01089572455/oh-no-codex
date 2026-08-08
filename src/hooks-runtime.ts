/**
 * Non-authority runtime evidence that Codex hooks actually fired for this
 * project. Doctor/hooks status use it so "file installed" is not "ACTIVE".
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { homedir } from "node:os";

export type HookEventName =
  | "SessionStart"
  | "PostCompact"
  | "UserPromptSubmit"
  | "PreToolUse"
  | "Stop";

export interface HooksRuntimeEvidence {
  schema_version: 1;
  /** sha256 of project .codex/hooks.json bytes when last event recorded. */
  config_digest: string | null;
  last_events: Partial<Record<HookEventName, string>>;
  last_session_id: string | null;
  /** True after a mid-session first Stop before SessionStart was observed. */
  bootstrap_required: boolean;
  updated_at: string | null;
}

export type HookActivation =
  | "MISSING"
  | "REVIEW_REQUIRED"
  | "RUNTIME_UNVERIFIED"
  | "ACTIVE"
  | "CHANGED_REVIEW_REQUIRED";

const emptyEvidence = (): HooksRuntimeEvidence => ({
  schema_version: 1,
  config_digest: null,
  last_events: {},
  last_session_id: null,
  bootstrap_required: false,
  updated_at: null,
});

export function hooksRuntimePath(projectPath: string): string {
  return resolve(projectPath, ".ohno", "hooks-runtime.json");
}

export function hooksConfigPath(projectPath: string): string {
  return resolve(projectPath, ".codex", "hooks.json");
}

export async function digestHooksConfig(
  projectPath: string,
): Promise<string | null> {
  try {
    const raw = await readFile(hooksConfigPath(projectPath));
    return createHash("sha256").update(raw).digest("hex");
  } catch {
    return null;
  }
}

export async function readHooksRuntime(
  projectPath: string,
): Promise<HooksRuntimeEvidence> {
  try {
    const raw = await readFile(hooksRuntimePath(projectPath), "utf8");
    const parsed = JSON.parse(raw) as Partial<HooksRuntimeEvidence>;
    return {
      ...emptyEvidence(),
      ...parsed,
      last_events: parsed.last_events ?? {},
    };
  } catch {
    return emptyEvidence();
  }
}

async function writeHooksRuntime(
  projectPath: string,
  evidence: HooksRuntimeEvidence,
): Promise<void> {
  const path = hooksRuntimePath(projectPath);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
}

/**
 * Record that a project hook actually ran. Best-effort; never throws to hooks.
 */
export async function recordHookRuntimeEvent(
  projectPath: string,
  event: HookEventName,
  sessionId?: string,
): Promise<void> {
  try {
    const digest = await digestHooksConfig(projectPath);
    const prev = await readHooksRuntime(projectPath);
    const now = new Date().toISOString();
    const next: HooksRuntimeEvidence = {
      schema_version: 1,
      config_digest: digest,
      last_events: {
        ...prev.last_events,
        [event]: now,
      },
      last_session_id: sessionId ?? prev.last_session_id,
      bootstrap_required: prev.bootstrap_required,
      updated_at: now,
    };
    if (event === "SessionStart") {
      next.bootstrap_required = false;
    } else if (
      (event === "Stop" || event === "PreToolUse")
      && prev.last_events.SessionStart == null
    ) {
      // Never saw SessionStart for this project evidence → mid-session enable.
      next.bootstrap_required = true;
    }
    await writeHooksRuntime(projectPath, next);
  } catch {
    // cooperative: never break the Codex turn
  }
}

/**
 * Count trusted_hash records in ~/.codex/config.toml for this project's
 * hooks.json path. Codex stores review approvals there; exact hash algorithm
 * is host-owned — presence means the user opened /hooks for this path.
 */
export async function countCodexTrustedHookRecords(
  projectPath: string,
  home = homedir(),
): Promise<number> {
  const hooksPath = hooksConfigPath(projectPath);
  const needle = hooksPath.replaceAll("/", "\\");
  const needleAlt = hooksPath.replaceAll("\\", "/");
  try {
    const raw = await readFile(resolve(home, ".codex", "config.toml"), "utf8");
    let count = 0;
    for (const line of raw.split(/\r?\n/u)) {
      if (!line.includes("[hooks.state.")) {
        continue;
      }
      if (line.includes(needle) || line.includes(needleAlt)) {
        count += 1;
      }
    }
    return count;
  } catch {
    return 0;
  }
}

export async function deriveHookActivation(
  projectPath: string,
  codexConfigStatus: "MISSING" | "INSTALLED_TEMPLATE" | "MODIFIED_OR_CUSTOM",
): Promise<{
  activation: HookActivation;
  trusted_records: number;
  runtime: HooksRuntimeEvidence;
  config_digest: string | null;
}> {
  const configDigest = await digestHooksConfig(projectPath);
  const runtime = await readHooksRuntime(projectPath);
  const trusted = await countCodexTrustedHookRecords(projectPath);

  if (codexConfigStatus === "MISSING" || configDigest == null) {
    return {
      activation: "MISSING",
      trusted_records: trusted,
      runtime,
      config_digest: configDigest,
    };
  }

  if (trusted === 0) {
    return {
      activation: "REVIEW_REQUIRED",
      trusted_records: trusted,
      runtime,
      config_digest: configDigest,
    };
  }

  const sawRuntime = Object.keys(runtime.last_events).length > 0;
  if (
    sawRuntime
    && runtime.config_digest != null
    && runtime.config_digest !== configDigest
  ) {
    return {
      activation: "CHANGED_REVIEW_REQUIRED",
      trusted_records: trusted,
      runtime,
      config_digest: configDigest,
    };
  }

  if (!sawRuntime || runtime.config_digest !== configDigest) {
    return {
      activation: "RUNTIME_UNVERIFIED",
      trusted_records: trusted,
      runtime,
      config_digest: configDigest,
    };
  }

  return {
    activation: "ACTIVE",
    trusted_records: trusted,
    runtime,
    config_digest: configDigest,
  };
}

/** Codex Desktop host noise that must never become Owner authority. */
export function looksLikeHostSystemCapture(prompt: string): boolean {
  const t = prompt.trim();
  if (t === "") {
    return false;
  }
  if (/Generate 0 to 3 hyperpersonalized suggestions/iu.test(t)) {
    return true;
  }
  if (/hyperpersonalized suggestions/iu.test(t)) {
    return true;
  }
  if (/personalized.?suggestions for the user/iu.test(t)) {
    return true;
  }
  if (/^<codex[_-]system[\s>]/iu.test(t)) {
    return true;
  }
  if (
    /This block is automatically supplied ambient UI state/iu.test(t)
    && /not part of the user's request/iu.test(t)
    && !/## My request/iu.test(t)
  ) {
    return true;
  }
  return false;
}
