# Field trial issues — Codex session `019fb9be` (full monitor log)

**Status:** OPEN evidence log + **fix implementation in progress** on branch `fix/field-trial-ft-defects`  
**First recorded:** 2026-07-31  
**Last updated:** 2026-07-31 (fixes landed for P0/P1/P2 code paths; see §11)  
**Trial project:** `D:\python_workspace\lzs\xiaochengxu`  
**Primary Codex session:**  
`019fb9be-8ee9-7441-8bc9-e1a3ad128689`  
(`%USERPROFILE%\.codex\sessions\2026\07\31\rollout-2026-07-31T12-55-01-019fb9be-…jsonl`)  
**Package:** `oh-no-codex@0.1.3` (global `ohno` under `node_global`)  
**Observer method:** Owner real use + external continuous session/state monitor from first “read this session” request through implementation worktrees  

This file is the **complete defect inventory** from one real Codex product session.  
It is **not** a design rewrite and **not** permission to start fix implementation.

---

## 0. How to read this log

| Layer | Question |
| --- | --- |
| **A. Install / inject** | Did Oh No get into the project and session context? |
| **B. Control loop** | Did plan → task → verify govern real work? |
| **C. Cockpit / trust** | Did UI tell the Owner the truth? |
| **D. Windows / ops** | Did host environment break the CLI? |
| **E. Dual track** | Did competing skills/plans split authority? |

**Bottom line after full session:**  
Oh No **can** run a real multi-slice loop (later, in a worktree).  
The same session also shows **systemic trust and governance gaps**: toy plans → 100% UI, dual state, commit-driven micro-plans, weak tests, PATH/WSH, and long periods of zero participation while product decisions happened elsewhere.

---

## 1. Session timeline (compressed)

| Phase | Approx | What Codex did | Oh No participation |
| --- | --- | --- | --- |
| T0 Setup | ~12:44 | `ohno init` + `install` on empty repo | Install OK, doctor green |
| T1 Open | ~12:55 | Session start; AGENTS managed capsule injected (`NEXT: PROPOSE_PLAN`) | **Injection yes** |
| T2 Discovery | ~12:55–13:35 | User anti-procrastination story; long **brainstorming** Q&A; wireframes under `.superpowers/` | **Zero CLI**; state IDLE 0/0 |
| T3 Design doc | ~13:34–13:36 | Write design md; first commit **blocked by git pre-commit** (no active task / no PASS) | **Hook yes** |
| T4 Toy plan #1 | ~13:36–13:43 | PATH fail → find `ohno` → `plan propose` **1 task** `commit-design-doc` → accept → weak `git diff --cached --check` → PASS → commit design | **Loop yes, content bad** → `PROJECT_COMPLETE` **1/1 = 100%** |
| T5 Impl plan (md) | ~13:46–14:00 | Superpowers implementation plan: **9 tasks / 47 checkboxes** in markdown | **Not in `.ohno`** |
| T6 Toy plan #2 | ~14:04–14:05 | Another **1-task** plan `prepare-isolated-worktree` (gitignore + plan md) → PASS → again `PROJECT_COMPLETE` | **Commit license pattern** |
| T7 Worktree | ~14:06+ | `.worktrees/anti-procrastination-mvp` + branch `codex/anti-procrastination-mvp` | New **local** `.ohno/state.json` |
| T8 Real plan | ~14:08–14:13 | Worktree: **9→10 task** implementation plan; `task-01-scaffold` ACTIVE → `npm test` PASS → 1/9 | **Real harness** |
| T9 STALE | ~14:26 | Edit smoke test after PASS → `PROOF=STALE` / `STALE_PASS` | **Proof CAS working** |
| T10 Continue | ~14:26–20:20+ | `task-01b` quality fix; freeze/run `task-02-core-rules`; advance to **task-03-repository ACTIVE**; cursor **3/10** | **Multi-slice working in worktree** |
| Side | anytime | Owner may open `dist/cli.js` → **Windows Script Host** “无效字符” | Host association bug |

### Snapshot when this full log was finalized (~20:20)

| Site | Cursor | Next / status | Truthfulness for “mini-program progress” |
| --- | --- | --- | --- |
| **Master** `xiaochengxu` | **1/1** | `PROJECT_COMPLETE` | **Misleading (100%)** |
| **Worktree** `…/anti-procrastination-mvp` | **3/10** | `task-03-repository` ACTIVE | **Honest (~30%)** if cockpit cwd is worktree |

