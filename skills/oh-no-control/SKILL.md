---
name: oh-no-control
description: >
  Oh No Truth-bound harness. Pipeline: clarify → seal → design → plan → execute;
  FAIL requires truth-read mode A/B; Owner change auto-revokes execution.
---

# Oh No harness (Owner vision)

**Owner:** `ohno setup` then talk. You (Codex) run the pipeline.

## Pipeline

1. **DISCOVER (PM)** — ask until demand is clear. Tech/arch: you decide.  
   Hooks block product code. Every Owner prompt → OWNER-INPUTS +  
   `REQUIREMENTS.md` **Latest Owner words (latest wins)**.

2. **`ohno phase seal-requirements`** — REQUIREMENTS must include goal/acceptance  
   signals + Owner ledger. → DESIGN

3. **Write `.ohno/DESIGN.md`** (full route OK) then  
   **`ohno phase seal-design`** → PLAN_READY

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
