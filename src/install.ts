import { execFileSync } from "node:child_process";
import {
  chmod,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { findProjectRoot } from "./hooks/project-root.js";
import {
  installOhNoSkill,
  serializeSkillInstallResult,
} from "./skill-install.js";

type IntegrationFileStatus =
  | "MISSING"
  | "INSTALLED_TEMPLATE"
  | "MODIFIED_OR_CUSTOM";

export interface HooksIntegrationStatus {
  classification: "COOPERATIVE_GUARDRAIL";
  codex_config: IntegrationFileStatus;
  codex_feature: "UNVERIFIED";
  codex_trust: "UNVERIFIED";
  git_hook: IntegrationFileStatus;
  coverage: "SUPPORTED_LOCAL_PATHS_ONLY";
}

interface InstallFile {
  label: ".codex/hooks.json" | ".git/hooks/pre-commit";
  sourceLabel:
    | "templates/.codex/hooks.json"
    | "templates/git/pre-commit";
  sourcePath: string;
  destinationPath: string;
  mode?: number;
}

const packageRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
);
const runtimeCliPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "cli.js",
);

function quotePosix(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function quotePowerShell(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function jsonStringContent(value: string): string {
  return JSON.stringify(value).slice(1, -1);
}

function renderTemplate(file: InstallFile, source: Buffer): Buffer {
  let rendered = source.toString("utf8");
  if (file.label === ".codex/hooks.json") {
    const command = `${quotePosix(process.execPath)} `
      + `${quotePosix(runtimeCliPath)} hook`;
    const commandWindows = `& ${quotePowerShell(process.execPath)} `
      + `${quotePowerShell(runtimeCliPath)} hook`;
    rendered = rendered
      .replaceAll(
        "{{OHNO_HOOK_COMMAND}}",
        jsonStringContent(command),
      )
      .replaceAll(
        "{{OHNO_HOOK_COMMAND_WINDOWS}}",
        jsonStringContent(commandWindows),
      );
  } else {
    const posixNode = process.execPath.replaceAll("\\", "/");
    const posixCli = runtimeCliPath.replaceAll("\\", "/");
    rendered = rendered.replaceAll(
      "{{OHNO_GIT_PRECOMMIT_COMMAND}}",
      `${quotePosix(posixNode)} ${quotePosix(posixCli)} git pre-commit`,
    );
  }
  if (/\{\{[^}]+\}\}/u.test(rendered)) {
    throw new Error(`unresolved installer placeholder in ${file.sourceLabel}`);
  }
  return Buffer.from(rendered, "utf8");
}

/**
 * Resolve the real Git hooks directory. Linked worktrees use a `.git` *file*
 * that points at the common dir — writing `<worktree>/.git/hooks/...` is ENOTDIR.
 */
export function resolveGitHooksDirectory(projectPath: string): string {
  try {
    const out = execFileSync(
      "git",
      ["-C", projectPath, "rev-parse", "--git-path", "hooks"],
      { encoding: "utf8", windowsHide: true },
    ).trim();
    if (out.length === 0) {
      throw new Error("empty");
    }
    return isAbsolute(out) ? out : resolve(projectPath, out);
  } catch {
    return resolve(projectPath, ".git", "hooks");
  }
}

function installFiles(projectPath: string): InstallFile[] {
  return [
    {
      label: ".codex/hooks.json",
      sourceLabel: "templates/.codex/hooks.json",
      sourcePath: resolve(packageRoot, "templates", ".codex", "hooks.json"),
      destinationPath: resolve(projectPath, ".codex", "hooks.json"),
    },
    {
      label: ".git/hooks/pre-commit",
      sourceLabel: "templates/git/pre-commit",
      sourcePath: resolve(packageRoot, "templates", "git", "pre-commit"),
      destinationPath: resolve(
        resolveGitHooksDirectory(projectPath),
        "pre-commit",
      ),
      mode: 0o755,
    },
  ];
}

async function existingStatus(
  destinationPath: string,
  expected: Buffer,
): Promise<IntegrationFileStatus> {
  try {
    const existing = await readFile(destinationPath);
    return existing.equals(expected)
      ? "INSTALLED_TEMPLATE"
      : "MODIFIED_OR_CUSTOM";
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return "MISSING";
    }
    throw error;
  }
}

