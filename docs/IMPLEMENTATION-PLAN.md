# Codex-only V1 implementation plan

Status: **V1_CHANGES_REQUIRED — A14_AND_P06_UNAVAILABLE**

Owner authorization: Tasks 1–7 below, including 6A–6C, were authorized as the
complete V1 implementation scope on 2026-07-30. Execute them sequentially.
Do not add another task or publish a package without new authorization.

## Ledger

| Slice | Status | Owning public acceptance |
| --- | --- | --- |
| Task 1 — task-start contract and atomic state | LOCAL_PASS | A01, A02, part of A12 |
| Task 2 — exact verification, finish, and one next action | LOCAL_PASS | A03, A04, A05 |
| Task 3 — status, resume, next, and bounded capsule | LOCAL_PASS | A06, A07, part of A15 |
| Task 4 — Truth-driven requirement-change sync | LOCAL_PASS | A10, A11 |
| Correction 1 — linear plan and freshness repair | LOCAL_PASS | corrected A01, A04–A06, A09–A11, A15 |
| Task 5 — Codex hooks and Git pre-commit | LOCAL_PASS | A08, A09, A16 |
| Task 6A — locked Cockpit design contract | LOCAL_PASS | design prerequisite for A13, A14 |
| Task 6B — read-only Cockpit implementation | LOCAL_PASS | A13, part of P06 |
| Task 6C — browser visual and functional acceptance | EXTERNAL_BROWSER_BLOCKED | A14 |
| Task 7 — cross-project trials and final gate | V1_CHANGES_REQUIRED | A12, A15, A16, P01–P06 |

## Task 1 local evidence

Recorded on 2026-07-30 with Node.js v24.11.1:

- RED: `node --test test/blackbox/task-start.test.mjs` exited 1 with 0 passing
  and 18 failing tests because the packaged `dist/cli.js` interface was absent.
- Initial GREEN: `node --test test/blackbox/task-start.test.mjs` exited 0 with
  all 18 tests passing.
- Review RED: the same owning command exited 1 with 18 passing and 1 failing
  test because parseable but structurally corrupt state was accepted and
  overwritten.
- Review GREEN: the same owning command exited 0 with all 19 tests passing,
  including exact byte preservation for corrupt input and signal-interrupted
  old/new atomic replacement.
- Task 3 compatibility RED: the same owning command exited 1 with 18 passing
  and 1 failing test because its 20 KiB atomic-write payload occupied the newly
  bounded, user-visible `--expect` field.
- Task 3 compatibility GREEN: the same owning command exited 0 with all 19
  tests passing after moving that payload to the non-displayed `--stop` field.
  The test still observes the temporary file, terminates the writer by signal,
  and requires exact known-good old or new state bytes.
- `D:\Program Files\nodejs\npm.cmd run typecheck` exited 0.
- `D:\Program Files\nodejs\npm.cmd run build` exited 0.
- `git diff --check` exited 0 with no output.

This earns local evidence for A01, A02, and the interrupted-write portion of
A12 only. It does not earn verification, hooks, read surfaces, Cockpit,
performance, trial, or production claims.

## Task 2 local evidence

Recorded on 2026-07-30 with Node.js v24.11.1:

- RED: `node --test test/blackbox/verify-finish.test.mjs` exited 1 with 1
  passing and 9 failing tests. The public `ohno verify` interface was absent;
  the exact-command case also exposed that Task 1 trimmed `--test` instead of
  preserving it verbatim.
- GREEN: `node --test test/blackbox/verify-finish.test.mjs` exited 0 with all
  10 tests passing.
- Review RED: the same owning command exited 1 with 10 passing and 1 failing
  test because a zero-exit command could corrupt `.ohno/state.json` and the
  UNKNOWN path overwrote those exact corrupt bytes with cached pre-test state.
- Review GREEN: the same owning command exited 0 with all 11 tests passing,
  including fail-closed byte preservation when post-command state is corrupt.
- Quality-review RED: the same owning command exited 1 with 11 passing and 5
  failing tests. Cached pre-test state overwrote non-zero corruption, corrupt
  detached HEAD was treated as `UNBORN`, exact-file verification enumerated a
  greater-than-1-MiB unrelated index, concurrent verification let the slower
  process observe and overwrite the faster result, and date-only receipt
  timestamps passed validation.
- Quality-review GREEN: the same owning command exited 0 with all 16 tests
  passing.
