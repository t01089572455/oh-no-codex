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
    "1. Under an accepted plan: never stop to ask the Owner on FAIL/confusion — "
      + "re-open Truth-listed playbook/matrix/contracts, re-approach inside the "
      + "frozen task, then `ohno verify`. Soft black boxes (echo+exit 3 / "
      + "playbook deferral) are refused on plan accept without --allow-weak-plan.",
    "2. Before product coding: preserve raw Owner prompts in `OWNER-INPUTS.md`,",
    "   consolidate `.ohno/REQUIREMENTS.md`, then review `ohno plan propose`.",
    "3. Weak-size / docs-only findings may warn in PREPARE; weak black boxes "
      + "hard-refuse accept unless Owner passes --allow-weak-plan.",
    "4. After PASS then quality fix: `ohno task reopen` (not a new micro-plan).",
    "5. `PROJECT_COMPLETE` / plan % = **this linear plan only**, not product done.",
    "6. Multi-agent (Codex spawn): only **root** runs ohno plan/task/verify;",
    "   review agents cannot invent PASS. Oh No does not schedule agents.",
    "7. Prefer committing `.ohno/` + `AGENTS.md` with the product (authority travel).",
    "8. Windows: use `ohno.cmd` on PATH; never double-click `dist/cli.js`.",
    "9. Stop only at PROJECT_COMPLETE under an accepted plan. OHNO_NEEDS_INPUT "
      + "is recovery guidance (re-read Truth), not an Owner handoff.",
    "",
  ].join("\n");
}
