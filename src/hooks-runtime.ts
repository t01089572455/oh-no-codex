/**
 * Cooperative Desktop hook activation evidence (Correction 6R.1).
 *
 * Not sole product authority: task/plan/proof remain only in `.ohno/state.json`.
 * This file only answers “did Codex Desktop actually fire our hooks for the
 * current hooks.json digest?” for doctor/status and soft mutation guards.
 * Corrupt or digest-mismatched evidence fails closed (never ACTIVE).
 */
import { createHash, randomUUID } from "node:crypto";
import { open, mkdir, readFile, realpath, rename, writeFile } from "node:fs/promises";
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

export const REQUIRED_HOOK_EVENTS: readonly HookEventName[] = [
  "SessionStart",
  "PostCompact",
  "UserPromptSubmit",
  "PreToolUse",
  "Stop",
] as const;

export const REQUIRED_TRUSTED_HOOK_RECORDS = REQUIRED_HOOK_EVENTS.length;

export interface SessionHookEvidence {
  /** Events recorded while config_digest matched the live hooks.json. */
  last_events: Partial<Record<HookEventName, string>>;
  pending_latest_rebind: boolean;
  bootstrap_required: boolean;
}

export interface HooksRuntimeEvidence {
  schema_version: 2;
  config_digest: string | null;
  last_events: Partial<Record<HookEventName, string>>;
  last_session_id: string | null;
  sessions: Record<string, SessionHookEvidence>;
  updated_at: string | null;
  /** True when the on-disk file was unreadable/corrupt (fail-closed). */
  corrupt?: boolean;
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

export const emptyEvidence = (): HooksRuntimeEvidence => ({
  schema_version: 2,
  config_digest: null,
  last_events: {},
  last_session_id: null,
  sessions: {},
  updated_at: null,
  corrupt: false,
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
    return { ...emptyEvidence(), corrupt: true };
  }
  const o = raw as Record<string, unknown>;
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
      corrupt: false,
    };
  }
  if (o.schema_version !== 2) {
    return { ...emptyEvidence(), corrupt: true };
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
    corrupt: false,
  };
}

