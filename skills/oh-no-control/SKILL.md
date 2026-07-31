---
name: oh-no-control
description: >
  Hub skill for Oh No, Codex! (oh-no-codex / ohno) anti-drift harness. Use when
  the user mentions ohno, oh-no, oh no codex, harness, bounded task, plan board,
  .ohno, anti-drift, vibe coding control, or asks which ohno skill/command to
  use. Routes to the right shell `ohno …` command. Prefer specific oh-no-* skills
  when the intent is clear (verify, resume, init, change, task, plan, doctor).
---

# Oh No — control hub

## What this is

Oh No is a **local CLI** (`ohno`). Skills do **not** replace the binary; they
tell Codex **which shell command to run** so the human does not paste CLI soup.

Install once:

```bash
npm install -g oh-no-codex
cd <git-repo>
ohno init
ohno install          # hooks + all oh-no-* skills → ~/.codex/skills
```

## Skill → command map (call these as skills / run the shell line)

| Skill name | When user means | Shell |
| --- | --- | --- |
| `oh-no-init` | 初始化项目 / init this repo | `ohno init` |
| `oh-no-install` | 装 hooks 和 skills | `ohno install` |
| `oh-no-plan` | 提计划 / 接受计划 | `ohno plan propose` / `accept` |
| `oh-no-task` | 开工 / start slice | `ohno task start` |
| `oh-no-verify` | 做完了 / 验收 / done | `ohno verify` |
| `oh-no-resume` | 卡在哪 / where are we | `ohno resume` |
| `oh-no-status` | 状态 / status | `ohno status` |
| `oh-no-next` | 下一步是什么 | `ohno next` |
| `oh-no-change` | 需求变了 | `ohno change begin/diff/accept` |
| `oh-no-requirements` | 记下来 / owner note | `ohno requirements note/show` |
| `oh-no-preferences` | 改规矩 / craft rules | `ohno preferences …` |
| `oh-no-doctor` | 体检 / doctor | `ohno doctor` |
| `oh-no-cockpit` | 打开看板 | `ohno cockpit` |
| `oh-no-projectors` | 刷新 AGENTS/PROGRESS | `ohno projectors refresh` |

## Hard rules

1. Never claim done without **`ohno verify` PASS**.  
2. `next` is a locator, not new permission.  
3. `.ohno/state.json` is sole runtime authority.  
4. Live board text in `AGENTS.md` managed block — procedure in these skills.
