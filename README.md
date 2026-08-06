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
  <strong>A Truth-bound harness for Codex vibe coding</strong><br>
  <em>Branch line: <code>prompt-only-harness</code> — pull a drifting agent back to Truth with hook-injected rails, not a tax of hard-deny gates</em>
</p>

<p align="center">
  <img alt="line" src="https://img.shields.io/badge/line-prompt--only-harness-74D6B1?style=flat-square&labelColor=202624">
  <img alt="status" src="https://img.shields.io/badge/status-FIELD_TRIAL_STEERS-3DDC97?style=flat-square&labelColor=202624">
  <img alt="node" src="https://img.shields.io/badge/node-%3E%3D22.20-74D6B1?style=flat-square&labelColor=202624">
  <img alt="codex" src="https://img.shields.io/badge/for-Codex-FF4B35?style=flat-square&labelColor=202624">
  <a href="./LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-FFF1CE?style=flat-square&labelColor=202624"></a>
</p>

<p align="center">
  <a href="#why">Why</a> ·
  <a href="#sell">What you get</a> ·
  <a href="#eighteen-sins">Eighteen Sins</a> ·
  <a href="#how">How it works</a> ·
  <a href="#install">Install</a> ·
  <a href="#field">Field facts</a> ·
  <a href="#limits">Limits</a> ·
  <a href="#vs-main">vs main</a>
</p>

---

<a id="why"></a>

## Why Oh No?

Codex can write strong code and still take a project the wrong way: freestyle without reading design, fake completion, keep expanding after PASS, or force every new session to reconstruct history from chat.

What Owners asked for in real vibe-coding sessions is **not** a second governance OS, and **not** OS-level “read every Truth file before every write.”

**The real job is:**

> **Let Codex work. When it drifts, the Truth harness pulls it back.**

Those failures are documented as a public incident audit:  
[**The Eighteen Sins of Codex**](./docs/CODEX-SINS.md).

This branch folds long-running Owner rules (mined from the full Grok session history for this repo, including compaction segments) into **`OHNO_PROMPT_RAILS`**, injected by **hooks at critical moments**—steering Codex with **prompt law + state board + verify**, instead of a museum of hard-deny gates.

---

<a id="sell"></a>

## What you get (this branch, as built)

### 1. Pull back on drift — not a sermon before every edit

- Goal is **not** force-reading Truth on every file write (slow, heavy, governance-shaped).
- Goal is: **drift → re-open Truth / design / frozen contract → decide again**.
- In field use that looks like fixing soft black boxes, scope issues, and bad state by returning to authority docs and `truth-read`—not freezing the session for ceremony.

### 2. Human surface almost cut; internals drive

- Owner: `ohno setup` once, then mostly talk to Codex.
- Every Owner prompt / Stop / `ohno pipeline`: inject full **`OHNO_PROMPT_RAILS`** (lifecycle, anti-block-to-owner, eighteen-sins rails, force-read-when-adrift…).
- PreToolUse: **not hard-deny as the main control** (advisory + self-correct). Less “choked by the gate” friction.

### 3. Done still means real proof

- Only `ohno verify` + a frozen user-visible black box closes work.
- Soft theatre (e.g. `exit 3` + “go read the playbook”) gets exposed and must become an executable acceptance.

### 4. Readable scene across sessions

- `.ohno/state.json` remains the **sole runtime authority**.
- `ohno` / status / resume / Cockpit: current task, proof, next action—handoff tax drops.

### 5. Especially good when requirements already live in docs

When demand, design, and playbooks are **already written**, and the phase is execute + prove (not greenfield clarification):

- Oh No pushes **read docs + follow the board + verify**, not endless re-clarification chats.
- On a real project trial (LoveBuddy-v11, Codex session `019fd4f0…`): stayed on state, fixed fake black boxes, multi-wave verify loops—**Owner experience: clearly smoother than hard-deny-everywhere main**.

### 6. Eighteen Sins stay the public product story

Not fluff: each sin has a rail in `OHNO_PROMPT_RAILS`; completion / fake tests / zombie plans still rest on state + verify.

---

<a id="eighteen-sins"></a>

## The Eighteen Sins of Codex

The name is deliberate. Eighteen distinct, privacy-scrubbed failure patterns—not a claim that every run fails.

| # | Pattern | What you see |
| ---: | --- | --- |
| 1 | Semantic usurpation | A narrow ask becomes a larger product or architecture |
| 2 | Maximum interpretation | “Control” / “robust” maxed into overbuild |
| 3 | Never stopping | PASS already happened; Agent keeps going |
| 4 | Review as edit rights | Audit turns into unapproved edits |
| 5 | Zombie authority | Old plan/summary overrides latest Owner decision |
| 6 | Summary as truth | Compaction hardens omissions into false history |
| 7 | Local green = complete | Unit/mock green claimed as feature done |
| 8 | Self-certified closure | Same Agent defines, implements, and cites itself |
| 9 | Test theatre | Internals tested; user path broken/untested |
| 10 | Proxy goals | Coverage/neatness outranks Owner outcome |
| 11 | Reviewer inflation | Review adds never-frozen criteria |
| 12 | Control-tax blindness | Guardrail slower/heavier than the drift |
| 13 | Rebuilding the world | New platform before value ships |
| 14 | Workspace confusion | Wrong branch / worktree / dirty tree |
| 15 | Handoff tax | Every session reconstructs from chat |
| 16 | UX last | Machinery grows; UX stays generic |
| 17 | Agree + overclaim | Apology → another unmeasured promise |
| 18 | Apology without constraint | Explains failure; no rule/test change |

