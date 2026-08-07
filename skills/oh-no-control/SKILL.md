---
name: oh-no-control
description: >
  Oh No cooperative harness for Codex. Short OHNO_PIPELINE on Owner turns and
  Stop. PreToolUse is silent (allow or short hard deny). Force Latest
  REQUIREMENTS; anti-ask; ohno verify only proves done. Full law:
  ohno pipeline --full.
---

# Oh No — Control (current product)

**Owner:** `ohno setup` once → talk.  
**You:** follow **state + short pipeline + Latest REQUIREMENTS**, not freestyle.

## How control actually works

| Surface | Behavior |
| --- | --- |
| UserPromptSubmit | log Owner words → update Latest → re-bind truth-read → short `OHNO_PIPELINE` |
| Stop | short continue card (`next` / `do` / anti-ask) — **not** full rails every time |
| PreToolUse | **silent** allow, or **short hard deny** — never stamp/law spam |
| Full law text | only `ohno pipeline --full` when you need the long rails |

## Standing rules

1. **Latest wins** — open `.ohno/REQUIREMENTS.md` Latest before material decisions.  
2. **Lifecycle:** DISCOVER → DESIGN → PLAN → EXECUTE → RECOVER(A/B) → CHANGE.  
3. **Anti-ask:** never 请确认/请选择 for tech, cases, design, SOP. Ask only secrets / devices / account-type / pure business unknowns.  
4. **Done** = only `ohno verify` (Gate/skill green alone is not proof).  
5. **LOCAL_PASS:** unit tests ≠ true device/cat/listen path — narrow expect or upgrade test, or Owner `--allow-local-pass`.  
6. Prefer thin board; no parameter museum.

## Commands

```text
ohno pipeline              # short next
ohno pipeline --full       # next + full OHNO_PROMPT_RAILS once
ohno truth-read --paths .ohno/REQUIREMENTS.md,.ohno/DESIGN.md --mode A|B
ohno task start
ohno verify
ohno
```

## Full law source

`src/prompt-rails.ts` via `ohno pipeline --full`.  
Catalog: `docs/superpowers/specs/2026-08-05-complete-prompt-harness-catalog.md`.
