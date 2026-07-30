# Oh No, Codex! agent contract

This repository is a clean Codex-only product. Historical VibeTether
repositories are reference material only and cannot override this file or the
current documents below.

## Required reading order

Before planning, implementing, reviewing, resuming, or accepting work, read:

1. `docs/PRODUCT-CONTRACT.md`
2. `docs/DESIGN.md`
3. `docs/ACCEPTANCE.md`
4. `docs/IMPLEMENTATION-PLAN.md`
5. the exact public black-box test owned by the current plan slice

Do not infer current status from a chat summary, branch name, issue title,
historical report, or agent message.

## Current status and authorization

Status is `DESIGN_FROZEN_IMPLEMENTATION_NOT_STARTED`.

The Owner authorized Tasks 1 through 7 in
`docs/IMPLEMENTATION-PLAN.md` on 2026-07-30. A clean implementation task may
execute those slices sequentially without asking for permission after every
green test. That authorization does not include an eighth task, a design
rewrite, Claude support, publication, package release, or changes to another
repository.

The exact first action is:

> Task 1 — write the failing public black-box test for the task-start contract,
> then implement only enough Node.js/TypeScript CLI and atomic state support to
> make that test pass.

## Working rules

- Use a clean Git branch or isolated worktree. Record the real path, branch,
  exact commit, tree, and clean/dirty state at handoff.
- Freeze the current slice's expected user-visible behavior, one public
  black-box test, allowed files, time budget, and stop condition before source
  edits.
- Run the smallest owning test during a slice. Do not use the full suite as a
  diagnostic; it belongs at the final boundary named in the plan.
- A failed test stays failed. Do not weaken, delete, skip, or replace public
  acceptance to make implementation look green.
- A passing slice updates the plan ledger and exact next action in the same
  commit. README changes only when public capability truth changes.
- Review and audit are read-only unless the Owner explicitly asks for fixes.
- A recommendation, reviewer idea, or next-action field is not authorization to
  broaden scope.
- Never claim complete from an agent report, test count, mocked path, or stale
  PASS receipt. Name the exact command and scope of every claim.

## Anti-overdesign rules

- Preserve the Owner's words. Resolve ambiguity with the smallest behavior that
  satisfies the frozen public acceptance.
- V1 is one package, one executable, one atomic current-state file, one Truth
  applicability file, one project hook config, one Git hook, and one local
  read-only Cockpit.
- Do not add a database, daemon, hosted service, event authority, policy
  language, plugin platform, provider abstraction, multi-agent scheduler, or
  generalized writer gateway.
- Do not add an abstraction, dependency, module, or state transition unless the
  current failing public test requires it. Record the failure it solves.
- Keep slices between roughly 30 and 90 minutes. Split work when a trust
  boundary or independently visible outcome changes; do not split mechanical
  details into ceremony.
- When the frozen acceptance passes and the slice ledger is synchronized, stop
  that slice. Proceed only to the next already-authorized plan item.

## Truth and completion

- `.ohno/state.json` will be the sole current runtime authority.
- `.ohno/truth.json` will be the Owner-maintained governing-document
  applicability list.
- Resume text, progress output, hooks, receipts, and Cockpit are projections or
  evidence. They cannot become a second source of current truth.
- A PASS receipt is fresh only for its exact task contract, command, HEAD, and
  digest of allowed files. A later relevant mutation invalidates it.
- Use `OHNO_COMPLETE:<active-task-id>` only after the exact `ohno verify`
  command succeeds. It is a cooperative Stop-hook marker, not proof by itself.
- Requirement changes block implementation until the exact applicable
  governing-document diff is reviewed and the stale plan is replaced.
- The product is cooperative. Codex hooks and Git hooks are guardrails, not a
  hostile same-user security boundary.

## UI method

Cockpit work has three boundaries:

1. use `frontend-design-ui-ux` to produce the locked design contract;
2. use `frontend-design` to implement that contract;
3. perform browser-based visual, responsive, accessibility, and functional
   acceptance against the running product.

`ui-ux-pro-max` is catalog-only and must never be credited as implementation.
Do not write Cockpit code before Task 6A is committed.

## Final boundary

After Task 7, run the exact final commands in `docs/ACCEPTANCE.md`, verify the
performance budgets on disposable project copies, update public status
honestly, and stop. Do not publish npm packages or create a release unless the
Owner separately authorizes it.