Full audit: [`docs/CODEX-SINS.md`](./docs/CODEX-SINS.md).

---

<a id="how"></a>

## How control works (this branch)

```text
Owner:  ohno setup → talk to Codex
Hooks:  UserPromptSubmit / Stop / pipeline  →  inject OHNO_PROMPT_RAILS
State:  .ohno/state.json = sole current authority
Agent:  follow next/ACTIVE → ohno verify is the only done signal
Drift:  re-read Truth / design / contract → fix implement (A) or plan (B) → verify again
```

**Thin human surface:**

```bash
ohno setup      # once
ohno            # where am I + pipeline
ohno pipeline   # exact next (for the Agent)
ohno verify     # only completion proof
```

Law text: `src/prompt-rails.ts` (`OHNO_PROMPT_RAILS`).  
Owner-session synthesis catalog: `docs/superpowers/specs/2026-08-05-complete-prompt-harness-catalog.md`.

---

<a id="install"></a>

## Install and use

Requires Node.js **≥ 22.20**.

### This branch line (current product narrative)

```bash
git clone https://github.com/t01089572455/oh-no-codex.git
cd oh-no-codex
git checkout prompt-only-harness
npm install
npm run build
npm install -g .

cd your-project   # must be a git repo
ohno setup        # or skill install + refresh hooks if .ohno already exists
```

**Start a new Codex session** after install so skills/hooks reload.

### Daily

```bash
ohno
ohno status
ohno pipeline
ohno verify
ohno doctor
ohno cockpit      # optional read-only board
```

### New Codex session (docs already clear)

1. Fix cwd to the project root  
2. Paste one goal: trust this cwd’s `.ohno/state.json`, read Truth, loop task/verify, do not stop for Owner by default  
3. Let it `ohno status` → work → `ohno verify`  
4. You intervene only for secrets / devices / business unknowns  

---

<a id="field"></a>

## Field facts (honest)

On real project **LoveBuddy-v11**, Codex session `019fd4f0-c913-7653-8254-d7d6369f8263`:

**What worked:**

- Locked cwd + `.ohno/state.json`; followed ACTIVE / next  
- Detected and repaired **soft black boxes**, then `ohno verify`  
- Used `truth-read` / authority loading; multi-wave delivery on the board  
- **No hard-deny main path** in the tool transcript (by design on this branch)  
- Owner experience: **much smoother than hard-coded deny-everywhere main**, with long autonomous runs  

**Also stated honestly:**

- Main drive is still **state + plan + verify**; full `OHNO_PROMPT_RAILS` is a strong assist, not present on every event line  
- Reading Truth is **pull-back / load**, not OS-forced before every write  
- Does **not** claim zero hallucination—claims **less fake-done, less freestyle, work bound to design + proof**  
- If the Owner goal says “cover the whole design universe,” the Agent follows the Owner; Oh No governs **how proof and re-read work**, not vetoing that goal  

Repo automation: black-box and performance suites stay green on this branch (`npm test` / `npm run test:performance`).

---

<a id="limits"></a>

## Limits

- **Cooperative** (COOPERATIVE_GUARDRAIL), not an OS sandbox.  
- **No semantic court** (“did you understand?”).  
- **Pull on drift**, not a sermon every step.  
- A few hard fact gates (verify, optional pre-commit) may still exist—that is proof money, not a parameter museum.  
- npm `latest` may still point at an older published line; **this branch is installed from source** as above.

---

<a id="vs-main"></a>

## vs `main` (hard-gate line)

| | `main` (heavier hard gates) | this branch `prompt-only-harness` |
| --- | --- | --- |
| Primary control | phase / write deny, etc. | hook-injected `OHNO_PROMPT_RAILS` + state/verify |
| Feel | easier to get stuck on gates | smoother when docs exist and work is execute/prove |
| On drift | hard block + receipts | rails demand re-read Truth + verify pull-back |
| Owner field take | higher control tax | **more usable** (fewer denies, still board-bound) |

This branch does **not** claim a scientific sweep of every axis over `main`. It claims:

> **For real vibe coding—requirements in docs, autonomous execution, anti fake-done—this Truth-prompt harness is more usable and closer to the Owner’s original intent.**

`main` remains the hard-gate reference line; this README is the **`prompt-only-harness` product story and facts**.

---

## Cockpit

<p align="center">
  <img
    src="./assets/brand/oh-no-cockpit.png"
    width="960"
    alt="Oh No, Codex! Cockpit"
  >
</p>

<p align="center">
  <sub>Read-only projection, not a second truth. Cursor progress is this plan only, not whole-product done.</sub>
</p>

---

## License

[MIT](./LICENSE)
