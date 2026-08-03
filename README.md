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
  <a href="#why-oh-no">Why</a> ·
  <a href="#how-control-works">How it controls Codex</a> ·
  <a href="#cockpit">Cockpit</a> ·
  <a href="#eighteen-sins">The Eighteen Sins</a> ·
  <a href="#install">Install</a> ·
  <a href="#daily-use">Use</a> ·
  <a href="#limits-evidence">Limits & evidence</a>
</p>

---

<a id="why-oh-no"></a>

## Why Oh No?

Codex can write good code and still take a project in the wrong direction. It
may broaden the request, keep working after success, trust stale plans, or make
the next session reconstruct everything from chat.

Oh No, Codex! adds a small local harness around that workflow. It keeps the
Owner’s words, one bounded task, one exact black-box test, fresh evidence, and
one next action readable across sessions.

> **Owner goal → frozen task → bounded work → exact test → PASS or stop → one next action**

The product grew from a public audit of [**The Eighteen Sins of
Codex**](./docs/CODEX-SINS.md): recurring ways an agent can look productive
while the project drifts.

Package: [`oh-no-codex`](https://www.npmjs.com/package/oh-no-codex) · command:
`ohno` · current release: **`0.1.10`**.

---

<a id="how-control-works"></a>

## How it controls Codex

This is not one giant prompt and it does not try to read the Agent’s mind.
Control happens at a few concrete points in the coding loop:

| Moment | What Oh No does |
| --- | --- |
| Remember | Saves important Owner words verbatim in `.ohno/REQUIREMENTS.md` instead of trusting chat summaries |
| Plan | Freezes the current task’s expected behavior, one exact test, allowed files, time budget, and stop condition |
| Work | Codex hooks and Git pre-commit guard supported writes when there is no active task, document sync is pending, or a path is outside scope |
| Prove | `ohno verify` runs the frozen black-box command; FAIL / UNKNOWN do not advance the task |
| Resume | `status`, `resume`, `next`, hooks, and Cockpit read the same atomic project state |
| Change | `ohno change` uses the Owner-maintained Truth list to select applicable governing documents, then blocks coding until their exact diff and replacement plan are reviewed |

```text
Owner words + reviewed plan
            │
            ▼
       current task ──► exact black-box test ──► PASS / stay active
            │
            ▼
   .ohno/state.json ──► resume / next / hooks / Cockpit

.ohno/truth.json ──► documents that must change when requirements change
```

`.ohno/state.json` is the sole current runtime authority. Resume text,
`PROGRESS.md`, receipts, and Cockpit are projections or evidence—not competing
versions of the truth.

The hooks are cooperative guardrails. A same-user process can bypass them; Oh
No does not claim hostile-agent security or perfect semantic understanding.

---

<a id="cockpit"></a>

## Cockpit: current project state at a glance

<p align="center">
  <img
    src="./assets/brand/oh-no-cockpit.png"
    width="960"
    alt="Oh No, Codex! Cockpit — current task, plan board, proof, drift, and next action"
  >
</p>

<p align="center">
  <sub>Real local layout-demo capture. Cursor 3/14 means plan progress, not product completion.</sub>
</p>

The Cockpit is read-only and shows the same data as `ohno status --json`:

- **NOW** — the active task, expected user behavior, and exact test;
- **PROOF / DRIFT** — whether evidence is fresh and what currently blocks work;
- **NEXT / PLAN BOARD** — the one allowed next step and where the linear plan stands.

```bash
ohno cockpit                       # start on a free local port
ohno cockpit --port 13521          # optional fixed port
ohno cockpit --replace             # replace this repo's running Cockpit
ohno cockpit stop
```

Each repository or worktree has its own `.ohno/` state and its own Cockpit.
The page polls the local read-only state endpoint; it is not a daemon or a
second state store.

---

<a id="eighteen-sins"></a>

## The Eighteen Sins of Codex

The name is deliberate. These are 18 distinct, privacy-scrubbed failure
patterns—not a claim that every Codex run fails.

| # | Pattern | What you see |
| ---: | --- | --- |
| 1 | Semantic usurpation | A narrow request quietly becomes a larger product or architecture |
| 2 | Maximum interpretation | Words such as “control” or “robust” are interpreted at the highest imaginable level |
| 3 | Never stopping | Acceptance already passed, but the Agent keeps editing or opens another phase |
| 4 | Review as edit rights | An inspect or audit request turns into unapproved edits and commits |
| 5 | Zombie authority | An old plan or summary overrides the Owner’s latest decision |
| 6 | Summary as truth | A compacted handoff hardens omissions into false project history |
| 7 | Local green = complete | One unit or mocked path becomes a claim that the whole feature is done |
| 8 | Self-certified closure | The same Agent defines success, implements it, and cites itself as proof |
| 9 | Test theatre | Tests prove internals while the user-visible path remains broken or untested |
| 10 | Proxy goals | Coverage, architecture neatness, or reviewer taste outranks the Owner’s outcome |
| 11 | Reviewer inflation | Review adds criteria that were never frozen, so the task cannot finish |
| 12 | Control-tax blindness | The guardrail becomes slower and heavier than the drift it prevents |
| 13 | Rebuilding the world | Git, tests, and simple files are replaced by a new platform before value ships |
| 14 | Workspace confusion | Work lands in the wrong branch, worktree, HEAD, or dirty checkout |
| 15 | Handoff tax | Every new session must reconstruct the project from chat archaeology |
| 16 | UX last | Internal machinery grows while the user experience stays generic or untested |
| 17 | Agree + overclaim | An apology is followed by another unmeasured promise |
| 18 | Apology without constraint | The failure is explained, but no test or working rule changes |

Read the complete incident audit and evidence boundary:
[`docs/CODEX-SINS.md`](./docs/CODEX-SINS.md).

---

<a id="install"></a>

## Install

Requires Node.js **22.20 or newer**.

```bash
npm install -g oh-no-codex

cd your-git-repo
ohno init --goal "Owner project goal"
ohno install
ohno doctor
```

`ohno install` adds the project hooks and installs the `oh-no-*` Codex skills.
Start a new Codex session after skill installation so discovery reloads.

Skills can also be refreshed separately:

```bash
ohno skill install
ohno skill status
```

### Windows

Put the global npm bin directory on `PATH` and run `ohno` or `ohno.cmd` in a
terminal. Do not double-click `dist\cli.js`; Windows Script Host cannot run
that ESM entry.

### Existing or half-built repositories

Oh No can be added beside existing code, but it does not automatically infer
old truth, completed work, or the correct plan from Git history.

1. Initialize with the **current stage** goal—not the entire historical vision.
2. Record what is already true, what must ship now, non-goals, and hard constraints in the Owner’s original words.
3. Review which PRD, design, acceptance, plan, README, and Agent files are current governing documents; keep one winning set in Truth.
4. Plan only work that still needs a user-visible black-box proof. Do not invent historical PASS receipts.
5. Start the cursor task, work inside its file boundary, and let `ohno verify` decide whether it advances.

```bash
ohno init --goal "Current-stage Owner goal"
ohno install
ohno doctor
ohno requirements note --text "What is already true in this repository"
ohno requirements note --text "What this stage must still deliver"
```

If governing requirements change after setup, use `ohno change`; do not edit
`.ohno/state.json` by hand or silently replace the plan.

---

<a id="daily-use"></a>

## Daily use

### The minimal loop

Normally you can tell Codex, “Draft a bounded plan.” The installed
`oh-no-plan` skill prepares the plan file and review flow; the commands below
are the same deterministic loop when you want to run it directly.

```bash
ohno requirements note --text "Owner words, verbatim"  # when a real decision is made
ohno plan propose --file plan.json
ohno plan accept --revision <rev> --diff <digest>
ohno task start
# Codex works only on the frozen task and allowed files
ohno verify
ohno resume
ohno next
```

- A zero-exit exact test with unchanged scoped files creates a fresh PASS and
  advances once.
- FAIL, timeout, unreadable state, or test-time mutation leaves the task active.
- `next` tells you where the plan stands; it is not permission for the Agent to
  invent another task.

### Talk naturally in Codex

The installed skills translate ordinary requests into the matching workflow:

| What you say | Skill / command |
| --- | --- |
| “Remember this requirement exactly” | `oh-no-requirements` → `ohno requirements note` |
| “Draft or review the bounded plan” | `oh-no-plan` |
| “Start the current task” | `oh-no-task` → `ohno task start` |
| “I think this task is done” | `oh-no-verify` → `ohno verify` |
| “Where are we?” | `oh-no-resume` / `ohno status` |
| “The requirements changed” | `oh-no-change` |
| “Open the board” | `oh-no-cockpit` → `ohno cockpit` |
| “Check the installation” | `oh-no-doctor` |

Owner decisions belong in `.ohno/REQUIREMENTS.md`, not only in chat. All Codex
sessions opened in the same repository read the same project files, so a new
session can recover without trusting an old conversation summary.

---

<a id="limits-evidence"></a>

## Honest limits and evidence

Oh No is a cooperative local harness, not an autonomous agent OS or security
boundary. It does not prevent `--no-verify`, direct same-user file writes,
unsupported hosted tools, or an Agent that deliberately ignores every rule.

It also does not judge prose by NLP, reconstruct a half-built product
automatically, or guarantee universal correctness and speed. Cockpit progress
is `cursor / task_count`, never a product-completion percentage.

| Public fact | Current evidence |
| --- | --- |
| Package | [`oh-no-codex@0.1.10`](https://www.npmjs.com/package/oh-no-codex) is published |
| Core loop | `ANTI_DRIFT_CORE_WORKS` with local public black-box coverage |
| Real-project trial | `TRIAL_PASS` on three small disposable project copies; not a universal large-repo claim |
| Cockpit | Read-only equality with the CLI state plus browser and local reflection checks |

Read the exact contracts and evidence:

- [Product contract](./docs/PRODUCT-CONTRACT.md)
- [Design](./docs/DESIGN.md)
- [Acceptance contract](./docs/ACCEPTANCE.md)
- [Implementation ledger](./docs/IMPLEMENTATION-PLAN.md)
- [Cockpit design contract](./docs/COCKPIT-DESIGN-CONTRACT.md)
- [Publish procedure](./docs/PUBLISH.md)

---

<p align="center">
  <sub>MIT · Independent community project · Not affiliated with OpenAI</sub>
</p>

<p align="center"><a href="#readme-top">↑ top</a></p>
