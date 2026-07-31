<!-- Bilingual homepage: language switch uses in-page anchors only. -->
<p align="center">
  <a href="#readme-en"><strong>English</strong></a>
  &nbsp;·&nbsp;
  <a href="#readme-zh"><strong>简体中文</strong></a>
</p>

<p align="center"><sub>Same homepage — in-page jump, no other file.</sub></p>

<a id="readme-en"></a>

<p align="center">
  <img
    src="./assets/brand/oh-no-codex-lockup.png"
    width="900"
    alt="Oh No, Codex! — a mischievous blue coding plush is stopped from continuing by a clear red cross"
  >
</p>

<h1 align="center">Oh No, Codex!</h1>

<p align="center">
  <strong>A fast, local anti-drift harness for Codex vibe coding.</strong>
</p>

<p align="center">
  One goal. One bounded task. One black-box test. Then stop.
</p>

<p align="center">
  <a href="https://github.com/t01089572455/oh-no-codex/blob/main/docs/IMPLEMENTATION-PLAN.md">
    <img alt="Status: V1 trial accepted" src="https://img.shields.io/badge/status-V1_TRIAL_ACCEPTED-74D6B1?style=for-the-badge&labelColor=202624">
  </a>
  <img alt="Codex only" src="https://img.shields.io/badge/harness-Codex_only-FF4B35?style=for-the-badge&labelColor=202624">
  <img alt="Node.js 22.20 or newer" src="https://img.shields.io/badge/Node.js-%E2%89%A522.20-74D6B1?style=for-the-badge&labelColor=202624">
  <a href="./LICENSE">
    <img alt="MIT License" src="https://img.shields.io/badge/license-MIT-FFF1CE?style=for-the-badge&labelColor=202624">
  </a>
</p>

<p align="center">
  <a href="#why">Why</a>
  ·
  <a href="#what-is-implemented">Features</a>
  ·
  <a href="#complete-usage-guide">Usage</a>
  ·
  <a href="#the-four-loops">Four loops</a>
  ·
  <a href="#oh-no-cockpit">Cockpit</a>
  ·
  <a href="#the-eighteen-sins">18 sins</a>
  ·
  <a href="#project-contracts">Docs</a>
</p>

> [!IMPORTANT]
> **V1 is `V1_TRIAL_ACCEPTED`.** Daily path: **install + `init` + `install`
> hooks**, then talk to Codex — hooks inject resume, scope writes, and refresh
> projections; the AGENTS managed block (and optional `skills/oh-no-control`)
> tells the Agent when to run `task start` / `verify` / `change` / notes.
> Evidence covers CLI loops, hooks, Cockpit, projectors, preferences, doctor,
> A14/P01–P06. Ledger: Tasks 1–7, Corrections 1–2, essence ports E1–E12.
> This is **not** hostile-agent containment or auto plan-accept / fake verify.
> Install: `npm install -g oh-no-codex`.

## Why

Codex can write good code and still let a project drift:

- a small request quietly becomes a new architecture;
- coding starts before the expected user behavior is clear;
- internal tests pass while the user-visible behavior remains broken;
- a requirement changes, but the governing documents do not;
- “next” is mistaken for permission to keep working;
- the next session spends an hour reconstructing the truth from chat.

Oh No, Codex! puts a lightweight harness around each task boundary. Before a
supported write, it asks for one bounded task and one minimal, user-visible
black-box test. At the finish line, fresh evidence—not agent prose—decides
whether the task stops.

It is a **cooperative project harness** for local Codex work. It is not an AI
security sandbox, an enterprise governance platform, or a promise that a
hostile process cannot bypass its owner.

## The four loops

```mermaid
flowchart LR
    A["Owner goal"] --> B["One bounded task"]
    B --> C["One user-visible black box"]
    C --> D{"Fresh PASS?"}
    D -- "FAIL / UNKNOWN" --> B
    D -- "Yes" --> E["Stop"]
    E --> F["One plan-derived next action"]
```

The next action is a locator, not fresh authorization.

| Loop | Drift it prevents | Smallest useful behavior |
| --- | --- | --- |
| **Start** | Coding before the task is understood | Activate only the frozen cursor task: expected behavior, one test, allowed files, time budget, and stop condition. |
| **Finish** | “Looks done” completion claims | Run the exact black box and bind PASS to the current task and Git subject. |
| **Change** | Requirements and governing documents diverging | Select required documents from Owner-maintained Truth, show the exact diff, and block coding until review. |
| **Resume** | New sessions rebuilding state from prose | Return the goal, current task, proof, blocker, and one next action from one atomic state file. |

## What is implemented

**V1 harness scope is complete** as `V1_TRIAL_ACCEPTED` on named local black-box
and disposable-project evidence. That does **not** mean npm publication,
hostile-agent security, or a universal speed guarantee.

| Area | Commands / surfaces | Status |
| --- | --- | --- |
| Project bootstrap | `ohno init --goal …` | Done |
| Linear plan review | `ohno plan propose` · `ohno plan accept` | Done |
| Bounded task start | `ohno task start` (no free-form contract args) | Done |
| Evidence-bound finish | `ohno verify` | Done |
| Instant recovery | `ohno status` · `ohno resume` · `ohno next` | Done |
| Requirement change | `ohno change begin` · `diff` · `accept` | Done |
| Codex cooperative hooks | SessionStart / PostCompact / PreToolUse / Stop | Done |
| Git pre-commit guard | `ohno install` · `ohno git pre-commit` | Done |
| Hook introspection | `ohno hooks status --json` · `ohno hook` | Done |
| Read-only Cockpit | `ohno cockpit` (glass mission dashboard + plan board) | Done |
| Plan board projection | `status --json` field `plan_board` (DONE/HALF/READY/OUTLINE…) | Done |
| Generated progress + AGENTS block | `ohno projectors refresh` → `.ohno/PROGRESS.md` + managed AGENTS section | Done |
| Owner requirements log | `ohno requirements note/show` → `.ohno/REQUIREMENTS.md` | Done |
| Working method preferences | `ohno preferences show/set/reset` → `.ohno/preferences.json` (defaults: research-first, reuse OSS, frontend adapt-not-invent) | Done |
| Conversation protocol in AGENTS | Managed block maps 开工/做完/改需求 → `task start` / `verify` / `change` | Done |
| Optional control skill copy | `skills/oh-no-control/SKILL.md` (static; AGENTS live capsule wins) | Done |
| Doctor health surface | `ohno doctor [--json]` | Done |
| Handoff identity | resume `HANDOFF_*` path/branch/head/dirty | Done |
| Atomic state authority | `.ohno/state.json` sole runtime authority | Done |
| Truth applicability | `.ohno/truth.json` Owner list | Done |

