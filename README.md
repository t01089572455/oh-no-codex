<a id="readme-top"></a>

<div align="center">

[**English**](./README.md) · [简体中文](./README.zh-CN.md)

</div>

<br>

<p align="center">
  <img
    src="./assets/brand/oh-no-codex-lockup.png"
    width="720"
    alt="Oh No, Codex!"
  >
</p>

<p align="center">
  <strong>Local anti-drift harness for Codex.</strong><br>
  One bounded task. One user-visible black-box command. One atomic
  <code>.ohno/state.json</code>. Fresh PASS evidence. One next locator.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/oh-no-codex"><img alt="npm" src="https://img.shields.io/npm/v/oh-no-codex?style=flat-square&color=74D6B1&labelColor=202624&label=npm"></a>
  <img alt="status" src="https://img.shields.io/badge/status-ANTI_DRIFT_CORE_WORKS-3DDC97?style=flat-square&labelColor=202624">
  <img alt="node" src="https://img.shields.io/badge/node-%3E%3D22.20-74D6B1?style=flat-square&labelColor=202624">
  <img alt="codex" src="https://img.shields.io/badge/for-Codex-FF4B35?style=flat-square&labelColor=202624">
  <a href="./LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-FFF1CE?style=flat-square&labelColor=202624"></a>
</p>

<p align="center">
  <a href="#contract">Contract</a> ·
  <a href="#authority">Authority</a> ·
  <a href="#failure-modes">Failures</a> ·
  <a href="#install">Install</a> ·
  <a href="#operation">Operate</a> ·
  <a href="#cockpit">Cockpit</a> ·
  <a href="#evidence">Evidence</a>
</p>

---

## Contract