---

## 2. Issue index (all findings)

| ID | Sev | Area | One-line |
| --- | --- | --- | --- |
| FT-01 | **P0** | Cockpit | Bare **100%** on toy plan reads as product done |
| FT-02 | **P0** | Verify | Weak `test_command` (e.g. `git diff --cached --check`) still full PASS + advance |
| FT-03 | **P1** | PATH | Codex shell: `ohno` not recognized until PATH fixed |
| FT-04 | **P1** | Cooperation | Long free brainstorm; injection ≠ control |
| FT-05 | **P1** | Plan quality | Agent free to accept **1-task docs-only** plans for a full product goal |
| FT-06 | **P2** | Encoding | Auto requirements note / display mojibake (revision truncate, console CP) |
| FT-07 | **P2** | Git hygiene | `.ohno` / AGENTS often **untracked** while “done” commits land |
| FT-08 | **P2** | Requirements | Discovery decisions not captured via `requirements note` |
| FT-09 | **P2** | Cockpit copy | “DONE / Project complete” = plan terminal, not product terminal |
| FT-10 | **P3** | Skills | Global **brainstorming** / **superpowers** dominate `oh-no-*` early |
| FT-11 | **P3** | Doctor | Green while progress story is dishonest (no trivial-plan / weak-test WARN) |
| FT-12 | **P3** | Post-complete | After `PROJECT_COMPLETE`, weak guidance to open **next phase** plan |
| FT-13 | **P0** | Dual authority | **Master vs worktree** each have `.ohno/state.json`; cockpit cwd picks the lie |
| FT-14 | **P0** | Behavior pattern | **Commit-driven micro-plans**: every blocked commit → new 1-task plan → instant 100% |
| FT-15 | **P1** | Hook incentive | Pre-commit **works** but incentivizes **minimum legal task**, not product slices |
| FT-16 | **P1** | Dual planning | Superpowers plan.md (9 tasks) vs Oh No board desynced until late worktree recover |
| FT-17 | **P1** | Cockpit ops | No forced “open cockpit on active worktree”; Owner easily watches wrong tree |
| FT-18 | **P1** | Windows | Opening `dist/cli.js` → **WScript** 800A03F6 “无效字符” (ESM ≠ JScript) |
| FT-19 | **P2** | Windows console | `ohno status --json` Chinese mojibake / JSON break under some PowerShell encodings |
| FT-20 | **P3 note** | Proof | Post-PASS file edit → `STALE_PASS` (**correct**); still confuses if UI not explained |
| FT-21 | **P2** | OUTLINE | Implementation tasks left OUTLINE until FREEZE; OK design, but easy to stall / dual-track around it |
| FT-22 | **P2** | State portability | Worktree `.ohno` remains untracked; clone/other machine loses control plane |
| FT-23 | **P3** | Monitor/ops | External monitors that only poll **master** miss real progress (process lesson, product-ish) |

**What worked (credit, not defects):**

| ID | Note |
| --- | --- |
| W-01 | SessionStart AGENTS managed capsule injection |
| W-02 | Git pre-commit blocked commit without active PASS |
| W-03 | Late worktree: multi-task plan + `task start` + `npm test` verify + cursor advance |
| W-04 | Scope guard on commits during active task |
| W-05 | Proof freshness / STALE after subject change |
| W-06 | FREEZE_TASK gate for OUTLINE cursor tasks |

---

## 3. Defect write-ups

### FT-01 — Cockpit 100% on toy plan (trust)

**Observed:** After single task `commit-design-doc` PASS, UI progress = `cursor/task_count` = **1/1 = 100%**, mission **DONE / Project complete**.  
**Reality:** No mini-program implementation.  
**Root:** Formula is correct for **plan cursor**; labels sell **product completion**.  
**Code:** `assets/cockpit/cockpit.js` `progressRatio`, `missionCenter` on `PROJECT_COMPLETE`.

### FT-02 — Weak black-box still advances plan

**Observed `test_command` examples:**

```text
git diff --cached --check -- docs/.../design.md
git diff --cached --check -- .gitignore docs/.../plan.md && git check-ignore -q .worktrees/probe ...
```

Exit 0 → real PASS → cursor advance → `PROJECT_COMPLETE`.  
Does not prove product behavior. Doctor did not stop it.

### FT-03 — PATH in Codex shell

