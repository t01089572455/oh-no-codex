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
  <strong>A small anti-drift tool for Codex</strong><br>
  <em>Let it work. When it drifts, pull it back to your docs.</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/oh-no-codex"><img alt="npm" src="https://img.shields.io/npm/v/oh-no-codex?style=flat-square&color=74D6B1&labelColor=202624&label=npm"></a>
  <img alt="node" src="https://img.shields.io/badge/node-%3E%3D22.20-74D6B1?style=flat-square&labelColor=202624">
  <img alt="codex" src="https://img.shields.io/badge/for-Codex-FF4B35?style=flat-square&labelColor=202624">
  <a href="./LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-FFF1CE?style=flat-square&labelColor=202624"></a>
</p>

---

## In one line

Codex writes strong code and still steers projects wrong.  
**Oh No** is a local tool that keeps Codex on: **what you said + your requirement/design docs + a real test.**

You mostly do two things: **install once, then talk.**  
The rest should run in the background with as little babysitting as possible.

---

## How Codex usually fails (the Eighteen Sins)

These are not “the model is dumb.” They are failure patterns that show up on long real projects:

| What you see | In short |
| --- | --- |
| A small ask becomes a big system | Scope creep |
| “Robust / control” becomes overbuild | Max interpretation |
| Acceptance passed, agent keeps going | Never stopping |
| You asked for a review; it edits and commits | Review as edit rights |
| An old plan overrides your latest words | Zombie authority |
| A summary hardens into false history | Summary as truth |
| Unit/mock green claimed as feature done | Local green = complete |
| Same agent defines, builds, and certifies | Self-certified closure |
| Internals tested; user path still broken | Test theatre |
| Coverage/neatness outranks your outcome | Proxy goals |
| Review invents never-frozen criteria | Reviewer inflation |
| Guardrails hurt more than the drift | Control tax |
| New platform before value ships | Rebuild the world |
| Wrong folder / worktree | Workspace confusion |
| Every new chat reconstructs from history | Handoff tax |
| Heavy internals, weak UX | UX last |
| Apology, then another empty promise | Agree + overclaim |
| Explains the fail; rules/tests unchanged | Apology without constraint |

Full write-up: [docs/CODEX-SINS.md](./docs/CODEX-SINS.md).

---

## What Oh No actually does

In plain Owner terms:

1. **After install + setup, get out of your way**  
   You talk to Codex. Oh No records progress, injects rules, and watches acceptance.

2. **Your words count**  
   Prompts are logged. On conflict, **latest Owner words win**.

3. **Clarify / write requirements before freestyle product code**  
   When docs already exist, push Codex to **read them, follow the board, verify** — not re-interview you forever.

4. **Done means a real test, not a speech**  
   Only `ohno verify` against a frozen user-visible test counts.  
   Soft theatre like `exit 3` + “go read the playbook” gets rejected.

5. **On drift: read docs first, then self-fix**  
   Don’t default to blocking and asking the Owner.  
   Open requirements/design/contract → decide “code wrong” vs “plan wrong” → fix → re-test.

6. **Not “read every doc before every write”**  
   That’s slow and feels like a governance OS.  
   Goal: **work normally; when it drifts, pull it back with Truth.**

7. **Prompt-first, not hard-deny museums**
   Everyday control is short next-action prompts + Latest Owner words.
   Clear structure (phase / scope / sync) can still get a **short** hard deny — never a law dump on every tool.
   The model can still ignore text — this is cooperative, not an OS sandbox.

---

## Install

Needs Node.js **≥ 22.20**.

```bash
npm install -g oh-no-codex

cd your-git-repo
ohno setup
```

**Open a new Codex session after install** so skills/hooks reload.

Then:

1. Talk to Codex in the project root  
2. Check progress: `ohno`  
3. When a slice is done: `ohno verify`  
4. Optional board: `ohno cockpit`

From source:

```bash
git clone https://github.com/t01089572455/oh-no-codex.git
cd oh-no-codex
npm install
npm run build
npm install -g .
```

### When requirements already live in docs

Paste one goal into a new Codex session, for example:

> Trust only this cwd’s `.ohno/state.json`. Read requirements/design. Loop tasks + `ohno verify`. If the docs answer it, don’t ask me. Ask only for secrets, devices, or real business unknowns.

### Existing / half-built projects

`ohno setup` does **not** invent history from Git.  
Write current goals and known facts into requirements/docs, then work the board.  
Don’t hand-edit state to fake PASS.

Requirements changed: re-clarify → update design → update plan → update expected tests → continue under Oh No. Don’t silently keep the old plan.

---

## Field notes (honest)

On real long Codex sessions you can see it:

- advance on the current task board  
- catch fake acceptance and replace with real tests  
- re-open docs and continue  
- feel smoother than hard-deny-everywhere, with long autonomous stretches  

Also clear:

- the spine is still **state + plan + real verify**; prompts help, they are not magic  
- it does **not** claim zero hallucination — it claims less fake-done and less freestyle  
- if *you* ask for “the whole universe,” it will follow you; Oh No governs proof and re-read, not vetoing your goal  

---

## Limits

- **Cooperative rules**, not an OS sandbox  
- **Does not judge “did you understand?”** — only forces “open the docs and work from them”  
- **Pull back on drift**, not a sermon every step  
- Soft acceptance tests make soft guardrails  
- Product direction stays yours  

---

## Cockpit (optional, still useful)

A **local read-only board** in the browser: same data as `ohno` / `ohno status`, no write APIs.  
Handy when you want to glance at the plan without reading the terminal. Skip it if CLI is enough.

```bash
ohno cockpit
```

Progress on the board is “this plan,” not whole-product done.

<p align="center">
  <img
    src="./assets/brand/oh-no-cockpit.png"
    width="960"
    alt="Oh No, Codex! Cockpit"
  >
</p>

---

## License

[MIT](./LICENSE)
