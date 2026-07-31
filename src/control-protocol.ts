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
    "No invented PASS. Authority: `.ohno/state.json`.",
    "",
  ].join("\n");
}
