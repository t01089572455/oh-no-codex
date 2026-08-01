# V1 design

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
  "schema_version": 3,
  "goal": "Owner-authored project goal",
  "status": "IDLE | ACTIVE | BLOCKED_DOC_SYNC",
  "plan_revision": "sha256 or null",
  "ordered_tasks": [
    {
      "id": "stable-token-id",
      "title": "owner-readable title",
      "goal": "task goal",
      "status": "FROZEN",
      "expected_behavior": "user-visible outcome",
      "test_command": "one exact command",
      "stop_condition": "explicit boundary",
      "allowed_files": ["bounded/glob/**"],
      "time_budget_minutes": 60
    },
    {
      "id": "future-id",
      "title": "future title",
      "goal": "future goal",
      "status": "OUTLINE"
    }
  ],
  "cursor": 0,
  "plan_review": {
    "status": "LOCAL_REVIEW_RECORDED",
    "plan_revision": "sha256",
    "diff_digest": "sha256",
    "head": "git commit or UNBORN",
    "proposed_at": "RFC3339",
    "recorded_at": "RFC3339",
    "acceptance_source_path": ".ohno/acceptance-basis.json",
    "acceptance_source_digest": "sha256"
  },
  "pending_plan": null,
  "truth_inventory": {
    "inventory_digest": "sha256",
    "classification": []
  },
  "active_task": {
    "id": "stable-token-id",
    "expected_behavior": "user-visible outcome",
    "test_command": "one exact command",
    "stop_condition": "explicit boundary",
    "allowed_files": ["bounded/glob/**"],
    "time_budget_minutes": 60,
    "plan_revision": "sha256",
    "contract_digest": "sha256"
  },
  "last_verification": {
    "result": "PASS | FAIL | UNKNOWN",
    "command": "exact command",
    "contract_digest": "sha256",
    "plan_revision": "sha256",
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

Schema **2** (pre–structured basis) remains readable. While migration is
required, the sole next action is `MIGRATE_ACCEPTANCE_BASIS` (even over FAIL
proof). Migration is two-phase and fail-closed:

1. `ohno migrate acceptance-basis --file <basis.json>` — zero-write preview of
   the semantic side-effect exact diff (Truth action, inventory rebuild, active
   task clear, pending rebind-or-clear, status); wall-clock review fields are
   marked `apply_metadata`;
2. re-run with caller-returned `--diff <sha256> --head <git-head>` — under
   `state.cas.lock`, atomic Truth replace then state CAS (rollback Truth on
   state-write failure). Provenance is **caller-returned local review**, not
   Owner identity.

Only ENOENT may create `.ohno/truth.json`; corrupt Truth is never overwritten.
Pending schema-2 proposals rebind with a fresh v3 exact plan diff when the
proposal source is still accept-able; otherwise pending is cleared to
`PROPOSE_PLAN`. Stale pending alongside an accepted plan is cleared only as an
explicit side-effect in the exact migrate diff.

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

At `init`, the state persists a classified high-risk inventory and its path
digest. High risk includes nested `AGENTS`/`AGENTS.override` entries, root
README language entries, configured Agent/hook files, canonical
plan/Truth/contract/acceptance assets, and existing Truth targets. Only
`change begin` rescans it. An unchanged digest reuses the persisted
classification; a new unclassified high-risk entry or a missing/renamed
governing target fails closed. Normal status/resume/next, hooks, and Cockpit
reads do not perform this scan.

## Loop 1 — Start

Initialization is explicit:

```text
ohno init --goal <owner-authored project goal>
```

It refuses to replace an existing project state. Changing the goal later uses
the requirement-change loop rather than a silent re-init.

The plan is reviewed before a task can start:

```text
ohno plan propose --file <review.json>
ohno plan accept --revision <sha256> --diff <sha256>
ohno task start
```

The proposal is a minimal linear plan: a revision over `ordered_tasks` **and**
the structured acceptance basis (path + content digest), a runtime cursor, and
unique stable ids. Plan JSON requires `acceptance_source` pointing at a Truth
target that holds structured basis JSON:

```json
{
  "schema_version": 1,
  "tasks": [
    {
      "id": "stable-task-id",
      "expected_behavior": "exact user-visible behavior",
      "test_command": "exact black-box command",
      "stop_condition": "exact stop boundary"
    }
  ]
}
```

Every `FROZEN` task id must appear exactly once in the basis with **identical**
`expected_behavior`, `test_command`, and `stop_condition` strings (no regex or
NLP). `OUTLINE` tasks must not carry full basis contracts until frozen.
Propose and accept both re-read the basis; path/content drift or mismatch
refuses the operation.

Schema 2 projects that still lack structured basis remain readable; `next` is
`MIGRATE_ACCEPTANCE_BASIS` until the two-phase migrate above upgrades them to
schema 3 without dropping cursor or completed history. Empty Truth inventories
are migratable; migrate rebuilds the full high-risk inventory (including
Truth file and projector-owned AGENTS path) so `change begin` does not
self-lock. `LOCAL_REVIEW_RECORDED` is written only on successful apply after
caller-returned digest/HEAD (local review, not Owner identity)—not
self-approved before display. While
migration is required, verify, task start, pre-commit, and Codex completion
hooks refuse product work (parseable PreToolUse mutations; arbitrary Bash
remains an honest cooperative limitation). Unknown FROZEN plan fields are
hard-rejected. `change begin` always unions Truth targets that carry the
`acceptance-basis` concern (not every black-box path).

The cursor task must be `FROZEN` with behavior, exact test, file scope, stop
condition, and budget. Later tasks may be `OUTLINE` with only id, title, and
goal. Reordering, deletion, editing, or freezing changes the revision.

Proposal output frames the exact plan diff and binds its digest, revision, Git
HEAD, and time. Acceptance records only `LOCAL_REVIEW_RECORDED`; it is local
evidence, not `OWNER_AUTHORIZED`, `OWNER_CONFIRMED`, cryptographic identity, or
hostile same-user containment.

Accepting a new revision invalidates active work and receipts from the old
revision; neither can advance the replacement plan.

`task start` takes no contract arguments. It rejects an active task, pending
document sync, an unreviewed plan, or an `OUTLINE` cursor. For an outline its
only next action is `FREEZE_TASK:<id>`. Otherwise it atomically activates the
exact frozen cursor contract.

The implementation does not attempt to decide whether prose is philosophically
"good." It enforces presence, bounds, stable identity, and explicitness.

## Loop 2 — Verify and finish

`ohno verify`:

1. loads the active contract;
2. captures the current Git HEAD (`UNBORN` is valid);
3. hashes the contract and content/absence of files matched by `allowed_files`;
4. runs the exact frozen command string by handing it unchanged to the
   platform shell (`shell: true` / equivalent). The product does not tokenize,
   normalize, rewrite, or re-quote the command; platform shell interpretation
   remains cooperative OS behavior, not a security boundary;
5. records exit code, timestamps, and subject digest;
6. on failure, leaves the task active and returns non-zero;
7. on success, rechecks the digest to detect test-time mutation;
8. closes the task only when the pre/post subject is identical;
9. advances the cursor exactly once and derives the next action from the
   ordered plan, ending with `PROJECT_COMPLETE`.

The digest is intentionally limited to the declared file scope so normal use
does not scan the entire repository. If Git or a matched file cannot be read,
verification is `UNKNOWN`, never PASS.

HEAD is receipt provenance and a pre/post compare-and-swap guard. A HEAD
change during the exact command yields `UNKNOWN`. After a successful verify,
an ordinary commit that leaves the frozen contract and scoped subject
unchanged preserves `FRESH`; a contract, plan-revision, or scoped-subject
change makes it `STALE`. `ohno task finish` is not a second bypass; V1 has only
the verification-driven close path.

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
replacement current plan. Because V1 is cooperative, it records
`LOCAL_REVIEW_RECORDED`; it does not claim Owner authorization/confirmation,
cryptographic human identity, or production review separation.

## Loop 4 — Resume and display

- `ohno status`: concise machine-stable current state and proof freshness.
- `ohno resume`: a human capsule with goal, completed summaries, current task,
  expected behavior, exact test, blocker, and next action.
- `ohno next`: exactly one action derived from the current ordered plan;
  terminal state is `PROJECT_COMPLETE`, while blocked or active states may
  report `NONE`.
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
- the task is being marked complete without a fresh receipt whose separately
  calculated staged-subject digest matches the verified subject digest.

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
- Completed linear plan: display `PROJECT_COMPLETE`; blocked or active states
  may display `NONE`; never accept caller-supplied free-text next authority.
- Hook unavailable: display the limitation and keep CLI/Git controls usable.

## Security and privacy

V1 stores project-local operational data only. It does not upload transcripts,
source, prompts, or test output. Test commands execute with the user's normal
local authority. The installer shows every hook it will add.

## Deliberately absent

There is no grant service, effect gateway, append-only journal, adapter trust
grade, control-plan DAG, event bus, policy engine, or migration framework.
Those concepts do not solve a current V1 public acceptance test.
