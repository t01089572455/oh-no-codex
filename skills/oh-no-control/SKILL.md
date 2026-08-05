---
name: oh-no-control
description: >
  Hub for Oh No anti-drift harness. Bind Codex to Truth. Pipeline:
  clarify → seal → design → plan → execute → verify; change re-walks.
---

# Oh No — real harness (0.3)

**Owner almost never runs CLI.** After `ohno setup`, they talk to you.

## Your job as Codex

1. **DISCOVER (PM)** — ask until demand details are clear. Tech/arch: you decide.  
   - Append Owner words into requirements; raw prompts go to OWNER-INPUTS via hook.  
   - **No product code** until seals exist (hooks deny `src/**` etc.).  
2. **Seal requirements** — when intent is substantial in `.ohno/REQUIREMENTS.md`:  
   `ohno phase seal-requirements` → phase DESIGN  
3. **DESIGN** — write full route to `.ohno/DESIGN.md` (one-shot full plan OK).  
   `ohno phase seal-design` → PLAN_READY  
4. **PLAN + EXECUTE** — plan propose/accept (id+expect+hard test+scope), task start, work in scope, `ohno verify`.  
5. **RECOVER on FAIL** — hooks clear truth-read; **must** cover required paths:  
   `ohno truth-read --paths .ohno/REQUIREMENTS.md,.ohno/DESIGN.md`  
   (receipt must include both when design was sealed). Then fix **implement** OR **plan/design**.  
   Shell write mutations also denied until then.  
6. **CHANGE** — Owner says 需求变了 / new requirements: hook may **auto**  
   `declare-change`. Or run  
   `ohno phase declare-change --summary "…"`  
   then re-seal + new plan/tests. Old plan no longer authorizes code.

## Truth

- All Owner prompts = raw Truth (latest wins).  
- Never decide without reading Truth after FAIL.  
- Done = real black-box + user-visible function, not prose.

## Owner commands

```bash
ohno setup
ohno          # optional glance
```
