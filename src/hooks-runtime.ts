/**
 * Non-authority runtime evidence that Codex hooks actually fired.
 * Not sole product authority (that remains .ohno/state.json) — doctor/status
 * use this only to avoid "file installed" false-green. Writes are locked +
 * atomic rename (Correction 6R).
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, realpath, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { homedir } from "node:os";

import {
  acquirePidTokenLock,
  releasePidTokenLock,
} from "./process-lock.js";

export type HookEventName =
  | "SessionStart"
  | "PostCompact"
  | "UserPromptSubmit"
  | "PreToolUse"
  | "Stop";

/** Five cooperative hooks installed by ohno setup templates. */
export const REQUIRED_HOOK_EVENTS: readonly HookEventName[] = [
  "SessionStart",
  "PostCompact",
  "UserPromptSubmit",
  "PreToolUse",
  "Stop",
] as const;

/** Desktop must trust each of the five template hooks. */
export const REQUIRED_TRUSTED_HOOK_RECORDS = REQUIRED_HOOK_EVENTS.length;

export interface SessionHookEvidence {
  last_events: Partial<Record<HookEventName, string>>;
  /** Owner UserPromptSubmit seen; PreToolUse must re-bind Latest once. */
  pending_latest_rebind: boolean;
  /** Mid-session enable: Stop/PreTool before SessionStart in this session. */
  bootstrap_required: boolean;
}

export interface HooksRuntimeEvidence {
  schema_version: 2;
  /** sha256 of project .codex/hooks.json when evidence was last written. */
  config_digest: string | null;
  /** Aggregate last-seen (any session) for doctor display. */
  last_events: Partial<Record<HookEventName, string>>;
  last_session_id: string | null;
  /** Per-session isolation (mid-enable / latest rebind). */
  sessions: Record<string, SessionHookEvidence>;
  updated_at: string | null;
}

export type HookActivation =
  | "MISSING"
  | "REVIEW_REQUIRED"
  | "RUNTIME_UNVERIFIED"
  | "ACTIVE"
  | "CHANGED_REVIEW_REQUIRED";

const emptySession = (): SessionHookEvidence => ({
  last_events: {},
  pending_latest_rebind: false,
  bootstrap_required: false,
});

const emptyEvidence = (): HooksRuntimeEvidence => ({
  schema_version: 2,
  config_digest: null,
  last_events: {},
  last_session_id: null,
  sessions: {},
  updated_at: null,
});

export function hooksRuntimePath(projectPath: string): string {
  return resolve(projectPath, ".ohno", "hooks-runtime.json");
}

export function hooksRuntimeLockPath(projectPath: string): string {
  return resolve(projectPath, ".ohno", "hooks-runtime.lock");
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

function normalizeEvidence(raw: unknown): HooksRuntimeEvidence {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return emptyEvidence();
  }
  const o = raw as Record<string, unknown>;
  // v1 → v2 migration (best-effort).
  if (o.schema_version === 1) {
    const lastEvents =
      (o.last_events as Partial<Record<HookEventName, string>>) ?? {};
    const sid =
      typeof o.last_session_id === "string" && o.last_session_id.trim() !== ""
        ? o.last_session_id
        : "_legacy";
    return {
      schema_version: 2,
      config_digest:
        typeof o.config_digest === "string" ? o.config_digest : null,
      last_events: lastEvents,
      last_session_id: sid === "_legacy" ? null : sid,
      sessions: {
        [sid]: {
          last_events: { ...lastEvents },
          pending_latest_rebind: false,
          bootstrap_required: o.bootstrap_required === true,
        },
      },
      updated_at: typeof o.updated_at === "string" ? o.updated_at : null,
    };
  }
  const sessionsIn =
    o.sessions != null && typeof o.sessions === "object" && !Array.isArray(o.sessions)
      ? o.sessions as Record<string, Partial<SessionHookEvidence>>
      : {};
  const sessions: Record<string, SessionHookEvidence> = {};
  for (const [id, s] of Object.entries(sessionsIn)) {
    sessions[id] = {
      last_events: s?.last_events ?? {},
      pending_latest_rebind: s?.pending_latest_rebind === true,
      bootstrap_required: s?.bootstrap_required === true,
    };
  }
  return {
    schema_version: 2,
    config_digest:
      typeof o.config_digest === "string" ? o.config_digest : null,
    last_events:
      (o.last_events as Partial<Record<HookEventName, string>>) ?? {},
    last_session_id:
      typeof o.last_session_id === "string" ? o.last_session_id : null,
    sessions,
    updated_at: typeof o.updated_at === "string" ? o.updated_at : null,
  };
}

export async function readHooksRuntime(
  projectPath: string,
): Promise<HooksRuntimeEvidence> {
  try {
    const raw = await readFile(hooksRuntimePath(projectPath), "utf8");
    return normalizeEvidence(JSON.parse(raw));
  } catch {
    return emptyEvidence();
  }
}

