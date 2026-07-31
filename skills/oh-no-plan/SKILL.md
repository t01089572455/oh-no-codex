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

## Accept (only after Owner review)

Use the printed revision and diff digests:

```bash
ohno plan accept --revision <sha256> --diff <sha256>
```

Never silent-accept without Owner review.
