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
  <strong>Strong agents still drift.</strong><br>
  A local harness that freezes one task, proves it with a user-visible black box,<br>
  and stops Codex when the work is actually done.
</p>

<p align="center">
  <code>one goal</code>&nbsp;&nbsp;·&nbsp;&nbsp;<code>one task</code>&nbsp;&nbsp;·&nbsp;&nbsp;<code>one test</code>&nbsp;&nbsp;·&nbsp;&nbsp;<code>then stop</code>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/oh-no-codex"><img alt="npm" src="https://img.shields.io/npm/v/oh-no-codex?style=flat-square&color=74D6B1&labelColor=202624&label=npm"></a>
  <img alt="status" src="https://img.shields.io/badge/status-V1_TRIAL_ACCEPTED-74D6B1?style=flat-square&labelColor=202624">
  <img alt="codex" src="https://img.shields.io/badge/for-Codex_CLI-FF4B35?style=flat-square&labelColor=202624">
  <img alt="node" src="https://img.shields.io/badge/node-%E2%89%A522.20-74D6B1?style=flat-square&labelColor=202624">
  <a href="./LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-FFF1CE?style=flat-square&labelColor=202624"></a>
</p>

<p align="center">
  <a href="#why-this-exists">Why</a> ·
  <a href="#the-eighteen-sins">18 sins</a> ·
  <a href="#the-rule">The rule</a> ·
  <a href="#install">Install</a> ·
  <a href="#how-you-actually-use-it">Use</a> ·
  <a href="#what-ships">Ships</a> ·
  <a href="#evidence">Evidence</a>
</p>

---

## Why this exists

Codex can produce excellent code and still leave the repository worse than it found it.

Not because the model is weak — because **long sessions invent authority**.

A small request becomes a platform.  
“Done” is declared from a green unit test the user never sees.  
A chat summary outranks the plan you accepted yesterday.  
After acceptance, “next” is treated as permission to keep going.

If you have felt that on a Friday night, this repository is for you.

**Oh No, Codex!** is a cooperative, local harness — not a cloud product, not a policy engine, not a claim that it can cage a hostile process under your own credentials.

---

## The eighteen sins

We audited recurring Codex failure modes into **eighteen named sins**.  
They are the product’s enemy list — kept visible, not buried.

| # | Sin | In one line |
| ---: | --- | --- |
| 1 | Semantic usurpation | You asked for a door; it built a castle. |
| 2 | Maximum interpretation | “Control” becomes a platform. |
| 3 | Never stopping | Acceptance passed; work continues anyway. |
| 4 | Review as edit rights | “Look at this” becomes “I already rewrote it.” |
| 5 | Zombie authority | Old plans beat your latest decision. |
| 6 | Summary as truth | Compaction text hardens into false history. |
| 7 | Local green = complete | One mock, one unit test, “shipped.” |
| 8 | Self-certified closure | Same agent writes claim and applause. |
| 9 | Test theatre | Internal branches green; user path broken. |
| 10 | Proxy goals | Coverage and neatness beat your outcome. |
| 11 | Reviewer inflation | Review invents new acceptance forever. |
| 12 | Control-tax blindness | The harness costs more than the drift. |
| 13 | Rebuilding the world | New machinery instead of Git and tests. |
| 14 | Workspace confusion | Wrong path, branch, or dirty tree. |
| 15 | Handoff tax | Next session reconstructs state from chat. |
| 16 | UX last | Internals for weeks; UI untested. |
| 17 | Agree + overclaim | Instant apology, unmeasured promise. |
| 18 | Apology without constraint | Soft regret; same failure tomorrow. |

Full audit (privacy-scrubbed): [`docs/CODEX-SINS.md`](./docs/CODEX-SINS.md).

Oh No does **not** add eighteen subsystems.  
It answers with a few hard edges: **owner wording, one task, black-box verify, one state file, stop means stop.**

---

## The rule

