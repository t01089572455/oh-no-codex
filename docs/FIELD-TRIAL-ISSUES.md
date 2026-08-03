# Field trial issues (public, privacy-scrubbed)

**Status:** Historical defect inventory from one real Codex product session

**Package under trial:** `oh-no-codex` ~0.1.3–0.1.4 era

**Public boundary:** No absolute local paths, session IDs, email, private repo
names, or verbatim private prompts (see `docs/CODEX-SINS.md`).

This file keeps **product-useful patterns only**. Raw session extracts and
monitor dumps are **not** kept in this repository.

## Bottom line

Oh No can run a real multi-slice loop. The same trial also showed trust and
governance gaps when plans and UI were weak.

## Defect themes (paraphrased)

| ID | Theme | Symptom | Product response (later) |
| --- | --- | --- | --- |
| FT-01 | Progress honesty | Cursor % read as “product finished” | Fraction + plan-only notes |
| FT-02 | Weak black box | Format-only or mock tests as done | Frozen user-visible command |
| FT-05/14 | Micro-plan / commit license | Docs-only slices inflate DONE | Plan discipline warnings |
| FT-07/22 | Untracked harness | State not traveling with Git | Init tips; version harness |
| FT-13/17 | Worktree confusion | Wrong tree’s board | Handoff path + sibling note |
| FT-24 | Reopen | Need refresh proof on closed task | `task reopen` |
| FT-25 | Owner words | Chat loses constraints | `requirements note` log |

## Layers observed

1. **Install / inject** — hooks and skills can enter a session.
2. **Control loop** — plan → task → verify works when used.
3. **Cockpit trust** — UI must project sole state, not invent trust %.
4. **Host ops** — PATH / Windows shim issues block CLI discovery.
5. **Dual track** — competing skills or plans split authority.

## What is deliberately absent

- Session JSONL paths and rollout IDs
- Machine-local worktree paths
- Prompt transcripts and proprietary source

For the failure-pattern product vocabulary, see `docs/CODEX-SINS.md`.
