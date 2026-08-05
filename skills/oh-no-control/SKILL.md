---
name: oh-no-control
description: >
  Hub for Oh No, Codex! anti-drift harness. Use when user mentions ohno, harness,
  .ohno, anti-drift, or which oh-no skill. Prefer specific oh-no-* skills when clear.
---

# Oh No — harness core

**Job:** keep Codex bound to **Truth**. Read before deciding. No freestyle without Truth.

Owner talks to you. Oh No only hands on at critical moments (hooks + verify).

## Pipeline (always)

1. **DISCOVER** — clarify ALL demand details (you are PM). Tech/arch: you decide.  
2. **DESIGN** — detailed design + full route from Truth (full roadmap OK).  
3. **EXECUTE** — one frozen task: `expect` + hard `test` + `scope`.  
4. **RECOVER** — black-box fail / drift: **read Truth first**, then fix implement **or** plan/design. Auto-adjust. Ask Owner only for secrets/devices/business facts.  
5. **CHANGE** — new/changed requirements: re-clarify → update design → plan → expected tests → execute. Old plan is not authority.

## Truth

- Every Owner prompt = raw Truth (verbatim). Latest wins on conflict.  
- Confirmed conclusions + design docs on Truth list govern work.  
- Never invent direction without reading Truth.

## Critical controls (automatic)

- PREPARE: product code blocked; Truth/docs/.ohno plan allowed.  
- ACTIVE: scope fence.  
- FAIL: Stop card forces Truth re-read.  
- Done: only `ohno verify` PASS (real function, not soft echo).

## Owner commands (almost none)

```bash
ohno setup    # once per repo
ohno          # where am I
ohno verify   # when proving a slice (or you run it automatically)
```

Plan/task internals: use `oh-no-plan` / `oh-no-task` / `oh-no-verify` as needed; Owner should not need a museum.
