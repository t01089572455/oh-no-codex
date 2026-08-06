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
  <strong>A local anti-drift harness for Codex vibe coding</strong><br>
  <em>Let Codex work. When it drifts, pull it back to Truth.</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/oh-no-codex"><img alt="npm" src="https://img.shields.io/npm/v/oh-no-codex?style=flat-square&color=74D6B1&labelColor=202624&label=npm"></a>
  <img alt="status" src="https://img.shields.io/badge/status-ANTI_DRIFT_HARNESS-3DDC97?style=flat-square&labelColor=202624">
  <img alt="node" src="https://img.shields.io/badge/node-%3E%3D22.20-74D6B1?style=flat-square&labelColor=202624">
  <img alt="codex" src="https://img.shields.io/badge/for-Codex-FF4B35?style=flat-square&labelColor=202624">
  <a href="./LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-FFF1CE?style=flat-square&labelColor=202624"></a>
</p>

<p align="center">
  <a href="#why">Why</a> ·
  <a href="#what">What it does</a> ·
  <a href="#eighteen-sins">Eighteen Sins</a> ·
  <a href="#how">How it works</a> ·
  <a href="#install">Install</a> ·
  <a href="#cockpit">Cockpit</a> ·
  <a href="#limits">Limits</a>
</p>

---

<a id="why"></a>

## Why Oh No?

Codex writes strong code and still steers projects wrong:

- ships freestyle without reading design or requirements  
- treats a green unit test as “feature done”  
- keeps expanding after acceptance  
- forces every new session to reconstruct progress from chat  

That is not only “the model is dumb.” It is **not bound to Truth**.  
The public incident audit names these patterns  
[**The Eighteen Sins of Codex**](./docs/CODEX-SINS.md).

**Oh No is not a second project manager and not an OS sandbox.**  
It is a **small, local, cooperative harness** that keeps Codex on:

**Owner words · design docs · one bounded task · a real black-box proof · one next action.**

> **Let Codex work. When it drifts, pull it back to Truth.**  
> Not “read every governing doc before every write” — that is control tax, not anti-drift.

---

<a id="what"></a>

## What Oh No does

Across real Codex sessions, Oh No does the same job on every project:

| Role | What you get |
| --- | --- |
| **Capture Truth** | Owner prompts land in OWNER-INPUTS; requirements/design live under `.ohno`; latest Owner words win |
| **Stage the work** | Clarify → design → plan → execute, with **`OHNO_PROMPT_RAILS`** injected by hooks so Codex does not freestyle product code too early |
| **Pin tasks** | A plan board: each slice has expect, hard test, and file scope; one ACTIVE task at a time |
| **Prove done** | Only **`ohno verify`** counts; soft black boxes and agent prose do not |
| **Pull on drift** | Soft tests, scope issues, stalls → re-read Truth / design / frozen contract → fix implement or plan → verify again |
| **Resume cleanly** | Next session: `ohno`, resume, or Cockpit — not chat archaeology |

Humans mostly:

```text
ohno setup  →  talk to Codex  →  (optional) ohno / verify / cockpit
```

Internals (**hooks + skills + state**) inject the law, log prompts, follow the board, and run acceptance.

**In the field, in one line:**  
From a one-shot Owner ask, Codex can research, write Truth, design, freeze slices, and implement with verify — and on large, document-heavy work it can keep advancing on a board with real proofs instead of inventing a new story every hour.  
**Same harness. Different boards. Same job: stay on Truth.**

---

<a id="eighteen-sins"></a>

## The Eighteen Sins of Codex

The name is deliberate. Eighteen distinct failure patterns — not a claim that every run fails.

| # | Pattern | What you see |
| ---: | --- | --- |
| 1 | Semantic usurpation | A narrow ask becomes a larger product |
| 2 | Maximum interpretation | “Robust / control” maxed into overbuild |
| 3 | Never stopping | PASS already landed; Agent keeps going |
| 4 | Review as edit rights | Audit turns into unapproved edits |
| 5 | Zombie authority | Old plan overrides latest Owner decision |
| 6 | Summary as truth | Compaction hardens false history |
| 7 | Local green = complete | Mock green claimed as feature done |
| 8 | Self-certified closure | Same Agent defines, builds, and cites itself |
| 9 | Test theatre | Internals green; user path broken |
| 10 | Proxy goals | Coverage neatness outranks Owner outcome |
| 11 | Reviewer inflation | Review adds never-frozen criteria |
| 12 | Control-tax blindness | Guardrail heavier than the drift |
| 13 | Rebuilding the world | New platform before value ships |
| 14 | Workspace confusion | Wrong branch / worktree |
| 15 | Handoff tax | Every session rebuilds from chat |
| 16 | UX last | Machinery grows; UX stays generic |
| 17 | Agree + overclaim | Apology → another empty promise |
| 18 | Apology without constraint | Explains failure; no rule changes |

Full audit: [`docs/CODEX-SINS.md`](./docs/CODEX-SINS.md).

Oh No answers them with **prompt law (`OHNO_PROMPT_RAILS`) + state board + verify** — cooperative constraints, not magical immunity.

---

<a id="how"></a>

## How it works

```text
You:  ohno setup once, then talk to Codex only
        │
        ▼
Hooks ──► log Owner words + inject OHNO_PROMPT_RAILS
        │
        ▼
State ──► .ohno/state.json is the sole current authority
        │
        ▼
Codex ──► clarify → design → plan slices → implement → ohno verify
        │
        ▼
Drift ──► re-read Truth / design / contract → fix code or plan → verify again
```

### Commands you actually need

```bash
ohno setup       # once: init + hooks + skills
ohno             # one-screen status + next
ohno pipeline    # exact next commands for the Agent
ohno verify      # only “done” proof
ohno doctor      # health check
ohno cockpit     # optional read-only board
```

Speak normally in Codex; installed `oh-no-*` skills steer the Agent toward these commands.

---

<a id="install"></a>

## Install

Requires Node.js **≥ 22.20**.

```bash
npm install -g oh-no-codex

cd your-git-repo
ohno setup
# open a new Codex session, then talk
```

From source (current `main`):

```bash
git clone https://github.com/t01089572455/oh-no-codex.git
cd oh-no-codex
npm install && npm run build && npm install -g .
```

**Existing repos:** setup does not invent old truth from Git history. Capture what is already true, freeze a plan for work that still needs user-visible proof, and do not forge historical PASS receipts.

**Requirements change:** re-clarify / change path under Oh No — do not hand-edit `.ohno/state.json` into a fake complete.

---

<a id="cockpit"></a>

## Cockpit

<p align="center">
  <img
    src="./assets/brand/oh-no-cockpit.png"
    width="960"
    alt="Oh No, Codex! Cockpit"
  >
</p>

<p align="center">
  <sub>Read-only view of the same state as the CLI. Cursor progress is this plan only, not whole-product done.</sub>
</p>

```bash
ohno cockpit
```

---

<a id="limits"></a>

## Limits (honest)

- **Cooperative** guardrails, not an OS sandbox — the model can still ignore prompts.  
- **No semantic court** (“did you understand?”) — Oh No binds **read docs, follow the board, prove with verify**.  
- **Pull on drift**, not a forced Truth sermon before every write.  
- Proof is only as strong as the **frozen user-visible test**; soft tests make soft harnesses.  
- Oh No does not choose your product vision; Owner goals still rule.

---

## License

[MIT](./LICENSE)