async function writeHooksRuntimeAtomic(
  projectPath: string,
  evidence: HooksRuntimeEvidence,
): Promise<void> {
  const path = hooksRuntimePath(projectPath);
  const dir = dirname(path);
  await mkdir(dir, { recursive: true });
  const tmp = resolve(dir, `hooks-runtime.${process.pid}.${randomUUID()}.tmp`);
  const body = `${JSON.stringify(evidence, null, 2)}\n`;
  await writeFile(tmp, body, "utf8");
  await rename(tmp, path);
}

/**
 * Record that a project hook actually ran. Locked + atomic. Best-effort.
 */
export async function recordHookRuntimeEvent(
  projectPath: string,
  event: HookEventName,
  sessionId?: string,
  options: { ownerInput?: boolean } = {},
): Promise<void> {
  const lockPath = hooksRuntimeLockPath(projectPath);
  let token: string | null = null;
  try {
    token = await acquirePidTokenLock(lockPath, { deadlineMs: 5_000 });
    const digest = await digestHooksConfig(projectPath);
    const prev = await readHooksRuntime(projectPath);
    const now = new Date().toISOString();
    const sid =
      typeof sessionId === "string" && sessionId.trim() !== ""
        ? sessionId.trim()
        : "_unknown";
    const prevSession = prev.sessions[sid] ?? emptySession();
    const session: SessionHookEvidence = {
      last_events: {
        ...prevSession.last_events,
        [event]: now,
      },
      pending_latest_rebind: prevSession.pending_latest_rebind,
      bootstrap_required: prevSession.bootstrap_required,
    };

    if (event === "SessionStart") {
      session.bootstrap_required = false;
    } else if (
      (event === "Stop" || event === "PreToolUse")
      && prevSession.last_events.SessionStart == null
    ) {
      // This session never saw SessionStart → mid-session enable.
      session.bootstrap_required = true;
    }

    // Only real Owner UserPromptSubmit requires Latest rebind on next mutation.
    if (event === "UserPromptSubmit" && options.ownerInput !== false) {
      session.pending_latest_rebind = true;
    }

    const next: HooksRuntimeEvidence = {
      schema_version: 2,
      config_digest: digest,
      last_events: {
        ...prev.last_events,
        [event]: now,
      },
      last_session_id: sid === "_unknown" ? prev.last_session_id : sid,
      sessions: {
        ...prev.sessions,
        [sid]: session,
      },
      updated_at: now,
    };
    // Cap session map growth (keep newest ~32).
    const ids = Object.keys(next.sessions);
    if (ids.length > 32) {
      const drop = ids.slice(0, ids.length - 32);
      for (const id of drop) {
        delete next.sessions[id];
      }
    }
    await writeHooksRuntimeAtomic(projectPath, next);
  } catch {
    // cooperative: never break the Codex turn
  } finally {
    if (token != null) {
      await releasePidTokenLock(lockPath, token).catch(() => undefined);
    }
  }
}

export async function clearPendingLatestRebind(
  projectPath: string,
  sessionId?: string,
): Promise<void> {
  const lockPath = hooksRuntimeLockPath(projectPath);
  let token: string | null = null;
  try {
    token = await acquirePidTokenLock(lockPath, { deadlineMs: 5_000 });
    const prev = await readHooksRuntime(projectPath);
    const sid =
      typeof sessionId === "string" && sessionId.trim() !== ""
        ? sessionId.trim()
        : prev.last_session_id;
    if (sid == null || prev.sessions[sid] == null) {
      return;
    }
    const session = {
      ...prev.sessions[sid],
      pending_latest_rebind: false,
    };
    await writeHooksRuntimeAtomic(projectPath, {
      ...prev,
      sessions: { ...prev.sessions, [sid]: session },
      updated_at: new Date().toISOString(),
    });
  } catch {
    // ignore
  } finally {
    if (token != null) {
      await releasePidTokenLock(lockPath, token).catch(() => undefined);
    }
  }
}

export function sessionBootstrapRequired(
  runtime: HooksRuntimeEvidence,
  sessionId?: string,
): boolean {
  if (typeof sessionId === "string" && sessionId.trim() !== "") {
    return runtime.sessions[sessionId.trim()]?.bootstrap_required === true;
  }
  // Unknown session: any open bootstrap, or never SessionStart aggregate.
  if (Object.values(runtime.sessions).some((s) => s.bootstrap_required)) {
    return true;
  }
  return (
    runtime.last_events.SessionStart == null
    && (runtime.last_events.Stop != null || runtime.last_events.PreToolUse != null)
  );
}