**Explicitly not done / not authorized**

| Item | Status |
| --- | --- |
| Hostile multi-tenant SaaS hosting | Out of scope |
| Claude or multi-agent support | Out of V1 scope |
| Hostile same-user containment | Explicit non-goal |
| Database, daemon, hosted service, plugin platform | Explicit non-goals |

## Complete usage guide

> Preferred: install from npm. Source build remains supported.

### Daily path (what you actually do)

Most days you should **not** memorize the full CLI.

```text
1. Once:  npm i -g oh-no-codex
2. Once:  cd project && ohno init --goal "…" && ohno install
3. Daily: talk to Codex in ordinary language
4. Optional: ohno cockpit | doctor | preferences | requirements note
```

| Layer | Who | What |
| --- | --- | --- |
| **Background** | Hooks after `ohno install` | Resume capsule on session start/compact; cooperative write scope; Stop completion marker; projector refresh |
| **Conversation protocol** | Codex, via `AGENTS.md` managed block | Runs `task start` / `verify` / `change` / `requirements note` when you mean those intents |
| **You edit anytime** | You | `.ohno/preferences.json`, REQUIREMENTS notes, prose outside the AGENTS managed block |

**Never automated:** silent plan accept, inventing a verify PASS, treating `next` as new permission.

Optional skill copy of the protocol (same rules as the managed block):  
[`skills/oh-no-control/SKILL.md`](./skills/oh-no-control/SKILL.md) — copy into your Codex skills folder if you like; the project AGENTS live capsule still wins for current state.

### 0. Prerequisites

- Node.js **≥ 22.20**
- An ordinary **Git** repository (the project you want to harness)
- Optional: Codex CLI/TUI for hook integration

### 1. Install the CLI

```bash
npm install -g oh-no-codex
ohno --help
```

Or without a global install:

```bash
npx oh-no-codex --help
```

From source (development):

```bash
git clone https://github.com/t01089572455/oh-no-codex.git
cd oh-no-codex
npm ci
npm run build
node dist/cli.js --help
```

### 2. Initialize a project (and install hooks)

```bash
cd /path/to/your-git-project
ohno init --goal "Ship reliable draft persistence"
ohno install
```

Creates / updates:

| Path | Role |
| --- | --- |
| `.ohno/state.json` | Sole current runtime authority |
| `.ohno/truth.json` | Owner-maintained governing-document list |
| `.ohno/preferences.json` | Working-method defaults (research / reuse OSS / frontend adapt) |
| `.ohno/REQUIREMENTS.md` | Owner notes + live projection |
| `AGENTS.md` | Live capsule + **conversation protocol** (managed block) |
| `.ohno/PROGRESS.md` | Generated progress board (best-effort on init) |
| `.codex/hooks.json` | Cooperative SessionStart / PostCompact / PreToolUse / Stop |

`init` refuses silent re-initialization. Goal changes go through the
requirement-change loop, not another `init`.

### 3. Propose and accept a linear plan

> The Agent can prepare the plan file from your words; you still review before
> `plan accept`. Full CLI below is for scripts and power users.

Write a review file (example: `.ohno/review-plan.json`):

```json
{
  "cursor": 0,
  "ordered_tasks": [
    {
      "id": "draft-persistence",
      "title": "Prove draft survives reload",
      "goal": "Users keep their draft after refresh",
      "status": "FROZEN",
      "expected_behavior": "A saved draft survives page reload",
      "test_command": "node --test test/draft-persistence.test.mjs",
      "stop_condition": "Stop after the draft black box passes",
      "allowed_files": ["src/draft/**", "test/draft-persistence.test.mjs"],
      "time_budget_minutes": 45
    },
    {
      "id": "polish-copy",
      "title": "Polish empty-state copy",
      "goal": "Empty state is clear",
      "status": "OUTLINE"
    }
  ]
}
```

Rules:

- The **cursor** task must be `FROZEN` (behavior, exact test, files, stop, budget).
- Later tasks may be `OUTLINE` (id + title + goal only).
- An `OUTLINE` at the cursor cannot start; next action is `FREEZE_TASK:<id>`.

```bash
ohno plan propose --file .ohno/review-plan.json
# copy the exact printed values:
ohno plan accept --revision <PLAN_REVISION> --diff <DIFF_DIGEST>
```

Acceptance records only `LOCAL_REVIEW_RECORDED` (local evidence), **not**
Owner identity or production authorization.

### 4. Start the cursor task

```bash
ohno task start
```

- No `--test` / `--files` / free-form next args: only the frozen cursor contract activates.
- Second start while active fails closed and preserves state bytes.
- Pending document sync also blocks start.

### 5. Implement, then verify with the exact black box

Do the work inside `allowed_files`. When ready:

```bash
ohno verify
```

| Result | Meaning |
| --- | --- |
| non-zero / timeout / unknown | Task stays **ACTIVE**; fix and re-verify |
| zero + stable subject | **PASS** receipt; cursor advances once |
| HEAD changes during the test | **UNKNOWN** (not PASS) |
| Later ordinary commit, subject unchanged | Proof stays **FRESH** |
| Contract / plan / scoped files change | Proof becomes **STALE** |

Optional cooperative Stop marker for Codex (only after a real PASS):

```text
OHNO_COMPLETE:<active-task-id>
```

### 6. Recover state in any new session

```bash
ohno status          # human-readable
ohno status --json   # machine-readable read model
ohno resume          # bounded capsule for a new session / post-compact
ohno next            # one plan-derived next action only
```

Typical next actions: `START_TASK:<id>`, `FREEZE_TASK:<id>`,
`SYNC_GOVERNING_DOCUMENTS`, `PROPOSE_PLAN`, `PROJECT_COMPLETE`.

### 7. Requirement change (Truth + exact diff)

When the Owner changes requirements:

```bash
ohno change begin --summary "Owner revised acceptance wording" --concerns docs
# edit governing docs + replacement plan as shown
ohno change diff
ohno change accept --change <CHANGE_ID> --diff <DISPLAYED_DIGEST>
```

While pending, the only safe next action is `SYNC_GOVERNING_DOCUMENTS`.
Supported mutation hooks deny unrelated implementation work.

