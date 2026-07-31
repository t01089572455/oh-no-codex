<a id="readme-top"></a>

<div align="center">

[**English**](./README.md) · [简体中文](./README.zh-CN.md)

</div>

<br>

<p align="center">
  <img
    src="./assets/brand/oh-no-codex-lockup.png"
    width="920"
    alt="Oh No, Codex! — a mischievous blue coding plush stopped mid-run by a clear red cross"
  >
</p>

<p align="center">
  <strong>Codex can write great code and still make the project worse.</strong><br>
  Oh No is a local harness that keeps vibe-coding <em>aligned</em>:<br>
  one goal, one frozen task, one user-visible black-box test, fresh proof — and a clear stop for <em>that task</em>.
</p>

<p align="center">
  <code>align</code>&nbsp;&nbsp;·&nbsp;&nbsp;<code>bound</code>&nbsp;&nbsp;·&nbsp;&nbsp;<code>prove</code>&nbsp;&nbsp;·&nbsp;&nbsp;<code>recover</code>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/oh-no-codex"><img alt="npm" src="https://img.shields.io/npm/v/oh-no-codex?style=flat-square&color=74D6B1&labelColor=202624&label=npm"></a>
  <img alt="status" src="https://img.shields.io/badge/status-V1_TRIAL_ACCEPTED-74D6B1?style=flat-square&labelColor=202624">
  <img alt="codex" src="https://img.shields.io/badge/for-Codex_CLI-FF4B35?style=flat-square&labelColor=202624">
  <img alt="node" src="https://img.shields.io/badge/node-%E2%89%A522.20-74D6B1?style=flat-square&labelColor=202624">
  <a href="./LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-FFF1CE?style=flat-square&labelColor=202624"></a>
</p>

<p align="center">
  <a href="#the-real-problem">Problem</a> ·
  <a href="#the-eighteen-sins">18 sins</a> ·
  <a href="#what-oh-no-is-for">What it is for</a> ·
  <a href="#install">Install</a> ·
  <a href="#daily-use">Daily use</a> ·
  <a href="#evidence">Evidence</a>
</p>

---

## The real problem

The main failure is not “Codex is offline.”  
It is **drift while coding**: the repo moves away from what you asked for, even when the model looks productive.

In practice that shows up as:

| Rank | What goes wrong | Example |
| --- | --- | --- |
| **1 · Scope & meaning** | Your words are enlarged or replaced | “Draft save” becomes a provider platform |
| **2 · Fake done** | Internal green ≠ user-visible success | Unit mocks pass; reload still loses the draft |
| **3 · Lost truth** | Chat / old plans outrank the project | New session rebuilds reality from prose |
| **4 · Won’t close the slice** | After a real pass, work keeps sprawling | “Next” is treated as a blank cheque for new work |

