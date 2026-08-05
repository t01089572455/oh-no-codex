---
name: oh-no-plan
description: >
  Propose or accept an Oh No linear plan. Use when user says make a plan, 排计划,
  plan propose, plan accept, freeze tasks, ordered_tasks, or ohno plan.
---

# oh-no-plan

## Shape (harness 0.2)

**Prefer ≤5 tasks.** One vertical slice, not a product roadmap.

Each **FROZEN** task needs only:

| Key | Meaning |
| --- | --- |
| `id` | stable token |
| `expect` | user-visible done line |
| `test` | one exact black-box command |
| `scope` | allowed path globs |
| `status` | `FROZEN` |

Optional aliases: `expected_behavior`, `test_command`, `allowed_files`.  
Defaults: `title`=`id`, `goal`=`expect`, `stop`=when test passes, `budget`=60.

**OUTLINE:** `{ "id", "status": "OUTLINE" }` is enough.

## Plan file

```json
{
  "cursor": 0,
  "ordered_tasks": [
    {
      "id": "t1",
      "status": "FROZEN",
      "expect": "…",
      "test": "node scripts/bb-t1.mjs",
      "scope": ["src/**", "scripts/bb-t1.mjs"]
    }
  ]
}
```

`acceptance_source` is **optional**. If omitted, harness writes
`.ohno/acceptance-basis.json` from frozen expect/test/stop.

```bash
ohno plan propose --file .ohno/review-plan.json
ohno plan accept --revision <sha256> --diff <sha256>
```

- Soft / playbook-deferral `test` → refuse accept unless `--allow-weak-plan`.  
- More than 5 tasks → refuse unless `--allow-long-plan`.  
- When `next` is `MIGRATE_ACCEPTANCE_BASIS`, run migrate first.

## After accept

If Owner said plan-and-finish: `task start` → work in scope → `ohno verify` →
advance automatically. Do not ask again at ordinary boundaries.

## FREEZE path

When `ohno next` is `PROPOSE_PLAN` / `FREEZE_TASK` / `PROJECT_COMPLETE`, writing
`.ohno/*.json` is allowed; product code is denied until `task start`.
