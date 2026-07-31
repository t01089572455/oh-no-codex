---
name: oh-no-verify
description: >
  Prove the active Oh No task with its black-box test. Use when user says 做完了,
  验收, done, verify, pass this slice, 测一下, or ohno verify. MUST run before
  claiming completion. Shell: ohno verify only.
---

# oh-no-verify

```bash
ohno verify
```

- **PASS** → task closes; report real result.  
- **FAIL / UNKNOWN** → task stays open; do not claim done.  
Never invent PASS. Never skip this for “looks good” prose.