**Observed:** `ohno : The term 'ohno' is not recognized`.  
Agent delayed control loop until PATH / full node path discovered.

### FT-04 — Injection without early participation

Hours of product decisions in chat + brainstorming while state stayed `IDLE 0/0` / `PROPOSE_PLAN`.  
Cooperative design allows this; Owner experience is “Oh No is on but not governing.”

### FT-05 — Plan quality unconstrained

For Owner goal “build mini-program MVP”, accepted Oh No plans were:

1. commit design doc only  
2. prepare worktree / commit plan md only  

No minimum slice count, no “must map to product milestones” pressure.

### FT-06 — Encoding

- `REQUIREMENTS.md` plan-accept note: `revision=c84d10e0ea21��` style truncation/mojibake  
- PowerShell piping `ohno status --json` can corrupt Chinese and break JSON parse  
- state.json UTF-8 via Node often OK — problem is **append/console surfaces**

### FT-07 / FT-22 — Harness files unversioned

Repeatedly: product commits land; `.ohno/`, `AGENTS.md` stay `??`.  
Authority is disk-local, not in the same git history Owner thinks is “done.”

### FT-08 — Requirements underused

Interview (estimate → difficulty → breakdown → deadline → privacy → hybrid AI) largely never `ohno requirements note`.  
Log stayed init boilerplate + system plan-accept notes.

### FT-09 — Copy equates plan end with project end

Mission subtext **“Project complete”** on `PROJECT_COMPLETE` is the sharp edge of FT-01.

### FT-10 / FT-16 — Competing systems

| System | Role in session |
| --- | --- |
| brainstorming skill | Discovery + wireframes |
| superpowers plan.md | 9-task implementation script + subagent-driven-dev |
| oh-no | Late / commit-gated / then worktree multi-slice |

Two “plans” coexisted; only one is authority (`.ohno/state.json`), and it was the **wrong** one for a long time on master.

### FT-11 — Doctor false confidence

`ohno doctor` → OK while:

- trivial 1-task complete plans  
- weak tests  
- dirty tree without versioned `.ohno`  
- master 100% vs unfinished product  

Doctor answers “is harness installed?”, not “is the story honest?”

### FT-12 — Post PROJECT_COMPLETE affordance

Resume correctly says `PROJECT_COMPLETE` but does not strongly drive “propose **implementation** plan next.”  
Agent instead opened superpowers track or another micro-plan.

### FT-13 — Dual authority (master vs worktree) **P0**

| Tree | state meaning |
| --- | --- |
| Master | `1/1` PROJECT_COMPLETE (micro-plans) |
| Worktree | `3/10` real implementation board, ACTIVE tasks |

Cockpit / `ohno resume` without correct **cwd** shows the wrong truth.  
This is the operational form of FT-01 during implementation.

### FT-14 — Commit-driven micro-plan loop **P0 behavior**

Pattern repeated:

```text
want commit → hook blocks → propose 1 tiny task → accept → weak verify → PASS
→ PROJECT_COMPLETE → cockpit 100% → later need another commit → repeat
```

Harness becomes a **commit license printer**, not a product board.

### FT-15 — Hook incentive misalignment

Pre-commit **succeeded** at forcing Oh No once (good).  
Side effect: agent optimizes for **smallest task that unblocks git**, not Owner MVP decomposition (FT-05/14).

### FT-17 — Cockpit cwd footgun

No product-level “you are watching master while work is in worktree” banner.  
Owner monitoring root sees permanent 100%.

### FT-18 — Windows Script Host on `cli.js`

**Popup:** Windows Script Host / 无效字符 / 800A03F6  
**Path:** `...\oh-no-codex\dist\cli.js` (UI may wrap as `clijs`)  
**Cause:** `.js` → `WScript.exe`; file is Node ESM (`import`).  
**Trigger:** open/run `cli.js` without `node.exe` (Explorer double-click, bad shortcut).  
**Not:** normal `ohno.cmd` / hooks that prefix `node.exe` (those are correct).

### FT-19 — Console encoding

Chinese fields in CLI JSON/text under PowerShell code pages become `?` or garbled; tooling that parses JSON fails.

### FT-20 — STALE_PASS (working as designed)

After task-01 PASS, editing `test/smoke/project.test.js` → proof STALE / blocker STALE_PASS.  
**Correct anti-fake-done behavior.** Listed so Owner doesn’t file it as a random bug; UX may still need clearer “re-verify or explain dirty subject” guidance.

