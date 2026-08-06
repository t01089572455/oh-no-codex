# Known issues after field trial (0.1.6)

Date: 2026-08-01  
Package: oh-no-codex@0.1.6

## Fixed in 0.1.6

| ID | Issue | Fix |
| --- | --- | --- |
| FT-LIVE-01 | FREEZE/PROPOSE deadlocked: no ACTIVE → PreToolUse denied all writes; `plan propose` needs a JSON file | Allow `.ohno/*.json\|*.md` (not `state.json`) when next is `PROPOSE_PLAN`, `FREEZE_TASK:*`, or `PROJECT_COMPLETE` |
| FT-LIVE-02 | Cockpit progress label still sold bare percent as product complete | Primary label is `N of M plan tasks`; HTML eyebrow says not product completion |
| FT-LIVE-03 | Operators had no doctor tip for freeze write path | `doctor` PASS detail `plan_write_path` |
| FT-LIVE-04 | Skill silence on freeze write | `oh-no-plan` documents allowed paths |

## Still open (not this slice)

| ID | Sev | Note |
| --- | --- | --- |
| FT-LIVE-05 | P2 | Cockpit still process-bound (random port default; dead tab offline) — mitigated by `--port`/`stop`/`--replace` in 0.1.5 |
| FT-LIVE-06 | P2 | `--allow-weak-plan` still explicit Owner override for toys |
| FT-LIVE-07 | P3 | Multi-agent roles — V1 non-goal |
| FT-LIVE-08 | P2 | Windows PATH / npm.ps1 / agent Job Object — host ops |

## Non-goals (do not “fix” as missing features)

- Automatic product planning from a single Owner sentence  
- Hostile security against same-user bypass flags  
- Merging multiple git worktree authorities into one state  
