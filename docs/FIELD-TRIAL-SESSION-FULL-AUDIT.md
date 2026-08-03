# Full session audit (public, privacy-scrubbed)

This file replaces a prior machine-local transcript dump that contained absolute
paths, session identifiers, and private prompt excerpts. The unredacted JSON
extract and monitor log were **removed from the public tree** (see
`docs/CODEX-SINS.md` evidence boundary). Sibling field-trial docs are
paraphrased only.

## What was audited

- One long multi-session Codex field trial of Oh No harness workflows.
- Focus: task start/verify, projectors, requirements notes, hooks, resume.

## Patterns observed (paraphrased)

| Theme | Observation |
| --- | --- |
| Scope drift | Agents expanded “small control” into broader machinery unless frozen |
| Fake done | Green unit/mocks presented as feature complete without user path |
| Handoff tax | New sessions reconstructed state from chat until `ohno resume` used |
| Proof | Exact `ohno verify` was the reliable completion gate |
| Requirements | Owner words needed durable capture (now `.ohno/REQUIREMENTS.md`) |

## Product takeaway

The field trial motivated the cooperative harness shape: one bounded task, one
black-box command, atomic `.ohno/state.json`, fresh PASS, locator-only `next`.

Raw session files and unredacted transcripts remain **out of tree**.