### FT-21 — OUTLINE / FREEZE friction

Worktree plan placed tasks 2–9 as OUTLINE; `NEXT: FREEZE_TASK:…`.  
Good contract discipline; in dual-track world agent may stall or work outside freeze.

### FT-23 — Monitor only on master

External 15‑min polls of master state reported perpetual PROJECT_COMPLETE while worktree advanced — process lesson for operators; product should make **active worktree** obvious.

---

## 4. Defect map → product surfaces

| Surface | Defects |
| --- | --- |
| Cockpit UI copy + % | FT-01, FT-09, FT-13, FT-17 |
| plan propose / accept policy | FT-05, FT-14, FT-15 |
| verify / doctor weak-test | FT-02, FT-11 |
| install / PATH / Windows | FT-03, FT-18, FT-19 |
| requirements / encoding | FT-06, FT-08 |
| git hygiene | FT-07, FT-22 |
| skills / dual plan | FT-04, FT-10, FT-16, FT-12 |
| worktree multi-root state | FT-13, FT-17, FT-23 |
| proof engine | W-05 / FT-20 (positive) |

---

## 5. Severity triage (when Owner authorizes fixes)

1. **P0 trust:** FT-01, FT-09, FT-13, FT-14, FT-02  
2. **P1 ops/incentive:** FT-03, FT-15, FT-16, FT-17, FT-18, FT-04, FT-05  
3. **P2 hygiene:** FT-06, FT-07, FT-08, FT-19, FT-21, FT-22  
4. **P3 polish / doctor / post-complete:** FT-10, FT-11, FT-12, FT-23  

Suggested theme clusters (not a schedule):

- **A. Honest progress language** (never bare product-100% on plan cursor)  
- **B. Anti toy-plan / weak-test** (doctor + plan skill pressure)  
- **C. Worktree-aware status** (which tree is authority; cockpit cwd)  
- **D. Windows launch & PATH** (never WScript; Codex PATH docs)  
- **E. Requirements + encoding**  

---

## 6. Evidence pointers

| Artifact | Location |
| --- | --- |
| Session JSONL | `…\sessions\2026\07\31\rollout-2026-07-31T12-55-01-019fb9be-8ee9-7441-8bc9-e1a3ad128689.jsonl` |
| Master state | `D:\python_workspace\lzs\xiaochengxu\.ohno\state.json` |
| Worktree state | `D:\python_workspace\lzs\xiaochengxu\.worktrees\anti-procrastination-mvp\.ohno\state.json` |
| Superpowers plan | `docs/superpowers/plans/2026-07-31-anti-procrastination-wechat-mini-program.md` |
| Monitor poll log | `docs/FIELD-TRIAL-MONITOR.log` (master-biased early) |
| Cockpit % formula | `assets/cockpit/cockpit.js` → `progressRatio` |
| Hook node path | `.git/hooks/pre-commit` → `node.exe` + `dist/cli.js` |
| Win `.js` association | `assoc .js` → `JSFile` → `WScript.exe` |

---

## 7. Exact next for this log

> **Record only until Owner authorizes fix slices.**  
> Append new FT-IDs; do not rewrite observed history.  
> Re-verify claims with `ohno resume` on **both** master and active worktree after any change.

---

## 8. One-paragraph executive summary

One real Codex session proved Oh No’s install, injection, git hook, and (late) multi-task verify loop **can work**, especially inside an isolated worktree where a 10-task implementation board advanced to ~3/10 with real `npm test` gates. The same session also proved the product’s **trust story is fragile**: commit-blocking hooks push agents into **one-task micro-plans** with **weak tests**, the cockpit renders **plan cursor as 100% project complete**, **master and worktree carry divergent authorities**, discovery is captured by **brainstorming/superpowers** instead of requirements/plan skills, and Windows users can hit a **Script Host error** by opening `cli.js` without Node. Fixing V1 trial credibility is less about “more features” and more about **honest progress language, anti-toy-plan pressure, worktree-aware status, and Windows launch hygiene**.

---

## 9. Full-session re-audit (3555/3555 lines, 0 parse errors)

**Method:** Mechanical full parse of session JSONL (`docs/FIELD-TRIAL-SESSION-FULL-AUDIT.md` + `.json`).  
**Span:** `2026-07-31T19:55:01Z` → `2026-08-01T04:21:43Z` (~8.5h wall).  
**Scale:** 5.9MB; `exec`×392; `spawn_agent`×4; `wait`×87; `wait_agent`×7; `list_agents`×6; `task_complete`×29.

