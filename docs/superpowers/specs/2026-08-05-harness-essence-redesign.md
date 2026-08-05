# Harness essence redesign (0.2.0)

Owner-authorized product simplification (2026-08-05): rebuild the **default
surface** around harness + cooperative hooks + the Eighteen Sins, without
adding a second authority, daemon, policy language, or multi-agent scheduler.

## Problem

Field trial showed control tax worse than drift:

- Plan tasks required many fields and tight UTF-8 caps (display budget leaked
  into authoring).
- Stop “auto continue” was a wall of prose; `decision: block` felt like a stop.
- Soft / huge plans ran as if “full auto” while proof stayed weak.
- Users could not tell what Oh No is: reins, not a second product.

## North star

> One local harness: freeze a short vertical slice → agent works only in scope →
> one hard black box decides done → short cooperative continue under the plan.

Maps to CODEX-SINS corrections (smallest useful harness):

1. state expected user-visible behavior  
2. one minimal black-box test  
3. bound files (scope)  
4. keep current truth readable  
5. stop/advance on fresh evidence  
6. measure control tax  

## Non-goals (still)

- Semantic proof that the agent “read all Truth”
- Automatic global replan / multi-agent OS
- Dropping sole authority `.ohno/state.json`
- Raising normal-path Truth inventory scans

## Default task shape (authoring)

**Required (four keys + status):**

| Author key | Stored as | Role (sin) |
| --- | --- | --- |
| `id` | `id` | stable pointer (3, 10) |
| `expect` *or* `expected_behavior` | `expected_behavior` | owner outcome (1, 2) |
| `test` *or* `test_command` | `test_command` | black box (7, 8, 9) |
| `scope` *or* `allowed_files` | `allowed_files` | mutation fence (2, 3) |
| `status` | `FROZEN` \| `OUTLINE` | freeze discipline |

**Defaults if omitted:**

| Field | Default |
| --- | --- |
| `title` | `id` |
| `goal` | same as `expect` |
| `stop_condition` | `Stop when the exact black-box test passes` |
| `time_budget_minutes` | `60` |

OUTLINE may be `{ "id", "status": "OUTLINE" }` with title/goal defaulted to id.

Legacy full nine-field FROZEN tasks remain accepted (compat).

## Authoring byte limits

Display/injection may truncate. **Authoring limits are raised** so intent is not
ridiculed:

| Field | Old | New |
| --- | ---: | ---: |
| task id | 96 | 128 |
| title | 256 | 512 |
| goal / expect | 256 / 512 | 16 KiB |
| test_command | 1 KiB | 4 KiB |
| change summary | 512 | 4 KiB |
| owner note | 4 KiB | 16 KiB |

No newlines in single-line display fields remain (injection safety).

## Plan shape

- **Plan task count is unrestricted** (Owner choice; do not cap model ability).
  Prefer clear vertical slices when useful; never hard-refuse on length alone.
- Weak / playbook-deferral black boxes still hard-refuse without
  `--allow-weak-plan`.
- `acceptance_source` **optional on propose**: if omitted, harness writes
  `.ohno/acceptance-basis.json` from frozen expect/test/stop and binds it
  (still exact-match denominator; less copy-paste tax).

## Hook / continue surface

Under accepted plan, Stop injects a **short card** (not a Truth dump):

```text
OHNO_CONTINUE
mode: WORK|REPAIR|VERIFY|START|ADVANCE|STUCK|DONE
task: <id>
proof: <freshness>
next: <canonical next_action>
do: <one line>
hint: <optional one line; top Truth path if REPAIR>
fails: <n>   # same contract consecutive FAIL/UNKNOWN
```

- `decision: block` remains the Codex cooperative continue channel; docs state
  it means **force continue**, not “work blocked”.
- Truth targets: at most **3** paths in `hint`, never a 16-path wall.
- `consecutive_failures >= 5` on same contract → `mode: STUCK`: stop spinning
  product code; fix contract/test or `ohno change` / new short plan.

## Human CLI surface

Daily: bare `ohno`, `status`, `next`, `task start|reopen`, `verify`, `init`,
`install`, `doctor`, `cockpit`.  
Advanced: plan/change/requirements/preferences/migrate/hooks.

## Sin → mechanism matrix (implementation checklist)

| Sin | Mechanism |
| --- | --- |
| 1–2 semantic max | min interpret; frozen `expect`; short plans |
| 3 never stop | PASS advances; PROJECT_COMPLETE ends auto |
| 4 review≠edit | PreToolUse scope; review skills read-only culture |
| 5–6 zombie/summary | sole `state.json`; resume is projection |
| 7–9 green theatre | hard black box; refuse soft boxes |
| 8 self-cert | receipts + subject digest |
| 10 proxy goals | one active task on every brief |
| 11 reviewer inflate | frozen contract only |
| 12–13 control tax | short cards; no normal-path full scans |
| 14–15 workspace/handoff | handoff identity on resume |
| 16 UX last | brief-first CLI; cockpit read-only |
| 17–18 apology | capability labels; fail→constraint (tests) |

## Compatibility

- Schema remains 3 on disk after normalize (full frozen fields stored).
- Old proposal files with long field sets still parse.
- Public tests updated for new limits / optional acceptance_source / short cards.

## Release

Ship as **0.2.0** (intentional default-surface break for humans/agents; wire
compat for on-disk state).