### 8. Install cooperative hooks

Inside the project:

```bash
ohno install
ohno hooks status --json
```

| Hook | Job |
| --- | --- |
| SessionStart / PostCompact | Inject goal, task, proof, blocker, next |
| PreToolUse | Deny supported writes without contract / out of scope |
| Stop | Require exact `OHNO_COMPLETE:<id>` + fresh proof |
| Git pre-commit | Reject out-of-scope or stale proof commits |

Then review and trust the project hooks inside Codex. Hooks are
**cooperative guardrails**, not hostile-agent containment. Ordinary Git can
still use `--no-verify`.

### 9. Refresh projections (progress table + AGENTS managed block)

```bash
ohno projectors refresh
# or skip AGENTS.md:
ohno projectors refresh --no-agents
```

Writes:

| File | Meaning |
| --- | --- |
| `.ohno/PROGRESS.md` | Generated board/progress table (**not** authority) |
| `.ohno/REQUIREMENTS.md` | Owner notes + live projection of goal/board/truth |
| `.ohno/preferences.json` | Owner working-method rules (default ON: research / reuse OSS / frontend adapt) |
| `AGENTS.md` between `<!-- ohno:managed-begin/end -->` | Live capsule for agents; owner prose outside the block is preserved |

`task start`, `verify`, `plan accept`, and `change accept` also refresh
projections best-effort.

### 10. Open the Cockpit

```bash
ohno cockpit
# prints: Cockpit: http://127.0.0.1:<port>/
```

Open that loopback URL in a browser. The glass dashboard is **read-only** and
always projects the same model as `status --json` (no second authority). The
**PLAN BOARD** panel lists DONE / HALF / READY / OUTLINE rows from that model.

### End-to-end cheat sheet

```bash
ohno init --goal "…"
# edit .ohno/review-plan.json
ohno plan propose --file .ohno/review-plan.json
ohno plan accept --revision … --diff …
ohno task start
# implement within allowed_files
ohno verify
ohno install                 # optional cooperative hooks
ohno doctor                  # health surface
ohno projectors refresh      # PROGRESS + REQUIREMENTS + AGENTS block
ohno requirements note --text "Owner: ship user-visible save first"
ohno preferences show
ohno preferences set --id frontend_adapt_not_invent --enabled false
ohno preferences reset
ohno resume
ohno next
ohno cockpit                 # GET /api/state, ~2.5s poll
```

## CLI core, thin hooks

The CLI owns the state and decisions. Hooks only bring those decisions to the
moment Codex is about to act:

| Surface | V1 job |
| --- | --- |
| `SessionStart` / `PostCompact` | Best-effort projector refresh, then inject the bounded resume capsule (goal, board, proof, blocker, next, handoff). |
| `PreToolUse` | Block supported writes when the task contract is missing or the path is outside the declared scope. |
| `Stop` | On the exact `OHNO_COMPLETE:<task-id>` marker, keep the task open unless proof is fresh and document sync is clean. Missing or paraphrased markers are not completion signals. |
| Git `pre-commit` | Reject an out-of-scope or unverified commit. |

Hooks are guardrails around cooperative Codex use—not an unbreakable security
boundary.

## One authority, several views

```text
ohno CLI -- atomic replace --> .ohno/state.json   (sole runtime authority)
                                  |-- status / resume / next / doctor
                                  |-- thin Codex hooks (capsule inject)
                                  |-- Git pre-commit guard
                                  |-- projectors → .ohno/PROGRESS.md
                                  |               → AGENTS.md managed block
                                  `-- read-only Cockpit ← GET /api/state (poll)

.ohno/truth.json -------------> named governing documents
```

- `.ohno/state.json` is the sole current runtime authority.
- `.ohno/truth.json` is the Owner-maintained document applicability list.
- Hooks, receipts, terminal output, PROGRESS, AGENTS managed blocks, and
  Cockpit are projections—not competing sources of truth.
- Normal read paths stay bounded: no whole-repository document scan and no
  full test suite.

## Small by design

V1 has one Node.js package, one `ohno` executable, one atomic state file, one
Truth list, thin project hooks, one Git hook, and one local read-only Cockpit.

It deliberately has no database, daemon, hosted service, policy language,
plugin platform, provider framework, or multi-agent scheduler. A new
abstraction earns its place only when a failing public black-box test needs it.

## Oh No Cockpit

The Cockpit is a local, GET-only **glass mission dashboard** that projects the
same read model as `ohno status --json`. It owns no state, cache, database, or
write route. Top navigation carries brand, current stage, overall progress,
and refresh. Instruments answer:

1. **What is happening now?** (`NOW`, mission pulse, calibration rail)
2. **What is the one next action?** (`NEXT`)
3. **Is proof fresh, and is anything blocking?** (`PROOF`, `DRIFT` / ATTENTION)

```bash
ohno cockpit
```

```text
+-- OH NO, CODEX! ------ CURRENT STAGE ------ PROGRESS ------ REFRESH --+
| NOW / NEXT / ATTENTION |  MISSION PULSE + CALIBRATION  | PROOF        |
| RECENT completed       |  cursor / task count          | PLAN BOARD   |
|                        |                               | Truth paths  |
|                        |                               | Handoff id   |
+-- COMPLETION VECTOR (poll ~2.5s from /api/state) --------------------+
```

Honesty rules for the UI:

- all panels bind the same `/api/state` model as `status --json`
- progress = `cursor / task_count` only
- no invented “trust weather” percentages or fake metrics
- unavailable / corrupt state shows an explicit offline gate
- read-only: the UI never writes authority

| Color | Role |
| --- | --- |
| Soft lavender field `#F0EDF8` | glass dashboard surface |
| Purple / blue accents | navigation and active pulse |
| Teal / mint | fresh / clear |
| Amber | drift / attention |
| Red | blocked / fail |

## The eighteen sins

Codex’s **eighteen sins** are the audited anti-patterns this harness is built
against. Oh No, Codex! turns them into constraints, tests, or explicit
non-goals—not eighteen new subsystems.

<details>
<summary><strong>Open all 18</strong></summary>