export function sessionPendingLatestRebind(
  runtime: HooksRuntimeEvidence,
  sessionId?: string,
): boolean {
  if (typeof sessionId === "string" && sessionId.trim() !== "") {
    return runtime.sessions[sessionId.trim()]?.pending_latest_rebind === true;
  }
  if (runtime.last_session_id != null) {
    return (
      runtime.sessions[runtime.last_session_id]?.pending_latest_rebind === true
    );
  }
  return false;
}

/**
 * Count trusted_hash records in ~/.codex/config.toml for this project's
 * hooks.json. Keys look like:
 * [hooks.state.'D:\proj\.codex\hooks.json:pre_tool_use:0:0']
 */
/** Override with OHNO_CODEX_HOME in tests. */
export function resolveCodexHome(home?: string): string {
  if (home != null && home.trim() !== "") {
    return home;
  }
  if (process.env.OHNO_CODEX_HOME != null && process.env.OHNO_CODEX_HOME !== "") {
    return process.env.OHNO_CODEX_HOME;
  }
  return homedir();
}

function normalizeFsPath(path: string): string {
  return path.replaceAll("/", "\\").replaceAll(/\\+/gu, "\\").toLowerCase();
}

async function pathAliases(hooksPath: string): Promise<string[]> {
  const out = new Set<string>([
    hooksPath,
    hooksPath.replaceAll("/", "\\"),
    hooksPath.replaceAll("\\", "/"),
  ]);
  try {
    const real = await realpath(hooksPath);
    out.add(real);
    out.add(real.replaceAll("/", "\\"));
    out.add(real.replaceAll("\\", "/"));
  } catch {
    // ignore
  }
  return [...out];
}

export async function countCodexTrustedHookRecords(
  projectPath: string,
  home = resolveCodexHome(),
): Promise<number> {
  const hooksPath = hooksConfigPath(projectPath);
  const aliases = await pathAliases(hooksPath);
  const aliasNorm = new Set(aliases.map(normalizeFsPath));
  try {
    const raw = await readFile(resolve(home, ".codex", "config.toml"), "utf8");
    const seen = new Set<string>();
    for (const line of raw.split(/\r?\n/u)) {
      if (!line.includes("[hooks.state.")) {
        continue;
      }
      // [hooks.state.'D:\proj\.codex\hooks.json:pre_tool_use:0:0']
      const key =
        /\[hooks\.state\.'((?:\\'|[^'])+)'\]/u.exec(line)?.[1]
        ?? /\[hooks\.state\."((?:\\"|[^"])+)"\]/u.exec(line)?.[1];
      if (key == null) {
        continue;
      }
      const pathPart = key.replace(
        /:(session_start|post_compact|user_prompt_submit|pre_tool_use|stop):\d+:\d+$/iu,
        "",
      );
      if (!aliasNorm.has(normalizeFsPath(pathPart))) {
        // Short 8.3 vs long path fallback: same .codex\hooks.json suffix + parent name
        const hit = aliases.some((a) =>
          normalizeFsPath(pathPart).endsWith(
            normalizeFsPath(a).split("\\").slice(-3).join("\\"),
          )
        );
        if (!hit) {
          continue;
        }
      }
      const kind =
        /:(session_start|post_compact|user_prompt_submit|pre_tool_use|stop):/iu
          .exec(key)?.[1]
          ?.toLowerCase();
      if (kind != null) {
        seen.add(kind);
      } else {
        seen.add(key);
      }
    }
    return seen.size;
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

  // Full five-hook Desktop review required (not 1/5 → ACTIVE).
  if (trusted < REQUIRED_TRUSTED_HOOK_RECORDS) {
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

  // ACTIVE only when current digest matches and SessionStart observed
  // (proves a live cooperative session, not a single stray Stop).
  const sawSessionStart =
    runtime.last_events.SessionStart != null
    && runtime.config_digest === configDigest;
  if (!sawSessionStart) {
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

/**
 * Codex Desktop host noise only — exact host patterns.
 * Do NOT match user messages that merely quote the phrase.
 */
export function looksLikeHostSystemCapture(prompt: string): boolean {
  const t = prompt.trim();
  if (t === "") {
    return false;
  }
  // Exact / near-exact host automation (not a user wrapping the phrase).
  if (
    /^Generate 0 to 3 hyperpersonalized suggestions\b/iu.test(t)
    && t.length < 2_000
    && !/\n##\s*My request/iu.test(t)
  ) {
    return true;
  }
  if (/^<codex[_-]system[\s>]/iu.test(t)) {
    return true;
  }
  // Ambient UI block alone (no embedded user request section).
  if (
    /^<in-app-browser-context\b/iu.test(t)
    && /This block is automatically supplied ambient UI state/iu.test(t)
    && /not part of the user's request/iu.test(t)
    && !/## My request for Codex:/iu.test(t)
  ) {
    return true;
  }
  return false;
}
