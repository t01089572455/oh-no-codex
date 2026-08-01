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
    "This block is **live state only**. Done ⇒ **oh-no-verify**. No silent accept.",
    "No invented PASS. Authority: **this cwd** `.ohno/state.json` (worktrees differ).",
    "",
    "### Field-trial hard rules (must follow)",
    "",
    "1. Before product coding: `ohno requirements note` for Owner decisions, then",
    "   multi-slice `ohno plan propose` — **not** free brainstorm-then-commit.",
    "2. **Refuse** single-task design/gitignore/worktree-only plans and",
    "   `git diff --check`-only tests unless Owner uses `--allow-weak-plan`.",
    "3. After PASS then quality fix: `ohno task reopen` (not a new micro-plan).",
    "4. `PROJECT_COMPLETE` / plan % = **this linear plan only**, not product done.",
    "5. Multi-agent (Codex spawn): only **root** runs ohno plan/task/verify;",
    "   review agents cannot invent PASS. Oh No does not schedule agents.",
    "6. Prefer committing `.ohno/` + `AGENTS.md` with the product (authority travel).",
    "7. Windows: use `ohno.cmd` on PATH; never double-click `dist/cli.js`.",
    "",
  ].join("\n");
}