| # | Sin | Product correction |
| ---: | --- | --- |
| 1 | **Semantic usurpation** | Preserve the Owner’s words; ambiguity selects the smallest satisfying behavior. |
| 2 | **Maximum interpretation** | No subsystem or abstraction without a current public RED. |
| 3 | **Never stopping** | Acceptance ends the task; `next` is not permission. |
| 4 | **Review becomes edit authority** | Review is read-only unless fixes are explicitly authorized. |
| 5 | **Zombie authority** | Current canonical state outranks old plans and summaries. |
| 6 | **Summary replaces truth** | Resume is a bounded projection, never a new authority. |
| 7 | **Local green equals complete** | Every claim names its exact evidence scope. |
| 8 | **Self-certified closure** | Exact commands and subject-bound receipts outrank agent prose. |
| 9 | **Test theatre** | Every task owns one minimal user-visible black box. |
| 10 | **Proxy goals take over** | Keep one Owner goal and one active bounded task visible. |
| 11 | **Reviewer denominator inflation** | Review against frozen acceptance; extra ideas remain proposals. |
| 12 | **Control-tax blindness** | Latency, capsule size, and no-full-scan paths are acceptance rows. |
| 13 | **Rebuilding the world** | Prefer Git, files, and ordinary tests before new machinery. |
| 14 | **Workspace identity confusion** | Handoffs name path, branch, commit, tree, and dirty state. |
| 15 | **Handoff tax on the user** | One `resume` command returns the operational capsule. |
| 16 | **UX debt last** | Freeze the Cockpit design before code; accept it in the browser. |
| 17 | **Agreement plus overconfidence** | Use honest capability labels and measured evidence. |
| 18 | **Apology without constraint** | Every confirmed incident becomes a rule, regression, or non-goal. |

