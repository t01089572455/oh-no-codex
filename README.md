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
  user-visible black box, recover from project state instead of chat archaeology,<br>
  and close <em>that slice</em> cleanly. It stops the slice, not the Codex app.
</p>

<p align="center">
  <code>bound</code>&nbsp;&nbsp;·&nbsp;&nbsp;<code>prove</code>&nbsp;&nbsp;·&nbsp;&nbsp;<code>recover</code>&nbsp;&nbsp;·&nbsp;&nbsp;<code>stop the slice</code>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/oh-no-codex"><img alt="npm" src="https://img.shields.io/npm/v/oh-no-codex?style=flat-square&color=74D6B1&labelColor=202624&label=npm"></a>
  <img alt="status" src="https://img.shields.io/badge/status-ANTI_DRIFT_CORE_WORKS-3DDC97?style=flat-square&labelColor=202624">
  <img alt="codex" src="https://img.shields.io/badge/for-Codex_CLI-FF4B35?style=flat-square&labelColor=202624">
  <img alt="skills" src="https://img.shields.io/badge/UX-13_Codex_skills-74D6B1?style=flat-square&labelColor=202624">
  <a href="./LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-FFF1CE?style=flat-square&labelColor=202624"></a>
</p>

<p align="center">
  <a href="#the-problem">Problem</a> ·
  <a href="#eighteen-sins">18 sins</a> ·
  <a href="#what-it-does">What it does</a> ·
  <a href="#install">Install</a> ·
  <a href="#how-you-actually-use-it-autonomy-vs-manual">Use</a> ·
  <a href="#evidence">Evidence</a>
</p>

---

## The problem

Codex stays "busy" while the repo drifts:

| # | Failure | Example |
| ---: | --- | --- |
| 1 | **Scope & meaning** | "Foreign-trade system" quietly becomes a platform rewrite |
| 2 | **Fake done** | Mocks are green; the user-visible path still breaks |
| 3 | **Lost truth** | Chat / old plans beat project state next session |
| 4 | **Slice won't close** | After a real pass, "next" is treated as a blank cheque |

Oh No optimises for answers from **project files**, not memory:

1. What is already done?  
2. What is the **one** active bounded task?  
3. What exact user-visible test proves it?  
4. What is blocking?  
5. What is the **one** next action (**locator**, not new permission)?

Project goal is required at init: **`ohno init --goal "…"`**. Task-level goals
live in the plan; free-form notes use **`ohno requirements note`**.

---

## Eighteen sins

This enemy list came from a long session audit; it is not a list of eighteen
features. Full text: [`docs/CODEX-SINS.md`](./docs/CODEX-SINS.md).

| # | Sin | One line |
| ---: | --- | --- |
| 1 | Semantic usurpation | You asked for a door; it built a castle. |
| 2 | Maximum interpretation | "Control" becomes a platform. |
| 3 | Never stopping | Slice accepted; sprawl continues anyway. |
| 4 | Review as edit rights | "Inspect" becomes silent rewrite. |
| 5 | Zombie authority | Old plan beats your latest decision. |
| 6 | Summary as truth | Compaction hardens into false history. |
| 7 | Local green = complete | One mock ships as "done." |
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
| **Recover** | `ohno resume` and Cockpit project the same `.ohno/state.json` authority |

**Cooperative** hooks (`SessionStart`, `PostCompact`, `PreToolUse`, `Stop`, and
Git pre-commit) inject the capsule and help keep writes in scope. They are not
a hostile security sandbox.

**Skill suite:** day-to-day CLI surfaces map to Codex skills under
`~/.codex/skills/oh-no-*` (setup stays terminal-only: `ohno init` / `ohno install`).

---

## Install

```bash
npm install -g oh-no-codex
# if a mirror lags a fresh release:
# npm install -g oh-no-codex@0.1.7 --registry https://registry.npmjs.org
cd your-git-repo
ohno init --goal "Owner project goal"
ohno install              # hooks + day-to-day oh-no-* skills
```

