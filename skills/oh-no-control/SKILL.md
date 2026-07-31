---
name: oh-no-control
description: >
  Thin Oh No, Codex! conversation protocol. Use when the project has
  oh-no-codex installed and the user is doing vibe coding with bounded tasks,
  verify, requirement change, preferences, or resume. Not a skill router.
---

# Oh No, Codex! control protocol

## When to use

Project already has `ohno init` + `ohno install` (or you are setting that up).
The human should **not** memorize the full CLI. You run boundary commands.

## Daily path

1. Human: install once (`npm i -g oh-no-codex`), then `ohno init --goal "…"`, `ohno install`.
2. Human: talks in ordinary language.
3. You: follow the table below.
4. Hooks (background): SessionStart/PostCompact inject resume; PreToolUse scope check; Stop completion marker; projectors refresh.

## Command map

| Human intent | You run |
| --- | --- |
| Start this slice / 开工 | `ohno task start` if cursor task is frozen; else plan propose/accept after Owner review |
| This slice is done / 做完了 | **Only** `ohno verify` — no PASS, no “done” |
| Requirements changed / 需求变了 | `ohno change begin --summary "…"` then sync + replacement plan |
| Remember my words / 记下来 | `ohno requirements note --text "…"` |
| Change craft rules / 改规矩 | `ohno preferences set …` or edit `.ohno/preferences.json` |
| Where are we / 卡在哪 | `ohno resume` or `ohno doctor` |

## Working method defaults

See `.ohno/preferences.json` (also projected into `AGENTS.md`). Defaults favor:

- research open-source before consequential implementation;
- prefer existing packages/templates;
- frontend: adapt a real reference, do not invent a full UI from scratch.

Owner may disable any rule. Preferences are craft, not a second runtime authority.

## Authority

- Sole runtime authority: `.ohno/state.json`
- Projections: `.ohno/PROGRESS.md`, `.ohno/REQUIREMENTS.md`, AGENTS managed block
- Never auto-accept plans or invent verify PASS
- `next` is a locator, not permission

## Prefer project AGENTS block

If the project `AGENTS.md` contains `<!-- ohno:managed-begin -->` … `<!-- ohno:managed-end -->`, that live capsule **outranks** this static skill copy for current goal, board, and next action.