- The strengthened timeout case traps `SIGTERM` and checks that no descendant
  survives. It was already green on Windows because `taskkill /T /F` is
  forceful; the POSIX path now escalates the process group to `SIGKILL` after a
  fixed 250 ms grace without cancelling escalation when the shell exits.
- The timeout and parent-signal cases use `NODE_ENV=test` with a 150 ms
  test-only bound. Normal verification derives its timeout from the frozen
  task's minute budget.
- `D:\Program Files\nodejs\npm.cmd run typecheck` exited 0.
- `D:\Program Files\nodejs\npm.cmd run build` exited 0.
- `git diff --check` exited 0 with no output.

This earns local evidence for A03, A04, and A05 only. It does not earn read
surfaces, hooks, Cockpit, performance, trial, or production claims.

## Task 3 local evidence

Recorded on 2026-07-30 with Node.js v24.11.1:

- RED: `node --test test/blackbox/resume-status-next.test.mjs` exited 1 with
  0 passing and 8 failing tests because the public `ohno status`,
  `ohno resume`, and `ohno next` interfaces were absent.
- GREEN: `node --test test/blackbox/resume-status-next.test.mjs` exited 0 with
  all 8 tests passing across idle, active, failed, fresh-PASS, stale-PASS,
  blocked-document-sync, bounded-history, missing-state, and corrupt-state
  fixtures.
- Specification-review RED: the same owning command exited 1 with 9 passing
  and 12 failing tests. A previous task's PASS was misreported as current
  STALE proof after a new task started; CLI and runtime state accepted
  oversized or multiline displayed fields, so the resume bound was not strict
  for every accepted state and `next` could serialize multiple lines.
- Specification-review GREEN: the same owning command exited 0 with all 21
  tests passing. A mismatched historical receipt now projects `NONE` for a new
  active task, while a matching anomalous active PASS remains visibly stale.
  Shared UTF-8 byte limits and single-line validation now apply identically at
  `init`/`task start` and runtime state parsing, with byte-preserving rejection.
- The largest accepted fixture kept the UTF-8 resume capsule below 4 KiB while
  retaining maximum accepted goal, task identifier, expected behavior, exact
  test, and blocker ahead of 120 bounded completed summaries. Correction 1
  replaces the old free-text next fixture with a maximum stable next-task id
  and its derived action.
- `npm.cmd run typecheck` exited 0.
- `npm.cmd run build` exited 0.
- `git diff --check` exited 0 with no output.
- One warmed diagnostic sample in a disposable idle repository measured
  `status --json` at 69.69 ms, `resume` at 61.50 ms, and `next` at 97.07 ms.
  These are diagnostic single samples, not p95, trial, or performance claims.

This earns local evidence for A06, A07, and the Task 3 read-path portion of
A15 only. It does not earn hooks, requirement-change commands, Cockpit,
performance, trial, or production claims.

## Task 4 local evidence

Recorded on 2026-07-30 with Node.js v24.11.1:

- RED: `node --test test/blackbox/requirement-change.test.mjs` exited 1 with
  0 passing and 11 failing tests because the public `ohno change
  begin|diff|accept` interface and Truth loading were absent.
- Initial GREEN: the same owning command exited 0 with all 11 tests passing.
- Structural review RED: the same command exited 1 with 11 passing and 1
  failing test because deletion produced Git diff coverage and was incorrectly
  accepted as a replacement current plan.
- Path-safety review RED: the same command exited 1 with 11 passing and 1
  failing test because a Git pathspec was accepted where Truth requires an
  exact named governing-document path.
- Test-contract review RED: the same command exited 1 with 11 passing and 1
  failing test because `change begin` rejected an active task and left
  implementation running against requirements the Owner had just changed.
- Final GREEN: the same owning command exited 0 with all 12 tests passing.
  It covers fail-closed Truth loading, known concern union, mixed
  unknown/empty concern fallback, additive candidates, the single pending
  next action after superseding active work, staged-plus-unstaged exact diff
  bytes and SHA-256, missing coverage and plan replacement, wrong
  identifiers/digests, diff and pending state drift, and exact local
  acceptance back to clean task start.
- Implementation-review RED: the same command exited 1 with 9 passing and 4
  failing tests. Exact `..` and drive-relative Truth paths were accepted; a
  known concern with no selected plan entered a permanently unacceptable
  pending state; a valid goal mutation was not bound to pending identity; and
  a required document could change after the acceptance snapshot but before
  the CLEAN write.
