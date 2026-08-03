# Field trial regression — oh-no-codex@0.1.4 (public, privacy-scrubbed)

**Date:** 2026-08-01  
**Package:** global `oh-no-codex@0.1.4` from registry.npmjs.org  
**Note:** CLI regression of session failure modes. Absolute paths and private
project identity removed for public tree hygiene (`docs/CODEX-SINS.md`).

## What was checked

| Surface | Result (abstract) |
| --- | --- |
| `ohno resume` | Capsule available; plan progress and proof projected |
| `ohno doctor` | Health rows for state, handoff, projectors, requirements |
| Master vs worktree | Distinct handoff identities; sibling `.ohno` warned (FT-13) |
| Plan complete | `PROJECT_COMPLETE` = this linear plan cursor done, not product-finished |
| Requirements log | `.ohno/REQUIREMENTS.md` present after init |

## Known warnings (still educational)

- Micro / docs-only plans make cockpit “100% of THIS plan” easy to misread.  
- Untracked harness files mean authority may not travel with commits.  
- Multiple worktrees each have their own `.ohno/state.json`.

## Not included

- Live `HANDOFF_PATH` strings from the Owner machine  
- Real branch/HEAD of private repositories  
- Session identifiers  

Product fixes after this trial landed on main in subsequent releases; this file
is provenance, not a second acceptance ledger.