```bash
ohno skill install        # refresh skills only
ohno skill status
# open a new Codex session so discovery picks them up
```

Node.js **>= 22.20**. Package: [oh-no-codex](https://www.npmjs.com/package/oh-no-codex) (`0.1.7`).

### Windows notes

- Put npm's global bin on **PATH** (often `%AppData%\npm` or a custom global prefix) so Codex shells find `ohno`.
- Use the `ohno` / `ohno.cmd` shim. **Do not** double-click `node_modules\oh-no-codex\dist\cli.js`; Windows Script Host cannot run that ESM file.
- Progress % in the cockpit is **plan cursor** (`cursor/task_count`), not "product finished."

---

## Cockpit (how to start)

Local **read-only** glass board. Same data as `ohno status --json`.

```bash
cd your-git-repo          # must already have run ohno init
# If you use a git worktree, cd into THAT worktree — each tree has its own .ohno/
ohno cockpit
# optional fixed port (multi-project: pick different ports):
ohno cockpit --port 13521
# free the port / stop the process without finding the terminal:
ohno cockpit stop
# kill previous cockpit for this project and start a new one:
ohno cockpit --replace
ohno cockpit --replace --port 13521
```

Terminal prints a loopback URL, for example:

```text
Cockpit: http://127.0.0.1:53123/
Stop: Ctrl+C in this terminal, or from another shell: ohno cockpit stop
```

1. Open that URL in a browser on the same machine.  
2. The page polls `/api/state` about every 100ms while the tab is visible
   (design target 100–125ms).
3. **Stop** with Ctrl+C, or `ohno cockpit stop` (releases the port). Not a daemon.  
4. Or ask Codex via skill **`oh-no-cockpit`**.

### Port and multi-project rules

| Rule | Behavior |
| --- | --- |
| Default port | OS ephemeral (`port: 0`) unless `--port N` |
| Same project, already running | Prints the **existing** URL and exits (no second process) |
| `--replace` | Stops the previous cockpit for **this** cwd, then starts |
| `ohno cockpit stop` | Kills the recorded PID and frees the port |
| Multi-project | One cockpit per project cwd; use different `--port` values if you want stable tabs |
| Old browser tab | Dead port → **COCKPIT SERVER OFFLINE** (not "corrupt state.json") |
| Runtime pointer | `.ohno/cockpit.runtime.json` (pid/url only; **not** plan authority) |

### Where cockpit data comes from

```text
plan accept / task start / verify
        │ atomic replace
        ▼
  .ohno/state.json            sole authority
        │ readModel()
        ├── status / resume / next
        └── GET /api/state ── browser poll ── Cockpit UI
```

| On screen | Source |
| --- | --- |
| How many tasks | `ordered_tasks.length` →`task_count` |
| How far along | `cursor` + `active_task` |
| Progress bar | **`cursor / task_count`** only (no fake trust %) |
| Board phases | Derived from cursor / proof — not a second store |

The cockpit **never** advances work. CLI/skills mutate state; the UI only reads.

---

## How you actually use it (autonomy vs manual)

**You usually do not pick skills by hand.**

After `init` + `install`, talk in ordinary language. Codex is expected to load
the matching `oh-no-*` skill and run the shell command.

Oh No is **cooperative**, not fully autonomous: hooks help in the background;
acceptance still requires a real `ohno verify`.

| Who | What happens |
| --- | --- |
| **Automatic (hooks)** | Session start / compact → inject resume capsule; scoped writes may be denied |
| **You speak → Codex uses skill** | "start / done / where are we / open cockpit" → model runs the matching `ohno` command |
| **You run CLI yourself** | Setup once; or when the model forgets verify / you want certainty |

### Setup once (you, terminal)

```bash
npm install -g oh-no-codex
cd your-git-repo
ohno init --goal "Your product goal"
ohno install
# new Codex session
```

### Everyday examples (you →expected Codex behavior)

**Example A — first slice**

| You say | Codex should |
| --- | --- |
| "This is a foreign-trade app. Draft a linear plan; first slice = customer CRUD." | Use **`oh-no-plan`**: write plan JSON, `ohno plan propose`, wait for your review, then `accept` |
| "Start work." | **`oh-no-task`** →`ohno task start`, then edit only allowed files |
| "Done, verify." | **`oh-no-verify`** →`ohno verify`; report PASS/FAIL honestly |

**Example B — mid project**

| You say | Codex should |
| --- | --- |
| "Where are we?" | **`oh-no-resume`** (or status) |
| "Remember: no multi-tenant yet." | **`oh-no-requirements`** →`ohno requirements note --text "…"` |
| "Requirements changed: export PDF first." | **`oh-no-change`** then a replacement plan |
| "Open the board." | **`oh-no-cockpit`** →`ohno cockpit`, tell you the `http://127.0.0.1:…` URL |

**Example C — when you should act yourself**

| Situation | You do |
| --- | --- |
| First time in a repo | Terminal: `ohno init` + `ohno install` |
| Model says "done" without running verify | Say "run ohno verify" **or** run `ohno verify` in the terminal |
| Want a dashboard | Terminal or chat: `ohno cockpit` / "open cockpit" |
| Skill missing after upgrade | `ohno skill install`, new Codex session |

### Day-to-day skills (reference — not a checklist)

Setup (`ohno init` / `ohno install`) is **terminal-only**, not a skill.  
Shell details live inside each skill file for Codex; users need not memorize them.

| Skill | You mean |
| --- | --- |
| `oh-no-plan` | plan / accept plan |
| `oh-no-task` | start / reopen this slice |
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
| CLI | `init` · `plan` · `task` · `verify` · `change` · `migrate acceptance-basis` · `resume` · … |
| 13 Codex skills | Day-to-day discoverable procedure (setup is CLI) |
| Hooks + pre-commit | Capsule inject, scope guard |
| Projectors | `.ohno/PROGRESS.md`, `.ohno/REQUIREMENTS.md`, short AGENTS capsule |
| Preferences | Optional craft defaults (research / OSS / UI adapt) |
| Cockpit | Read-only board = `status --json` |

**Not in V1:** database, daemon, skill marketplace product, multi-agent OS, absolute same-user security.

---

## Evidence

| Claim | Label |
| --- | --- |
| Core harness | `ANTI_DRIFT_CORE_WORKS` |
| Release / public status | **`0.1.7` is published**; local trials remain `TRIAL_PASS`, not `V1_TRIAL_ACCEPTED` |
| CLI / hooks / atomic state | `LOCAL_PASS` |
| Cockpit = status JSON | `LOCAL_PASS` |
| Correction 4 structured basis | `LOCAL_PASS` (merged on main) |
| Disposable real-copy P01–P06 | **`TRIAL_PASS`** LIVE — p95 ms A/B/C: status 139.361 / 140.512 / 132.802; next 169.689 / 157.331 / 136.215; resume 168.616 / 195.458 / 193.012; task_start 136.947 / 156.410 / 159.346; P06 163 / 178 / 164; P04 resume 4006 B (not a universal speed claim; batch id in trial evidence JSON) |
| npm | **`oh-no-codex@0.1.7`** is on the public npm registry; mirrors may lag |
| Schema 2 → 3 migrate | Two-phase: preview then `--diff`/`--head` apply (see DESIGN) |

Contracts: [Product](./docs/PRODUCT-CONTRACT.md) · [Design](./docs/DESIGN.md) · [Acceptance](./docs/ACCEPTANCE.md) · [Publish](./docs/PUBLISH.md) · [Sins](./docs/CODEX-SINS.md)

---

<p align="center">
  <sub>MIT · Independent community project · Not affiliated with OpenAI</sub>
</p>

<p align="center">
  <strong>Bound the slice. Prove it. Recover without archaeology.</strong>
</p>

<p align="center"><a href="#readme-top">→top</a></p>
