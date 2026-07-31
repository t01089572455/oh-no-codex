import { access } from "node:fs/promises";
import { resolve } from "node:path";

import { hooksIntegrationStatus } from "./install.js";
import {
  enabledRules,
  loadPreferences,
} from "./preferences.js";
import { readModel } from "./read-model.js";
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
      detail: ".ohno/state.json missing — run ohno init --goal …",
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

      // Eighteen-sins pressure: broad scope and trivial black boxes.
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
          const trivial = /process\.exit\(0\)|exit 0|true\s*;?\s*$/iu.test(
            active.test_command,
          )
            || active.test_command.trim().length < 8;
          checks.push({
            id: "blackbox_discipline",
            status: trivial ? "WARN" : "PASS",
            detail: trivial
              ? "active test_command looks trivial — risk of test theatre"
              : "active test_command present",
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