- Pending-identity review RED: after those four fixes, the same command exited
  1 with 12 passing and 1 failing test because changing only the valid UUID
  suffix of `change_id` preserved its authority-digest prefix and was accepted.
- Review-fix GREEN: the same owning command exited 0 with all 13 tests passing.
  The pending identifier now binds the complete non-display current authority
  and its nonce; begin requires an explicitly selected Truth plan target;
  acceptance rechecks exact digest and coverage immediately before CLEAN; and
  exact parent, Git pathspec, absolute, and drive-relative targets fail closed.
- `npm.cmd run typecheck` exited 0.
- `npm.cmd run build` exited 0.
- `git diff --check` exited 0 with no output.

This earns local evidence for A10 and A11 only. It records cooperative local
review, not independent identity, semantic prose proof,
production authority, or hook enforcement.

## Correction 1 — linear plan and freshness repair

This one corrective slice supersedes only the conflicting free-form plan,
next-action, HEAD-freshness, and Truth-inventory semantics in Tasks 1–4 plus
the provisional Task 5 pre-commit subject comparison. It does not accept or
otherwise finalize Task 5, reopen the earlier acceptance denominator, or add a
DAG, authentication, gateway, database, daemon, migration framework, Claude
support, or release system.

Its single public black box is
`test/blackbox/linear-plan-freshness.test.mjs`, with exactly eight behavior
classes:

1. exact local plan-review evidence without Owner identity claims;
2. `plan_revision`, `ordered_tasks`, cursor, stable ids, and frozen/outline
   shapes;
3. argument-free start of only the frozen cursor contract;
4. one cursor advance with list-derived next and `PROJECT_COMPLETE`;
5. new revisions for reorder/delete/edit/freeze and old-revision invalidation;
6. verify-time HEAD CAS with post-verify subject/contract freshness;
7. separate staged-subject comparison in pre-commit;
8. init-time Truth classification/inventory with change-begin-only rescan and
   fail-closed high-risk drift.

Evidence recorded on 2026-07-30 with Node.js v24.11.1:

- RED: `node --test test/blackbox/linear-plan-freshness.test.mjs` exited 1
  with 0 passing and 8 failing tests. Seven failures reached the absent public
  `ohno plan propose` interface; the Truth case found no persisted inventory.
- Initial GREEN: the same owning command exited 0 with all 8 tests passing.
- Bounded-audit RED: the same owning command exited 1 with 5 passing and 3
  failing classes. It reproduced a non-zero command changing HEAD being
  recorded as FAIL instead of UNKNOWN, a plan-accept race able to overwrite a
  newer revision with an old PASS, and deletion of a tracked built-in
  governing file being hidden by an unchanged path inventory digest.
- Review-fix GREEN: the same owning command exited 0 with all 8 tests passing.
  The final run covered the exact eight frozen classes and no ninth acceptance
  class; state comparison and replacement are now one atomic CAS, verify
  checks post-command HEAD and subject before classifying a non-zero exit, and
  unchanged inventories still prove every previously classified governing
  path exists.
- `npm.cmd run typecheck` and `npm.cmd run build` exited 0.
- `node --check` exited 0 for the mechanically adapted Task 1–4 fixtures and
  shared black-box helper; their old acceptance denominator was not expanded
  or rerun as a review suite.
- `git diff --check` exited 0 with no output.

The Task 5 checkpoint below predates this corrective decision. Its commit and
preservation evidence remain intact and were not rewritten; the separate
post-Correction adaptation/finalization evidence below is what validates the
capability against the corrected semantics.

## Task 5 checkpoint and adaptation evidence

Recorded on 2026-07-30 with Node.js v24.11.1:

- Initial RED: `node --test test/blackbox/codex-hooks.test.mjs` exited 1
  because the public Codex hook interface and project template were absent.
  `node --test test/blackbox/git-precommit.test.mjs` likewise exited 1 because
  the installer and ordinary Git pre-commit interface were absent.
- Initial GREEN: the Codex owning command exited 0 with all 15 tests passing;
  the Git owning command exited 0 with all 11 tests passing.
- Contract-review RED: the Codex command exited 1 with 14 passing and 1
  failing test because a prefixed, non-token-bounded completion marker was
  accepted. The Git command exited 1 with 10 passing and 2 failing tests
  because installation did not disclose every added hook and a fresh
  worktree receipt incorrectly covered a different staged index subject.
