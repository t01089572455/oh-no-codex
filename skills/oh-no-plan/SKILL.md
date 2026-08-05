---
name: oh-no-plan
description: >
  Propose or accept an Oh No plan after requirements/design are on Truth.
  Use for plan propose/accept, freeze tasks, ordered_tasks.
---

# oh-no-plan

**Only after DISCOVER** (requirements clear) and **DESIGN** (route from Truth).

Plan length unrestricted. Each FROZEN task needs:

| Key | Meaning |
| --- | --- |
| `id` | stable token |
| `expect` | user-visible function done-line |
| `test` | exact black-box command (real function) |
| `scope` | allowed paths |

Aliases: `expected_behavior` / `test_command` / `allowed_files`. Other fields default.  
`acceptance_source` optional (auto `.ohno/acceptance-basis.json`).

```bash
ohno plan propose --file .ohno/review-plan.json
ohno plan accept --revision <sha> --diff <sha>
```

Soft/playbook-only tests → refuse unless Owner `--allow-weak-plan`.

On **requirement change**: re-clarify, update design, then new plan + new expected tests — do not keep zombie plan authority.
