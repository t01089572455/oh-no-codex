---
name: oh-no-plan
description: >
  Propose or accept an Oh No linear plan. Use when user says make a plan, 排计划,
  plan propose, plan accept, freeze tasks, ordered_tasks, or ohno plan. Runs
  ohno plan propose --file … and ohno plan accept --revision … --diff ….
---

# oh-no-plan

## Propose

Write a **structured acceptance basis** first (Truth target, usually
`.ohno/acceptance-basis.json`):

```json
{
  "schema_version": 1,
  "tasks": [
    {
      "id": "task-id",
      "expected_behavior": "exact user-visible behavior",
      "test_command": "exact black-box command",
      "stop_condition": "exact stop"
    }
  ]
}
```

Then write plan JSON under **`.ohno/`** with:

- `cursor`, `ordered_tasks`
- **`acceptance_source`**: project-relative path to that basis (must be a Truth
  target). Required. Path + content digest bind into `plan_revision`.

```bash
ohno plan propose --file .ohno/review-plan.json
```

### Acceptance denominator hard gate (#7/#9)

- Every `FROZEN` task must **exactly match** the basis entry with the same `id`
  (`expected_behavior` / `test_command` / `stop_condition` string equality).
- No regex, synonyms, or comment tricks. Mismatch →
  `ACCEPTANCE_DENOMINATOR_MISMATCH` (not overridable by `--allow-weak-plan`).
- Missing / unreadable basis, or path not in Truth → refuse.
- After propose, basis content drift → `ACCEPTANCE_BASIS_DRIFT`.
- If `next` is `MIGRATE_ACCEPTANCE_BASIS`:  
  `ohno migrate acceptance-basis --file .ohno/acceptance-basis.json`

### FREEZE / no-ACTIVE write path (0.1.6)

When `ohno next` is `PROPOSE_PLAN`, `FREEZE_TASK:…`, or `PROJECT_COMPLETE`, there is
**no** ACTIVE task. PreToolUse **allows** writing `.ohno/*.json` and `.ohno/*.md`
(except `.ohno/state.json` and cockpit runtime). It still **denies** product code
until `ohno task start`.

Do **not** use absolute Windows paths in patches. Do **not** rewrite `state.json`
by hand.

Cursor task must be `FROZEN` (behavior, test_command, allowed_files, stop, budget).
Later tasks may be `OUTLINE`.

### Task-shape guidance (PREPARE warning)

- Do **not** propose a single docs/commit/gitignore-only task just to unblock git
  when the Owner goal is a multi-slice product.
- Prefer several product tasks with **behavioral** black boxes (`npm test`, app
  smoke, etc.). Avoid sole `git diff --check` as the product test.
- `ohno plan propose` prints **WARN** lines.
- These heuristic findings do not require an override flag. Improve the split
  during PREPARE when doing so does not expand the goal, acceptance, non-goals,
  or allowed scope.
- Missing structure, acceptance-basis mismatch, unbounded scope, and missing
  fresh PASS remain hard failures.

- After `PROJECT_COMPLETE`, propose a **new** implementation plan — that marker
  means **this linear plan** finished, not the product.

## Accept at the PREPARE boundary

```bash
ohno plan accept --revision <sha256> --diff <sha256>
```

Resolve material ambiguity and review the exact basis/plan diff first. If the
Owner already asked to “plan and finish” or otherwise authorized implementation,
accept without asking again, then execute `task start`, repair, `verify`, and
every plan-derived next task automatically. If the Owner requested planning
only, leave the proposal unaccepted.
