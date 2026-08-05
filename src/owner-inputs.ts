import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";

import {
  acquirePidTokenLock,
  releasePidTokenLock,
} from "./process-lock.js";

export interface OwnerInput {
  sessionId: string;
  turnId: string;
  prompt: string;
}

const ownerInputsHeader = [
  "# Oh No Owner inputs",
  "",
  "> Local/private append-only evidence captured by a trusted Codex",
  "> `UserPromptSubmit` hook. Entries preserve what was said; they do not",
  "> prove which prompt is the final requirement or replace `.ohno/state.json`.",
  "",
].join("\n");

function ownerInputsPath(projectPath: string): string {
  return resolve(projectPath, ".ohno", "OWNER-INPUTS.md");
}

async function ensureOwnerInputsIgnored(directory: string): Promise<void> {
  const path = resolve(directory, ".gitignore");
  let existing = "";
  try {
    existing = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
  if (/^OWNER-INPUTS\.md\s*$/mu.test(existing)) {
    return;
  }
  const separator = existing === "" || existing.endsWith("\n") ? "" : "\n";
  await atomicWrite(
    path,
    `${existing}${separator}# Local/private Owner prompt evidence\nOWNER-INPUTS.md\n`,
  );
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function ownerInputId(input: OwnerInput): string {
  return sha256([
    "ohno-owner-input-v1",
    input.sessionId,
    input.turnId,
    sha256(input.prompt),
  ].join("\0"));
}

function safeInlineJson(value: string): string {
  return JSON.stringify(value).replaceAll("`", "\\u0060");
}

function promptFence(prompt: string): string {
  const longest = Math.max(
    0,
    ...(prompt.match(/`+/gu) ?? []).map((run) => run.length),
  );
  return "`".repeat(Math.max(3, longest + 1));
}

function renderEntry(input: OwnerInput, receivedAt: string): string {
  const id = ownerInputId(input);
  const digest = sha256(input.prompt);
  const fence = promptFence(input.prompt);
  return [
    `## Input \`${id}\``,
    "",
    `- received_at: \`${receivedAt}\``,
    `- session_id: \`${safeInlineJson(input.sessionId)}\``,
    `- turn_id: \`${safeInlineJson(input.turnId)}\``,
    `- prompt_sha256: \`${digest}\``,
    `- prompt_utf8_bytes: ${Buffer.byteLength(input.prompt, "utf8")}`,
    "",
    `${fence}text`,
    input.prompt,
    fence,
    "",
  ].join("\n");
}

async function atomicWrite(path: string, body: string): Promise<void> {
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, body, { encoding: "utf8", flag: "wx" });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined);
  }
}

export async function appendOwnerInput(
  projectPath: string,
  input: OwnerInput,
): Promise<string> {
  const directory = resolve(projectPath, ".ohno");
  await mkdir(directory, { recursive: true });
  const lockPath = resolve(directory, "owner-inputs.lock");
  let token: string;
  try {
    token = await acquirePidTokenLock(lockPath, {
      deadlineMs: 30_000,
      emptyStaleMs: 5_000,
    });
  } catch {
    throw new Error("cannot acquire Owner input log lock");
  }

  try {
    await ensureOwnerInputsIgnored(directory);
    const path = ownerInputsPath(projectPath);
    let existing: string;
    try {
      existing = await readFile(path, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
      existing = ownerInputsHeader;
    }

    const id = ownerInputId(input);
    if (new RegExp("^## Input `" + id + "`$", "mu").test(existing)) {
      return ".ohno/OWNER-INPUTS.md";
    }
    const separator = existing.endsWith("\n") ? "" : "\n";
    await atomicWrite(
      path,
      `${existing}${separator}${renderEntry(input, new Date().toISOString())}`,
    );
    return ".ohno/OWNER-INPUTS.md";
  } finally {
    await releasePidTokenLock(lockPath, token);
  }
}

export async function readOwnerInputs(projectPath: string): Promise<string> {
  try {
    return await readFile(ownerInputsPath(projectPath), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        ".ohno/OWNER-INPUTS.md is not present; trusted prompt capture has not "
          + "recorded an Owner prompt in this project",
      );
    }
    throw error;
  }
}
