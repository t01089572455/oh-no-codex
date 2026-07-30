# V1 design

Status: **FROZEN — NOT IMPLEMENTED**

This document defines the smallest architecture that can satisfy
`PRODUCT-CONTRACT.md`. It is not permission to add adjacent governance
features.

## Shape

```text
Owner / Codex
     |
     v
  ohno CLI  ------ atomic replace ------> .ohno/state.json
     |                                      |
     |                                      +--> status / resume / next
     |                                      +--> Codex lifecycle hooks
     |                                      +--> Git pre-commit hook
     |                                      `--> read-only Cockpit
     |
     `------ named governing files <------ .ohno/truth.json
```

There is one current-state authority. Hooks, console output, test receipts,
resume capsules, and Cockpit views are derived from it.

## Technology boundary

- Node.js 22.20 or newer. This is the first maintained line in which the
  built-in `path.matchesGlob()` contract used by V1 is stable.
- TypeScript, ESM, and the Node built-in test runner.
- Node built-ins for argument parsing, hashing, child processes, atomic file
  replacement, glob matching where available, and the local HTTP server.
- Vanilla semantic HTML, CSS, and JavaScript for the Cockpit.
- No runtime framework or database in V1.

If a current failing public test cannot be satisfied by that stack, the
implementer records the exact failure before proposing one narrow dependency.
See the official
[Node.js path documentation](https://nodejs.org/api/path.html#pathmatchesglobpath-pattern)
and [release status](https://nodejs.org/en/about/previous-releases).

## Repository assets

### `.ohno/state.json`

The sole current runtime authority. Conceptual fields:

```json
{
  "schema_version": 1,
  "goal": "Owner-authored project goal",
  "status": "IDLE | ACTIVE | BLOCKED_DOC_SYNC",
  "active_task": {
    "id": "stable-owner-readable-id",
    "expected_behavior": "user-visible outcome",
    "test_command": "one exact command",
    "stop_condition": "explicit boundary",
    "allowed_files": ["bounded/glob/**"],
    "time_budget_minutes": 60,
    "next_action": "one action",
    "contract_digest": "sha256"
  },
  "last_verification": {
    "result": "PASS | FAIL | UNKNOWN",
    "command": "exact command",
    "head": "git commit or UNBORN",
    "subject_digest": "sha256",
    "exit_code": 0,
    "finished_at": "RFC3339"
  },
  "completed": [],
  "document_sync": {
    "status": "CLEAN | PENDING_REVIEW",
    "change_id": null,
    "required_paths": [],
    "reviewed_diff_digest": null
  }
}
```

This is a conceptual public contract, not a demand for a generalized domain
model. The implementation may serialize a flatter equivalent if public
behavior and forward versioning remain clear.

Writes use a same-directory temporary file, flush, and atomic rename. A parse
failure or unsupported schema fails closed without overwriting the original.

### `.ohno/truth.json`

Owner-maintained applicability, for example:

```json
{
  "schema_version": 1,
  "targets": [
    { "path": "README.md", "concerns": ["public-capability"] },
    { "path": "docs/PRODUCT.md", "concerns": ["requirements", "public-capability"] },
    { "path": "docs/PLAN.md", "concerns": ["requirements", "plan"] },
    { "path": "AGENTS.md", "concerns": ["agent-rules"] }
  ]
}
```

The Owner confirms concern labels when beginning a change. The harness
calculates matching paths. If labels are absent, unknown, or inconsistent, all
targets are included. An Agent-supplied list can add candidates but cannot
remove the Owner-maintained required set.

## Loop 1 — Start

Initialization is explicit:

```text
ohno init --goal <owner-authored project goal>
```

It refuses to replace an existing project state. Changing the goal later uses
the requirement-change loop rather than a silent re-init.

Planned command:

```text
ohno task start
  --id <stable-id>
  --expect <user-visible behavior>
  --test <one exact command>
  --stop <boundary>
  --files <comma-separated globs>
  --minutes <positive integer>
  --next <one action>
```

The command rejects missing or blank fields, multiple next actions, an active
task, pending document sync, invalid globs, or an unsafe time budget. It does
not edit product files. On success it atomically records one active contract
and prints a compact summary.

The implementation does not attempt to decide whether prose is philosophically
"good." It enforces presence, bounds, stable identity, and explicitness.

## Loop 2 — Verify and finish

`ohno verify`:

1. loads the active contract;
2. captures the current Git HEAD (`UNBORN` is valid);
3. hashes the contract and content/absence of files matched by `allowed_files`;
4. runs the exact command without shell rewriting;
5. records exit code, timestamps, and subject digest;
6. on failure, leaves the task active and returns non-zero;
7. on success, rechecks the digest to detect test-time mutation;
8. closes the task only when the pre/post subject is identical;
9. exposes the contract's one next action and stops.

The digest is intentionally limited to the declared file scope so normal use
does not scan the entire repository. If Git or a matched file cannot be read,
verification is `UNKNOWN`, never PASS.

Any later change to the contract, HEAD, or matched file content makes the
receipt stale. `ohno task finish` is not a second bypass; V1 has only the
verification-driven close path.

## Loop 3 — Requirement change

The minimal flow is:

```text
ohno change begin --summary <owner words> --concerns <owner-confirmed labels>
Codex edits only the required governing files and replacement plan
ohno change diff
ohno change accept --change <id> --diff <displayed digest>
```

`begin` records `PENDING_REVIEW`, required paths, and the only safe next action:
`SYNC_GOVERNING_DOCUMENTS`. Mutation hooks deny unrelated implementation work.

`diff` displays the exact Git diff for every required path and reports missing
coverage. It does not silently edit user-authored prose.

`accept` succeeds only for the displayed digest, complete path coverage, and a
replacement current plan. Because V1 is cooperative, this records local Owner
confirmation; it does not claim cryptographic human identity or production
review separation.

## Loop 4 — Resume and display

- `ohno status`: concise machine-stable current state and proof freshness.
- `ohno resume`: a human capsule with goal, completed summaries, current task,
  expected behavior, exact test, blocker, and next action.
- `ohno next`: exactly one action or an explicit `NONE`.
- `ohno cockpit`: serves a local read-only web view of the same state.

The resume capsule is bounded to 4 KiB. Completed history is summarized and
bounded; the current contract and blocker take precedence.

## Codex hooks

Project hooks live in `.codex/hooks.json` and call an internal `ohno hook`
entrypoint. They read only the small state file on the normal path.

| Event | V1 behavior |
| --- | --- |
| `SessionStart` | Add the bounded resume capsule as context. |
| `PostCompact` | Re-inject the current capsule so compaction cannot make stale prose authoritative. |
| `PreToolUse` | For supported mutation tools, deny when no task is active, document sync is pending, or a parseable target is outside scope. Ambiguous command targeting fails closed only when the hook can do so without pretending to understand arbitrary shell semantics. |
| `Stop` | If the final message uses the product's completion marker without fresh PASS evidence, continue with the exact missing-proof reason. |

The cooperative marker is `OHNO_COMPLETE:<active-task-id>`. Repository agent
instructions tell Codex to use it only after `ohno verify` succeeds. A model
can omit or paraphrase the marker, so the hook must not claim to understand or
control arbitrary completion prose.

The official Codex documentation states:

- project-local hooks can live at `<repo>/.codex/hooks.json`;
- non-managed hooks require review and trust, and changes invalidate trust;
- `PreToolUse` can intercept shell, unified exec, `apply_patch`, MCP, and most
  other local function tools;
- hosted tools and some specialized paths do not use or may opt out of that
  hook path;
- `Stop` can ask Codex to continue, rather than undoing prior effects.

Source: [Codex hooks documentation](https://learn.chatgpt.com/docs/hooks).

Therefore hook status is always `COOPERATIVE_GUARDRAIL`. Installation and
status output must expose disabled, untrusted, or unavailable hooks instead of
claiming enforcement.

## Git pre-commit

The installer must not overwrite an existing hook. It either:

- adds a clearly delimited Oh No invocation to a compatible existing hook; or
- refuses with exact manual instructions.

The check rejects a commit when:

- there is neither an active task nor a just-verified completed subject;
- document sync is pending;
- staged paths exceed the active task's file boundary;
- the task is being marked complete without a fresh receipt for the staged
  subject.

It does not claim to control direct filesystem writes, `--no-verify`, another
Git client, or a hostile same-user process.

## Cockpit locked direction

Task 6A must turn this direction into a versioned visual contract before code:

- **Metaphor:** precision caliper plus warning beacon—not a generic SaaS admin
  dashboard.
- **Information hierarchy:** a dominant NOW instrument for the current task and
  one next action; smaller PROOF and DRIFT instruments for test freshness and
  document synchronization.
- **Visual language:** warm instrument-paper background, near-black typography,
  signal red for blocked/stale states, calibrated amber for active work, and a
  restrained mint only for fresh PASS.
- **Type:** expressive display face paired with a highly legible mono/data face;
  no default framework typography.
- **Motion:** brief mechanical measurement/lock transitions; reduced-motion
  support; no decorative looping animation.
- **Interaction:** keyboard navigable, visible focus, semantic landmarks,
  readable contrast, desktop and narrow viewport acceptance.
- **Truth:** read-only. No database, hidden polling authority, or UI-only state.

Use `frontend-design-ui-ux` for the locked contract, `frontend-design` for
implementation, then browser acceptance. `ui-ux-pro-max` is catalog-only.

## Failure behavior

- Missing/corrupt state: read commands report `UNAVAILABLE`; mutation guards
  deny supported writes with recovery instructions.
- Test timeout or signal: `UNKNOWN`, task remains active.
- Stale receipt: visible `STALE`, not PASS.
- Dirty required docs during change: pending until exact diff acceptance.
- No next action: display `NONE`; never invent one.
- Hook unavailable: display the limitation and keep CLI/Git controls usable.

## Security and privacy

V1 stores project-local operational data only. It does not upload transcripts,
source, prompts, or test output. Test commands execute with the user's normal
local authority. The installer shows every hook it will add.

## Deliberately absent

There is no grant service, effect gateway, append-only journal, adapter trust
grade, control-plan DAG, event bus, policy engine, or migration framework.
Those concepts do not solve a current V1 public acceptance test.