- Contract-review GREEN: the Codex command exited 0 with all 15 tests passing;
  the strengthened Git command exited 0 with all 12 tests passing. Coverage
  now includes exact official matchers, every supported patch header and both
  rename sides, mixed pending-document mutations, exact marker boundaries,
  index-versus-worktree proof, existing-hook refusal, and installation
  disclosure.
- Trusted-smoke RED: after persistent review and trust in Codex 0.145.0, a
  disposable project's SessionStart handler exited 1. The installed
  `commandWindows` succeeded under `cmd.exe` but failed under the PowerShell
  execution path used by the real session.
- Windows-runner RED: the Git owning command exited 1 with 11 passing and 1
  failing test after its installation smoke began executing the installed
  `commandWindows` directly through non-interactive `powershell.exe`.
- Final GREEN: `node --test test/blackbox/codex-hooks.test.mjs` exited 0 with
  all 15 tests passing, and
  `node --test test/blackbox/git-precommit.test.mjs` exited 0 with all 12 tests
  passing. The Windows smoke uses the exact installed command, official-shape
  stdin, and the PowerShell runner rather than `shell: true`.
- A fresh disposable Git project was reviewed and persistently trusted in the
  real Codex 0.145.0 TUI. `/hooks` showed all four project hooks installed and
  active. A new session reported `SessionStart hook (completed)` and displayed
  hook context containing the exact current goal. A later model request timed
  out at the network boundary; no model response is claimed as evidence.
- `npm.cmd run typecheck` exited 0.
- `npm.cmd run build` exited 0.
- `git diff --check` exited 0 with no output.

Commit `2e45850b5eef1a0ec5d221f07169f4b2540d367d` is preserved as
`TASK5_PROVISIONAL_CHECKPOINT_NOT_ACCEPTED`; it remains a historical checkpoint
rather than being retroactively relabeled or rewritten.

Post-Correction adaptation evidence:

- Compatibility GREEN: after mechanically replacing old caller-supplied task
  fields with a locally reviewed frozen plan and adding the schema-v2 pending
  identity fields, the original Codex owning command exited 0 with all 15
  tests passing and the original Git owning command exited 0 with all 12
  tests passing.
- Adaptation RED: the unchanged 15-test Codex denominator then exited 1 with
  14 passing and 1 failing test because its no-active-task denial still told
  callers to supply a bounded contract to `task start` instead of projecting
  the corrected plan-derived `PROPOSE_PLAN` next action.
- Adaptation GREEN: after the hook used the same read model for that denial,
  the Codex owning command exited 0 with all 15 tests passing. The Git owning
  command remained GREEN with all 12 tests passing.
- `npm.cmd run typecheck` and `npm.cmd run build` exited 0.
- `git diff --check` exited 0 with no output.

This earns local evidence for A08, A09, and the Task 5 CLI-help portion of A16
only. Hooks still require project trust, changed definitions invalidate that
trust, hosted or specialized mutation paths may bypass the supported surface,
and ordinary Git can bypass a cooperative hook with `--no-verify`. No hostile
same-user containment, Cockpit, final performance, or production claim is
made.

## Task 6A locked design evidence

Recorded on 2026-07-30:

- The required `frontend-design-ui-ux` method was applied as a design-only
  boundary. The confirmed plush Hero was inspected without modification, and
  `docs/COCKPIT-DESIGN-CONTRACT.md` locks the single
  **Calibrated Plush Workshop** industrial/signage direction.
- The contract freezes the Calibration Rail signature, locally bundled type,
  exact OKLCH/hex tokens and measured contrast, desktop and narrow wireframes,
  canonical read-model mapping, full state matrix, keyboard and focus model,
  reduced motion, GET-only boundary, 12 deterministic screenshot targets, and
  the P06 measurement interval.
- Design pre-flight scored 29/32 with no axis below 3. It records explicit
  anti-slop bans and removes both generic card layout and a competing copy
  control.
- Two bounded read-only reviews found five contract ambiguities: Fresh PASS
  presented completed work as current, skip-link focus contradicted DOM order,
  a disabled refresh contradicted focus retention, the idle screenshot was
  not deterministic, and a red X stop gate conflicted with the Hero boundary.
  All five were corrected in the contract.
- Placeholder/ambiguity scan found no `TBD`, `TODO`, `FIXME`, or placeholder;
  `git diff --check` exited 0 with no output.
- No Cockpit source, asset, endpoint, dependency, or runtime behavior was
  implemented in this slice.

This locks the design prerequisite only. It does not earn A13, A14, P06, or a
claim that the Cockpit exists.

## Task 6B read-only Cockpit evidence