Package: [`oh-no-codex`](https://www.npmjs.com/package/oh-no-codex) · binary: `ohno` · current: **`0.1.8`**.

| Rule | Meaning |
| --- | --- |
| Bound | Cursor task freezes expected behavior, **one** exact test command, allowed globs, budget, stop condition |
| Prove | `ohno verify` runs that command only; PASS is a receipt (task + plan rev + HEAD + scoped digests) |
| Advance | Fresh PASS closes the task once and advances `cursor`; FAIL / UNKNOWN leave the task active |
| Locate | `next` is a **locator**, not authorization to start new work |
| Recover | `status` / `resume` / hooks / Cockpit all read the same atomic state |
| Change | Requirement edits sync named governing docs via `ohno change` before coding continues |

Not a product claim: autonomous multi-agent OS, hostile same-user security, database, daemon, hosted control plane.

---

## Authority

```text
ohno CLI  ──atomic replace──►  .ohno/state.json   (sole runtime authority)
                                    │
                                    ├─ status / resume / next
                                    ├─ Codex hooks + Git pre-commit
                                    └─ GET /api/state  →  Cockpit (read-only)

.ohno/truth.json  →  which Owner docs apply on requirement change
```

| Artifact | Role |
| --- | --- |
| `.ohno/state.json` | Current goal, plan, cursor, active contract, proof, next |
| `.ohno/truth.json` | Governing-document applicability list (Owner-maintained) |
| PASS receipt | Provenance + verify CAS; not a second “current truth” |
| `PROGRESS.md` / resume text / Cockpit | Projections only |
| `.ohno/cockpit.runtime.json` | pid / URL pointer only |

Cooperative hooks inject the resume capsule and deny some out-of-scope writes. A same-user process can still bypass them; that is an explicit non-goal.

---

## Failure modes

Codex can stay “busy” while the repo drifts. The harness is built against these patterns (full audit: [`docs/CODEX-SINS.md`](./docs/CODEX-SINS.md)):

| # | Pattern | Symptom |
| ---: | --- | --- |
| 1 | Semantic usurpation | Door request → castle |
| 2 | Maximum interpretation | “Control” → platform |
| 3 | Never stopping | Slice PASS; work continues |
| 4 | Review as edit rights | “Inspect” → silent rewrite |
| 5 | Zombie authority | Stale plan beats latest decision |
| 6 | Summary as truth | Compaction hardens false history |
| 7 | Local green = complete | Mock ships as done |
| 8 | Self-certified closure | Same agent writes claim and applause |
| 9 | Test theatre | Internals green; user path broken |
| 10 | Proxy goals | Coverage over outcome |
| 11 | Reviewer inflation | Endless new acceptance |
| 12 | Control-tax blindness | Tool costs more than drift |
| 13 | Rebuilding the world | New machinery over Git/tests |
| 14 | Workspace confusion | Wrong tree / branch / dirty tree |
| 15 | Handoff tax | Next session rebuilds from chat |
| 16 | UX last | Internals for weeks; UI untested |
| 17 | Agree + overclaim | Instant apology; unmeasured promise |
| 18 | Apology without constraint | Soft regret; same failure tomorrow |

Product collapse of the list: **Owner semantics win · one frozen contract · evidence ends the slice · review is read-only · project state outranks chat · public black box outranks internal green · latency is acceptance · workspace identity is exact.**

---

## Install

```bash
npm install -g oh-no-codex
# mirrors may lag a fresh release:
# npm install -g oh-no-codex@0.1.8 --registry https://registry.npmjs.org

cd your-git-repo
ohno init --goal "Owner project goal"   # goal required
ohno install                            # hooks + ~/.codex/skills/oh-no-*
```

```bash
ohno skill install    # skills only
ohno skill status
# new Codex session required for skill discovery
```

Node.js **≥ 22.20** (stable `path.matchesGlob`).

### Windows

- Global npm bin on `PATH` (`%AppData%\npm` or custom prefix).
- Use `ohno` / `ohno.cmd`. Do not double-click `dist\cli.js` (WSH cannot run that ESM entry).
- Cockpit progress is **`cursor / task_count`**, not product completion.

---

## Operation

Setup is terminal-only. Day-to-day: natural language → Codex loads `oh-no-*` skill → runs the matching `ohno` command. Hooks assist; **completion still requires a real `ohno verify`**.

### Minimal loop

```bash
ohno plan propose --file plan.json
ohno plan accept --revision <rev> --diff <digest>
ohno task start                 # no caller-supplied contract fields
# …edit only allowed_files…
ohno verify                     # exact frozen test_command
ohno resume                     # recover from files, not chat
ohno next                       # locator only
```

### Language → skill

| You | Skill / command |
| --- | --- |
| Draft / accept linear plan | `oh-no-plan` |
| Start / reopen cursor slice | `oh-no-task` → `ohno task start` |
| Done | `oh-no-verify` → `ohno verify` |
| Where are we | `oh-no-resume` / `ohno status` |
| Remember Owner words | `oh-no-requirements` |
| Requirements changed | `oh-no-change` |
| Board | `oh-no-cockpit` → `ohno cockpit` |
| Health | `oh-no-doctor` |
| Hub | `oh-no-control` |

Also: `oh-no-status`, `oh-no-next`, `oh-no-preferences`, `oh-no-projectors` (13 skills total). Setup (`init` / `install`) is not a skill.

### When you run the CLI yourself

| Situation | Action |
| --- | --- |
| First repo | `ohno init` + `ohno install` |
| Model claims done without verify | Force `ohno verify` |
| Skills missing after upgrade | `ohno skill install` + new session |
| Need certainty | Run the command in your own terminal |

**Hard rules:** no PASS → not done. `next` ≠ blank cheque. Long CLI dumps in chat are noise.

---

## Cockpit

Read-only local board. Same payload as `ohno status --json`. Never mutates plan/state.

```bash
cd your-git-repo            # must already be init'd
# worktree: cd that worktree — each tree has its own .ohno/
ohno cockpit
ohno cockpit --port 13521
ohno cockpit stop
ohno cockpit --replace
ohno cockpit --replace --port 13521
```

```text
Cockpit: http://127.0.0.1:<port>/
```

Visible tab polls `/api/state` ~100ms (design band 100–125ms). Not a daemon: Ctrl+C or `ohno cockpit stop`.

| Rule | Behavior |
| --- | --- |
| Default port | OS ephemeral (`0`) unless `--port N` |
| Same project already up | Print existing URL; exit |
| `--replace` | Kill prior cockpit for this cwd, then start |
| Multi-project | One process per project cwd; use distinct ports for stable tabs |
| Dead tab | **COCKPIT SERVER OFFLINE** (not corrupt `state.json`) |
| Progress bar | `cursor / task_count` only |

```text
plan accept / task start / verify
        │ atomic replace
        ▼
  .ohno/state.json
        │ readModel()
        ├── status / resume / next
        └── GET /api/state ── poll ── UI
```

---

## What ships

| Piece | Role |
| --- | --- |
| CLI | `init` · `plan` · `task` · `verify` · `change` · `migrate acceptance-basis` · `resume` · `status` · `next` · `doctor` · `cockpit` · … |
| 13 Codex skills | Discoverable day-to-day procedures |
| Hooks + pre-commit | Capsule inject + cooperative scope guard |
| Projectors | `PROGRESS.md`, `REQUIREMENTS.md`, short AGENTS block |
| Preferences | Optional craft defaults |
| Cockpit | Read-only status surface |

V1 budget: one package, one binary, one state file, one truth file, one hook config, one Git hook, one local read-only Cockpit.

---

## Evidence

| Claim | Label |
| --- | --- |
| Core harness | `ANTI_DRIFT_CORE_WORKS` |
| Public release | **`0.1.8` published** (cockpit UX); local trials remain `TRIAL_PASS`, not `V1_TRIAL_ACCEPTED` |
| CLI / hooks / atomic state | `LOCAL_PASS` |
| Cockpit = status JSON | `LOCAL_PASS` |
| Correction 4 acceptance basis | `LOCAL_PASS` (on main) |
| Disposable real-copy P01–P06 | **`TRIAL_PASS` LIVE** — p95 ms A/B/C: status 139.361 / 140.512 / 132.802; next 169.689 / 157.331 / 136.215; resume 168.616 / 195.458 / 193.012; task_start 136.947 / 156.410 / 159.346; P06 163 / 178 / 164; P04 resume 4006 B (batch-bound; not a universal speed claim) |
| npm | **`oh-no-codex@0.1.8`** on registry.npmjs.org; mirrors may lag |
| Schema 2 → 3 | Two-phase migrate: preview, then `--diff` / `--head` apply |

Contracts: [Product](./docs/PRODUCT-CONTRACT.md) · [Design](./docs/DESIGN.md) · [Acceptance](./docs/ACCEPTANCE.md) · [Publish](./docs/PUBLISH.md) · [Sins](./docs/CODEX-SINS.md)

---

<p align="center">
  <sub>MIT · Independent community project · Not affiliated with OpenAI</sub>
</p>

<p align="center"><a href="#readme-top">↑ top</a></p>