Read the privacy-scrubbed audit and evidence boundary in
[`docs/CODEX-SINS.md`](https://github.com/t01089572455/oh-no-codex/blob/main/docs/CODEX-SINS.md).

</details>

## Evidence, not promises

Capability labels name the evidence actually held by this repository:

| Capability | Status | Evidence boundary |
| --- | --- | --- |
| Public product status | `V1_TRIAL_ACCEPTED` | Ledger Tasks 1–7 + Corrections 1–2 + essence ports E1–E12 |
| CLI state, plan, verify, resume, change, hooks, and atomic-write behavior | `LOCAL_PASS` | Public Node black boxes A01–A12, A15, and A16 |
| Plan board, projectors, doctor, handoff identity | `LOCAL_PASS` | `projectors` / resume-status-next / hooks black boxes |
| Read-only Cockpit projection | `LOCAL_PASS` | A13 HTTP equality with `status --json` |
| Three copied-project loops and P01–P05 | `TRIAL_PASS` | Bounded harness trials on anonymous TypeScript CLI, React/Vite Web, and Python OCR source copies |
| Desktop/narrow visual and accessibility acceptance | `LOCAL_PASS` | A14 via system Chrome/Edge after Owner authorized external browser |
| State-to-Cockpit browser reflection | `TRIAL_PASS` | P06 three-copy browser receipt; worst p95 73.690 ms |
| npm package `oh-no-codex` | `0.1.0` on [registry.npmjs.org](https://www.npmjs.com/package/oh-no-codex) | `npm install -g oh-no-codex` |

The three-copy measurements use one untimed warm-up and 30 raw samples per
command per copy. Worst observed p95 values were:

| Surface | Frozen budget | Worst observed | Result |
| --- | ---: | ---: | --- |
| `ohno status` | `<250 ms` | `92.249 ms` | `TRIAL_PASS` |
| `ohno next` | `<250 ms` | `84.213 ms` | `TRIAL_PASS` |
| `ohno resume` | `<500 ms` | `85.938 ms` | `TRIAL_PASS` |
| Largest accepted resume capsule | `<4096 bytes` | `3194 bytes` | `TRIAL_PASS` |
| Task-start harness overhead | `<2000 ms` | `97.667 ms` | `TRIAL_PASS` |
| State-to-Cockpit browser reflection | `<250 ms` | `73.690 ms` | `TRIAL_PASS` |

These are local trial results for the named anonymous copies and machine, not
a universal speed or production-readiness guarantee.

## Project contracts

Public product truth lives in a small set of documents:

1. [Product contract](https://github.com/t01089572455/oh-no-codex/blob/main/docs/PRODUCT-CONTRACT.md)
2. [V1 design](https://github.com/t01089572455/oh-no-codex/blob/main/docs/DESIGN.md)
3. [Acceptance contract](https://github.com/t01089572455/oh-no-codex/blob/main/docs/ACCEPTANCE.md)
4. [Implementation ledger](https://github.com/t01089572455/oh-no-codex/blob/main/docs/IMPLEMENTATION-PLAN.md) (current status: `V1_TRIAL_ACCEPTED`)
5. [Codex eighteen sins](https://github.com/t01089572455/oh-no-codex/blob/main/docs/CODEX-SINS.md)
6. [Essence backlog](https://github.com/t01089572455/oh-no-codex/blob/main/docs/ESSENCE-BACKLOG.md) (E1–E12 complete)

## License

[MIT](./LICENSE)

Oh No, Codex! is an independent community project and is not affiliated with
or endorsed by OpenAI.

<p align="center">
  <strong>Measure the task. Prove the behavior. Stop the agent.</strong>
</p>

<p align="center"><a href="#readme-en">Back to top ↑</a></p>

---

<a id="readme-zh"></a>

<p align="center">
  <a href="#readme-en">English</a>
  &nbsp;·&nbsp;
  <strong>简体中文</strong>
</p>

<p align="center">
  <img
    src="./assets/brand/oh-no-codex-lockup.png"
    width="900"
    alt="Oh No, Codex!：淘气的蓝色编程玩偶准备继续操作时，被清晰的红叉及时制止"
  >
</p>

<h1 align="center">Oh No, Codex!</h1>

<p align="center">
  <strong>一个快速、本地、专门防止 Codex vibe coding 漂移的 Harness。</strong>
</p>

<p align="center">
  一个目标。一个有边界的任务。一个黑盒测试。通过就停。
</p>

<p align="center">
  <a href="https://github.com/t01089572455/oh-no-codex/blob/main/docs/IMPLEMENTATION-PLAN.md">
    <img alt="状态：V1 试验已接受" src="https://img.shields.io/badge/status-V1_TRIAL_ACCEPTED-74D6B1?style=for-the-badge&labelColor=202624">
  </a>
  <img alt="仅支持 Codex" src="https://img.shields.io/badge/harness-Codex_only-FF4B35?style=for-the-badge&labelColor=202624">
  <img alt="Node.js 22.20 或更高版本" src="https://img.shields.io/badge/Node.js-%E2%89%A522.20-74D6B1?style=for-the-badge&labelColor=202624">
  <a href="./LICENSE">
    <img alt="MIT License" src="https://img.shields.io/badge/license-MIT-FFF1CE?style=for-the-badge&labelColor=202624">
  </a>
</p>

<p align="center">
  <a href="#为什么需要它">为什么</a>
  ·
  <a href="#已经实现了哪些功能">功能清单</a>
  ·
  <a href="#完整使用说明">使用说明</a>
  ·
  <a href="#四个闭环">四个闭环</a>
  ·
  <a href="#oh-no-驾驶舱">驾驶舱</a>
  ·
  <a href="#codex-十八宗罪">十八宗罪</a>
  ·
  <a href="#项目合同">文档</a>
</p>

> [!IMPORTANT]
> **V1 状态为 `V1_TRIAL_ACCEPTED`。** 日常路径：**安装 + `init` + `install` hooks**，
> 之后主要对 Codex 说话——hooks 注入 resume、协作拦写范围并刷新投影；`AGENTS.md`
> 托管块（及可选 `skills/oh-no-control`）告诉 Agent 何时跑 `task start` /
> `verify` / `change` / 记笔记。证据覆盖 CLI、hooks、驾驶舱、投影、preferences、
> doctor、A14/P01–P06。账本：Tasks 1–7、Corrections 1–2、精华 E1–E12。
> 这**不是**敌对 Agent 硬隔离，也**不会**静默 accept plan 或伪造 verify PASS。
> 安装：`npm install -g oh-no-codex`。

## 为什么需要它

Codex 能写出不错的代码，也仍然可能把项目带偏：

- 一个小需求悄悄膨胀成一套新架构；
- 用户预期还没说清楚，编码已经开始；
- 内部测试全绿，但用户真正看到的功能仍然坏着；
- 需求已经变化，规范文档却没有一起更新；
- “下一步是什么”被误解成“可以继续做”；
- 新 Session 先花一个小时从聊天记录里重建现场。

Oh No, Codex! 在每个任务边界套上一层轻量约束。执行受支持的写操作前，
先固定一个有边界的任务和一个最小、用户可见的黑盒测试；到达终点后，
由新鲜证据决定是否停止，而不是由 Agent 自己说“完成了”。

它是面向本地 Codex 开发的**合作型项目 Harness**，不是 AI 安全沙箱，
不是企业治理平台，也不承诺能阻止 Owner 权限下的恶意进程。

## 四个闭环

```mermaid
flowchart LR
    A["Owner 目标"] --> B["一个有边界的任务"]
    B --> C["一个用户可见的黑盒测试"]
    C --> D{"当前证据 PASS？"}
    D -- "FAIL / UNKNOWN" --> B
    D -- "是" --> E["停止"]
    E --> F["由计划推导的唯一下一步"]
```

“下一步”只是定位信息，不是新的执行授权。

| 闭环 | 防止什么漂移 | 最小有用行为 |
| --- | --- | --- |
| **开始** | 任务没想清楚就开写 | 只激活 cursor 指向的冻结任务：预期行为、一个测试、文件范围、时间预算和停止条件。 |
| **完成** | “看起来好了”冒充完成 | 执行指定黑盒，并把 PASS 绑定到当前任务和 Git 对象。 |
| **变更** | 需求与规范文档不同步 | 从 Owner 维护的 Truth 清单确定必改文档，展示精确 diff，确认前阻止编码。 |
| **恢复** | 新 Session 从聊天里拼现场 | 从一个原子状态文件返回目标、当前任务、证据、阻塞和唯一下一步。 |

## 已经实现了哪些功能

**V1 Harness 范围已完成**，账本状态为 `V1_TRIAL_ACCEPTED`（基于命名本地黑盒与
可弃用项目副本证据）。npm 包 `oh-no-codex@0.1.0` 已公开；这**不等于**敌对 Agent 安全产品、
也不等于普适速度保证。

| 能力域 | 命令 / 表面 | 状态 |
| --- | --- | --- |
| 项目初始化 | `ohno init --goal …` | 已完成 |
| 线性计划评审 | `ohno plan propose` · `ohno plan accept` | 已完成 |
| 有边界任务启动 | `ohno task start`（不能自填合同字段） | 已完成 |
| 证据绑定完成 | `ohno verify` | 已完成 |
| 秒级恢复现场 | `ohno status` · `ohno resume` · `ohno next` | 已完成 |
| 需求变更同步 | `ohno change begin` · `diff` · `accept` | 已完成 |
| Codex 合作式 Hooks | SessionStart / PostCompact / PreToolUse / Stop | 已完成 |
| Git pre-commit 护栏 | `ohno install` · `ohno git pre-commit` | 已完成 |
| Hook 状态查询 | `ohno hooks status --json` · `ohno hook` | 已完成 |
| 只读驾驶舱 | `ohno cockpit`（玻璃态任务仪表盘 + 计划看板） | 已完成 |
| 计划看板投影 | `status --json` 的 `plan_board`（DONE/HALF/READY/OUTLINE…） | 已完成 |
| 生成式进度/AGENTS 托管块 | `ohno projectors refresh` → `.ohno/PROGRESS.md` + `AGENTS.md` 托管段 | 已完成 |
| Owner 需求汇总日志 | `ohno requirements note/show` → `.ohno/REQUIREMENTS.md` | 已完成 |
| 工作方法偏好 | `ohno preferences show/set/reset` → `.ohno/preferences.json`（默认：先调研、复用开源、前端先抄再改） | 已完成 |
| AGENTS 对话协议 | 托管块映射 开工/做完/改需求 → `task start` / `verify` / `change` | 已完成 |
| 可选控制 skill 副本 | `skills/oh-no-control/SKILL.md`（静态；现场以 AGENTS 托管块为准） | 已完成 |
| 健康检查 | `ohno doctor [--json]` | 已完成 |
| Handoff 身份 | resume 中的 path/branch/head/dirty | 已完成 |
| 原子状态权威 | `.ohno/state.json` 唯一运行时权威 | 已完成 |
| Truth 适用清单 | `.ohno/truth.json` 由 Owner 维护 | 已完成 |

**明确未做 / 未授权**

| 项目 | 状态 |
| --- | --- |
| 多租户托管 SaaS | 超出范围 |
| Claude 或多 Agent 支持 | 超出 V1 |
| 敌对同用户进程硬隔离 | 明确非目标 |
| 数据库、守护进程、托管服务、插件平台 | 明确非目标 |

## 完整使用说明

> 推荐从 npm 安装；也支持源码构建。

### 日常路径（你真正要做的）

多数时候**不必背完整 CLI**。

```text
1. 一次：npm i -g oh-no-codex
2. 一次：cd 项目 && ohno init --goal "…" && ohno install
3. 日常：用自然语言和 Codex 说话
4. 可选：ohno cockpit | doctor | preferences | requirements note
```

| 层 | 谁 | 做什么 |
| --- | --- | --- |
| **后台** | `ohno install` 后的 hooks | 会话开始/压缩注入 resume；协作拦越权写；Stop 完成标记；刷新投影 |
| **对话协议** | Codex（读 `AGENTS.md` 托管块） | 你表达「开工 / 做完 / 需求变了 / 记下来」时，由它跑对应 `ohno` 命令 |
| **你可手改** | 你 | `.ohno/preferences.json`、REQUIREMENTS 笔记区、AGENTS 托管块外的规矩 |

**永不静默自动：** 未审就 `plan accept`、伪造 verify PASS、把 `next` 当成新授权。

可选协议副本（与托管块同规则）：  
[`skills/oh-no-control/SKILL.md`](./skills/oh-no-control/SKILL.md) — 可复制到 Codex skills；**当前状态仍以项目 AGENTS 托管块为准**。

### 0. 前置条件

- Node.js **≥ 22.20**
- 目标项目是普通 **Git** 仓库
- 可选：Codex CLI/TUI（用于安装并信任项目 Hooks）

### 1. 安装 CLI

```bash
npm install -g oh-no-codex
ohno --help
```

或不用全局安装：

```bash
npx oh-no-codex --help
```

源码开发：

```bash
git clone https://github.com/t01089572455/oh-no-codex.git
cd oh-no-codex
npm ci
npm run build
node dist/cli.js --help
```

### 2. 初始化业务项目（并安装 hooks）

```bash
cd /path/to/your-git-project
ohno init --goal "让草稿保存可靠"
ohno install
```

会创建/更新：

| 路径 | 作用 |
| --- | --- |
| `.ohno/state.json` | 唯一当前运行时权威 |
| `.ohno/truth.json` | Owner 维护的规范文档清单 |
| `.ohno/preferences.json` | 工作方法默认（先调研 / 复用开源 / 前端先抄） |
| `.ohno/REQUIREMENTS.md` | Owner 备注 + 实时投影 |
| `AGENTS.md` | 现场胶囊 + **对话协议**（托管块） |
| `.ohno/PROGRESS.md` | 生成式进度看板（init 时尽量写出） |
| `.codex/hooks.json` | 合作式 SessionStart / PostCompact / PreToolUse / Stop |

`init` 禁止静默重复初始化。目标变更走需求变更闭环，不要再 `init` 一次。

### 3. 提议并接受线性计划

> Agent 可根据你的话准备 plan 文件；`plan accept` 前仍需你审。
> 下面完整 CLI 给脚本和高级用户。

编写评审文件（例如 `.ohno/review-plan.json`）：

```json
{
  "cursor": 0,
  "ordered_tasks": [
    {
      "id": "draft-persistence",
      "title": "证明草稿刷新后仍在",
      "goal": "用户刷新后仍能看到草稿",
      "status": "FROZEN",
      "expected_behavior": "保存后的草稿在刷新页面后仍然存在",
      "test_command": "node --test test/draft-persistence.test.mjs",
      "stop_condition": "黑盒通过后立即停止",
      "allowed_files": ["src/draft/**", "test/draft-persistence.test.mjs"],
      "time_budget_minutes": 45
    },
    {
      "id": "polish-copy",
      "title": "润色空状态文案",
      "goal": "空状态说清楚",
      "status": "OUTLINE"
    }
  ]
}
```

规则：

- **cursor** 任务必须是 `FROZEN`（预期行为、精确测试、文件范围、停止条件、预算）
- 后续任务可以是 `OUTLINE`（只需 id + 标题 + 目标）
- cursor 指向 `OUTLINE` 时不能启动，唯一下一步是 `FREEZE_TASK:<id>`

```bash
ohno plan propose --file .ohno/review-plan.json
# 原样复制输出中的精确值：
ohno plan accept --revision <PLAN_REVISION> --diff <DIFF_DIGEST>
```

接受只记录 `LOCAL_REVIEW_RECORDED`（本地评审证据），**不**声称 Owner 身份或
生产授权。

### 4. 启动 cursor 任务

```bash
ohno task start
```

- 不能传 `--test` / `--files` / 自由 next：只激活冻结合同
- 已有活跃任务时二次启动会失败并保持原状态字节
- 文档同步 pending 时也会阻止启动

### 5. 实现后用精确黑盒验收

在 `allowed_files` 范围内改代码，然后：

```bash
ohno verify
```

| 结果 | 含义 |
| --- | --- |
| 非零 / 超时 / 未知 | 任务仍为 **ACTIVE**，修好再验 |
| 零退出 + 作用域内容未变 | **PASS** 收据，cursor 前进一格 |
| 测试过程中 HEAD 变化 | **UNKNOWN**（不是 PASS） |
| 之后普通 commit、作用域未变 | 证明仍为 **FRESH** |
| 合同 / 计划 / 作用域文件变化 | 证明变为 **STALE** |

Codex 可选完成标记（仅在真实 PASS 后）：

```text
OHNO_COMPLETE:<active-task-id>
```

### 6. 任意新 Session 恢复现场

```bash
ohno status          # 人类可读
ohno status --json   # 机器可读 read model
ohno resume          # 有界摘要，给新 Session / 压缩后使用
ohno next            # 只输出计划推导的唯一下一步
```

常见 next：`START_TASK:<id>`、`FREEZE_TASK:<id>`、
`SYNC_GOVERNING_DOCUMENTS`、`PROPOSE_PLAN`、`PROJECT_COMPLETE`。

### 7. 需求变更（Truth + 精确 diff）

Owner 改需求时：

```bash
ohno change begin --summary "Owner 修订了验收表述" --concerns docs
# 按提示修改规范文档与替换计划
ohno change diff
ohno change accept --change <CHANGE_ID> --diff <DISPLAYED_DIGEST>
```

pending 期间唯一下一步是 `SYNC_GOVERNING_DOCUMENTS`；受支持的写 Hook 会阻止
无关实现工作。

### 8. 安装合作式 Hooks

在业务项目中：

```bash
ohno install
ohno hooks status --json
```

| Hook | 职责 |
| --- | --- |
| SessionStart / PostCompact | 注入目标、任务、证据、阻塞、下一步 |
| PreToolUse | 无合同或超范围时拒绝受支持写操作 |
| Stop | 要求精确 `OHNO_COMPLETE:<id>` + 新鲜 PASS |
| Git pre-commit | 拒绝超范围或过期证明的提交 |

然后在 Codex 里审查并信任项目 Hooks。Hooks 是**合作型护栏**，不是敌对安全
边界；普通 Git 仍可用 `--no-verify` 绕过。

### 9. 刷新投影（进度表 + AGENTS 托管块）

```bash
ohno projectors refresh
# 或只写进度、不碰 AGENTS.md：
ohno projectors refresh --no-agents
```

会生成：

| 文件 | 含义 |
| --- | --- |
| `.ohno/PROGRESS.md` | 从 state 生成的进度表（**不是**权威，勿手改当真相） |
| `.ohno/REQUIREMENTS.md` | Owner 备注 + 目标/看板/Truth 投影 |
| `.ohno/preferences.json` | Owner 工作方法（默认开启：先调研 / 复用开源 / 前端先抄再改） |
| `AGENTS.md` 中 `<!-- ohno:managed-begin/end -->` 段 | 注入目标/看板/下一步；**块外**仍是你的规则 |

`task start` / `verify` / `plan accept` / `change accept` 成功后也会尽量自动刷新投影。

### 10. 打开驾驶舱

```bash
ohno cockpit
# 打印：Cockpit: http://127.0.0.1:<port>/
```

用浏览器打开该 loopback 地址。玻璃态仪表盘**只读**，并与 `status --json`
使用同一 read model（没有第二套权威）。右侧 **PLAN BOARD** 用
DONE / HALF / READY / OUTLINE 等相位显示整张计划表。

### 端到端速查

```bash
ohno init --goal "…"
# 编辑 .ohno/review-plan.json
ohno plan propose --file .ohno/review-plan.json
ohno plan accept --revision … --diff …
ohno task start
# 在 allowed_files 内实现
ohno verify
ohno install                 # 可选：合作式 hooks
ohno doctor                  # 健康检查
ohno projectors refresh      # PROGRESS + REQUIREMENTS + AGENTS
ohno requirements note --text "Owner: 先做用户可见保存，不要先造平台"
ohno preferences show
ohno preferences set --id frontend_adapt_not_invent --enabled false
ohno preferences reset
ohno resume
ohno next
ohno cockpit                 # GET /api/state，约 2.5s 轮询
```

## CLI 内核，薄 Hooks

CLI 掌握状态和判断；Hooks 只负责在 Codex 即将行动的时刻执行这些判断：

| 接入点 | V1 职责 |
| --- | --- |
| `SessionStart` / `PostCompact` | 尽量刷新投影，再注入有界 resume 胶囊（目标、看板、证据、阻塞、下一步、handoff）。 |
| `PreToolUse` | 缺少任务合同，或路径超出声明范围时，阻止受支持的写操作。 |
| `Stop` | 只在看到精确的 `OHNO_COMPLETE:<task-id>` 标记时检查：若 PASS 不新鲜或文档同步未清理，则保持任务未完成。缺失或改写过的标记不算完成信号。 |
| Git `pre-commit` | 拒绝超范围或未经验证的提交。 |

Hooks 是约束合作型 Codex 的护栏，不是不可绕过的安全边界。

## 一个权威，多个视图

```text
ohno CLI -- 原子替换 --> .ohno/state.json   （唯一运行时权威）
                              |-- status / resume / next / doctor
                              |-- 薄 Codex Hooks（注入 capsule）
                              |-- Git pre-commit 护栏
                              |-- projectors → .ohno/PROGRESS.md
                              |               → AGENTS.md 托管块
                              `-- 只读驾驶舱 ← GET /api/state（轮询）

.ohno/truth.json ----------> 指定的规范文档
```

- `.ohno/state.json` 是唯一的当前运行时权威。
- `.ohno/truth.json` 是由 Owner 维护的规范文档适用清单。
- Hooks、收据、终端输出、PROGRESS、AGENTS 托管块和驾驶舱都只是投影，
  不会建立第二套真相。
- 正常读取只看有边界的小状态，不扫描全部文档，也不运行完整测试套件。

## 刻意保持简单

V1 只有一个 Node.js 包、一个 `ohno` 命令、一个原子状态文件、一个 Truth
清单、薄 Codex Hooks、一个 Git Hook 和一个本地只读驾驶舱。

V1 不做数据库、后台守护进程、托管服务、策略语言、插件平台、Provider
框架或多 Agent 调度器。只有当前公共黑盒测试真实失败时，新抽象才有资格
进入产品。

## Oh No 驾驶舱

驾驶舱是本地、仅 GET 的**玻璃态任务仪表盘**，与 `ohno status --json` 共用
同一 read model；没有自有状态、缓存、数据库或写接口。顶栏导航包含品牌、
当前阶段、总进度与刷新。面板回答：

1. **现在在做什么？**（NOW、任务环、校准轨）
2. **唯一下一步是什么？**（NEXT）
3. **证明是否新鲜、有没有阻塞？**（PROOF、DRIFT / ATTENTION）

```bash
ohno cockpit
```

```text
+-- OH NO, CODEX! ---- 当前阶段 ---- 总进度 ---- REFRESH --+
| NOW / NEXT / ATTENTION |  任务环 + 校准轨     | PROOF     |
| RECENT 已完成          |  cursor / 任务数     | PLAN BOARD|
|                        |                      | Truth 列表|
|                        |                      | Handoff   |
+-- COMPLETION VECTOR（约 2.5s 轮询 /api/state） ----------+
```

UI 诚实规则：

- 所有面板绑定与 `status --json` 相同的 `/api/state` 模型
- 进度只等于 `cursor / task_count`
- 不发明“信任天气”百分比或假指标
- 状态不可用/损坏时显示明确离线门
- 只读：UI 不写权威

| 颜色 | 用途 |
| --- | --- |
| 淡紫字段 `#F0EDF8` | 玻璃仪表盘底色 |
| 紫 / 蓝强调色 | 导航与进行中脉冲 |
| 青绿 / 薄荷 | 新鲜 / 通畅 |
| 琥珀 | 漂移 / 注意 |
| 红色 | 阻塞 / 失败 |

## Codex 十八宗罪

**Codex 十八宗罪**是本 harness 要对抗的审计失败模式。
Oh No, Codex! 把它们变成约束、测试或明确不做的事情，而不是再造 18 个
子系统。

<details>
<summary><strong>展开全部 18 条</strong></summary>

| # | 罪 | 产品约束 |
| ---: | --- | --- |
| 1 | **越俎代庖** | 保留 Owner 原话，含糊时选择最小满足方案。 |
| 2 | **把含糊词解释到最大** | 没有当前公共红测，就不新增子系统或抽象。 |
| 3 | **完成以后不停** | 验收通过就结束，`next` 不是继续授权。 |
| 4 | **把审查当修改权** | 审查默认只读，修复必须另有明确授权。 |
| 5 | **旧权威复活** | 当前权威高于旧计划与旧摘要。 |
| 6 | **用摘要改写真相** | 恢复摘要只是投影，不能成为新权威。 |
| 7 | **局部绿灯冒充完成** | 每个结论都必须说明精确证据范围。 |
| 8 | **同一 Agent 自证闭环** | 精确命令与对象绑定收据高于 Agent 自述。 |
| 9 | **测试戏剧** | 每个任务必须有一个最小、用户可见的黑盒测试。 |
| 10 | **代理目标反客为主** | 始终只突出一个 Owner 目标和一个当前任务。 |
| 11 | **Reviewer 扩大分母** | 按冻结验收审查，额外想法只能是建议。 |
| 12 | **对控制税失明** | 延迟、摘要大小与禁止全量扫描都必须实测。 |
| 13 | **重造轮子** | 优先使用 Git、文件和普通测试，不重造基础设施。 |
| 14 | **工作区身份混乱** | 交接必须给出路径、分支、commit、tree 与脏状态。 |
| 15 | **把交接税转嫁给用户** | 一条 `resume` 命令直接返回可执行现场。 |
| 16 | **用户体验最后偿还** | 先冻结驾驶舱设计，再编码并通过浏览器验收。 |
| 17 | **附和与过度自信** | 使用诚实能力标签，只说已经测得的结论。 |
| 18 | **道歉没有变成约束** | 每次确认的问题都要落成规则、回归测试或明确不做。 |

完整的脱敏审计与证据边界见
[`docs/CODEX-SINS.md`](https://github.com/t01089572455/oh-no-codex/blob/main/docs/CODEX-SINS.md)。

</details>

## 用证据，不用口号

能力标签只描述仓库当前真正持有的证据：

| 能力 | 状态 | 证据边界 |
| --- | --- | --- |
| 公开产品状态 | `V1_TRIAL_ACCEPTED` | 账本 Tasks 1–7 + Corrections 1–2 + 精华 E1–E12 |
| CLI 状态、计划、验证、恢复、变更、Hooks 与原子写行为 | `LOCAL_PASS` | 公共 Node 黑盒 A01–A12、A15、A16 |
| 计划看板、投影、doctor、handoff 身份 | `LOCAL_PASS` | projectors / resume-status-next / hooks 黑盒 |
| 只读驾驶舱投影 | `LOCAL_PASS` | A13 HTTP 输出与 `status --json` 相等 |
| 三个项目副本的完整闭环与 P01–P05 | `TRIAL_PASS` | 匿名 TypeScript CLI、React/Vite Web 与 Python OCR 源码副本上的有界 harness 试验 |
| 桌面/窄屏视觉与无障碍验收 | `LOCAL_PASS` | Owner 授权外置浏览器后，用系统 Chrome/Edge 完成 A14 |
| 状态到驾驶舱的浏览器反映延迟 | `TRIAL_PASS` | P06 三副本浏览器收据；最差 p95 73.690 ms |
| npm 包 `oh-no-codex` | 已发布 `0.1.0`（[registry.npmjs.org](https://www.npmjs.com/package/oh-no-codex)） | `npm install -g oh-no-codex` |

三个副本的测量均先做一次不计时 warm-up，再对每条命令保存 30 个原始样本。
最差 p95 如下：

| 场景 | 冻结预算 | 最差观测值 | 结果 |
| --- | ---: | ---: | --- |
| `ohno status` | `<250 ms` | `92.249 ms` | `TRIAL_PASS` |
| `ohno next` | `<250 ms` | `84.213 ms` | `TRIAL_PASS` |
| `ohno resume` | `<500 ms` | `85.938 ms` | `TRIAL_PASS` |
| 最大合法恢复摘要 | `<4096 bytes` | `3194 bytes` | `TRIAL_PASS` |
| 任务启动 Harness 开销 | `<2000 ms` | `97.667 ms` | `TRIAL_PASS` |
| 状态到驾驶舱的浏览器反映延迟 | `<250 ms` | `73.690 ms` | `TRIAL_PASS` |

这些只是指定匿名副本与本机上的试验结果，不是通用速度或生产就绪保证。

## 项目合同

公开产品事实只由下面这组小而明确的文档管理：

1. [产品合同](https://github.com/t01089572455/oh-no-codex/blob/main/docs/PRODUCT-CONTRACT.md)
2. [V1 设计](https://github.com/t01089572455/oh-no-codex/blob/main/docs/DESIGN.md)
3. [验收合同](https://github.com/t01089572455/oh-no-codex/blob/main/docs/ACCEPTANCE.md)
4. [实现账本](https://github.com/t01089572455/oh-no-codex/blob/main/docs/IMPLEMENTATION-PLAN.md)（当前状态：`V1_TRIAL_ACCEPTED`）
5. [Codex 十八宗罪](https://github.com/t01089572455/oh-no-codex/blob/main/docs/CODEX-SINS.md)
6. [精华迁移清单](https://github.com/t01089572455/oh-no-codex/blob/main/docs/ESSENCE-BACKLOG.md)（E1–E12 已完成）

## 开源许可

[MIT](./LICENSE)

Oh No, Codex! 是独立社区项目，与 OpenAI 没有隶属关系，也未获得 OpenAI
官方背书。

<p align="center">
  <strong>量好边界，验证行为，然后让 Agent 停手。</strong>
</p>

<p align="center"><a href="#readme-zh">返回顶部 ↑</a></p>