Recorded on 2026-07-30 with Node.js v24.11.1:

- RED: `node --test test/blackbox/cockpit.test.mjs` exited 1 with 0 passing
  and 5 failing tests because the public `ohno cockpit` command and local HTTP
  surface were absent.
- The implementation uses Node's built-in loopback HTTP server, the existing
  canonical `readModel`, and local vanilla HTML/CSS/JavaScript. It adds no
  runtime dependency, database, cache, telemetry, browser persistence, or
  second current-state schema.
- Harness diagnostic: the first post-implementation run reached all five
  behaviors but failed cleanup on Windows because disposable-project removal
  ran before child-server shutdown. Each test now closes its server in
  `finally`; no product assertion or acceptance class was weakened.
- GREEN: the owning command exited 0 with all 5 tests passing. It covers the
  printed loopback URL and listener close, exact equality with
  `status --json`, no normal Truth-inventory rescan, GET-only static and state
  surfaces, byte-preserving unavailable-state recovery, and live reflection
  from no-plan through active to fresh project completion.
- Six official IBM Plex WOFF2 assets and their SIL Open Font License are
  vendored locally with package versions, registry integrity values, and
  SHA-256 provenance in `assets/cockpit/fonts/SOURCE.md`; the page makes no
  network asset request.
- A bounded read-only review returned `ACCEPT_AS_BOUNDED`: no false PASS,
  write-capable route, second authority, cached stale projection, or
  lifecycle leak was found within Task 6B.
- `npm.cmd run typecheck`, `npm.cmd run build`, `node --check
  assets/cockpit/cockpit.js`, `node --check
  test/blackbox/cockpit.test.mjs`, and `git diff --check` exited 0.

This earns local functional evidence for A13 and the implementation needed to
measure P06. It does not earn browser visual acceptance A14 or the three-copy
P06 performance result; both remain explicit Task 6C/7 work.

## Task 6C browser acceptance evidence

Recorded on 2026-07-30:

- Browser pre-flight against the running built Cockpit demonstrated three
  bounded acceptance defects: the skip link used a transform while unfocused,
  the rail jaw and stop retained transforms under reduced motion, and an
  unavailable projection was headed `NO ACTIVE TASK`. The minimal UI fix uses
  positional offsets instead of transforms, labels the refresh control, and
  renders `UNAVAILABLE` explicitly.
- After the Owner explicitly authorized
  `http://127.0.0.1:12261/`, the in-app Browser still rejected direct
  navigation under an external browser security policy. The agent did not use
  Chrome, standalone Playwright, raw CDP, another port, or any other
  circumvention.
- Because the required browser could not open the target, the locked desktop,
  narrow, keyboard, focus, contrast, reduced-motion, overflow, and complete
  state screenshot matrix was not rerun after the fixes. A14 therefore remains
  unproved, and P06 has no valid browser samples.

This slice stops at the exact external blocker permitted by its frozen stop
condition. It does not call the Cockpit polished, browser-accepted, or complete.

## Task 7 trial and final-truth evidence

Recorded on 2026-07-30 with Node.js v24.11.1 on Windows 10.0.19044 x64,
13th Gen Intel(R) Core(TM) i7-13700KF:

- Script RED: before Task 7, `npm test`, `npm run test:acceptance`, and
  `npm run test:performance` exited 1 because those package scripts did not
  exist. The real scripts now own the public black boxes and performance
  receipt verifier; no publication script or side effect was added.
- The first clean-candidate full black-box run exposed two stale public
  fixtures, not product failures: the Correction 1 ledger assertion still
  named the historical Task 5 next action, and the Task 2 PASS-receipt fixture
  omitted the now-required `plan_revision`. The tests were mechanically
  adapted to the current linear schema; `node --test
  test/blackbox/linear-plan-freshness.test.mjs` is now 8/8 and `node --test
  test/blackbox/verify-finish.test.mjs` is 16/16. No production behavior or
  acceptance denominator changed.
- A12/A15 GREEN: `node --test test/blackbox/atomic-state.test.mjs` exited 0
  with 3/3 passing. It proves corrupt authority preserves exact bytes,
  interrupted atomic replacement leaves valid old or new authority, and
  `status`/`next`/`resume`, all four supported Codex hook events, and Cockpit
  refresh neither rescan Truth nor execute the frozen project test. The same
  inventory drift is detected only at explicit `change begin`.
