/**
 * Short AGENTS pointer. Full procedure lives in Codex skills oh-no-*
 * (installed by `ohno install` / `ohno skill install`).
 */
export function renderControlProtocolMarkdown(): string {
  return [
    "### Oh No control (skill suite)",
    "",
    "Setup is terminal-only: `ohno init` then `ohno install` (not skills).",
    "Day-to-day: Codex skills `oh-no-plan` · `oh-no-task` · `oh-no-verify` ·",
    "`oh-no-resume` · `oh-no-status` · `oh-no-next` · `oh-no-change` ·",
    "`oh-no-requirements` · `oh-no-preferences` · `oh-no-doctor` · `oh-no-cockpit` ·",
    "`oh-no-projectors` · hub `oh-no-control`. Refresh: `ohno skill install`.",
    "",
    "This block is **live state only**. Done ⇒ **oh-no-verify**.",
    "No invented PASS. Authority: **this cwd** `.ohno/state.json` (worktrees differ).",
    "PREPARE resolves material ambiguity and reviews the exact plan/basis diff.",
    "If the Owner authorized plan-and-finish, accept without asking again; an",
    "accepted plan runs start/repair/verify/advance automatically until terminal.",
    "",
    "### Field-trial hard rules (must follow)",
    "",
    "1. Before product coding: preserve raw Owner prompts in `OWNER-INPUTS.md`,",
    "   consolidate `.ohno/REQUIREMENTS.md`, then review `ohno plan propose`.",
    "2. Weak-size, docs-only, and trivial-test findings are PREPARE warnings.",
    "   Structure, acceptance basis, scope, and fresh PASS remain hard gates.",
    "3. After PASS then quality fix: `ohno task reopen` (not a new micro-plan).",
    "4. `PROJECT_COMPLETE` / plan % = **this linear plan only**, not product done.",
    "5. Multi-agent (Codex spawn): only **root** runs ohno plan/task/verify;",
    "   review agents cannot invent PASS. Oh No does not schedule agents.",
    "6. Prefer committing `.ohno/` + `AGENTS.md` with the product (authority travel).",
    "7. Windows: use `ohno.cmd` on PATH; never double-click `dist/cli.js`.",
    "8. Stop only at PROJECT_COMPLETE or real NEEDS_INPUT (missing account/secret/",
    "   device/business fact, unapproved destructive/paid/publish/message action,",
    "   no honest acceptance, or state/platform blocker).",
    "",
  ].join("\n");
}
