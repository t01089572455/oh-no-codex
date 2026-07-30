# V1 acceptance contract

Status: **FROZEN — NO ROWS EARNED**

Every row is black-box unless explicitly marked structural. A mock, internal
unit test, agent report, or count of passing tests cannot substitute for the
named user-visible behavior.

## Public behavior matrix

| ID | Required user-visible evidence |
| --- | --- |
| A01 | In a disposable Git repository, `ohno init` requires and preserves one Owner goal. `ohno task start` with any missing required field exits non-zero, explains the missing field, and creates no active task. A complete bounded contract creates exactly one active task. |
| A02 | Starting a second task while one is active exits non-zero and preserves the original task byte-for-byte. |
| A03 | A failing exact black-box command leaves the current task active, records FAIL for that command, and returns non-zero. |
| A04 | A passing exact command with unchanged subject creates a fresh receipt, closes that task, and returns exactly one next action. |
| A05 | Changing HEAD, the task contract, or any matched allowed-file content after PASS makes the receipt visibly STALE. It cannot close or commit the changed subject without re-verification. |
| A06 | `status`, `resume`, and `next` agree on goal, active/completed state, proof freshness, blocker, and the same one next action. With no next action they all report `NONE`, not an invented step. |
| A07 | A new session and a post-compaction hook receive a capsule below 4 KiB that agrees with direct `resume` output on all canonical fields. |
| A08 | With no active task, pending document sync, or a clearly out-of-scope file target, supported `PreToolUse` mutation calls are denied with an actionable reason. In-scope calls are allowed. `Stop` recognizes only the explicit `OHNO_COMPLETE:<task-id>` marker and fresh proof. Hook status honestly exposes untrusted or unavailable integration. |
| A09 | The Git `pre-commit` integration rejects pending doc sync, out-of-scope staged paths, and stale completion proof; it accepts a fresh in-scope subject. Existing hooks are preserved or installation refuses safely. |
| A10 | A requirement change derives its required paths from Owner-maintained Truth concerns. Unknown/empty concerns include all targets. `change diff` shows exact complete coverage, and acceptance fails for an undisplayed digest or missing replacement plan. |
| A11 | While change sync is pending, the only reported next action is `SYNC_GOVERNING_DOCUMENTS`; unrelated implementation mutation is blocked on supported paths. After exact acceptance, the new plan replaces the stale plan and normal task start resumes. |
| A12 | Killing a state write between temporary-file creation and rename leaves either the old valid state or the new valid state—never truncated current authority. Corrupt input fails closed without overwrite. |
| A13 | The running Cockpit shows the same current task, proof freshness, doc-sync blocker, and next action as `status --json`; it creates no independent current-state store. |
| A14 | Cockpit browser acceptance passes at desktop and narrow viewports for distinctive locked design fidelity, keyboard navigation, visible focus, contrast, reduced motion, and blocked/active/fresh-PASS states. |
| A15 | No normal `status`, `next`, `resume`, hook, or Cockpit refresh scans every governing document or runs a project test suite. |
| A16 | README and CLI help label unimplemented or unavailable capabilities honestly and never call cooperative hooks hostile-agent containment, production authority, or full enforcement. |

## Performance matrix

Measure release-mode commands after one untimed warm-up on each of three
disposable copies of real projects. Use at least 30 timed samples per command
per copy. Record machine and Node version.

| ID | Budget |
| --- | --- |
| P01 | `ohno status` local p95 < 250 ms on every copy. |
| P02 | `ohno next` local p95 < 250 ms on every copy. |
| P03 | `ohno resume` local p95 < 500 ms on every copy. |
| P04 | Serialized resume capsule < 4 KiB for the largest accepted fixture. |
| P05 | Task-start harness overhead < 2 s, excluding any user test. |
| P06 | Saved state becomes visible in Cockpit < 250 ms p95. |

Failure on one copy fails the row. Results are `TRIAL_PASS`, not a universal
speed guarantee.

## Required public test layout

The implementation plan owns these black-box files:

```text
test/blackbox/task-start.test.mjs
test/blackbox/verify-finish.test.mjs
test/blackbox/resume-status-next.test.mjs
test/blackbox/requirement-change.test.mjs
test/blackbox/codex-hooks.test.mjs
test/blackbox/git-precommit.test.mjs
test/blackbox/cockpit.test.mjs
test/blackbox/atomic-state.test.mjs
test/performance/local-latency.test.mjs
```

Tests spawn the packaged CLI from outside implementation modules in disposable
Git repositories. Browser acceptance operates on the running built Cockpit.

## Slice verification

During a task, run only:

1. the current public black-box test;
2. the smallest dependency-bounded unit/type/build check required by changed
   files;
3. `git diff --check`.

Do not repeatedly run the final gate during diagnosis.

## Final verification commands

Task 7 must make these real package scripts and run them from a clean checkout:

```bash
npm ci
npm run typecheck
npm run build
npm test
npm run test:acceptance
npm run test:performance
npm pack --dry-run
git diff --check
git status --short
```

Expected:

- every command through `npm pack --dry-run` exits 0;
- `git diff --check` has no output;
- `git status --short` has no output;
- package contents contain only intended runtime, hook templates, Cockpit
  assets, README, license, and package metadata;
- no network or publication side effect occurs.

## Real-project trial rules

- Use three copied projects with different stacks; never mutate originals.
- Record copy identity without publishing private paths, source, or names.
- Exercise start, fail, pass, stale proof, resume, requirement change, Codex
  hook status, pre-commit, and Cockpit.
- A bypass that official Codex hooks do not cover is recorded as a limitation,
  not misreported as a passing enforcement test.
- Remove or retain trial copies according to their owners' instructions after
  evidence is recorded.

## Completion language

Before Task 7, public status remains `PLANNED` or precise `LOCAL_PASS` per row.
After all A and P rows pass, status may become:

> `V1_TRIAL_ACCEPTED` — Codex-only cooperative harness accepted on the named
> local black-box and disposable-project trials; no hostile-agent, production
> authority, package publication, or universal speed claim.

Anything less remains `V1_CHANGES_REQUIRED` with exact failing rows.