- The real-project harness first failed twice on its own overly narrow
  expectations (`INSTALLED` instead of the public `INSTALLED_TEMPLATE`, then
  an invented capsule heading). Both harness errors were corrected against
  existing public black boxes without product changes. A third run exited 0.
- `test/evidence/task7-real-project-trials.json` records the built CLI SHA-256,
  implementation HEAD/tree, machine context, anonymous copy identities, every
  flow result, one untimed warm-up, 30 raw samples per command per copy, and
  nearest-rank p95 values. It contains no private path, source, or project name.
- All three disposable copies exercised task start, exact FAIL, exact PASS,
  cursor advance, normal commit freshness, scoped-subject staleness, resume,
  requirement-change diff/accept, Codex hook status/events, installed Git
  pre-commit, and Cockpit API equality. Originals were never mutated.

| Anonymous copy | Stack | Identity SHA-256 | `status` p95 | `next` p95 | `resume` p95 | task-start p95 |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| Trial A | TypeScript CLI | `d0ca63441534558b59f4c909f095ca68434d9c72f9e74375452f974c9cd35a2d` | 92.249 ms | 84.213 ms | 85.938 ms | 97.667 ms |
| Trial B | React/Vite Web | `9fe7a804796484b47c895dc62e0d5b13a697e45fbd8fc8985c362730002651fa` | 61.451 ms | 68.916 ms | 63.930 ms | 64.583 ms |
| Trial C | Python OCR source | `c6770c9f28ab00222cdebfc3bfda6015643a8295e84097838139387a691a42c8` | 83.777 ms | 67.922 ms | 77.903 ms | 85.791 ms |

- P01, P02, P03, and P05 are `TRIAL_PASS` on every copy. The largest accepted
  P04 fixture uses the maximum 256-byte goal, 96-byte stable id, 512-byte
  expected behavior, 1024-byte exact command, and 120 completed contracts; its
  serialized capsule is 3194 bytes, below the exclusive 4096-byte budget.
- The performance receipt test has a deliberate, truthful boundary: its P01–P05
  and P04 case passes, while its P06 case exits non-zero with
  `P06_NOT_MEASURED: IN_APP_BROWSER_NAVIGATION_REJECTED`. HTTP-only Cockpit
  checks are not substituted for a real browser measurement.
- `package.json` remains private at version `0.0.0`, declares MIT, keeps zero
  runtime dependencies, exposes real `test`, `test:acceptance`, and
  `test:performance` scripts, and narrows packed Cockpit files to runtime assets
  so test evidence is not shipped. README English and Simplified Chinese now
  show the exact linear-plan interface, plan-derived next, exact Stop marker,
  implemented A13 boundary, measured P01–P05 values, and unavailable A14/P06.
- `docs/PRODUCT-CONTRACT.md`, `docs/DESIGN.md`, and `docs/ACCEPTANCE.md` were
  reread and intentionally retain only stable requirements. Dynamic status and
  trial evidence remain solely in this bootstrap ledger, while product runtime
  authority remains solely `.ohno/state.json`.

Current row classification:

| Rows | Classification |
| --- | --- |
| A01–A13, A15, A16 | `LOCAL_PASS` (also exercised on all three real copies where applicable) |
| A14 | `UNAVAILABLE` — required in-app Browser rejected the authorized loopback URL |
| P01–P05 | `TRIAL_PASS` on every copied project |
| P06 | `UNAVAILABLE` / `NOT_MEASURED` — no valid browser samples |

The exact clean-checkout final gate result is recorded below after the Task 7
candidate commit is created. No npm publish, tag, release, or network mutation
is authorized or performed.

## Exact current action

There is exactly one. **Unique next:**

> **Task 7 final gate:** commit the scoped candidate, run every frozen final
> command exactly once from its clean checkout, record the exact results, and
> stop at `V1_CHANGES_REQUIRED` unless the required in-app Browser becomes
> available for A14 and P06. No Task 8.

## Shared implementation rules

- Use Node.js 22.20+, TypeScript ESM, Node's built-in test runner, and ordinary
  Git. Avoid runtime dependencies unless a recorded public RED proves the
  built-ins insufficient.
- Before each slice, write its expected behavior, exact test command, allowed
  files, predicted duration, and stop condition into the active work note or
  commit message.
- RED must fail for the missing behavior, not a syntax/setup accident.
- GREEN is the smallest implementation that satisfies the current public test.
- Run the owning black box, the smallest type/build checks, and
  `git diff --check`. The full suite belongs only in Task 7.
