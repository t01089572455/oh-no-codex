# Automatic execution after plan readiness

Status: Owner-approved direction, awaiting written-spec review

Date: 2026-08-04

## Decision

Oh No has one workflow. There is no `guided` mode and no mode switch:

```text
PREPARE -> ACTIVE_AUTO -> COMPLETE
                    |
                    `-> NEEDS_INPUT -> ACTIVE_AUTO
```

Before implementation, Codex resolves material ambiguity, prepares the plan,
and makes its acceptance visible in the Cockpit. After an authorized plan is
accepted, Codex works to completion under Oh No without asking the Owner to
start, continue, verify, or advance each task.

Oh No remains a cooperative honesty harness. It constrains scope, runs exact
proof, and exposes drift; it does not become a decision engine, scheduler,
daemon, security boundary, or governance platform.

## PREPARE behavior

During PREPARE, Codex must:

1. retain the Owner's original inputs;
2. consolidate the current goal, constraints, non-goals, and acceptance;
3. inspect the repository and resolve every ambiguity that would materially
   change the user-visible result;
4. prepare the bounded linear plan and display it in the Cockpit;
5. ensure the cursor can be executed before accepting the plan.

Reversible implementation details are Codex decisions and do not justify a
question. Codex asks only when two reasonable interpretations would produce
materially different user outcomes.

An Owner instruction such as "plan and finish this" already authorizes
implementation. Codex must not ask for the same authorization again after it
prepares the plan. If the Owner explicitly asks for planning only, Codex leaves
the proposal unaccepted and does not enter ACTIVE_AUTO.

`ohno plan accept` remains the deterministic PREPARE/ACTIVE_AUTO boundary.
It records cooperative local activation, not authenticated Owner identity.
Existing `task start`, `verify`, and `next` commands remain implementation
primitives, not recurring user decisions.

## ACTIVE_AUTO behavior

Once a plan is accepted, Codex automatically:

1. starts the frozen cursor task;
2. works only inside its contract;
3. runs the exact black-box command;
4. diagnoses and repairs `FAIL`, `UNKNOWN`, or stale evidence;
5. records fresh PASS and advances exactly once;
6. starts the next plan item;
7. refreshes the existing projections and Cockpit;
8. stops only at `PROJECT_COMPLETE` or a real `NEEDS_INPUT` condition.

The existing Stop hook is extended, not replaced. For an accepted,
non-terminal plan, Stop returns one continuation containing the canonical next
action even when the assistant did not emit a completion marker. The
continuation tells Codex to keep working without asking the Owner and carries
a reserved `OHNO_AUTO_CONTINUE` prefix so prompt capture cannot mislabel it as
Owner prose. The hook allows a stop at `PROJECT_COMPLETE`.

For a genuinely unavailable account, secret, device, business fact, honest
acceptance path, or platform permission, Codex may use the exact cooperative
marker `OHNO_NEEDS_INPUT:<active-task-id>` and state the missing input. The
Stop hook allows that message instead of creating an infinite continuation
loop. This marker is an honest escape hatch, not proof of the blocker or a new
runtime authority.

The hook does not run tests or mutate product files itself. Codex continues to
call the existing CLI primitives, so `.ohno/state.json` remains the sole
runtime authority.

## Owner inputs and requirements

Two files have different, explicit roles:

### `.ohno/OWNER-INPUTS.md`

- A trusted `UserPromptSubmit` hook appends the exact multiline `prompt` with
  timestamp, session id, turn id, and a stable input id.
- Entries are append-only and preserve the exact prompt text plus its SHA-256;
  Markdown framing is not part of the prompt digest.
- Oh No-generated Stop continuations carry a reserved marker and are not
  recorded as Owner input.
- The file is local/private by default and is never automatically committed or
  published. New sessions in the same project can read it.
- It is evidence of what was said, not a claim that every prompt is a final
  requirement.

### `.ohno/REQUIREMENTS.md`

- Contains Codex's current consolidated interpretation of active goals,
  constraints, non-goals, and decisions.
- Material entries reference their originating OWNER-INPUTS ids.
- Superseded interpretations remain visible instead of being silently erased.
- Existing live projection and Truth applicability behavior remains unchanged.

Oh No does not claim perfect semantic classification. During PREPARE, Codex
uses the raw record to prepare the interpretation and plan. Plan acceptance is
the single activation boundary. During ACTIVE_AUTO, a clear new Owner
instruction is itself the change authorization; Codex runs the existing
requirement-change synchronization automatically and does not ask for a second
confirmation. Only genuinely ambiguous new intent produces `NEEDS_INPUT`.

Automatic prompt capture is cooperative: it covers prompts delivered through
a trusted Codex `UserPromptSubmit` hook after installation. It cannot recover
older prompts or cover another client or a deliberately bypassed hook.

## Task sizing

An Oh No task is one independently provable user outcome, not one coding step.

- Split only when outcomes can pass independently.
- Keep file edits, refactors, documentation, Git operations, and implementation
  steps as Codex's internal checklist unless they independently prove a user
  result.
- Keep one exact closing black box per task.
- Treat the existing 30-90 minute target and heuristic size checks as PREPARE
  guidance, not ACTIVE_AUTO blockers.
- Structural omissions, acceptance-basis mismatch, missing proof, and scope
  expansion remain fail-closed because they directly affect honest delivery.
- If implementation reveals a poor split, Codex may revise the split without
  Owner confirmation only when goal, acceptance, non-goals, and allowed scope
  do not expand. Otherwise it is a material change.

No task-size classifier, NLP authority, DAG, or new policy language is added.

## Real interruption conditions

ACTIVE_AUTO may request Owner input only when:

- two reasonable interpretations produce materially different outcomes;
- a required account, secret, device, or business fact is unavailable;
- an unapproved destructive, paid, publication, or external-message action is
  required;
- no honest executable acceptance path exists;
- state corruption or platform permissions prevent progress.

Ordinary failure, task transition, test execution, implementation choice,
in-scope repair, and projection refresh are not confirmation points. Oh No
cannot suppress Codex or operating-system security approvals; it only removes
its own conversational approval ceremony.

## Minimum implementation boundary

Implement this as one correction slice using the existing package and state
machine:

- add `UserPromptSubmit` to the installed hook template;
- add atomic append/read support for `.ohno/OWNER-INPUTS.md`;
- extend the existing Stop handler to continue canonical non-terminal actions;
- update the control/plan/requirements skills so PREPARE questions happen
  before plan acceptance and accepted plans run without recurring prompts;
- convert heuristic weak-plan/size findings to PREPARE warnings while keeping
  structural and acceptance-integrity failures hard;
- expose the automatic lifecycle plainly in README and Cockpit copy only where
  existing surfaces already show current status.

Do not add a new state store, execution service, background process, mode,
authentication adapter, dependency, or general-purpose planner.

## Public black-box acceptance

One new public black box must prove:

1. `UserPromptSubmit` records an exact multiline Owner prompt once;
2. concurrent prompt submissions preserve every successful entry;
3. an Oh No synthetic continuation is not recorded as Owner prose;
4. an accepted plan at `START_TASK`, active `CONTINUE_ACTIVE`, failed/stale
   proof, and a newly advanced cursor all receive automatic continuation
   without an Owner-confirmation request;
5. `PROJECT_COMPLETE` and an exact task-bound `OHNO_NEEDS_INPUT` message may
   stop;
6. heuristic task-size/weak-plan findings do not require an override flag;
7. structural contract, acceptance-basis, scope, and fresh-PASS protections
   remain unchanged.

Final verification runs the owning black box, typecheck, build, the existing
black-box suite once at the frozen boundary, and `git diff --check`. Publishing
or releasing remains separately Owner-authorized.