### 9.1 Multi-agent management (Codex native vs Oh No)

| Mechanism | Who owns it | Observed in this session |
| --- | --- | --- |
| `spawn_agent` / `wait_agent` / `list_agents` | **Codex runtime** | 4 spawns only (not one per plan task) |
| `subagent-driven-development` skill | **Superpowers / agent skills** | Orchestration policy: implement → spec review → quality review |
| Oh No plan/task/verify | **oh-no-codex** | Slice authority + git hook; **no multi-agent API** |
| Superpowers plan.md | Markdown checklist | Parallel “plan board” outside `.ohno` |

**Actual `spawn_agent` task_names (complete list from session):**

1. `task1_scaffold` (model terra / medium)  
2. `task1_spec_review` (model sol / high)  
3. `task1_quality_review`  
4. `task4_patch_implement` (late patch only)

**Implication:** Tasks 2–3 (and most of task 4 main body) were largely driven by the **root/main agent** doing implement + self-review when spawn/review channel failed or was skipped — not a full 9×3 agent matrix.

**Multi-agent quality (Codex side):**

| Aspect | Assessment |
| --- | --- |
| Intended workflow | Clear: new implementer + independent spec + quality gates before next task |
| Actual spawn density | **Low** (4 spawns / whole session) |
| Wait discipline | High wait volume (`wait` 87 + `wait_agent` 7); root often blocks on child |
| Review independence | Claimed; sometimes **root fell back to local read-only review** when “协作审查通道…没有返回可用的新代理” |
| Failure handling | Quality review found Important items → fix → but Oh No STALE after close forced **new micro-task 01b** |
| Oh No integration | Children told not to touch `.ohno`; root alone runs plan/verify/commit gates |
| Oh No multi-agent support | **None** — no agent id, no spawn policy, no review roles in state |

**Verdict on multi-agent:**  
Codex multi-agent is a **thin orchestrator overlay** (few real spawns + many waits + skill policy). Oh No is a **single-writer control plane** for tasks/proof. They **compose by convention** (root runs ohno; implementer stays in allowed_files) but Oh No **does not manage, observe, or constrain multi-agent topology**. When spawn/review routing breaks, work continues on root — Oh No still accepts verify from whoever runs the CLI in the worktree.

### 9.2 Additional defects found only after full read

| ID | Sev | Area | Finding |
| --- | --- | --- | --- |
| FT-24 | **P1** | Task lifecycle | **No reopen / amend closed task.** Post-DONE quality fix → STALE_PASS; agent must invent `task-01b` patch plan (Owner confirm). |
| FT-25 | **P2** | requirements | **Note length cap 512 bytes** rejected useful research write-up; agent compressed and retried. |
| FT-26 | **P1** | Multi-agent | **Claimed per-task agents ≠ actual spawn count**; Oh No cannot detect “main agent did the work.” |
| FT-27 | **P2** | Multi-agent ops | Review **routing/spawn failures** mid-session; root self-reviewed to avoid stall — weakens independent review promise. |
| FT-28 | **P1** | Product gap | **Zero multi-agent model** in Oh No (no roles, no agent-scoped allowed_files, no review PASS distinct from implement PASS). |
| FT-29 | **P2** | Windows | PowerShell **quoting ate full verify pipeline** once (no npm steps ran); agent had to re-exec step-by-step. |
| FT-30 | **P3** | Skills env | Session still resolved **`vibe-tether-verify`** skill path alongside oh-no-* (legacy noise / confusion risk). |
| FT-31 | **P2** | Git hygiene | Agent **policy-excluded `.ohno/` and AGENTS.md from commits** even when harness was the real authority — worsens FT-07/22. |
| FT-32 | **P2** | Dual plan | Superpowers plan + Oh No ordered_tasks + ad-hoc patch plans (01b, task-04 file list expand) — three layers of “plan.” |
| FT-33 | **P3** | Encoding | Skill markdown / console outputs show **garbled Chinese** in tool transcripts (`鎺掕鍒` etc.). |

### 9.3 Oh No defect map (complete for this session)