async function readInstallState(projectPath: string): Promise<Array<{
  file: InstallFile;
  source: Buffer;
  status: IntegrationFileStatus;
}>> {
  return Promise.all(installFiles(projectPath).map(async (file) => {
    const source = renderTemplate(file, await readFile(file.sourcePath));
    return {
      file,
      source,
      status: await existingStatus(file.destinationPath, source),
    };
  }));
}

export async function installGuardrails(
  startPath: string,
): Promise<string> {
  const projectPath = findProjectRoot(startPath);
  const states = await readInstallState(projectPath);
  const conflicts = states.filter(
    ({ status }) => status === "MODIFIED_OR_CUSTOM",
  );
  if (conflicts.length > 0) {
    const labels = conflicts.map(({ file }) => file.label).join(", ");
    const sources = conflicts
      .map(({ file }) => `${file.sourceLabel} into ${file.label}`)
      .join("; ");
    throw new Error(
      `refusing to overwrite existing ${labels}; preserve existing hooks. `
      + `Manual installation: merge ${sources}.`,
    );
  }

  const skillLines = await installOhNoSkill()
    .then((result) => serializeSkillInstallResult(result).trimEnd().split("\n"))
    .catch((error: unknown) => [
      `Skill install skipped: ${
        error instanceof Error ? error.message : String(error)
      }`,
    ]);

  const windowsTips = process.platform === "win32"
    ? [
      "Windows: ensure npm global bin is on PATH (often …\\nodejs\\node_global).",
      "Windows: use ohno.cmd — never double-click dist\\cli.js (WScript cannot run ESM).",
    ]
    : [];

  if (states.every(({ status }) => status === "INSTALLED_TEMPLATE")) {
    return [
      "COOPERATIVE_GUARDRAIL already installed (idempotent).",
      "  .codex/hooks.json: SessionStart, PostCompact, UserPromptSubmit, PreToolUse, Stop",
      "  .git/hooks/pre-commit",
      "Prompt capture: new UserPromptSubmit events only; OWNER-INPUTS.md stays local/private.",
      "Automatic continuation: accepted non-terminal plans; cooperative hook only.",
      "Codex hook feature and trust: UNVERIFIED; review with /hooks.",
      ...windowsTips,
      ...skillLines,
      "",
    ].join("\n");
  }

  const created: string[] = [];
  try {
    for (const { file, source, status } of states) {
      if (status !== "MISSING") {
        continue;
      }
      await mkdir(dirname(file.destinationPath), { recursive: true });
      await writeFile(file.destinationPath, source, {
        flag: "wx",
        mode: file.mode,
      });
      created.push(file.destinationPath);
      if (file.mode !== undefined) {
        await chmod(file.destinationPath, file.mode);
      }
    }
  } catch (error) {
    await Promise.all(
      created.map((path) => rm(path, { force: true })),
    );
    throw error;
  }

  return [
    "Installed COOPERATIVE_GUARDRAIL templates.",
    "  .codex/hooks.json: SessionStart, PostCompact, UserPromptSubmit, PreToolUse, Stop",
    "  .git/hooks/pre-commit",
    "Prompt capture: new UserPromptSubmit events only; OWNER-INPUTS.md stays local/private.",
    "Automatic continuation: accepted non-terminal plans; cooperative hook only.",
    "Codex hook feature and trust: UNVERIFIED; review with /hooks.",
    "Coverage is limited to supported local hook paths and ordinary Git.",
    ...windowsTips,
    ...skillLines,
    "",
  ].join("\n");
}

export async function hooksIntegrationStatus(
  startPath: string,
): Promise<HooksIntegrationStatus> {
  const projectPath = findProjectRoot(startPath);
  const states = await readInstallState(projectPath);
  const codex = states.find(
    ({ file }) => file.label === ".codex/hooks.json",
  );
  const git = states.find(
    ({ file }) => file.label === ".git/hooks/pre-commit",
  );
  if (codex === undefined || git === undefined) {
    throw new Error("hook integration status is unavailable");
  }

  return {
    classification: "COOPERATIVE_GUARDRAIL",
    codex_config: codex.status,
    codex_feature: "UNVERIFIED",
    codex_trust: "UNVERIFIED",
    git_hook: git.status,
    coverage: "SUPPORTED_LOCAL_PATHS_ONLY",
  };
}