- In the same commit as an accepted slice, update this ledger to `LOCAL_PASS`,
  add the exact verification command/result, and set exactly one next action.
- If a frozen requirement proves impossible or contradictory, stop with
  `V1_CHANGES_REQUIRED`; do not silently rewrite acceptance.

## Task 1 — Task-start contract and atomic state

**Expected user behavior**

An incomplete frozen cursor contract or competing start is rejected without
state damage. One locally reviewed frozen cursor contract becomes the sole
active task through an atomic write.

**Write first**

`test/blackbox/task-start.test.mjs`

The test creates disposable Git repositories and proves:

1. `init` requires one Owner goal and refuses silent re-initialization;
2. each missing/blank frozen plan field exits non-zero;
3. rejection creates no active task;
4. a reviewed complete cursor contract starts without caller overrides and
   serializes exactly one active task;
5. a second start fails and preserves the state bytes;
6. an interrupted replacement leaves valid old or valid new JSON.

The historical initial RED was caused by the absent `ohno task start`
interface. Correction 1 mechanically adapts this regression fixture to the
reviewed linear plan without expanding its atomic-state denominator.

**Allowed implementation files**

```text
package.json
package-lock.json
tsconfig.json
src/cli.ts
src/state.ts
src/task-start.ts
test/blackbox/task-start.test.mjs
test/helpers/**
```

**Budget:** 45–90 minutes.

**Stop:** the owning test, typecheck/build, and `git diff --check` pass. Do not
start verification logic.

## Task 2 — Exact verification, finish, and one next action

**Expected user behavior**

The exact black-box command—not agent prose—keeps a failed task active or
closes a freshly verified task and returns one next action.

**Write first**

`test/blackbox/verify-finish.test.mjs`

Prove:

- non-zero, timeout, signal, unreadable subject, or test-time mutation yields
  FAIL/UNKNOWN and leaves the task active;
- zero with identical pre/post HEAD and subject creates a receipt bound to
  exact command, plan/contract digest, HEAD provenance, and allowed-file
  digest;
- a later ordinary commit alone preserves freshness while a plan, contract, or
  scoped-subject change makes PASS visibly stale;
- fresh PASS closes the task, advances the cursor once, and prints the
  plan-derived next action;
- no manual finish bypass exists.

**Allowed additions**

```text
src/verify.ts
src/subject-digest.ts
src/process.ts
test/blackbox/verify-finish.test.mjs
```

Task 1 files may change only where this test demonstrates the dependency.

**Budget:** 60–90 minutes.

**Stop:** owning RED is green; no status/resume UI and no hooks.

## Task 3 — Status, resume, next, and bounded capsule

**Expected user behavior**

A new session obtains the same current truth in one fast command; all three
read surfaces agree and never invent a next action.

**Write first**

`test/blackbox/resume-status-next.test.mjs`

Prove no-plan, active, failed, stale-PASS, blocked-doc-sync, and completed
states; machine JSON stability; a capsule under 4 KiB; and exactly one
plan-derived next action, `PROJECT_COMPLETE`, or blocking `NONE`.

**Allowed additions**

```text
src/read-model.ts
src/status.ts
src/resume.ts
src/next.ts
test/blackbox/resume-status-next.test.mjs
```

**Budget:** 45–75 minutes.

**Stop:** A06/A07 behavior passes. Record diagnostic latency but do not claim
the final p95 trial.

## Task 4 — Truth-driven requirement-change sync

**Expected user behavior**

When requirements change, the harness identifies every required governing
document from the Owner-maintained list, displays the exact complete diff, and
blocks coding until that diff and replacement plan are accepted.

**Write first**

`test/blackbox/requirement-change.test.mjs`

Prove:

- known Owner-confirmed concerns select the union of matching targets;
- unknown/empty concerns select all targets;
- an Agent candidate list cannot shrink the required set;
- pending sync exposes only `SYNC_GOVERNING_DOCUMENTS`;
- acceptance rejects missing paths, missing plan replacement, state drift, and
  a digest different from the displayed exact diff;
- successful local confirmation restores a clean state without claiming
  independent production identity.

**Allowed additions**

```text
src/truth.ts
src/change.ts
test/blackbox/requirement-change.test.mjs
fixtures/truth/**
```

**Budget:** 60–90 minutes.

**Stop:** A10/A11 pass. Do not add an LLM document writer or graph engine.

## Task 5 — Thin Codex and Git hooks

**Expected user behavior**

Supported Codex mutation paths and ordinary Git commits receive fast,
actionable guardrails while unsupported paths and trust state are reported
honestly.