<p align="center">
  <img
    src="./assets/brand/oh-no-loop.png"
    width="880"
    alt="Goal → Task → Prove → Stop"
  >
</p>

| Moment | Without | With Oh No |
| --- | --- | --- |
| **Start** | Coding before the job is frozen | Cursor task only: behaviour, one test, files, budget, stop |
| **Finish** | “Looks good” in prose | `ohno verify` runs the exact black box |
| **Change** | Specs lag while code races | Document diffs; coding blocked until plan replacement |
| **Resume** | Chat archaeology | `ohno resume` — goal, proof, blocker, one next |

**Sole runtime authority:** `.ohno/state.json`  
Resume text, PROGRESS, AGENTS blocks, Cockpit — **projections only**.

---

## Install

```bash
npm install -g oh-no-codex
cd your-git-repo
ohno init --goal "Ship reliable draft save"
ohno install
```

Requires **Node.js ≥ 22.20** and a normal Git project.  
Package: [oh-no-codex on npm](https://www.npmjs.com/package/oh-no-codex) (`0.1.1`).

---

## How you actually use it

After `init` + `install`, you mostly **talk to Codex**.  
Hooks inject the resume capsule, refresh projections, and cooperatively scope writes.

| You mean | Codex runs |
| --- | --- |
| Start this slice | `ohno task start` (or plan first) |
| This slice is done | **`ohno verify` only** |
| Requirements changed | `ohno change begin --summary "…"` |
| Remember my words | `ohno requirements note --text "…"` |
| Where are we? | `ohno resume` / `ohno doctor` |

That map lives in the project `AGENTS.md` managed block.  
Optional skill copy: [`skills/oh-no-control/SKILL.md`](./skills/oh-no-control/SKILL.md).

```bash
ohno cockpit          # read-only glass board → same model as status --json
ohno preferences show # craft defaults: research first, reuse OSS, adapt UI
```

**Never automated:** silent plan accept · invented PASS · `next` as blank cheque.

---

## What ships

| Surface | Role |
| --- | --- |
| `plan` · `task` · `verify` | Bounded start → evidence-bound finish |
| `status` · `resume` · `next` · `doctor` | Instant recovery |
| `change` | Honest requirement + document sync |
| `projectors` | PROGRESS + AGENTS capsule |
| `preferences` · `requirements` | Craft rules + owner log |
| Codex hooks · Git pre-commit | Cooperative guardrails |
| `cockpit` | Read-only mission board |

**Not in V1 (on purpose):** database, daemon, skill marketplace, multi-agent scheduler, hostile same-user containment.

---

## Evidence

Honesty is part of the brand (sin 17).

| Claim | Label |
| --- | --- |
| Public status | `V1_TRIAL_ACCEPTED` |
| CLI / hooks / atomic state | `LOCAL_PASS` (public black boxes) |
| Cockpit = `status --json` | `LOCAL_PASS` |
| Disposable real copies | `TRIAL_PASS` (P01–P06) |
| npm | **`0.1.1`** |

Trial p95 (named local copies — not a universal SLA): `status`/`next` &lt; 100 ms class, `resume` &lt; 100 ms class, cockpit reflection &lt; 80 ms class against frozen budgets.

Contracts: [Product](./docs/PRODUCT-CONTRACT.md) · [Design](./docs/DESIGN.md) · [Acceptance](./docs/ACCEPTANCE.md) · [Ledger](./docs/IMPLEMENTATION-PLAN.md)

---

## Star it if…

- you vibe-code with Codex and lose weekends to drift  
- you want **stop conditions**, not another orchestration framework  
- you prefer **measured labels** over “production-ready” theatre  

Contributions: keep slices small, keep black boxes user-visible, do not invent a second authority.

---

<p align="center">
  <sub>MIT · Independent community project · Not affiliated with OpenAI</sub>
</p>

<p align="center">
  <strong>Measure the task. Prove the behaviour. Stop the agent.</strong>
</p>

<p align="center"><a href="#readme-top">↑ top</a></p>
