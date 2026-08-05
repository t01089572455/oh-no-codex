---
name: oh-no-control
description: >
  Oh No Truth-bound harness. Pipeline: clarify → seal → design → plan → execute;
  FAIL requires truth-read mode A/B; Owner change auto-revokes execution.
  Always run `ohno pipeline` when unsure of the exact next commands.
---

# Oh No harness (Owner vision)

**Owner:** `ohno setup` then talk. You (Codex) run the pipeline.  
Every Owner message and every Stop injects **OHNO_PIPELINE** — obey it.

## Locator (always)

```text
ohno pipeline          # exact next commands for current phase
ohno phase advance     # try seal-requirements or seal-design when files ready
ohno                   # one-screen where-am-I + pipeline
```

## Pipeline

1. **DISCOVER (PM)** — ask until demand is clear. Tech/arch: you decide.  
   Hooks block product code. Every Owner prompt → OWNER-INPUTS +  
   `REQUIREMENTS.md` **Latest Owner words (latest wins)**.

2. **`ohno phase seal-requirements`** (or `ohno phase advance`) — REQUIREMENTS  
   must include goal/acceptance signals + Owner ledger. → DESIGN  
   (creates DESIGN stub; you must expand it)

3. **Expand `.ohno/DESIGN.md`** (full route OK) then  
   **`ohno phase seal-design`** (or advance) → PLAN_READY

4. **Plan** with `id + expect + hard test + scope` → accept → EXECUTE  
   task start → work in scope → **`ohno verify`**

5. **FAIL → RECOVER**  
   - PATH **A** (implement):  
     `ohno truth-read --paths .ohno/REQUIREMENTS.md,.ohno/DESIGN.md --mode A`  
     then edit **scope only**  
   - PATH **B** (plan/design wrong):  
     `ohno truth-read --paths .ohno/REQUIREMENTS.md,.ohno/DESIGN.md --mode B`  
     then edit design/plan/expects  
   Product writes without matching mode are **denied**.

6. **CHANGE** — Owner says 需求变了 / etc → hook **auto** CHANGE (revoke).  
   Or `ohno phase declare-change --summary "…"`.  
   Re-clarify → re-seal → new plan/tests.

## Truth

- All Owner prompts raw in OWNER-INPUTS.  
- Latest auto-section in REQUIREMENTS wins on conflict.  
- Never freestyle without reading Truth after FAIL.
- Only `ohno verify` proves done.
