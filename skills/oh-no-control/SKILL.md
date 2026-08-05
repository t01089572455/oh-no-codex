---
name: oh-no-control
description: >
  Oh No Truth-bound harness. Pipeline + OHNO_HARNESS_RULES (十八宗罪 prompt rails).
  Force read Truth docs before decisions; FAIL needs truth-read A/B; CHANGE re-walks.
  Always run `ohno pipeline` when unsure.
---

# Oh No harness (Owner vision)

**Owner:** `ohno setup` then talk. You (Codex) run the pipeline.  
Every Owner message and every Stop injects **OHNO_PIPELINE** + **OHNO_HARNESS_RULES** — obey both.

## Core (prompt rails only — not semantic judge)

1. **Force read Truth** at critical moments: OWNER-INPUTS, REQUIREMENTS (Latest wins),
   DESIGN, frozen task, `state.json`. Do not freestyle from chat memory.
2. **FAIL/drift/change** → `ohno truth-read` (A=fix code, B=fix plan/design) **before**
   any new write decision.
3. **Done** = only `ohno verify` fresh PASS. Your prose is never proof.

## Locator

```text
ohno pipeline          # phase next commands + full OHNO_HARNESS_RULES
ohno phase advance     # try seal-requirements or seal-design
ohno                   # where-am-I + pipeline
```

## Pipeline

1. **DISCOVER (PM)** — clarify demand; tech/arch you decide. No product code until seals.  
   Owner prompts → OWNER-INPUTS + REQUIREMENTS **Latest Owner words**.
2. **`ohno phase seal-requirements`** (or `phase advance`) → DESIGN (stub; expand it).
3. **Expand `.ohno/DESIGN.md`** (full route OK) → **`seal-design`** → PLAN_READY.
4. **Plan** `id + expect + hard test + scope` → accept → task start → work → **`ohno verify`**.
5. **FAIL → RECOVER** — truth-read A or B, then adjust; do not ask Owner by default
   (except secrets/devices/business unknowns).
6. **CHANGE** — 需求变了 / declare-change → re-clarify → re-seal → new plan/tests.

## OHNO_HARNESS_RULES / 十八宗罪 (always)

| # | Rail |
| ---: | --- |
| 1 | No usurpation — keep Owner outcome; smallest satisfying behavior |
| 2 | No max-interpret — no overbuild / governance OS |
| 3 | Stop after PASS — next is locator not license |
| 4 | Review ≠ edit — audit read-only unless Owner authorizes fix |
| 5 | No zombie authority — state + latest Owner; CHANGE kills old plan |
| 6 | Summary ≠ truth — resume is projection; re-open Truth files |
| 7 | Local green ≠ done — only frozen black-box + verify |
| 8 | No self-certify — exact command + receipt only |
| 9 | No test theatre — user-visible black-box; refuse soft fakes |
| 10 | No proxy goals — Owner outcome > vanity metrics |
| 11 | No reviewer scope growth — frozen contract only |
| 12 | Control-tax thin — no full-suite diagnostic |
| 13 | No rebuild world — prefer git/tests/simple files |
| 14 | Exact workspace — path/branch/HEAD/tree/dirty |
| 15 | No handoff tax — use ohno/resume |
| 16 | UX not last — design before UI when UI in scope |
| 17 | No empty promises — claim only with command + scope |
| 18 | Apology → constraint — FAIL changes code/plan/test under Truth |
