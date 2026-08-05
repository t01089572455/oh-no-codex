# Prompt-only harness branch

**Branch:** `prompt-only-harness`  
**Owner decision:** do not add coding hard-gates for anti-drift; use hooks only to
**inject advanced prompt rails** so Codex self-restricts by reading Truth.

## What stays

- `ohno setup`, state, plan/task/verify tools (optional commands Agents can run)
- Hooks: SessionStart / UserPromptSubmit / Stop / PreToolUse / PostCompact
- OWNER-INPUTS capture, pipeline phase text, full **OHNO_PROMPT_RAILS**

## What changes vs main (coding gates)

- PreToolUse **does not deny** (no `permissionDecision: deny` for harness rails)
- Violations become **OHNO_PROMPT_ADVISORY** additionalContext only
- Full Owner lifecycle + 十八宗罪 + Owner solutions live in `src/prompt-rails.ts`

## Success criterion

Model repeatedly sees and follows rails → reads Truth → verify-only done.  
Not OS security; cooperative prompt binding only.
