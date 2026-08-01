---
name: oh-no-plan
description: >
  Propose or accept an Oh No linear plan. Use when user says make a plan, 排计划,
  plan propose, plan accept, freeze tasks, ordered_tasks, or ohno plan. Runs
  ohno plan propose --file … and ohno plan accept --revision … --diff ….
---

# oh-no-plan

## Propose

Write a review JSON (cursor + ordered_tasks), then:

```bash
ohno plan propose --file .ohno/review-plan.json
```

Cursor task must be `FROZEN` (behavior, test_command, allowed_files, stop, budget).
Later tasks may be `OUTLINE`.

### Anti-toy-plan (field trial FT-05/14) — **hard gate**

- Do **not** propose a single docs/commit/gitignore-only task just to unblock git
  when the Owner goal is a multi-slice product.
- Prefer several product tasks with **behavioral** black boxes (`npm test`, app
  smoke, etc.). Avoid sole `git diff --check` as the product test.
- `ohno plan propose` prints **WARN** lines.
- `ohno plan accept` **refuses** commit-license / weak-blackbox plans by default.
  Only if the Owner **explicitly** wants a meta-only plan:

```bash
ohno plan accept --revision <sha256> --diff <sha256> --allow-weak-plan
```

- After `PROJECT_COMPLETE`, propose a **new** implementation plan — that marker
  means **this linear plan** finished, not the product.

## Accept (only after Owner review)

```bash
ohno plan accept --revision <sha256> --diff <sha256>
# Owner override for meta-only plans only:
# ohno plan accept --revision … --diff … --allow-weak-plan
```

Never silent-accept without Owner review.
