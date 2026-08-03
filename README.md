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
  <strong>A fast, local anti-drift harness for Codex vibe coding.</strong>
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
  <a href="#eighteen-sins">The Eighteen Sins</a> ·
  <a href="#install">Install</a> ·
  <a href="#operation">Operate</a> ·
  <a href="#cockpit">Cockpit</a> ·
  <a href="#evidence">Evidence</a>
</p>

---

## Contract

Codex can write excellent code and still move the project in the wrong direction.
Oh No, Codex! keeps one Owner goal, one bounded task, one user-visible black-box
test, and one next action readable across sessions.

It was built in response to [**The Eighteen Sins of Codex**](./docs/CODEX-SINS.md):
18 recurring ways a coding agent can drift while still appearing productive.

Package: [`oh-no-codex`](https://www.npmjs.com/package/oh-no-codex) · binary: `ohno` · current: **`0.1.10`**.

| Rule | Meaning |
| --- | --- |
| Bound | Cursor task freezes expected behavior, **one** exact test command, allowed globs, budget, stop condition |
| Record | Owner instructions stay **verbatim** in `.ohno/REQUIREMENTS.md` via `ohno requirements note` — not paraphrased chat memory |
| Prove | `ohno verify` runs that command only; PASS is a receipt (task + plan rev + HEAD + scoped digests) |
| Advance | Fresh PASS closes the task once and advances `cursor`; FAIL / UNKNOWN leave the task active |
| Locate | `next` is a **locator**, not authorization to start new work |
| Recover | `status` / `resume` / hooks / Cockpit all read the same atomic state |
| Change | Material scope change: `ohno change` identifies applicable governing docs and verifies their reviewed diff before coding resumes |

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
| `.ohno/REQUIREMENTS.md` | Append-only log of **Owner’s original words** (prompts / decisions / constraints) |
| `.ohno/truth.json` | Governing-document applicability list (Owner-maintained) |
| PASS receipt | Provenance + verify CAS; not a second “current truth” |
| `PROGRESS.md` / resume text / Cockpit | Projections only |
| `.ohno/cockpit.runtime.json` | pid / URL pointer only |

Cooperative hooks inject the resume capsule and deny some out-of-scope writes. A same-user process can still bypass them; that is an explicit non-goal.

---

<a id="eighteen-sins"></a>

## The Eighteen Sins of Codex

**The Eighteen Sins of Codex** is the deliberate name for 18 distinct,
privacy-scrubbed failure patterns observed across long-running coding-agent work.

It is not a claim that every Codex run fails. It is a public incident taxonomy:
what users see, how the project is harmed, and which small constraint answers it.

Read the full audit and evidence boundary: [`docs/CODEX-SINS.md`](./docs/CODEX-SINS.md).

| # | Pattern | Symptom (what you see) |
| ---: | --- | --- |
| 1 | Semantic usurpation | You asked for a narrow outcome; the agent quietly solves a larger product you did not order |
| 2 | Maximum interpretation | Vague words (“control”, “robust”) become a platform / OS instead of the smallest useful fix |
| 3 | Never stopping | Frozen acceptance already PASS; agent keeps editing, committing, or opening a new phase on its own |
| 4 | Review as edit rights | You asked for inspect / diagnose / audit; it rewrites code, dispatches more agents, or commits |
| 5 | Zombie authority | An old plan, branch name, or progress note overrides your **latest** decision |
| 6 | Summary as truth | Handoff / compaction summary becomes “facts”; omissions harden into false history next session |
| 7 | Local green = complete | One unit test or mocked path is green → agent claims the feature / product is done |
| 8 | Self-certified closure | Same agent defines success, implements it, then cites its own prose as proof |
| 9 | Test theatre | Suite proves mocks / internals; the user-visible path you care about stays broken or untested |
| 10 | Proxy goals | Coverage, architecture neatness, or reviewer taste outranks the Owner’s product outcome |
| 11 | Reviewer inflation | Review adds new acceptance criteria that were never frozen; no slice can finish |
| 12 | Control-tax blindness | Extra gates / ledgers / full suites make ordinary work slower than the drift they prevent |
| 13 | Rebuilding the world | Replaces Git / tests / simple files with new gateways, journals, frameworks before value ships |
| 14 | Workspace confusion | Wrong worktree, branch, HEAD, or dirty tree; work or status lands on the wrong checkout |
| 15 | Handoff tax | Next session must reconstruct “where we are” from chat archaeology instead of one resume surface |
| 16 | UX last | Machinery grows for weeks; UI stays generic, unfinished, or never browser-accepted |
| 17 | Agree + overclaim | Instant apology, then another unmeasured promise (“fully controlled”, “prod ready”, “fast”) |
| 18 | Apology without constraint | Explains the drift; adds no test, hook, contract, or working rule — same failure next run |

Oh No’s answer in one line: **record Owner words · freeze one contract · evidence ends the slice · review is read-only · `state.json` outranks chat · public black box outranks internal green · measure latency · exact workspace identity.**

---

## Install

```bash
npm install -g oh-no-codex
# mirrors may lag a fresh release:
# npm install -g oh-no-codex@0.1.10 --registry https://registry.npmjs.org

cd your-git-repo
ohno init --goal "Owner project goal"   # goal required
ohno install                            # hooks + ~/.codex/skills/oh-no-*
```

```bash
ohno skill install    # skills only
ohno skill status
# new Codex session required for skill discovery
```

Node.js **≥ 22.20** (stable `path.matchesGlob`). Package version **`0.1.10`**.

### Windows

- Global npm bin on `PATH` (`%AppData%\npm` or custom prefix).
- Use `ohno` / `ohno.cmd`. Do not double-click `dist\cli.js` (WSH cannot run that ESM entry).
- Cockpit progress is **`cursor / task_count`**, not product completion.

---

## Operation

Setup is terminal-only. Day-to-day: natural language → Codex loads `oh-no-*` skill → runs the matching `ohno` command. Hooks assist; **completion still requires a real `ohno verify`**.

### Minimal loop

```bash
ohno requirements note --text "Owner words, verbatim"   # optional but recommended whenever scope is stated
ohno plan propose --file plan.json
ohno plan accept --revision <rev> --diff <digest>
ohno task start                 # no caller-supplied contract fields
# …edit only allowed_files…
ohno verify                     # exact frozen test_command
ohno resume                     # recover from files, not chat
ohno next                       # locator only
```

### Owner words (anti-drift log)

Chat is ephemeral. When the Owner states a goal, constraint, non-goal, or decision,
**append the original wording** — do not only paraphrase into the model’s plan.

| Command | Effect |
| --- | --- |
| `ohno requirements note --text "…"` | Append one entry to `.ohno/REQUIREMENTS.md` (verbatim Owner line) |
| `ohno requirements show` | Print the log |
| skill `oh-no-requirements` | Same, from natural language (“remember this”) |

This is the **instruction corpus** for the project: later sessions, resume, and agents
should prefer these lines over compacted chat.

Material rewrites of scope still go through `ohno change` + a new plan. The log is
the durable quote sheet, not a second plan authority.

### Intent → skill

| You | Skill / command |
| --- | --- |
| Draft / accept linear plan | `oh-no-plan` |
| Start / reopen cursor slice | `oh-no-task` → `ohno task start` |
| Done | `oh-no-verify` → `ohno verify` |
| Where are we | `oh-no-resume` / `ohno status` |
| Record my words | `oh-no-requirements` → `ohno requirements note` |
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
| Projectors | `PROGRESS.md`, short AGENTS block |
| Requirements log | `.ohno/REQUIREMENTS.md` via `ohno requirements note/show` |
| Preferences | Optional craft defaults |
| Cockpit | Read-only status surface |

V1 budget: one package, one binary, one state file, one truth file, one hook config, one Git hook, one local read-only Cockpit.

---

## Evidence

| Claim | Label |
| --- | --- |
| Core harness | `ANTI_DRIFT_CORE_WORKS` |
| Public release | **`0.1.10` published** on registry.npmjs.org (`latest`); integrity + same-batch LIVE |
| CLI / hooks / atomic state | `LOCAL_PASS` (plan-proof frontier, migrate rebind, pre-commit projections, locks) |
| Cockpit = status JSON | `LOCAL_PASS` |
| Correction 4 acceptance basis | `LOCAL_PASS`; change/task-start re-check live basis |
| Disposable real-copy P01–P06 | **`TRIAL_PASS` LIVE** batch `live-20260803T100000Z-0bd5926` — p95 ms A/B/C: status 175.451 / 170.745 / 173.641; next 181.154 / 198.192 / 168.308; resume 220.441 / 230.675 / 251.55; task_start 200.263 / 206.14 / 187.783; P06 181 / 205 / 199; P04 resume 4025 B (**three small disposable copies only**; not a universal large-repo claim) |
| npm | **`oh-no-codex@0.1.10`** on registry.npmjs.org; mirrors may lag |
| Schema 2 → 3 | Two-phase migrate: preview, then `--diff` / `--head` apply |

Contracts: [Product](./docs/PRODUCT-CONTRACT.md) · [Design](./docs/DESIGN.md) · [Acceptance](./docs/ACCEPTANCE.md) · [Publish](./docs/PUBLISH.md) · [Sins](./docs/CODEX-SINS.md)

---

<p align="center">
  <sub>MIT · Independent community project · Not affiliated with OpenAI</sub>
</p>

<p align="center"><a href="#readme-top">↑ top</a></p>