**P0 trust:** FT-01, FT-02, FT-09, FT-13, FT-14  
**P1 control/ops:** FT-03, FT-04, FT-05, FT-15, FT-16, FT-17, FT-18, FT-24, FT-26, FT-28  
**P2 hygiene/platform:** FT-06, FT-07, FT-08, FT-19, FT-21, FT-22, FT-25, FT-27, FT-29, FT-31, FT-32, FT-33  
**P3 polish:** FT-10, FT-11, FT-12, FT-20 (note), FT-23, FT-30  

### 9.4 What full read confirms Oh No did well

- Git pre-commit forced first participation (design).  
- Worktree multi-slice with real `npm test` / `test:core` / `test:services` / cloud suite.  
- STALE after post-close edit (correct) — but recovery UX is FT-24.  
- allowed_files scope guard on commits.  
- Agent eventually treated `ohno verify` / resume as authority vs raw test logs.  
- FREEZE for OUTLINE tasks.

### 9.5 Executive multi-agent + Oh No one-liner

> Codex multi-agent in this session was **policy-heavy, spawn-light** (4 children); Oh No was **slice-heavy, agent-blind**. Together they eventually shipped 5/10 implementation slices under a worktree, but Oh No’s biggest failures remain **honest progress (master 100%)**, **toy/micro plans**, **dual trees**, and **no first-class patch/reopen or multi-agent roles**.

---

## 10. Artifacts from full parse

| File | Purpose |
| --- | --- |
| `docs/FIELD-TRIAL-SESSION-FULL-AUDIT.md` | Human-readable full parse summary |
| `docs/FIELD-TRIAL-SESSION-FULL-AUDIT.json` | Machine-readable extract |
| `docs/_audit_session.cjs` | Re-runnable auditor (dev helper) |


---


## 11. Fix status (branch `fix/field-trial-ft-defects`) — final

**Owning black-box:** `node --test test/blackbox/field-trial-fixes.test.mjs` (6/6).

| ID | Final status | Mechanism |
| --- | --- | --- |
| FT-01 / FT-09 | **Fixed** | Cockpit plan-cursor label + PLAN DONE (not product complete) |
| FT-12 | **Fixed** | `PLAN_COMPLETE_NOTE` + AGENTS capsule note on PROJECT_COMPLETE |
| FT-02 | **Fixed (hard)** | Weak blackbox refused on `plan accept` unless `--allow-weak-plan` |
| FT-05 / FT-14 / FT-15 | **Fixed (hard)** | Commit-license micro-plan refused on accept; pre-commit message steers multi-slice |
| FT-11 | **Fixed** | doctor WARN for plan_shape / blackbox / plan_complete_honesty |
| FT-13 / FT-17 | **Fixed (visibility)** | AUTHORITY_NOTE + SIBLING_OHNO_WORKTREES + doctor worktree_authority + cockpit cwd |
| FT-24 | **Fixed** | `ohno task reopen` |
| FT-25 | **Fixed** | ownerNote 4096 bytes |
| FT-06 | **Fixed** | plan-accept note full revision |
| FT-07 / FT-22 / FT-31 | **Fixed (nudges)** | doctor harness_versioned; init tip git add; skills require commit harness |
| FT-03 / FT-18 | **Fixed (detect+doc)** | doctor cli_path; install Windows tips; README; never double-click cli.js |
| FT-04 / FT-08 | **Fixed (injection)** | AGENTS field-trial hard rules + PROPOSE_PLAN stop free-build banner |
| FT-10 / FT-16 / FT-32 | **Fixed (protocol)** | control-protocol + skills: Oh No board is authority; no dual-plan free-build |
| FT-20 | **OK** | STALE + RECOVERY line |
| FT-26 / FT-27 / FT-28 | **Closed as V1 design** | Agent-blind by contract; multi-agent not Oh No scope; skills state root-only ohno |
| FT-19 / FT-29 / FT-33 | **Mitigated** | UTF-8 best-effort; docs for PS quoting; residual console CP is OS-level |
| FT-21 | **By design** | OUTLINE/FREEZE kept |
| FT-23 | **Ops note** | dual monitor process |
| FT-30 | **Env** | host skill cleanup outside package |

### What “done” means here

- Session failure modes that Oh No can **enforce** are enforced (accept hard gate, reopen, honest UI, worktree visibility, doctor).
- Modes that are **Codex environment / multi-agent platform** are either documented as non-goals or given PATH/install detection — not a hostile rewrite of Codex.
- Owner can still force weak plans with **explicit** `--allow-weak-plan` (cooperative override, not silent agent escape).