export async function readHooksRuntime(
  projectPath: string,
): Promise<HooksRuntimeEvidence> {
  try {
    const raw = await readFile(hooksRuntimePath(projectPath), "utf8");
    try {
      return normalizeEvidence(JSON.parse(raw));
    } catch {
      return { ...emptyEvidence(), corrupt: true };
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return emptyEvidence();
    }
    return { ...emptyEvidence(), corrupt: true };
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
  const handle = await open(tmp, "w", 0o600);
  try {
    await handle.writeFile(body, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(tmp, path);
}

/**
 * Record that a project hook actually ran. Locked + atomic + fsync.
 * On hooks.json digest change, wipes prior evidence (no stale ACTIVE).
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
    let prev = await readHooksRuntime(projectPath);
    // Digest change or corrupt file: start clean under the new config.
    if (
      prev.corrupt === true
      || (
        prev.config_digest != null
        && digest != null
        && prev.config_digest !== digest
      )
    ) {
      prev = emptyEvidence();
    }

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
    } else if (prevSession.last_events.SessionStart == null) {
      // Mid-session enable only after Owner/Stop activity without SessionStart.
      // First PreToolUse alone on a fresh session is NOT bootstrap (tests + CLI).
      if (event === "Stop") {
        session.bootstrap_required = true;
      } else if (
        event === "UserPromptSubmit"
        && options.ownerInput !== false
      ) {
        session.bootstrap_required = true;
      } else if (
        event === "PreToolUse"
        && (
          prevSession.last_events.UserPromptSubmit != null
          || prevSession.last_events.Stop != null
        )
      ) {
        session.bootstrap_required = true;
      }
    }

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
      corrupt: false,
    };
    const ids = Object.keys(next.sessions);
    if (ids.length > 32) {
      for (const id of ids.slice(0, ids.length - 32)) {
        delete next.sessions[id];
      }
    }
    await writeHooksRuntimeAtomic(projectPath, next);
  } catch {
    // cooperative
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
    if (prev.corrupt === true) {
      return;
    }
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
  if (runtime.corrupt === true) {
    return true;
  }
  if (typeof sessionId === "string" && sessionId.trim() !== "") {
    return runtime.sessions[sessionId.trim()]?.bootstrap_required === true;
  }
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
  if (runtime.corrupt === true) {
    return false;
  }
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

async function sameHooksFile(a: string, b: string): Promise<boolean> {
  if (normalizeFsPath(a) === normalizeFsPath(b)) {
    return true;
  }
  try {
    return normalizeFsPath(await realpath(a))
      === normalizeFsPath(await realpath(b));
  } catch {
    return false;
  }
}

/**
 * Count distinct trusted hook *kinds* for this project's hooks.json path.
 * Exact path match only (after realpath normalize) — no suffix fuzzy match.
 */
export async function countCodexTrustedHookRecords(
  projectPath: string,
  home = resolveCodexHome(),
): Promise<number> {
  const hooksPath = hooksConfigPath(projectPath);
  try {
    const raw = await readFile(resolve(home, ".codex", "config.toml"), "utf8");
    const verified = new Set<string>();
    const lines = raw.split(/\r?\n/u);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? "";
      if (!line.includes("[hooks.state.")) {
        continue;
      }
      const key =
        /\[hooks\.state\.'((?:\\'|[^'])+)'\]/u.exec(line)?.[1]
        ?? /\[hooks\.state\."((?:\\"|[^"])+)"\]/u.exec(line)?.[1];
      if (key == null) {
        continue;
      }
      const kindMatch =
        /:(session_start|post_compact|user_prompt_submit|pre_tool_use|stop):(\d+):(\d+)$/iu
          .exec(key);
      if (kindMatch == null || kindMatch.index === undefined) {
        continue;
      }
      const kindName = kindMatch[1];
      if (kindName == null) {
        continue;
      }
      const pathPart = key.slice(0, kindMatch.index);
      if (!(await sameHooksFile(pathPart, hooksPath))) {
        continue;
      }
      let hasHash = false;
      for (let j = i + 1; j < Math.min(i + 8, lines.length); j += 1) {
        const next = lines[j] ?? "";
        if (next.includes("[hooks.state.")) {
          break;
        }
        if (/^\s*trusted_hash\s*=/u.test(next)) {
          hasHash = true;
          break;
        }
      }
      if (hasHash) {
        verified.add(kindName.toLowerCase());
      }
    }
    return verified.size;
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

  if (runtime.corrupt === true) {
    return {
      activation: "RUNTIME_UNVERIFIED",
      trusted_records: trusted,
      runtime,
      config_digest: configDigest,
    };
  }

  if (trusted < REQUIRED_TRUSTED_HOOK_RECORDS) {
    return {
      activation: "REVIEW_REQUIRED",
      trusted_records: trusted,
      runtime,
      config_digest: configDigest,
    };
  }

  // Evidence from a different hooks.json digest cannot promote ACTIVE.
  if (
    runtime.config_digest != null
    && runtime.config_digest !== configDigest
  ) {
    return {
      activation: "CHANGED_REVIEW_REQUIRED",
      trusted_records: trusted,
      runtime,
      config_digest: configDigest,
    };
  }

  // ACTIVE only: 5/5 trust + evidence under *this* digest + SessionStart.
  const sawSessionStart =
    runtime.config_digest === configDigest
    && runtime.last_events.SessionStart != null;
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
 * Host-only captures. Prefer exact Desktop shapes; do not drop Owner quotes.
 */
export function looksLikeHostSystemCapture(prompt: string): boolean {
  const t = prompt.trim();
  if (t === "") {
    return false;
  }
  // Real Desktop personalized-suggestion payloads often start with # Overview.
  if (
    /^#\s*Overview\b/iu.test(t)
    && /hyperpersonalized|personalized suggestions/iu.test(t)
    && t.length < 8_000
    && !/##\s*My request/iu.test(t)
  ) {
    return true;
  }
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
