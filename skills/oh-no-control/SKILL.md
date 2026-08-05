---
name: oh-no-control
description: >
  Hub skill for Oh No, Codex! (oh-no-codex / ohno) anti-drift harness. Use when
  the user mentions ohno, oh-no, oh no codex, harness, bounded task, plan board,
  .ohno, anti-drift, vibe coding control, or asks which ohno skill to use.
  Prefer specific oh-no-* skills when intent is clear (verify, resume, change,
  task, plan, doctor, cockpit). Setup (ohno init / install) is terminal-only,
  not a skill.
---

# Oh No — control hub

## What this is

Oh No is a **local CLI** (`ohno`). Day-to-day skills tell Codex **when** to run
which command. Humans should not paste long CLI into chat.

## One workflow

There is no guided mode or mode switch.

1. **PREPARE:** preserve trusted raw prompts in `.ohno/OWNER-INPUTS.md`,
   consolidate the current interpretation in `.ohno/REQUIREMENTS.md`, resolve
   material ambiguity, and review the exact acceptance basis and plan diff.
2. If the Owner already authorized “plan and finish,” accept the reviewed plan
   without asking for the same authorization again. If the Owner asked for
   planning only, leave the proposal unaccepted.
3. **After acceptance:** start, work, repair, verify, advance, and start the
   next task automatically. Stop only at `PROJECT_COMPLETE` or a real
   `OHNO_NEEDS_INPUT:<active-task-id>` condition.

Real input means a missing account/secret/device/business fact, an unapproved
destructive/paid/publish/external-message action, no honest acceptance path,
or a state/platform blocker. Ordinary failure and task transition are not
confirmation points. Once the missing input arrives, resume the same accepted
workflow without re-accepting the plan.

**One-time setup (human / terminal — not skills):**

```bash
npm install -g oh-no-codex
cd <git-repo>
ohno init
ohno install          # hooks + day-to-day oh-no-* skills
```

## Day-to-day skills (user speaks → you act)

| Skill | When user means |
| --- | --- |
| `oh-no-plan` | 排计划 / 接受计划 |
| `oh-no-task` | 开工 / reopen STALE slice |
| `oh-no-verify` | 做完了 / 验收 |
| `oh-no-resume` | 卡在哪 |
| `oh-no-status` | 状态 |
| `oh-no-next` | 下一步是什么 |
| `oh-no-change` | 需求变了 |
| `oh-no-requirements` | 记下来 |
| `oh-no-preferences` | 改规矩 |
| `oh-no-doctor` | 体检 |
| `oh-no-cockpit` | 打开看板 |
| `oh-no-projectors` | 刷新 PROGRESS / AGENTS |

Exact shell lines live **inside each skill file** (for you), not in the user chat.

## Hard rules

1. Never claim done without **`ohno verify` PASS**.  
2. `next` is a locator, not new permission; the accepted plan already
   authorizes executing its canonical next action.
3. `.ohno/state.json` is sole runtime authority **for this cwd** (worktrees differ).  
4. Live board in `AGENTS.md` managed block — procedure in these skills.  
5. `PROJECT_COMPLETE` / plan progress % = **this linear plan**, not product done.  
6. Prefer one independently provable user outcome per task. Weak-size and
   micro-plan findings are PREPARE warnings, not Owner override gates.
7. After PASS-then-STALE: `ohno task reopen` (not a fake new plan).  
8. Raw trusted prompts belong in `.ohno/OWNER-INPUTS.md`; Codex's current
   interpretation and decision history belong in `.ohno/REQUIREMENTS.md` with
   material input ids. Oh No cannot reliably classify the final decision.
9. Multi-agent (Codex spawn) is outside Oh No — root still runs plan/task/verify.
10. Every Stop-generated continuation begins `OHNO_AUTO_CONTINUE` and is not
    Owner prose.

## Windows

- Install: `npm install -g oh-no-codex` then ensure npm global bin is on PATH  
  (often `…\nodejs\node_global`).  
- Run `ohno` via the npm shim (`ohno.cmd`), never double-click `dist\cli.js`  
  (Windows Script Host cannot run ESM — “无效字符”).  
- PowerShell: prefer simple commands; avoid over-quoted multi-step pipelines  
  for `ohno verify` subject tests when possible.
