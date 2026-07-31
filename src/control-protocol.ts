/**
 * Short AGENTS pointer. Full procedure lives in Codex skills oh-no-*
 * (installed by `ohno install` / `ohno skill install`).
 */
export function renderControlProtocolMarkdown(): string {
  return [
    "### Oh No control (skill suite)",
    "",
    "Invoke Codex skills (not chat-paste CLI): `oh-no-control` hub, plus",
    "`oh-no-init` · `oh-no-install` · `oh-no-plan` · `oh-no-task` · `oh-no-verify` ·",
    "`oh-no-resume` · `oh-no-status` · `oh-no-next` · `oh-no-change` ·",
    "`oh-no-requirements` · `oh-no-preferences` · `oh-no-doctor` · `oh-no-cockpit` ·",
    "`oh-no-projectors`. Refresh: `ohno skill install`.",
    "",
    "This block is **live state only**. Done ⇒ skill **oh-no-verify** (`ohno verify`).",
    "No silent plan accept. No invented PASS. Authority: `.ohno/state.json`.",
    "",
  ].join("\n");
}
