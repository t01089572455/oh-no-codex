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
  Oh No is a local harness for vibe coding: freeze one task, prove it with a<br>
  user-visible black box, recover state without chat archaeology — and close<br>
  <em>that slice</em> cleanly (it does not shut down the Codex app).
</p>

<p align="center">
  <code>bound</code>&nbsp;&nbsp;·&nbsp;&nbsp;<code>prove</code>&nbsp;&nbsp;·&nbsp;&nbsp;<code>recover</code>&nbsp;&nbsp;·&nbsp;&nbsp;<code>stop the slice</code>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/oh-no-codex"><img alt="npm" src="https://img.shields.io/npm/v/oh-no-codex?style=flat-square&color=74D6B1&labelColor=202624&label=npm"></a>
  <img alt="status" src="https://img.shields.io/badge/status-V1_TRIAL_ACCEPTED-74D6B1?style=flat-square&labelColor=202624">
  <img alt="codex" src="https://img.shields.io/badge/for-Codex_CLI-FF4B35?style=flat-square&labelColor=202624">
  <img alt="skills" src="https://img.shields.io/badge/UX-13_Codex_skills-74D6B1?style=flat-square&labelColor=202624">
  <a href="./LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-FFF1CE?style=flat-square&labelColor=202624"></a>
</p>

<p align="center">
  <a href="#the-problem">Problem</a> ·
  <a href="#eighteen-sins">18 sins</a> ·
  <a href="#what-it-does">What it does</a> ·
  <a href="#install">Install</a> ·
  <a href="#use-it-like-skills">Skills</a> ·
  <a href="#evidence">Evidence</a>
</p>

---

## The problem

Codex stays “busy” while the repo drifts:

| # | Failure | Example |
| ---: | --- | --- |
| 1 | **Scope & meaning** | “Foreign-trade system” quietly becomes a platform rewrite |
| 2 | **Fake done** | Mocks are green; the user-visible path still breaks |
| 3 | **Lost truth** | Chat / old plans beat project state next session |
| 4 | **Slice won’t close** | After a real pass, “next” is treated as a blank cheque |

Oh No optimises for answers from **project files**, not memory:

1. What is already done?  
2. What is the **one** active bounded task?  
3. What exact user-visible test proves it?  
4. What is blocking?  
5. What is the **one** next action (**locator**, not new permission)?

There is **no project-level goal flag**. Product intent lives in **plan tasks** and **`ohno requirements note`**.

---

## Eighteen sins

Enemy list from a long session audit — not eighteen features. Full text: [`docs/CODEX-SINS.md`](./docs/CODEX-SINS.md).

| # | Sin | One line |
| ---: | --- | --- |
| 1 | Semantic usurpation | You asked for a door; it built a castle. |
| 2 | Maximum interpretation | “Control” becomes a platform. |
| 3 | Never stopping | Slice accepted; sprawl continues anyway. |
| 4 | Review as edit rights | “Inspect” becomes silent rewrite. |
| 5 | Zombie authority | Old plan beats your latest decision. |
| 6 | Summary as truth | Compaction hardens into false history. |
| 7 | Local green = complete | One mock ships as “done.” |
| 8 | Self-certified closure | Same agent writes claim and applause. |
| 9 | Test theatre | Internal green; user path broken. |
| 10 | Proxy goals | Coverage beats your outcome. |
| 11 | Reviewer inflation | Endless new acceptance criteria. |
| 12 | Control-tax blindness | Tool costs more than the drift. |
| 13 | Rebuilding the world | New machinery instead of Git/tests. |
| 14 | Workspace confusion | Wrong tree / branch / dirty checkout. |
| 15 | Handoff tax | Next session reconstructs from chat. |
| 16 | UX last | Internals for weeks; UI untested. |
| 17 | Agree + overclaim | Instant apology, unmeasured promise. |
| 18 | Apology without constraint | Soft regret; same failure tomorrow. |

---

## What it does

<p align="center">
  <img src="./assets/brand/oh-no-loop.png" width="880" alt="Task → Prove → Close the slice">
</p>

| Job | Meaning |
| --- | --- |
| **Freeze a task** | Behaviour, one black-box command, allowed files, budget, stop condition |
| **Prove** | `ohno verify` runs that exact command |
| **Close the slice** | Fresh PASS advances the plan cursor; `next` only **points** |
| **Recover** | `ohno resume` / cockpit ← `.ohno/state.json` (sole authority) |

**Cooperative** hooks (SessionStart / PreToolUse / Stop + Git pre-commit) inject the capsule and scope writes. Not a hostile security sandbox.

**Skill suite:** day-to-day CLI surfaces map to Codex skills under
`~/.codex/skills/oh-no-*` (setup stays terminal-only: `ohno init` / `ohno install`).

---

## Install

```bash
npm install -g oh-no-codex
cd your-git-repo
ohno init                 # creates .ohno/ — no --goal
ohno install              # hooks + day-to-day oh-no-* skills
```

```bash
ohno skill install        # refresh skills only
ohno skill status
# open a new Codex session so discovery picks them up
```