**Write first**

```text
test/blackbox/codex-hooks.test.mjs
test/blackbox/git-precommit.test.mjs
```

Prove hook stdin/stdout contracts for `SessionStart`, `PostCompact`,
`PreToolUse`, and `Stop`; no-task/doc-sync/out-of-scope denial; in-scope allow;
exact `OHNO_COMPLETE:<task-id>` marker freshness; existing Git-hook
preservation/refusal; staged scope; stale proof; and honest
untrusted/unavailable status.

Run one smoke trial in a disposable trusted Codex project after executable
contract tests pass. Do not pretend to test hosted paths the official hook
surface excludes.

**Allowed additions**

```text
src/hooks/**
src/install.ts
templates/.codex/hooks.json
templates/git/pre-commit
test/blackbox/codex-hooks.test.mjs
test/blackbox/git-precommit.test.mjs
```

**Budget:** 75–90 minutes.

**Stop:** A08/A09/A16 local behavior passes; no Cockpit code.

## Task 6A — Locked Cockpit design contract

**Expected user behavior**

Before UI code exists, one distinctive and testable visual contract defines
the precision-caliper/warning-beacon Cockpit at desktop and narrow widths.

Use `frontend-design-ui-ux`. `ui-ux-pro-max` may inform catalog lookup only and
must not be credited as implementation.

**Required artifact**

```text
docs/COCKPIT-DESIGN-CONTRACT.md
```

It freezes layout, tokens, typography, states, responsive behavior, keyboard
model, reduced motion, component anatomy, and acceptance screenshots or
wireframes. It must explicitly reject generic dashboard defaults and preserve
the read-only single-authority rule.

**Budget:** 45–75 minutes.

**Stop:** the contract is internally reviewed against `DESIGN.md` and committed
alone. Do not write UI code.

## Task 6B — Read-only Cockpit implementation

**Expected user behavior**

`ohno cockpit` opens a fast local view matching the locked contract and the
same JSON state as the CLI.

Use `frontend-design` and implement the Task 6A contract without redesigning
it.

**Write first**

`test/blackbox/cockpit.test.mjs` for server lifecycle, state endpoint,
read-only behavior, canonical-field equality, invalid-state handling, and
state-change reflection.

**Allowed additions**

```text
src/cockpit/**
assets/cockpit/**
test/blackbox/cockpit.test.mjs
```

No framework, database, telemetry, authentication product, or UI-only state.

**Budget:** 60–90 minutes.

**Stop:** functional A13 passes and the server shuts down cleanly. Visual
acceptance remains explicitly unearned.

## Task 6C — Browser visual and functional acceptance

**Expected user behavior**

The running Cockpit is polished, distinctive, accessible, responsive, and
truthful across idle, active, failed, blocked, stale, and fresh-PASS fixtures.

Use browser automation against the built product. Verify the exact Task 6A
contract at desktop and narrow viewport, keyboard traversal, focus visibility,
contrast, reduced motion, overflow, and canonical equality with
`status --json`. Fix only acceptance defects; do not redesign or add features.

**Allowed files**

Task 6B UI assets, `test/blackbox/cockpit.test.mjs`, and the Task 6A contract
only when a documented contradiction—not taste—requires clarification.

**Budget:** 45–90 minutes.

**Stop:** A14 passes with recorded screenshots and commands, or stop with exact
visual blockers.

## Task 7 — Trials, performance, packaging dry run, and final truth

**Expected user behavior**

The harness completes all four loops on three disposable copies of real
projects within the frozen latency budgets, and the repository tells the truth
about what was and was not proven.

**Write first**

`test/performance/local-latency.test.mjs` and any missing A12/A15 regression
case. Trial copies must never be original working directories.

Run every command in `docs/ACCEPTANCE.md` exactly once at the final frozen
boundary. Record Node/machine context, samples, p95, capsule size, package
contents, and each A/P row.

Update:

```text
README.md
docs/PRODUCT-CONTRACT.md
docs/ACCEPTANCE.md
docs/IMPLEMENTATION-PLAN.md
```

Only earned capabilities change from `PLANNED`. Do not publish npm, tag a
release, or claim hostile-agent/full enforcement.

**Budget:** 90–150 minutes.

**Stop:** clean worktree and either:

- `V1_TRIAL_ACCEPTED` with every A/P row evidenced; or
- `V1_CHANGES_REQUIRED` with exact failing rows and one next action.

No Task 8.
