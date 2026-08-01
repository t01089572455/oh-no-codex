import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

import {
  looksLikeTrivialBlackbox,
  planLooksLikeCommitLicense,
  weakBlackboxSummary,
} from "./discipline.js";
import { listSiblingOhnoWorktrees } from "./worktree-authority.js";
import { hooksIntegrationStatus } from "./install.js";
import {
  enabledRules,
  loadPreferences,
} from "./preferences.js";
import { readModel } from "./read-model.js";
import { skillInstallStatus } from "./skill-install.js";
import { readState, stateExists } from "./state.js";

export interface DoctorReport {
  ok: boolean;
  checks: Array<{
    id: string;
    status: "PASS" | "WARN" | "FAIL";
    detail: string;
  }>;
  next_action: string;
}

export async function runDoctor(projectPath: string): Promise<DoctorReport> {
  const checks: DoctorReport["checks"] = [];
  let modelNext = "NONE";

  const hasState = await stateExists(projectPath);
  if (!hasState) {
    checks.push({
      id: "state",
      status: "FAIL",
      detail: ".ohno/state.json missing — run ohno init",
    });
  } else {
    try {
      const model = await readModel(projectPath);
      modelNext = model.next_action;
      if (model.availability !== "AVAILABLE") {
        checks.push({
          id: "state",
          status: "FAIL",
          detail: "state unreadable or corrupt",
        });
      } else {
        checks.push({
          id: "state",
          status: "PASS",
          detail:
            `AVAILABLE status=${model.status} cursor=${model.cursor}/`
            + `${model.task_count} proof=${model.proof_freshness}`,
        });
      }
      checks.push({
        id: "handoff",
        status: model.handoff.head ? "PASS" : "WARN",
        detail:
          `path=${model.handoff.path} branch=${model.handoff.branch ?? "NONE"} `
          + `head=${model.handoff.head ?? "NONE"} dirty=${
            model.handoff.dirty ? "YES" : "NO"
          }`,
      });
      checks.push({
        id: "truth",
        status: model.truth_target_count > 0 ? "PASS" : "WARN",
        detail: `${model.truth_target_count} truth targets; `
          + `doc_sync=${model.document_sync_status}`,
      });

      // Eighteen-sins + field-trial pressure: broad scope, weak black boxes,
      // commit-license plans, untracked harness, wrong-tree risk.
      try {
        const state = await readState(projectPath);
        const active = state.active_task;
        if (active !== null) {
          const broad = active.allowed_files.some((pattern) =>
            pattern === "**"
            || pattern === "*"
            || pattern === "**/*"
            || pattern.startsWith("**/")
            || /^[^/]*\*$/u.test(pattern)
          );
          checks.push({
            id: "scope_discipline",
            status: broad ? "WARN" : "PASS",
            detail: broad
              ? "active allowed_files look very broad — risk of framework sprawl"
              : "active allowed_files look bounded",
          });
          const weak = weakBlackboxSummary(active.test_command);
          checks.push({
            id: "blackbox_discipline",
            status: weak !== null || looksLikeTrivialBlackbox(active.test_command)
              ? "WARN"
              : "PASS",
            detail: weak !== null
              ? `${weak} — risk of test theatre (FT-02)`
              : "active test_command present",
          });
        } else if (state.ordered_tasks.length > 0) {
          const frozen = state.ordered_tasks.filter((t) => t.status === "FROZEN");
          const weakFrozen = frozen.find((t) =>
            looksLikeTrivialBlackbox(t.test_command)
          );
          if (weakFrozen !== undefined) {
            checks.push({
              id: "blackbox_discipline",
              status: "WARN",
              detail:
                `plan task ${weakFrozen.id}: `
                + `${weakBlackboxSummary(weakFrozen.test_command) ?? "weak test"} `
                + `(FT-02)`,
            });
          }
        }

        if (
          state.ordered_tasks.length > 0
          && planLooksLikeCommitLicense(state.ordered_tasks)
        ) {
          checks.push({
            id: "plan_shape",
            status: "WARN",
            detail:
              "plan looks like a commit-license / docs-only micro-plan "
              + "(FT-05/14) — cockpit 100% will not mean product done; "
              + "prefer multi-slice product tasks with behavioral tests",
          });
        } else if (state.plan_revision !== null) {
          checks.push({
            id: "plan_shape",
            status: "PASS",
            detail: "plan shape does not match known commit-license micro-pattern",
          });
        }

        // 0.1.6: tell operators FREEZE/PROPOSE may write .ohno plan files.
        if (
          modelNext.startsWith("FREEZE_TASK:")
          || modelNext === "PROPOSE_PLAN"
          || modelNext === "PROJECT_COMPLETE"
        ) {
          checks.push({
            id: "plan_write_path",
            status: "PASS",
            detail:
              `next=${modelNext}: PreToolUse allows .ohno/*.json|*.md `
              + "(not state.json) so plan propose/freeze is not deadlocked; "
              + "write review JSON then ohno plan propose --file …",
          });
        }

        if (
          model.next_action === "PROJECT_COMPLETE"
          && model.task_count > 0
        ) {
          checks.push({
            id: "plan_complete_honesty",
            status: "WARN",
            detail:
              `NEXT=PROJECT_COMPLETE means this linear plan cursor is done `
              + `(${model.cursor}/${model.task_count} tasks), not that the `
              + `product is finished (FT-01/09/12). Propose next phase: `
              + `ohno plan propose`,
          });
        }

        // FT-07: harness files untracked while in a git repo
        const gitCheck = spawnSync(
          "git",
          ["-C", projectPath, "status", "--porcelain", "--", ".ohno", "AGENTS.md"],
          { encoding: "utf8", windowsHide: true },
        );
        if (gitCheck.status === 0) {
          const porc = gitCheck.stdout ?? "";
          const untrackedHarness = porc.split(/\r?\n/u).some((line) =>
            /^\?\?/.test(line) && (line.includes(".ohno") || line.includes("AGENTS.md"))
          );
          checks.push({
            id: "harness_versioned",
            status: untrackedHarness ? "WARN" : "PASS",
            detail: untrackedHarness
              ? ".ohno/ and/or AGENTS.md appear untracked — authority may not "
                + "travel with commits (FT-07/22/31); consider committing harness"
              : "harness paths not showing as untracked (or not a git repo)",
          });
        }

        // FT-13/17: sibling git worktrees with their own .ohno
        const siblings = await listSiblingOhnoWorktrees(projectPath);
        if (siblings.length > 0) {
          checks.push({
            id: "worktree_authority",
            status: "WARN",
            detail:
              `other git worktrees also have .ohno/state.json `
              + `(${siblings.length}): cockpit/resume only see cwd `
              + `${projectPath} (FT-13/17). Open ohno in the worktree you mean.`,
          });
        }
      } catch {
        // state already reported
      }
    } catch (error) {
      checks.push({
        id: "state",
        status: "FAIL",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  try {
    await access(resolve(projectPath, ".ohno", "PROGRESS.md"));
    checks.push({
      id: "progress_projection",
      status: "PASS",
      detail: ".ohno/PROGRESS.md present",
    });
  } catch {
    checks.push({
      id: "progress_projection",
      status: "WARN",
      detail: "PROGRESS.md missing — run ohno projectors refresh",
    });
  }

  try {
    await access(resolve(projectPath, ".ohno", "REQUIREMENTS.md"));
    checks.push({
      id: "requirements_log",
      status: "PASS",
      detail: ".ohno/REQUIREMENTS.md present",
    });
  } catch {
    checks.push({
      id: "requirements_log",
      status: "WARN",
      detail: "REQUIREMENTS.md missing — run ohno projectors refresh",
    });
  }

  try {
    const prefs = await loadPreferences(projectPath);
    const on = enabledRules(prefs);
    const researchOn = on.some((rule) =>
      rule.id === "research_before_implement"
    );
    const frontendOn = on.some((rule) =>
      rule.id === "frontend_adapt_not_invent"
    );
    checks.push({
      id: "working_method",
      status: "PASS",
      detail:
        `${on.length}/${prefs.rules.length} rules enabled; `
        + `research=${researchOn ? "ON" : "OFF"} `
        + `frontend_adapt=${frontendOn ? "ON" : "OFF"}`,
    });
  } catch (error) {
    checks.push({
      id: "working_method",
      status: "WARN",
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    const agents = await access(resolve(projectPath, "AGENTS.md")).then(
      () => "present",
    ).catch(() => "missing");
    checks.push({
      id: "agents_file",
      status: agents === "present" ? "PASS" : "WARN",
      detail: `AGENTS.md ${agents}`,
    });
  } catch {
    checks.push({
      id: "agents_file",
      status: "WARN",
      detail: "AGENTS.md missing",
    });
  }

  try {
    const hooks = await hooksIntegrationStatus(projectPath);
    const codexOk = hooks.codex_config !== "MISSING";
    const gitOk = hooks.git_hook !== "MISSING";
    checks.push({
      id: "hooks",
      status: codexOk || gitOk ? "PASS" : "WARN",
      detail:
        `codex=${hooks.codex_config} git=${hooks.git_hook} `
        + `classification=${hooks.classification}`,
    });
  } catch (error) {
    checks.push({
      id: "hooks",
      status: "WARN",
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    const skills = await skillInstallStatus();
    const codexSlots = skills.slots.filter((s) => s.root === "codex");
    const missing = codexSlots.filter((s) => s.status === "MISSING").length;
    const drift = codexSlots.filter((s) => s.status === "DRIFT").length;
    const ok = codexSlots.filter((s) => s.status === "INSTALLED").length;
    checks.push({
      id: "control_skill",
      status: missing === 0 && drift === 0 ? "PASS" : "WARN",
      detail: missing === 0 && drift === 0
        ? `oh-no skill suite ${ok}/${codexSlots.length} installed under ~/.codex/skills`
        : `oh-no skills: ${ok} ok, ${drift} drift, ${missing} missing — run ohno skill install`,
    });
  } catch (error) {
    checks.push({
      id: "control_skill",
      status: "WARN",
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  // FT-03: is `ohno` resolvable on PATH (Codex shells often miss node_global).
  try {
    const which = spawnSync(
      process.platform === "win32" ? "where" : "which",
      ["ohno"],
      { encoding: "utf8", windowsHide: true },
    );
    const found = which.status === 0
      && (which.stdout ?? "").trim().length > 0;
    checks.push({
      id: "cli_path",
      status: found ? "PASS" : "WARN",
      detail: found
        ? `ohno on PATH: ${(which.stdout ?? "").trim().split(/\r?\n/u)[0]}`
        : "ohno not found on PATH (FT-03). Add npm global bin "
          + "(Windows often …\\nodejs\\node_global) or call node …/cli.js",
    });
  } catch {
    checks.push({
      id: "cli_path",
      status: "WARN",
      detail: "could not probe PATH for ohno",
    });
  }

  const ok = checks.every((check) => check.status !== "FAIL");
  return {
    ok,
    checks,
    next_action: modelNext,
  };
}

export function serializeDoctor(report: DoctorReport): string {
  return [
    `OK: ${report.ok ? "YES" : "NO"}`,
    ...report.checks.map(
      (check) => `${check.status}: ${check.id} — ${check.detail}`,
    ),
    `NEXT: ${report.next_action}`,
    "",
  ].join("\n");
}
