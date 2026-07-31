/**
 * Short AGENTS pointer. Full procedure lives in the Codex skill
 * `oh-no-control` (installed by `ohno install` / `ohno skill install`).
 * Keeps managed block small so chat context does not dilute the protocol.
 */
export function renderControlProtocolMarkdown(): string {
  return [
    "### Oh No control (skill-first)",
    "",
    "Primary procedure: Codex skill **`oh-no-control`**",
    "(`~/.codex/skills/oh-no-control`, install with `ohno skill install`).",
    "This managed block is the **live capsule** (goal / board / next) only.",
    "Do not paste long CLI recipes into chat — run `ohno` at boundaries.",
    "",
    "| Intent | Command |",
    "| --- | --- |",
    "| Start slice | `ohno task start` |",
    "| Done / 验收 | **`ohno verify` only** |",
    "| Requirements changed | `ohno change begin --summary \"…\"` |",
    "| Remember words | `ohno requirements note --text \"…\"` |",
    "| Where are we | `ohno resume` |",
    "",
    "No silent plan accept. No invented PASS. `next` is not new permission.",
    "Authority: `.ohno/state.json` only.",
    "",
  ].join("\n");
}
