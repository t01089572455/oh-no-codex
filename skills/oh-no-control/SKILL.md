---
name: oh-no-control
description: >
  Hub skill for Oh No, Codex! (oh-no-codex / ohno) anti-drift harness.
  Use when the user mentions ohno, harness, bounded task, .ohno, anti-drift,
  or which oh-no skill to use. Prefer specific oh-no-* skills when intent is clear.
  Setup (ohno init / install) is terminal-only, not a skill.
---

# Oh No — harness (reins)

Not a second product. **Do not limit model capability by plan length.**
Anti-drift is four fences, not a task quota:

1. **Task contract** — `id` + `expect` + `test` + `scope`  
2. **Scope fence** — only touch allowed files  
3. **Hard black box** — real executable proof, not soft deferral  
4. **`ohno verify`** — only PASS proves done  

Plan may be as long as the Owner needs. Prefer clear vertical slices when useful;
never refuse a plan only because it has many tasks.

## Daily

```text
ohno / ohno next
ohno task start
work inside scope
ohno verify
```

Bare `ohno` = one-screen brief. Full capsule: `ohno resume`.

## Minimal plan task (author this)

```json
{
  "id": "login-redirect",
  "status": "FROZEN",
  "expect": "unauthenticated /app redirects to login",
  "test": "node scripts/bb-login-redirect.mjs",
  "scope": ["src/auth/**", "scripts/bb-login-redirect.mjs"]
}
```

Aliases ok: `expected_behavior`/`test_command`/`allowed_files`.  
`title`/`goal`/`stop`/`budget` default.  
`acceptance_source` optional (harness writes `.ohno/acceptance-basis.json`).

```bash
ohno plan propose --file .ohno/review-plan.json
ohno plan accept --revision <sha> --diff <sha>
```

## FAIL under accepted plan

Do **not** stop to ask the Owner.

1. `ohno` / `ohno next`  
2. Re-read expect + test + scope  
3. Open top Truth paths if listed  
4. Fix inside scope → `ohno verify`  
5. Many FAILs → STUCK: fix contract/test or `ohno change` / new plan  

`OHNO_CONTINUE` / Stop `decision: block` = **continue**, not “work blocked”.

## Skills map

| Need | Skill |
| --- | --- |
| 卡在哪 | `oh-no-resume` / bare `ohno` |
| 下一步 | `oh-no-next` |
| 开工 | `oh-no-task` |
| 验收 | `oh-no-verify` only |
| 计划 | `oh-no-plan` |
| 需求变了 | `oh-no-change` |
| 看板 | `oh-no-cockpit` |

## Hard rules

1. Never claim done without **`ohno verify` PASS**.  
2. Soft black boxes refused without `--allow-weak-plan`.  
3. **No plan task-count cap** — length is Owner/model choice.  
4. Authority = this cwd `.ohno/state.json`.  
5. `PROJECT_COMPLETE` = this plan only.  
