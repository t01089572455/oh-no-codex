---
name: oh-no-change
description: >
  Oh No requirement-change loop. Use when user says 需求变了, requirements changed,
  change begin, sync docs, governing documents, or ohno change. Shell:
  ohno change begin/diff/accept.
---

# oh-no-change

```bash
ohno change begin --summary "<Owner one-line summary>"
ohno change diff
ohno change accept --change <id> --diff <displayed digest>
```

Blocks coding until review + replacement plan as designed.

During accepted-plan execution, a clear new Owner instruction is the change
authorization: run this existing sync/replacement-plan flow without asking for
a second confirmation. Ask only when two reasonable interpretations materially
change the user-visible result or the requested scope is not authorized.
