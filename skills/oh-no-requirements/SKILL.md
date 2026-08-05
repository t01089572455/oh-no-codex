---
name: oh-no-requirements
description: >
  Owner-input evidence and interpreted requirements for Oh No. Use when user says 记下来, remember this,
  requirements note, REQUIREMENTS.md, or ohno requirements. Shell:
  ohno requirements note/show.
---

# oh-no-requirements

Two files have different roles:

- `.ohno/OWNER-INPUTS.md` is local/private append-only evidence of exact prompts
  received by the trusted `UserPromptSubmit` hook. It cannot recover older
  prompts, other clients, or bypassed/untrusted hooks, and generated
  `OHNO_AUTO_CONTINUE` prompts are excluded.
- `.ohno/REQUIREMENTS.md` is Codex's current consolidated interpretation and
  visible history. Material entries cite OWNER-INPUTS ids; superseded readings
  stay visible.

Oh No does not reliably decide which prompt is the correct final decision.
During PREPARE, use the raw record to resolve material ambiguity and prepare the
plan. A clear new Owner instruction during accepted-plan execution authorizes
the existing change-sync loop without a second conversational confirmation.

```bash
ohno requirements note --text "<current interpreted decision>"
ohno requirements show
```

`requirements note` remains a manual one-line capture path. It is not a claim
that REQUIREMENTS automatically contains every prompt.
