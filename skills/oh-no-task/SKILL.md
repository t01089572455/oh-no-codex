---
name: oh-no-task
description: >
  Start or reopen an Oh No task. Use when user says 开工, start task, task start,
  reopen, STALE after close, patch completed slice, or ohno task.
  Shell: ohno task start | ohno task reopen.
---

# oh-no-task

## Start cursor task

```bash
ohno task start
```

Requires an accepted plan with a **FROZEN** cursor task.  
No free-form contract args — the frozen task is the contract.

After plan acceptance this is an implementation primitive, not an Owner
confirmation point. Run it automatically for each frozen cursor task.

## Reopen last completed task (FT-24)

After a PASS closes a task, if quality review forces more edits and proof goes
**STALE** with no ACTIVE task:

```bash
ohno task reopen
# fix allowed_files only
ohno verify
```

- Rolls the cursor **back** to that task and removes it from completed until a
  fresh PASS (normal board semantics).
- Does **not** invent a new one-task micro-plan (avoid FT-14).
- Prefer this over `plan propose` of a tiny “patch” task when the same contract applies.
- When canonical next is `REOPEN_TASK:<id>`, reopen, repair, and verify without
  asking the Owner unless the goal/scope/acceptance must expand.

## Discipline

- Prefer product slices with behavioral `test_command` (not only `git diff --check`).
- Commit harness when it is the product authority: `.ohno/` + `AGENTS.md` (FT-07/31).
- On Windows use `ohno.cmd` / PATH that includes npm global; never double-click `dist/cli.js`.
