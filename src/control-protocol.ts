/**
 * Short AGENTS pointer. Skills + hooks do the rest.
 */
export function renderControlProtocolMarkdown(): string {
  return [
    "### Oh No harness (critical moments only)",
    "",
    "Setup once: `ohno setup` (or `ohno init` + `ohno install`). Then talk to Codex.",
    "Glance: bare `ohno`. Done proof: **ohno verify** only. Skills: `oh-no-control`.",
    "Authority: this cwd `.ohno/state.json`.",
    "",
    "### Pipeline",
    "",
    "1. **DISCOVER** — clarify ALL demand details; tech/arch Codex decides.",
    "2. **DESIGN** — detailed design + full route from Truth (length free).",
    "3. **EXECUTE** — one task: expect + hard test + scope; real function pass.",
    "4. **RECOVER** — FAIL/drift: MUST read Truth first; fix implement OR plan.",
    "5. **CHANGE** — new requirements: re-clarify → design → plan → expected tests.",
    "",
    "Owner prompts = raw Truth (latest wins). Do not freestyle without reading Truth.",
    "Hooks block product code in PREPARE; scope fence when ACTIVE; soft boxes refused.",
    "",
  ].join("\n");
}
