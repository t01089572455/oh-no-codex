# VibeTether → Oh No, Codex! essence backlog

Status: **COMPLETE + REQUIREMENTS LOG** (Owner 2026-07-31)

## Reading honesty (must read)

**No — this is not a claim that every VibeTether version and every Codex session
was read end-to-end.** That corpus is multi-GB (many publish caches, bootstraps,
and JSONL rollouts). Doing so would waste context and mostly re-learn overdesign.

What **was** sampled for essence decisions:

| Line | Sample | Contribution |
| --- | --- | --- |
| **0.6.0** | published npm package under `vibetether-npm-cache-v060` | Truth map, AGENTS markers, doctor, bootstrap, checkpoints |
| **0.6.3** | `vibetether-1.0.0-review/baseline-v0.6.3-*` | Same thin control surface |
| **1.0 RC** | `vibetether-1.0.0-review/acceptance` | `<!-- vibetether:start/end -->`, TRUTH.md, launcher AGENTS inject |
| **RC3 / R3 / B-v3** | `vibetether-rc3-hardening-v1` + sessions `019fb159`, `019fb3b4`, R3 threads | PROGRESS.md, cockpit ambition, **overdesign failure** |
| **Oh No pivot + V1** | `oh-no-codex` + session `019fb362` | What already exists |

**Judgment on “other versions”:** after 0.6 → 1.0 → R3, later lines mostly add
Gateway / providers / deep permits / gate matrices — **not** new lightweight
essences worth porting. Early 0.6-style thin control is where almost all good
ideas live.

## Defects (do not port)

- Effect Gateway / Grant / production adapter trust
- Gate Matrix / 40+ migration slices / sealed replay
- Multi-provider skill marketplace as core path
- Deep-mode permits as a second product
- Treating PROGRESS / Capsule / Cockpit as second authority
- Absolute same-user security claims
- Autonomous rewrite of whole AGENTS.md / governing prose

## Portable essences (complete list)

| ID | Essence | VT source | Oh No target | Status |
| --- | --- | --- | --- | --- |
| E1 | Plan board DONE/HALF/READY/QUEUED/OUTLINE | Progress table idea | `plan_board` + Cockpit | **DONE** |
| E2 | Generated progress file | `.vibetether/PROGRESS.md` | `.ohno/PROGRESS.md` | **DONE** |
| E3 | AGENTS managed block only | `vibetether:start/end` markers | `ohno:managed-begin/end` | **DONE** |
| E4 | Truth list legible | TRUTH.md list | `truth_targets[]` + Cockpit list | **DONE** |
| E5 | Handoff identity | worktree identity | `handoff` + resume HANDOFF_* | **DONE** |
| E6 | Session re-entry refresh | re-enter at start/compact | SessionStart/PostCompact → projectors | **DONE** |
| E7 | Doctor health surface | `vibetether doctor` | `ohno doctor [--json]` | **DONE** |
| E8 | Init scaffolds AGENTS markers | bootstrap | `ohno init` writes managed block | **DONE** |
| E9 | Owner requirements aggregation file | “all asks in one file” pattern + VT intent | `.ohno/REQUIREMENTS.md` + `ohno requirements note/show` | **DONE** |
| E10 | Doctor pressure on sprawl / fake tests | sins #2/#9/#13 | `scope_discipline` + `blackbox_discipline` WARN | **DONE** |

## Explicitly not scheduled (non-essences)

- Experience / proven-path recall marketplace
- Provider/Skill routing shortlist
- Deep Start Card + Implementation Permit
- Multi-agent worktree orchestration product
- Outcome DAG / required-open-satisfied counters as authority
- CLAUDE.md dual-stack (Codex-only V1)

## Verification (owning checks)

- `node --test test/blackbox/projectors.test.mjs` — pass
- `node --test test/blackbox/codex-hooks.test.mjs` — pass
- `node --test test/blackbox/resume-status-next.test.mjs` — pass
- `node --test test/blackbox/cockpit.test.mjs` — pass

## Exact next

> **Stop.** Scheduled essences E1–E10 are implemented as projections of
> `.ohno/state.json` only (REQUIREMENTS log is Owner notes + live projection,
> never a second authority). Do not reintroduce Gateway / multi-authority
> design. Do not invent eighteen new subsystems to “cure” the sins.
