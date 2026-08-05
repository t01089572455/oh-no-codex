---
name: oh-no-next
description: >
  Show the single Oh No next_action locator. Use when user asks 下一步, next
  action, what next, or ohno next. Shell: ohno next. Not permission to start work.
---

# oh-no-next

```bash
ohno next
```

Locator only: it cannot expand scope or grant new permission. Once the plan is
accepted, its canonical locator is executed automatically (`START_TASK`,
`CONTINUE_ACTIVE`, `RUN_EXACT_TEST`, `REOPEN_TASK`, or the next cursor) until
`PROJECT_COMPLETE` or real `NEEDS_INPUT`.
