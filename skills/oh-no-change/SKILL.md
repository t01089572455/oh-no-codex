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
