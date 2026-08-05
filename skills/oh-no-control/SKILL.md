---
name: oh-no-control
description: >
  Hub skill for Oh No, Codex! (oh-no-codex / ohno) simple anti-drift harness.
  Use when the user mentions ohno, harness, bounded task, .ohno, anti-drift,
  or which oh-no skill to use. Prefer specific oh-no-* skills when intent is
  clear. Setup (ohno init / install) is terminal-only, not a skill.
---

# Oh No — simple harness (reins)

Oh No is a **small local harness**, not a second product or project manager.

**Daily loop only:**

```text
ohno status / ohno next   → where am I?
ohno task start           → open the frozen cursor task (if needed)
work inside allowed_files
ohno verify               → only claim done after PASS
```

Bare `ohno` prints a one-screen view. Full capsule: `ohno resume`.

## Setup (human / terminal)

```bash
npm install -g oh-no-codex
cd <git-repo>
ohno init
ohno install
```

## When stuck / FAIL

Under an **accepted plan**: do **not** stop to ask the Owner.

1. `ohno status` / `ohno next`
2. Re-open Truth-listed docs (playbook / verification matrix when listed)
3. Re-read the frozen task contract
4. Fix inside `allowed_files` (no inventing secrets, no mock if forbidden)
5. `ohno verify` again

`OHNO_AUTO_CONTINUE` means keep going; it is not Owner prose.
`OHNO_NEEDS_INPUT` is recovery guidance, not a handoff stop.

## Skills map (keep small)

| Need | Skill / command |
| --- | --- |
| 卡在哪 | `oh-no-resume` / `ohno resume` or bare `ohno` |
| 下一步 | `oh-no-next` |
| 开工 | `oh-no-task` → `ohno task start` |
| 做完了 | `oh-no-verify` → **only** `ohno verify` |
| 排计划 | `oh-no-plan` (advanced) |
| 需求变了 | `oh-no-change` (advanced) |
| 看板 | `oh-no-cockpit` |

## Hard rules (few)

1. Never claim done without **`ohno verify` PASS**.
2. `next` is a locator, not new scope permission.
3. Authority is **this cwd** `.ohno/state.json` only.
4. Plan % / `PROJECT_COMPLETE` = **this linear plan**, not whole product.
5. Prefer **short plans** (one vertical). Do not freeze mega roadmaps as one board.
6. Soft black boxes (`echo` + exit 3 / “go read playbook”) are **refused** on accept unless Owner passes `--allow-weak-plan`.

## Advanced (ignore unless needed)

plan propose/accept, change begin/diff/accept, truth.json applicability,
requirements/OWNER-INPUTS, preferences, migrate, doctor, projectors.

## Windows

Use `ohno.cmd` on PATH; never double-click `dist/cli.js`.
