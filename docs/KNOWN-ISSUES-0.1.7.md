# Known issues after Correction 3 (0.1.7)

Date: 2026-08-01
Package: oh-no-codex@0.1.7

## Public status (honest)

| Label | Meaning |
| --- | --- |
| `ANTI_DRIFT_CORE_WORKS` | Core cooperative harness works on real multi-slice Codex sessions |
| `FIELD_TRIAL_PARTIAL` | Field trial is partial; not every product loop closed on real projects |
| `RELEASE_CHANGES_REQUIRED` | Do not claim `V1_TRIAL_ACCEPTED` / publish until Owner authorizes npm |

## Fixed in 0.1.7 (+ Codex follow-up)

| ID | Issue | Fix |
| --- | --- | --- |
| CORR3-01 | Green `V1_TRIAL_ACCEPTED` without naming isolation | Split public labels: core vs release |
| CORR3-02 | `ACTIVE` → `next=NONE` protocol gap | `CONTINUE_ACTIVE:<id>`; active FAIL → `RUN_EXACT_TEST`; closed STALE → `REOPEN_TASK` |
| CORR3-03 | Project goal vs task goal | `ohno init --goal` required; read surfaces use project goal only (#10) |
| CORR3-04 | init overwrote Owner `AGENTS.md` | Preserve file; upsert managed block only |
| CORR3-05 | Truth zero-target / AGENTS-only seed | Seed all *present* high-risk paths (README, docs contracts, AGENTS, …) |
| CORR3-06 | Git handoff + wrong runtime name | Ignore `cockpit.runtime.json`; init tip lists canonical files |
| CORR3-07 | Denominator shrink | **Repaired:** structured acceptance basis (exact task match); keywords retired |
| CORR3-08 | Mixed performance receipt | **Closed for candidate:** same-batch `LIVE` P01–P06 (evidence JSON) |
| CORR4-01 | Keyword gate false “hard close” | Replaced by structured basis + schema 2→3 migrate |

## Still open

| ID | Sev | Note |
| --- | --- | --- |
| FT-LIVE-05 | P2 | Cockpit process-bound (mitigated by port/stop/replace) |
| FT-LIVE-06 | P2 | `--allow-weak-plan` remains explicit Owner override |
| FT-LIVE-08 | P2 | Windows PATH / agent shell |
| CORR3-OPEN-01 | — | **Closed for 0.1.7 candidate:** LIVE P01–P06 receipts; performance gate green |
| CORR3-OPEN-02 | — | **Closed:** README.zh-CN rewritten UTF-8, aligned with EN status |
| CORR3-OPEN-03 | P2 | Existing trial projects need goal/truth/handoff hygiene |
| PUBLISH-01 | P1 | `npm publish` still requires explicit Owner authorization |

## Non-goals

- Rewrite into a governance platform
- Auto-planning from one Owner sentence
- Hostile same-user security
