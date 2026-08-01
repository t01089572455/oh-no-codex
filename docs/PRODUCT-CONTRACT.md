# Product contract

Frozen by the Owner on 2026-07-30.

## One-sentence product

Oh No, Codex! is a fast, cooperative harness that keeps a Codex vibe-coding
project aligned by requiring one bounded task, one user-visible black-box test,
fresh completion evidence, accurate requirement-document synchronization, and
one next action.

## User problem

Codex can write useful code while still making the project worse: it can
reinterpret a request, expand the architecture, continue after completion,
revive stale plans, pass internal tests that miss the user experience, or leave
the next session reconstructing state from prose.

The product succeeds when a new Codex session can answer, quickly and from
project assets:

- What is the Owner trying to achieve?
- What is already complete?
- What is the one active bounded task?
- What exact user-visible behavior and black-box test define success?
- What is blocking work?
- What is the one next action?

## V1 user

A developer using Codex locally in an ordinary Git repository for vibe coding.
The developer is cooperative and wants low-friction guardrails, not an
adversarial security boundary.

## Required outcomes

### O1 — Bounded start

Implementation cannot begin through supported Codex mutation paths unless a
locally reviewed linear plan contains `plan_revision`, `ordered_tasks`, a
single `cursor`, and stable task identifiers. The cursor task must freeze:

- the Owner's goal;
- a stable task identifier;
- expected user-visible behavior;
- one exact minimal black-box command;
- a stop condition;
- allowed file globs;
- a time budget.

Future tasks may remain `OUTLINE` with only id, title, and goal. An outline at
the cursor cannot start; its only next action is `FREEZE_TASK:<id>`. `task
start` takes no caller-supplied contract fields and activates only the frozen
cursor contract.

### O2 — Evidence-bound finish

The exact black-box command decides the task:

- non-zero or unknown result keeps it active;
- zero creates a PASS receipt bound to the exact task contract, plan revision,
  command, HEAD provenance, and digest of allowed files;
- a HEAD change during verification makes the result `UNKNOWN`;
- after verification, a later ordinary commit alone preserves freshness while
  a changed contract, plan revision, or scoped subject makes it stale;
- a fresh PASS closes the task, advances the cursor once, and derives the next
  action from `ordered_tasks` or returns `PROJECT_COMPLETE`.

### O3 — Honest requirement change

An Owner-authored change selects concerns from `.ohno/truth.json`. Matching
governing documents—and all documents when no concern is safely selected—form
the required sync set. The harness shows their exact Git diff before
acceptance. Coding stays blocked until review and plan replacement finish.

Plan proposal and acceptance record only `LOCAL_REVIEW_RECORDED`, bound to the
exact revision, diff digest, HEAD, and time. They never claim independent
Owner identity, authorization, or confirmation. A malicious same-user Agent
can bypass these cooperative files and hooks; that remains an explicit
non-goal.

The harness coordinates and verifies coverage; Codex still performs semantic
writing. V1 does not claim that an LLM can autonomously prove document meaning.

### O4 — Instant recovery

`status`, `resume`, `next`, session hooks, and Cockpit read the same atomic
state. They show the current goal, completed summaries, current task, exact
test and proof freshness, blocker, and one next action without scanning the
entire repository.

### O5 — Visible control

The Cockpit makes current work and proof legible without becoming a second
authority. It must be distinctive, responsive, keyboard accessible, and
accepted through the running browser surface.

## Ten executable rules

The eighteen audited failure patterns collapse into ten product rules, not
eighteen subsystems:

1. Owner semantics win; ambiguity cannot silently broaden scope.
2. Every task has one bounded contract before mutation.
3. Acceptance ends the task; a next action is not new permission.
4. Review is read-only unless fixes are explicitly authorized.
5. Current canonical state outranks summaries and historical plans.
6. Completion requires fresh exact evidence, never agent prose.
7. The public user-visible black box outranks internal green paths.
8. Simplicity and latency budgets are acceptance criteria.
9. Workspace and handoff identity are exact and reproducible.
10. Confirmed failures become executable constraints or regression tests.

## Hard complexity budget

V1 may contain:

- one Node.js 22.20+ TypeScript package;
- one `ohno` executable;
- `.ohno/state.json` as sole current runtime state;
- `.ohno/truth.json` as Owner-maintained document applicability;
- project-local Codex hooks and one Git `pre-commit` hook;
- one local HTTP server for a read-only vanilla web Cockpit.

V1 may not contain:

- a database, background daemon, hosted service, queue, or second event store;
- a policy DSL, plugin/provider framework, multi-agent scheduler, or generic
  effect gateway;
- autonomous production identity or CI/Owner trust claims;
- full-repository scans or full-suite runs on normal commands;
- Claude integration;
- npm publication or release automation.

Runtime dependencies should remain zero unless a failing public acceptance test
demonstrates that a Node built-in cannot meet the contract. Development
dependencies are limited to TypeScript and the minimum build tooling.

## Explicit non-goals

- Preventing a malicious same-user agent from bypassing hooks.
- Intercepting every hosted or specialized Codex tool path.
- Proving semantic correctness of generated prose.
- Enterprise governance, compliance, audit certification, or role separation.
- Migrating every capability from VibeTether RC3/R3/RC5.
- Sealed replay, release certification, or production Review/CI adapters.
- Guaranteed absolute correctness or speed.

## Capability language

Use these labels:

- `PLANNED`: frozen design, no implementation evidence.
- `LOCAL_PASS`: exact local black-box evidence only.
- `TRIAL_PASS`: accepted on the named disposable real-project copies.
- `UNAVAILABLE`: not implemented or not supported.

Never use `production`, `fully enforced`, `secure`, `complete`, or `release
ready` unless a later Owner-approved contract defines and earns that term.

## Performance contract

- `status` and `next`: local p95 below 250 ms.
- `resume`: local p95 below 500 ms.
- injected resume capsule: below 4 KiB.
- task-start harness overhead: below 2 seconds, excluding the user's test.
- state-to-Cockpit reflection: below 250 ms.
- normal paths read bounded state and named files only.

Task 7 recorded measurements on three disposable project copies. Public status
is split: core harness `ANTI_DRIFT_CORE_WORKS` vs release
`RELEASE_CHANGES_REQUIRED` until every A/P row and public surface is honest.
Exact p95 values live in the implementation ledger and README evidence table.
Those remain local trial results, not a universal speed guarantee.

## Authority order

1. The Owner's latest explicit decision.
2. This product contract.
3. `docs/DESIGN.md`.
4. `docs/ACCEPTANCE.md`.
5. `docs/IMPLEMENTATION-PLAN.md`.
6. The current public black-box test.

Lower items may make higher items more precise but cannot expand or contradict
them. README is a public projection and must stay honest.
