/**
 * Short AGENTS pointer. Skills + hooks inject full OHNO_HARNESS_RULES.
 */
export function renderControlProtocolMarkdown(): string {
  return [
    "### Oh No harness (critical moments only)",
    "",
    "Setup once: `ohno setup`. Glance: `ohno` / `ohno pipeline`. Done: **ohno verify** only.",
    "Skill: `oh-no-control`. Authority: this cwd `.ohno/state.json`.",
    "",
    "### Pipeline",
    "",
    "1. **DISCOVER** — clarify ALL demand details; tech/arch Codex decides.",
    "2. **DESIGN** — detailed design + full route from Truth (length free).",
    "3. **EXECUTE** — one task: expect + hard test + scope; real function pass.",
    "4. **RECOVER** — FAIL/drift: MUST `ohno truth-read` then fix implement OR plan.",
    "5. **CHANGE** — re-clarify → design → plan → expected tests.",
    "",
    "### Embedded prompt rails (hooks inject full list every turn)",
    "",
    "Force **read Truth docs** before material decisions (not semantic judgment).",
    "Obey **OHNO_HARNESS_RULES** / 十八宗罪 rails in Stop and UserPromptSubmit context:",
    "no usurpation/max-interpret; stop after PASS; review≠edit; no zombie plan;",
    "summary≠truth; local green≠done; no self-certify/test theatre/proxy goals;",
    "no reviewer scope growth; control-tax thin; no rebuild world; exact workspace;",
    "no handoff tax; UX not last; no empty promises; apology→constraint under Truth.",
    "Owner prompts = raw Truth (latest wins). Soft boxes refused. Scope fence when ACTIVE.",
    "",
  ].join("\n");
}