Item 4 is real (sin #3) — but it is **one symptom** of drift, not the whole product.

What we optimise for is the question every new session should answer from **project files**, not from memory:

1. What is the Owner trying to achieve?  
2. What is already complete?  
3. What is the **one** active bounded task?  
4. What user-visible behaviour and **exact** test define success?  
5. What is blocking?  
6. What is the **one** next action (a locator — not new permission)?

That is the product contract in plain language.

---

## The eighteen sins

Named anti-patterns from a long audit of agent sessions.  
They are the **enemy list** behind the design — not eighteen new features.

| # | Sin | One line |
| ---: | --- | --- |
| 1 | Semantic usurpation | You asked for a door; it built a castle. |
| 2 | Maximum interpretation | “Control” becomes a platform. |
| 3 | Never stopping | Slice accepted; sprawl continues as if authorized. |
| 4 | Review as edit rights | “Inspect” becomes silent rewrite. |
| 5 | Zombie authority | Old plan beats your latest decision. |
| 6 | Summary as truth | Compaction hardens into false history. |
| 7 | Local green = complete | One mock ships as “the product works.” |
| 8 | Self-certified closure | Same agent writes claim and applause. |
| 9 | Test theatre | Internal green; user path still broken. |
| 10 | Proxy goals | Coverage / neatness beats your outcome. |
| 11 | Reviewer inflation | Review invents endless new acceptance. |
| 12 | Control-tax blindness | Tool costs more than the drift. |
| 13 | Rebuilding the world | New machinery instead of Git and tests. |
| 14 | Workspace confusion | Wrong tree, branch, or dirty checkout. |
| 15 | Handoff tax | Next session reconstructs state from chat. |
| 16 | UX last | Internals for weeks; UI untested. |
| 17 | Agree + overclaim | Instant apology, unmeasured promise. |
| 18 | Apology without constraint | Soft regret; same failure tomorrow. |

Details: [`docs/CODEX-SINS.md`](./docs/CODEX-SINS.md).

---

## What Oh No is for

**Not:** shutting down the Codex app or “killing the service.”  
**Yes:** keeping each slice of work **bounded, provable, and recoverable**.

<p align="center">
  <img
    src="./assets/brand/oh-no-loop.png"
    width="880"
    alt="Goal → Task → Prove → Stop the task (not the Codex app)"
  >
</p>

| Job | Meaning |
| --- | --- |
| **Freeze a task** | Before supported writes: expected user-visible behaviour, one black-box command, allowed files, time budget, stop condition |
| **Prove with a black box** | `ohno verify` runs that **exact** command — not agent prose |
| **Stop the task** | Fresh PASS closes **this** slice and advances the plan cursor. `next` only **points** at what comes after; it is **not** automatic permission to invent a new phase |
| **Recover** | `ohno resume` / Cockpit read `.ohno/state.json` — the sole runtime authority |

Hooks and Git pre-commit are **cooperative guardrails** (inject capsule, scope writes).  
They are not a hostile security boundary under your own credentials.

---

## Install

```bash
npm install -g oh-no-codex
cd your-git-repo

# --goal = your project outcome in one short line (Owner wording, free text)
ohno init --goal "Users can log in and see their own dashboard"
ohno install
```

`--goal` is **not** a special keyword or template. It is the Owner’s plain-language
outcome for this repo — stored as the current project goal. Change later with
the requirement-change flow, not by re-running `init`.

Node.js **≥ 22.20**, ordinary Git repo.  
npm: [oh-no-codex](https://www.npmjs.com/package/oh-no-codex) (`0.1.1`).

---

## Daily use (skill-first)

`ohno install` also copies a **Codex skill** to `~/.codex/skills/oh-no-control/`.

That is the main agent UX: Codex can **discover** the skill from its description
(keywords: ohno, verify, 开工, 验收, anti-drift…). Long CLI recipes are **not**
meant to live as chat paste — they dilute.

| Who | What |
| --- | --- |
| **You** | Once: `init` + `install`. Daily: ordinary language |
| **Skill `oh-no-control`** | When to run which `ohno` command |
| **Hooks** | Resume inject + write scope (background) |
| **AGENTS managed block** | Live goal / board / next only (short) |

```bash
ohno skill install    # refresh skill into ~/.codex/skills
ohno skill status
# then start a new Codex session so discovery picks it up
```

| Intent | Codex runs (via skill) |
| --- | --- |
| Start the frozen slice | `ohno task start` |
| Prove this slice | **`ohno verify` only** |
| Requirements changed | `ohno change begin --summary "…"` |
| Keep Owner words | `ohno requirements note --text "…"` |
| Where are we? | `ohno resume` · `ohno doctor` · `ohno cockpit` |

**Never automated:** silent plan accept · invented PASS · treating `next` as a blank cheque.

---

## What ships

| Surface | Role |
| --- | --- |
| `plan` · `task` · `verify` | Bound → prove → close the slice |
| `status` · `resume` · `next` · `doctor` | Recover without chat archaeology |
| `change` | Requirement + governing-doc sync |
| `projectors` · `preferences` · `requirements` | Progress, craft rules, owner log |
| Hooks · pre-commit · `cockpit` | Guardrails + read-only board |

**Out of V1 on purpose:** database, daemon, skill marketplace, multi-agent OS, “absolute security.”

---

## Evidence

| Claim | Label |
| --- | --- |
| Product status | `V1_TRIAL_ACCEPTED` |
| CLI / hooks / atomic state | `LOCAL_PASS` |
| Cockpit = `status --json` | `LOCAL_PASS` |
| Disposable real copies | `TRIAL_PASS` (P01–P06) |
| npm | **`0.1.1`** |

Contracts: [Product](./docs/PRODUCT-CONTRACT.md) · [Design](./docs/DESIGN.md) · [Acceptance](./docs/ACCEPTANCE.md) · [Ledger](./docs/IMPLEMENTATION-PLAN.md)

---

<p align="center">
  <sub>MIT · Independent community project · Not affiliated with OpenAI</sub>
</p>

<p align="center">
  <strong>Keep the project aligned. Prove the slice. Close it cleanly.</strong>
</p>

<p align="center"><a href="#readme-top">↑ top</a></p>
