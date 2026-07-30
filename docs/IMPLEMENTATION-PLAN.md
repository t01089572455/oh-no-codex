# Codex-only V1 implementation plan

Status: **IMPLEMENTATION_IN_PROGRESS — TASK_1_LOCAL_PASS**

Owner authorization: Tasks 1–7 below, including 6A–6C, were authorized as the
complete V1 implementation scope on 2026-07-30. Execute them sequentially.
Do not add another task or publish a package without new authorization.

## Ledger

| Slice | Status | Owning public acceptance |
| --- | --- | --- |
| Task 1 — task-start contract and atomic state | LOCAL_PASS | A01, A02, part of A12 |
| Task 2 — exact verification, finish, and one next action | NOT_STARTED | A03, A04, A05 |
| Task 3 — status, resume, next, and bounded capsule | NOT_STARTED | A06, A07, part of A15 |
| Task 4 — Truth-driven requirement-change sync | NOT_STARTED | A10, A11 |
| Task 5 — Codex hooks and Git pre-commit | NOT_STARTED | A08, A09, A16 |
| Task 6A — locked Cockpit design contract | NOT_STARTED | design prerequisite for A13, A14 |
| Task 6B — read-only Cockpit implementation | NOT_STARTED | A13, part of P06 |
| Task 6C — browser visual and functional acceptance | NOT_STARTED | A14 |
| Task 7 — cross-project trials and final gate | NOT_STARTED | A12, A15, A16, P01–P06 |

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
- `D:\Program Files\nodejs\npm.cmd run typecheck` exited 0.
- `D:\Program Files\nodejs\npm.cmd run build` exited 0.
- `git diff --check` exited 0 with no output.

This earns local evidence for A01, A02, and the interrupted-write portion of
A12 only. It does not earn verification, hooks, read surfaces, Cockpit,
performance, trial, or production claims.

## Exact current action

There is exactly one:

> **Task 2:** create `test/blackbox/verify-finish.test.mjs` with the frozen RED
> cases below, then implement only exact verification, evidence-bound finish,
> stale-proof detection, and the frozen one next action required to make it
> pass.

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

An incomplete or competing task is rejected without state damage. One complete
bounded contract becomes the sole active task through an atomic write.

**Write first**

`test/blackbox/task-start.test.mjs`

The test creates disposable Git repositories and proves:

1. `init` requires one Owner goal and refuses silent re-initialization;
2. each missing/blank task field exits non-zero with its field name;
3. rejection creates no active task;
4. a complete contract exits zero and serializes exactly one active task;
5. a second start fails and preserves the state bytes;
6. an interrupted replacement leaves valid old or valid new JSON.

Initial RED must be caused by the absent `ohno task start` interface.

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
- zero with identical pre/post subject creates a receipt bound to exact
  command, contract digest, HEAD/UNBORN, and allowed-file digest;
- a later relevant change makes PASS visibly stale;
- fresh PASS closes the task and prints the one frozen next action;
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

Prove idle, active, failed, stale-PASS, blocked-doc-sync, and completed states;
machine JSON stability; a capsule under 4 KiB; and exactly one next or `NONE`.

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
