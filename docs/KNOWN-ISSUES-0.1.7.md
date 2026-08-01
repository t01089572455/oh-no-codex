# Known issues after Correction 3 (0.1.7)

Date: 2026-08-01  
Package: oh-no-codex@0.1.7

## Public status (honest)

| Label | Meaning |
| --- | --- |
| `ANTI_DRIFT_CORE_WORKS` | Core cooperative harness works on real multi-slice Codex sessions |
| `FIELD_TRIAL_PARTIAL` | Field trial is partial; not every product loop closed on real projects |
| `RELEASE_CHANGES_REQUIRED` | Do not claim `V1_TRIAL_ACCEPTED` until A/P + perf + public surfaces close |

## Fixed in 0.1.7

| ID | Issue | Fix |
| --- | --- | --- |
| CORR3-01 | Green `V1_TRIAL_ACCEPTED` without naming isolation | Split public labels: core vs release |
| CORR3-02 | `ACTIVE` → `next=NONE` protocol gap | `CONTINUE_ACTIVE:<id>`; fail/stale → `RUN_EXACT_TEST:<id>` |
| CORR3-03 | Empty project goal blanked all read surfaces | Effective goal falls back to cursor/active task goal |
| CORR3-04 | init overwrote Owner `AGENTS.md` | Preserve file; upsert managed block only |
| CORR3-05 | Truth zero-target default | Seed `.ohno/truth.json` with `AGENTS.md` when absent |
| CORR3-06 | `git add .ohno` too coarse | `.ohno/.gitignore` for locks/runtime; init tip lists canonical files |
| CORR3-07 | Silent test-denominator shrink | Soft WARN on plan propose + doctor when stop/expected name heavier path than test |

## Still open

| ID | Sev | Note |
| --- | --- | --- |
| FT-LIVE-05 | P2 | Cockpit process-bound (mitigated by port/stop/replace) |
| FT-LIVE-06 | P2 | `--allow-weak-plan` remains explicit Owner override |
| FT-LIVE-08 | P2 | Windows PATH / agent shell |
| CORR3-OPEN-01 | P2 | Full suite/perf re-green for eventual release claim |
| CORR3-OPEN-02 | P2 | README.zh-CN.md historical mojibake needs rewrite (badge status fixed) |
| CORR3-OPEN-03 | P2 | Existing trial projects need re-init or manual truth/handoff hygiene |

## Non-goals

- Rewrite into a governance platform  
- Auto-planning from one Owner sentence  
- Hostile same-user security  
