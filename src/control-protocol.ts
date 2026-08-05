/**
 * Short AGENTS pointer. Full procedure lives in Codex skills oh-no-*
 * (installed by `ohno install` / `ohno skill install`).
 */
export function renderControlProtocolMarkdown(): string {
  return [
    "### Oh No harness (reins)",
    "",
    "Setup (terminal): `ohno init` then `ohno install`. Refresh: `ohno skill install`.",
    "Daily: bare `ohno` | `ohno next` | `ohno task start` | `ohno verify`.",
    "Skills: hub `oh-no-control`, plus `oh-no-verify` / `oh-no-task` / `oh-no-plan` / `oh-no-resume`.",
    "Authority: **this cwd** `.ohno/state.json` only. Done => **ohno verify** PASS only.",
    "",
    "### Anti-drift (eighteen sins -> four fences)",
    "",
    "1. **Plan length unrestricted** - do not cap model capability; anti-drift is",
    "   hard boxes + scope + verify, not fewer tasks.",
    "2. **Task shape** - only `id`, `expect`, `test`, `scope` (aliases: expected_behavior,",
    "   test_command, allowed_files). title/goal/stop/budget default.",
    "3. **Scope fence** - PreToolUse/pre-commit; no product code outside scope.",
    "4. **Hard black box** - soft/playbook-deferral tests refused without `--allow-weak-plan`.",
    "",
    "Accepted plan => cooperative auto continue (`OHNO_CONTINUE`; Codex `block` = continue).",
    "FAIL => REPAIR in scope + re-read Truth top paths; do **not** stop to ask Owner.",
    "Repeated FAIL => STUCK (fix contract/test or new short plan / `ohno change`).",
    "`PROJECT_COMPLETE` = this linear plan only, not the whole product.",
    "",
    "Windows: `ohno.cmd` on PATH; never double-click `dist/cli.js`.",
    "",
  ].join("\n");
}
