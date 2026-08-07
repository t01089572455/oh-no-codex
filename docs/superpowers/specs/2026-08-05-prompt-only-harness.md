# Prompt-first hybrid harness (current product)

**Status:** supersedes the pure “no hard deny” experiment.
**Owner decision (field-proven):** semantic anti-drift is **prompt + short pipeline**;
**residual short hard-deny** only for clear structure. Never dump full law on every tool.

## What stays

- `ohno setup`, state, plan/task/verify tools
- Hooks: SessionStart / UserPromptSubmit / Stop / PreToolUse / PostCompact
- OWNER-INPUTS capture, pipeline phase text, full **OHNO_PROMPT_RAILS** on demand

## Control surfaces (honest)

| Surface | Behavior |
| --- | --- |
| UserPromptSubmit | log Owner → Latest re-bind → short `OHNO_PIPELINE`; `OWNER_PAUSE` / `OWNER_RESUME` when phrasing matches |
| Stop | short continue card under accepted work; **no** full rails; honor Owner pause; anti-ask continue for 请确认/请选择 design-case tech |
| PreToolUse | **silent allow**, or **short hard deny** for phase / scope / sync / RECOVER-without-truth-read / unparseable patch |
| `ohno pipeline` | short next + stamp; `--full` pastes complete law once |
| skill `oh-no-control` | short mirror |

## What is not claimed

- Not OS security; cooperative guardrails only.
- Not a semantic “did you understand” judge.
- Not pure “prompt-only with zero hard deny” — field trials showed that advisory-only scope was the wrong trade for clear structure.

## Success criterion

Model sees short next action + Latest, reads Truth, uses `ohno verify` as sole proof;
structural freestyle is blocked without context spam.
