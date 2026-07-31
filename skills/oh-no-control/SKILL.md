---
name: oh-no-control
description: >
  Use for Oh No, Codex! (oh-no-codex / ohno) project harness control during
  Codex vibe coding. Trigger when the user or project mentions ohno, oh-no,
  oh no codex, anti-drift harness, bounded task, black-box verify, resume
  capsule, plan board, REQUIREMENTS log, preferences research-first, 开工,
  做完了, 验收, 需求变了, 卡在哪, task start, ohno verify, or when coding in a
  repo that has .ohno/state.json or AGENTS.md ohno:managed-begin markers.
  You run shell `ohno` CLI at task boundaries; do not claim done without verify.
---

# Oh No, Codex! — control skill

## What this is

**Oh No** is a **local CLI harness** (`ohno`), not a cloud service and not a
replacement for Codex Goal mode.

This skill is the **primary way** you (Codex) should learn *when* to run `ohno`.
Do **not** wait for the human to paste long CLI recipes into chat — that
dilutes. Follow this skill + the live capsule in `AGENTS.md` when present.

| Layer | Role |
| --- | --- |
| This skill | When / how to call `ohno` |
| `.ohno/state.json` | Sole runtime authority |
| `AGENTS.md` `<!-- ohno:managed-begin -->` | Live goal / board / next (projection) |
| Hooks | Auto resume inject + write scope (after `ohno install`) |

If both skill and AGENTS managed block exist: **state/board from AGENTS**;  
**procedure from this skill**.

## Setup (human once per machine / project)

```bash
npm install -g oh-no-codex
cd <git-project>
ohno init             # no top-line goal required
ohno install          # hooks + this skill → ~/.codex/skills
```

Optional: `ohno init --goal "…"` only if Owner wants a resume slogan.
Scope lives in **plan tasks** / requirements notes — not a forced project goal.
Not Codex Goal-mode syntax.

If the skill is missing:

```bash
ohno skill install
```

## When to activate

Use this skill whenever:

- The repo has `.ohno/` or Oh No is mentioned
- User says start / done / verify / requirements changed / where are we
- User Chinese: 开工 / 做完了 / 验收 / 需求变了 / 卡在哪 / 记下来
- You are about to claim a task complete
- You need current goal, cursor task, or proof freshness

## Command map (you run these in the project shell)

| Human intent | You run | Notes |
| --- | --- | --- |
| Init project (rare) | `ohno init --goal "…"` | Once per repo; human may do this |
| Install hooks + skill | `ohno install` | Once per repo / refresh skill |
| Start frozen slice | `ohno task start` | Plan cursor must be frozen |
| Need a plan | prepare review JSON → `ohno plan propose` / `accept` | Accept only after Owner review |
| Slice done | **`ohno verify` only** | No PASS → not done. Never invent PASS |
| Requirements changed | `ohno change begin --summary "…"` | Then doc sync + new plan |
| Remember Owner words | `ohno requirements note --text "…"` | Append-only log |
| Craft rules | `ohno preferences show` / `set` | research / OSS / frontend defaults |
| Where are we | `ohno resume` or `ohno doctor` | Read-only |
| Dashboard | `ohno cockpit` | Read-only browser board |

## Hard rules

1. **Do not** claim completion without a fresh `ohno verify` PASS.  
2. **`next` is a locator**, not permission to start a new unauthorized phase.  
3. **Do not** silent `plan accept` or invent proof.  
4. **`.ohno/state.json`** is the only current runtime authority.  
5. Prefer **narrow** `allowed_files` and a **user-visible** black-box test.  
6. Working-method defaults (unless disabled): research before big build; reuse
   OSS; frontend adapt a real reference — see `ohno preferences show`.

## First turns in an Oh No project

1. `ohno resume` (or read AGENTS managed block) — learn goal / cursor / next.  
2. If no plan → help Owner produce a linear plan (frozen cursor task).  
3. If plan ready → `ohno task start` before broad edits.  
4. When user says done → `ohno verify`, report real exit status.  
5. On fail → stay on the same task; do not declare product complete.

## What you never say

- “Fully controlled” / “production ready” without named evidence  
- “Done” after only unit mocks or agent prose  
- That this skill **stops the Codex app** — it only closes **the task slice**