Node.js **≥ 22.20**. Package: [oh-no-codex](https://www.npmjs.com/package/oh-no-codex) (`0.1.2`).

---

## Cockpit (how to start)

Local **read-only** glass board. Same data as `ohno status --json`.

```bash
cd your-git-repo          # must already have run ohno init
ohno cockpit
```

Terminal prints a loopback URL, for example:

```text
Cockpit: http://127.0.0.1:53123/
```

1. Open that URL in a browser on the same machine.  
2. The page polls `/api/state` about every 2.5s.  
3. Stop with Ctrl+C in the terminal (no background daemon).  
4. Or ask Codex via skill **`oh-no-cockpit`**.

### Where cockpit data comes from

```text
plan accept / task start / verify …
        ↓ write
  .ohno/state.json          ← sole authority
        ↓ readModel()
  GET /api/state            ← same as status --json
        ↓ browser poll
  cockpit UI
```

| On screen | Source |
| --- | --- |
| How many tasks | `ordered_tasks.length` → `task_count` |
| How far along | `cursor` + `active_task` |
| Progress bar | **`cursor / task_count`** only (no fake trust %) |
| Board phases | Derived from cursor / proof — not a second store |

The cockpit **never** advances work. CLI/skills mutate state; the UI only reads.

---

## How you actually use it (autonomy vs manual)

**You usually do not pick skills by hand.**  
After `init` + `install`, you talk in ordinary language. Codex is expected to
load the matching `oh-no-*` skill and run the shell command.  
Oh No is **cooperative**, not fully autonomous: hooks help in the background;
acceptance still requires a real `ohno verify`.

| Who | What happens |
| --- | --- |
| **Automatic (hooks)** | Session start / compact → inject resume capsule; scoped writes may be denied |
| **You speak → Codex uses skill** | “start / done / where are we / open cockpit…” → model runs `ohno …` |
| **You run CLI yourself** | Setup once; or when the model forgets verify / you want certainty |

### Setup once (you, terminal)

```bash
npm install -g oh-no-codex
cd your-git-repo
ohno init
ohno install
# new Codex session
```

### Everyday examples (you → expected Codex behavior)

**Example A — first slice**

| You say | Codex should |
| --- | --- |
| “This is a foreign-trade app. Draft a linear plan; first slice = customer CRUD.” | Use **`oh-no-plan`**: write plan JSON, `ohno plan propose`, wait for your review, then `accept` |
| “Start work.” | **`oh-no-task`** → `ohno task start`, then edit only allowed files |
| “Done, verify.” | **`oh-no-verify`** → `ohno verify`; report PASS/FAIL honestly |

**Example B — mid project**

| You say | Codex should |
| --- | --- |
| “Where are we?” | **`oh-no-resume`** (or status) |
| “Remember: no multi-tenant yet.” | **`oh-no-requirements`** → `ohno requirements note --text "…"` |
| “Requirements changed: export PDF first.” | **`oh-no-change`** then a replacement plan |
| “Open the board.” | **`oh-no-cockpit`** → `ohno cockpit`, tell you the `http://127.0.0.1:…/` URL |

**Example C — when you should act yourself**

| Situation | You do |
| --- | --- |
| First time in a repo | Terminal: `ohno init` + `ohno install` |
| Model says “done” without running verify | Say “run ohno verify” **or** run `ohno verify` in the terminal |
| Want a dashboard | Terminal or chat: `ohno cockpit` / “open cockpit” |
| Skill missing after upgrade | `ohno skill install`, new Codex session |

### Day-to-day skills (reference — not a checklist)

Setup (`ohno init` / `ohno install`) is **terminal-only**, not a skill.  
Shell details live inside each skill file for Codex; users need not memorize them.

| Skill | You mean |
| --- | --- |
| `oh-no-plan` | plan / accept plan |
| `oh-no-task` | start this slice |
| `oh-no-verify` | done / verify |
| `oh-no-resume` | where are we |
| `oh-no-status` | status |
| `oh-no-next` | next locator |
| `oh-no-change` | requirements changed |
| `oh-no-requirements` | remember my words |
| `oh-no-preferences` | craft rules |
| `oh-no-doctor` | health check |
| `oh-no-cockpit` | open board |
| `oh-no-projectors` | refresh PROGRESS/AGENTS |
| `oh-no-control` | hub / which skill? |

**Do not** paste long CLI into chat.  
**Do not** claim done without PASS.  
**Do not** treat `next` as a blank cheque.

---

## What ships

| Piece | Role |
| --- | --- |
| CLI | `init` · `plan` · `task` · `verify` · `change` · `resume` · … |
| 13 Codex skills | Day-to-day discoverable procedure (setup is CLI) |
| Hooks + pre-commit | Capsule inject, scope guard |
| Projectors | `PROGRESS.md`, REQUIREMENTS, short AGENTS capsule |
| Preferences | Optional craft defaults (research / OSS / UI adapt) |
| Cockpit | Read-only board = `status --json` |

**Not in V1:** database, daemon, skill marketplace product, multi-agent OS, absolute same-user security.

---

## Evidence

| Claim | Label |
| --- | --- |
| Product status | `V1_TRIAL_ACCEPTED` |
| CLI / hooks / atomic state | `LOCAL_PASS` |
| Cockpit = status JSON | `LOCAL_PASS` |
| Disposable real copies | `TRIAL_PASS` (P01–P06) |
| npm | **`0.1.2`** (skill suite, no project `--goal`, cockpit docs) |

Contracts: [Product](./docs/PRODUCT-CONTRACT.md) · [Design](./docs/DESIGN.md) · [Acceptance](./docs/ACCEPTANCE.md) · [Sins](./docs/CODEX-SINS.md)

---

<p align="center">
  <sub>MIT · Independent community project · Not affiliated with OpenAI</sub>
</p>

<p align="center">
  <strong>Bound the slice. Prove it. Recover without archaeology.</strong>
</p>

<p align="center"><a href="#readme-top">↑ top</a></p>
