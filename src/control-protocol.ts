/**
 * Thin conversation protocol projected into AGENTS and shipped as an optional
 * skill copy. Not a skill marketplace or autonomous planner.
 */
export function renderControlProtocolMarkdown(): string {
  return [
    "### Conversation protocol (Agent runs the CLI)",
    "",
    "After `ohno init` + `ohno install`, the human mostly talks in Codex.",
    "You (the Agent) run the few boundary commands. Hooks already inject the",
    "resume capsule, refresh projections, and cooperatively deny out-of-scope",
    "writes — do not ask the human to re-type those.",
    "",
    "| Human intent (any language) | You run |",
    "| --- | --- |",
    "| Start this slice / 开工 | `ohno task start` when the cursor task is frozen; otherwise prepare a plan file and `ohno plan propose` / `accept` after Owner review |",
    "| This slice is done / 做完了 | **Only** `ohno verify`. Never claim done without a fresh PASS |",
    "| Requirements changed / 需求变了 | `ohno change begin --summary \"…\"` then document sync + replacement plan |",
    "| Remember my words / 记下来 | `ohno requirements note --text \"…\"` |",
    "| Change craft rules / 改规矩 | `ohno preferences set --id <id> --enabled true\\|false` or edit `.ohno/preferences.json` |",
    "| Where are we / 卡在哪 | `ohno resume` or `ohno doctor` (read-only) |",
    "",
    "**Do not automate:** silent `plan accept`, silent PASS, treating `next` as",
    "new permission, or inventing a second authority outside `.ohno/state.json`.",
    "",
    "Optional skill copy of this protocol: `skills/oh-no-control/SKILL.md` in the",
    "oh-no-codex package (or repo). Prefer this managed block when both exist.",
    "",
  ].join("\n");
}
