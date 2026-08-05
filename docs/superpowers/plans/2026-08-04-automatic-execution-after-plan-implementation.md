# Automatic Execution After Plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every accepted Oh No plan continue automatically through start, work, proof repair, verification, and cursor advance while preserving exact Owner prompt evidence and every existing honesty boundary.

**Architecture:** Keep `.ohno/state.json` and the existing read model as the only runtime authority. Add one focused, lock-protected append-only prompt asset for trusted `UserPromptSubmit`, then extend the existing Stop hook to return an `OHNO_AUTO_CONTINUE` prompt containing the canonical `next_action` for accepted non-terminal plans; no hook runs tests or mutates product code. Convert only heuristic plan-quality gates to PREPARE warnings, while structured contract, acceptance-basis, allowed-scope, and fresh-PASS checks remain unchanged.

**Tech Stack:** Node.js 22.20+, TypeScript ESM, Node built-ins (`crypto`, `fs/promises`), existing PID-token locks, official Codex project hooks, Node test runner, vanilla Cockpit copy.

**Execution status:** `LOCAL_PASS`, with a post-commit same-batch LIVE
P01–P06 `TRIAL_PASS`. The checklist below records the executed correction;
final identity and cleanliness are proven immediately after the single scoped
local commit.

---

## Frozen correction slice

- **Expected user-visible behavior:** A trusted Codex prompt hook preserves exact multiline Owner prompts in local/private `.ohno/OWNER-INPUTS.md`; after a plan is accepted, Codex receives canonical automatic continuations without recurring Owner confirmation until `PROJECT_COMPLETE` or an exact task-bound `OHNO_NEEDS_INPUT:<id>` escape hatch. Weak-plan and size heuristics warn during PREPARE but never require an override; structural and evidence gates remain fail-closed.
- **Owning public black box:** `test/blackbox/automatic-execution-after-plan.test.mjs`
- **Exact command:** `node --test test/blackbox/automatic-execution-after-plan.test.mjs`
- **Allowed files:** `src/owner-inputs.ts`, `src/hooks/codex.ts`, `src/hooks/precommit.ts`, `src/read-model.ts`, `src/cockpit/server.ts`, `src/requirements.ts`, `src/discipline.ts`, `src/cli.ts`, `src/install.ts`, `src/truth.ts`, `src/control-protocol.ts`, `templates/.codex/hooks.json`, `assets/cockpit/cockpit.js`, `skills/oh-no-{control,plan,requirements,task,verify,next,change}/SKILL.md`, `test/blackbox/automatic-execution-after-plan.test.mjs`, compatibility assertions in `test/blackbox/{atomic-state,codex-hooks,git-precommit,field-trial-fixes,release-honesty}.test.mjs` and `test/trials/real-project-trial.mjs`, the same-copy browser measurement fixture `test/browser/measure-p06.mjs`, regenerated current-package receipts in `test/evidence/{task7-real-project-trials,p06-browser-receipt}.json`, `docs/{PRODUCT-CONTRACT,DESIGN,ACCEPTANCE,IMPLEMENTATION-PLAN}.md`, `README.md`, `README.zh-CN.md`, and this plan. `src/hooks/precommit.ts` is included only to remove its obsolete claim that a heuristic warning requires an Owner override; its active-contract/fresh-PASS gate is unchanged. Stop fixtures may only switch their obsolete empty result to the canonical accepted-plan continuation. The installer fixture uses an isolated disposable HOME to avoid cross-file skill-install races while preserving the same template assertions. `src/read-model.ts` may only replace four handoff Git processes with one status/branch identity process plus the existing tree lookup after the frozen P01 RED; field semantics stay unchanged. `src/cockpit/server.ts` may only extend existing HTTP keep-alive past a loaded verify after two exact gate `ECONNRESET` failures; no API, polling, state, or UI behavior changes. Evidence files may change only through the existing three-copy P01–P06 scripts after the package-subject honesty test detects drift. `test/browser/measure-p06.mjs` may only align its English/Chinese continuation expectation with the already-accepted Cockpit copy after an exact P06 RED; no timeout, sample count, or budget may change.
- **Budget:** 75 minutes for the correction slice, plus one frozen full-suite boundary.
- **Stop condition:** Owning black box, typecheck, build, one `npm test`, and `git diff --check` pass; the ledger is synchronized in the same scoped local commit; branch/worktree identity is exact and clean. No push, merge, tag, package publication, release, daemon, scheduler, state schema, mode, auth layer, or runtime dependency.

## File map

- `test/blackbox/automatic-execution-after-plan.test.mjs`: sole new public denominator for prompt capture, automatic Stop continuation, real stop conditions, warning-only heuristics, and regression of existing honesty gates.
- `src/owner-inputs.ts`: exact prompt hashing, stable input id, duplicate suppression, lock-protected atomic append, dynamic Markdown fence selection, and read support for `.ohno/OWNER-INPUTS.md`.
- `src/hooks/codex.ts`: validate and dispatch `UserPromptSubmit`; exclude reserved synthetic continuations; reuse `readState` + `readModel` to decide Stop continuation.
- `templates/.codex/hooks.json`, `src/install.ts`: install and disclose the fifth trusted project hook without changing trust claims.
- `src/discipline.ts`, `src/cli.ts`, `src/control-protocol.ts`, `src/hooks/precommit.ts`: make heuristic weak-plan findings warning-only and remove recurring override guidance while retaining the real active-contract/fresh-PASS pre-commit gate and hidden flag compatibility.
- `src/requirements.ts`, `src/truth.ts`: explain the two evidence roles on every projection and ignore raw prompt history by default.
- `skills/oh-no-*.md`, READMEs, stable contracts, and Cockpit copy: describe PREPARE versus accepted-plan auto execution honestly without creating another state field.
- Existing black boxes listed above: mechanical expectation updates only where the Owner-approved behavior supersedes an old manual-confirmation or four-hook assertion.

### Task 1: Write and record the owning public RED

**Files:**
- Create: `test/blackbox/automatic-execution-after-plan.test.mjs`
- Read: `test/helpers/blackbox.mjs`

- [x] **Step 1: Add black-box hook helpers using the packaged CLI**

```js
function hookInput(cwd, hook_event_name, fields = {}) {
  return {
    session_id: "session-auto-plan",
    transcript_path: null,
    cwd,
    hook_event_name,
    model: "test-model",
    permission_mode: "default",
    ...fields,
  };
}

function runHook(cwd, hook_event_name, fields = {}) {
  return spawnSync(process.execPath, [cliPath, "hook"], {
    cwd,
    encoding: "utf8",
    input: `${JSON.stringify(hookInput(cwd, hook_event_name, fields))}\n`,
  });
}

function stop(cwd, message) {
  const result = runHook(cwd, "Stop", {
    turn_id: "turn-stop",
    stop_hook_active: false,
    last_assistant_message: message,
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}
```

- [x] **Step 2: Add exact prompt, retry de-duplication, concurrency, and synthetic-exclusion cases**

````js
const prompt = "  Owner first line\n```json\n{\"keep\":true}\n```\nOwner final line  ";
const submitted = runHook(projectPath, "UserPromptSubmit", {
  turn_id: "turn-owner-1",
  prompt,
});
assert.equal(submitted.status, 0, submitted.stderr);
const first = await readFile(resolve(projectPath, ".ohno", "OWNER-INPUTS.md"), "utf8");
assert.ok(first.includes(prompt));
assert.match(first, new RegExp(createHash("sha256").update(prompt).digest("hex")));

const retry = runHook(projectPath, "UserPromptSubmit", {
  turn_id: "turn-owner-1",
  prompt,
});
assert.equal(retry.status, 0, retry.stderr);
assert.equal(await readFile(resolve(projectPath, ".ohno", "OWNER-INPUTS.md"), "utf8"), first);
````

Use the packaged CLI concurrently and require every successful entry to survive:

```js
const children = Array.from({ length: 24 }, (_, index) => new Promise((done) => {
  const child = spawn(process.execPath, [cliPath, "hook"], {
    cwd: projectPath,
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += String(chunk); });
  child.on("exit", (code) => done({ code, stderr }));
  child.stdin.end(`${JSON.stringify(hookInput(projectPath, "UserPromptSubmit", {
    turn_id: `turn-race-${index}`,
    prompt: `exact-race-prompt-${index}`,
  }))}\n`);
}));
const results = await Promise.all(children);
assert.deepEqual(results.filter(({ code }) => code !== 0), []);
const raced = await readFile(resolve(projectPath, ".ohno", "OWNER-INPUTS.md"), "utf8");
for (let index = 0; index < 24; index += 1) {
  assert.ok(raced.includes(`exact-race-prompt-${index}`));
}
assert.equal(new Set(raced.match(/^## Input `([a-f0-9]{64})`$/gm)?.map((line) => line.slice(9, -1))).size, 25);
```

Submit `OHNO_AUTO_CONTINUE\nCANONICAL_NEXT: START_TASK:auto-1` and require byte-for-byte file equality before and after.

- [x] **Step 3: Add accepted-plan continuation and terminal-stop cases**

Use a two-task reviewed plan whose first command initially exits non-zero. Assert these exact projections in the Stop reason:

```js
assert.match(stop(projectPath, "Plan accepted").reason,
  /^OHNO_AUTO_CONTINUE\n[\s\S]*CANONICAL_NEXT: START_TASK:auto-1/m);
assert.match(stop(projectPath, "Working").reason,
  /CANONICAL_NEXT: CONTINUE_ACTIVE:auto-1/);
assert.match(stop(projectPath, "Test failed").reason,
  /PROOF: FAIL[\s\S]*CANONICAL_NEXT: RUN_EXACT_TEST:auto-1/);
assert.match(stop(projectPath, "Proof drifted").reason,
  /PROOF: STALE[\s\S]*CANONICAL_NEXT: REOPEN_TASK:auto-1/);
assert.match(stop(projectPath, "First task passed").reason,
  /CANONICAL_NEXT: START_TASK:auto-2/);
assert.deepEqual(stop(projectPath, "All plan tasks passed"), {});
assert.deepEqual(
  stop(activeProject, "OHNO_NEEDS_INPUT:auto-1\nMissing paid service credential."),
  {},
);
```

Also require a wrong-id or prefixed `OHNO_NEEDS_INPUT` marker to continue, not stop.

- [x] **Step 4: Add warning-only heuristics and unchanged honesty-gate cases**

Propose a one-task docs/`git diff --check` plan, require WARN output, then accept it without `--allow-weak-plan`. In separate fixtures require: a structured-basis string mismatch refuses proposal, `allowed_files: ["**"]` refuses proposal, an out-of-scope `PreToolUse` patch is denied, and `OHNO_COMPLETE:<active-id>` before fresh PASS still returns a continuation naming fresh PASS/`ohno verify`.

- [x] **Step 5: Run the exact owning command and preserve the RED**

Run: `node --test test/blackbox/automatic-execution-after-plan.test.mjs`

Expected: non-zero because `UserPromptSubmit` is unsupported and creates no `.ohno/OWNER-INPUTS.md`, Stop without a completion marker returns `{}`, and weak-plan accept still requires `--allow-weak-plan`. The structural regression assertions must already fail closed rather than causing the RED.

### Task 2: Implement exact local Owner-input capture

**Files:**
- Create: `src/owner-inputs.ts`
- Modify: `src/hooks/codex.ts`
- Modify: `templates/.codex/hooks.json`
- Modify: `src/install.ts`
- Modify: `src/truth.ts`

- [x] **Step 1: Add a deterministic entry model and stable input id**

```ts
export const automaticContinuationPrefix = "OHNO_AUTO_CONTINUE";

export interface OwnerInput {
  sessionId: string;
  turnId: string;
  prompt: string;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function inputId(input: OwnerInput): string {
  return sha256([
    "ohno-owner-input-v1",
    input.sessionId,
    input.turnId,
    sha256(input.prompt),
  ].join("\0"));
}
```

- [x] **Step 2: Add lock-protected append-only atomic replacement**

Use `acquirePidTokenLock`/`releasePidTokenLock` on `.ohno/owner-inputs.lock`. Under the lock, read existing UTF-8 or initialize this exact role header, return without writing when `## Input \`<stable-id>\`` already exists, otherwise append metadata (`received_at`, JSON-encoded session/turn ids, prompt SHA-256, UTF-8 byte count) and the exact prompt inside a fence longer than any backtick run in the prompt. Write a same-directory unique temporary file, then `rename`; clean the temporary on failure. Export `readOwnerInputs(projectPath)` as a bounded direct UTF-8 read.

- [x] **Step 3: Dispatch trusted prompt capture and reject synthetic continuation provenance**

```ts
if (input.hook_event_name === "UserPromptSubmit") {
  if (
    typeof input.session_id !== "string"
    || typeof input.turn_id !== "string"
    || typeof input.prompt !== "string"
  ) {
    throw new Error("UserPromptSubmit requires session_id, turn_id, and prompt");
  }
  if (!input.prompt.startsWith(`${automaticContinuationPrefix}\n`)) {
    await appendOwnerInput(projectPath, {
      sessionId: input.session_id,
      turnId: input.turn_id,
      prompt: input.prompt,
    });
  }
  return {};
}
```

- [x] **Step 4: Install and disclose `UserPromptSubmit`**

Add one matcher-free `UserPromptSubmit` command group to `templates/.codex/hooks.json` using the same command, five-second timeout, and status message `Recording trusted Owner input locally`. Update both `src/install.ts` hook lists to `SessionStart, PostCompact, UserPromptSubmit, PreToolUse, Stop`; keep `COOPERATIVE_GUARDRAIL`, trust `UNVERIFIED`, and supported-local-path limitations unchanged. Add `OWNER-INPUTS.md` to the generated `.ohno/.gitignore` runtime/private entries.

- [x] **Step 5: Run the prompt-capture tests only**

Run: `node --test --test-name-pattern="Owner prompt|concurrent prompt|synthetic continuation" test/blackbox/automatic-execution-after-plan.test.mjs`

Expected: all selected prompt-capture tests pass; automatic Stop and weak-plan tests remain outside this filtered run.

### Task 3: Continue every accepted non-terminal plan automatically

**Files:**
- Modify: `src/hooks/codex.ts`
- Modify: `test/blackbox/codex-hooks.test.mjs`

- [x] **Step 1: Parse exact task-bound `OHNO_NEEDS_INPUT` markers**

Generalize the existing token-bounded marker parser so `OHNO_COMPLETE:<id>` and `OHNO_NEEDS_INPUT:<id>` share start-boundary and id validation. Only an exact needs-input marker whose id equals `state.active_task.id` returns `{}`; wrong ids and prefixed forms continue with an actionable reason.

- [x] **Step 2: Build the reserved continuation from the existing read model**

```ts
function automaticContinuation(model: ReadModel): HookOutput {
  return continuation([
    `PROOF: ${model.proof_freshness}`,
    `BLOCKER: ${model.blocker}`,
    `CANONICAL_NEXT: ${model.next_action}`,
    "Continue autonomously under the accepted plan. Do not ask the Owner for start, continue, verify, repair, or task-transition confirmation.",
  ].join("\n"));
}
```

- [x] **Step 3: Preserve proof checks, then auto-continue accepted plans**

Make the shared Stop `continuation(reason)` prepend `OHNO_AUTO_CONTINUE\n` so every Stop-generated synthetic prompt—including wrong-marker, missing-proof, migration, and normal canonical continuation paths—is excluded from Owner capture. In `handleStop`: load state/model once; keep unavailable-state, migration, malformed/wrong completion marker, and pre-PASS completion behavior fail-closed; allow exact task-bound needs input first; allow stop when `model.next_action === "PROJECT_COMPLETE"`; otherwise, if `state.plan_revision !== null`, return `automaticContinuation(model)` for `START_TASK`, `CONTINUE_ACTIVE`, `RUN_EXACT_TEST`, `REOPEN_TASK`, `FREEZE_TASK`, `SYNC_GOVERNING_DOCUMENTS`, or migration. With no accepted plan, retain PREPARE stop behavior so planning-only requests do not auto-enter implementation.

- [x] **Step 4: Mechanically update the old Stop-hook expectations**

Keep old completion-marker boundary tests. Change the old “missing marker stops” fixture to assert `OHNO_AUTO_CONTINUE` plus `CONTINUE_ACTIVE:<id>` after plan acceptance; add a no-plan fixture that still returns `{}`. Do not delete fresh-PASS, wrong-id, stale, state-unavailable, or scope-denial assertions.

- [x] **Step 5: Run the Stop lifecycle tests**

Run: `node --test --test-name-pattern="accepted plan|automatic continuation|Stop|NEEDS_INPUT|PROJECT_COMPLETE|failed proof|stale proof|advanced cursor" test/blackbox/automatic-execution-after-plan.test.mjs test/blackbox/codex-hooks.test.mjs`

Expected: every selected test passes with canonical next actions sourced from `readModel`; no test observes product-file mutation by the hook.

### Task 4: Make plan-quality heuristics PREPARE warnings and synchronize agent behavior

**Files:**
- Modify: `src/discipline.ts`
- Modify: `src/cli.ts`
- Modify: `src/control-protocol.ts`
- Modify: `src/hooks/precommit.ts` (message only; keep the gate)
- Modify: `skills/oh-no-control/SKILL.md`
- Modify: `skills/oh-no-plan/SKILL.md`
- Modify: `skills/oh-no-requirements/SKILL.md`
- Modify: `skills/oh-no-task/SKILL.md`
- Modify: `skills/oh-no-verify/SKILL.md`
- Modify: `skills/oh-no-next/SKILL.md`
- Modify: `skills/oh-no-change/SKILL.md`
- Modify: `test/blackbox/field-trial-fixes.test.mjs`

- [x] **Step 1: Remove only the heuristic accept refusal**

Keep `planSoftWarnings`, `denominatorShrinkSummary`, exact structured-basis checks, allowed-file bounds, and every plan structural validator. Make `assertPlanDiscipline` return without throwing for `WEAK_BLACKBOX` and `COMMIT_LICENSE_MICRO_PLAN`; retain the optional CLI flag as a tolerated compatibility input but remove it from help and generated instructions. The acceptance result remains `LOCAL_REVIEW_RECORDED`, never Owner identity.

- [x] **Step 2: Update the public compatibility fixture**

Change the field-trial test to require warning output and successful accept without `--allow-weak-plan`. Keep the doctor warning assertion so poor plan shape stays visible.

- [x] **Step 3: Encode PREPARE versus ACTIVE_AUTO in skills without adding a mode**

Use these exact behavioral rules across the seven skills:

```text
PREPARE: resolve material ambiguity, preserve raw Owner input, consolidate REQUIREMENTS, and review the exact basis/plan diff.
If the Owner authorized “plan and finish,” accept the reviewed plan without asking again.
If the Owner requested planning only, leave the proposal unaccepted.
After acceptance: execute task start, repair, verify, advance, and next task automatically until PROJECT_COMPLETE or a real NEEDS_INPUT condition.
Weak-size/plan-shape findings are warnings; contract/basis/scope/fresh-PASS failures stay hard.
```

Update `oh-no-change` so a clear new Owner instruction authorizes the existing change loop without a second conversational confirmation. Update `oh-no-next` so the locator is executed under the already accepted plan but never expands scope.

- [x] **Step 4: Run the discipline and skill-facing tests**

Run: `node --test --test-name-pattern="heuristic|micro-plan|weak plan|automatic" test/blackbox/automatic-execution-after-plan.test.mjs test/blackbox/field-trial-fixes.test.mjs`

Expected: warning-only heuristic cases pass without an override and hard-gate regression cases remain non-zero.

### Task 5: Explain the two files and automatic lifecycle on existing surfaces

**Files:**
- Modify: `src/requirements.ts`
- Modify: `assets/cockpit/cockpit.js`
- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Modify: `docs/PRODUCT-CONTRACT.md`
- Modify: `docs/DESIGN.md`
- Modify: `docs/ACCEPTANCE.md`
- Modify: `docs/IMPLEMENTATION-PLAN.md`
- Modify: `test/blackbox/git-precommit.test.mjs`
- Modify: `test/blackbox/release-honesty.test.mjs`

- [x] **Step 1: Correct REQUIREMENTS role text for new and existing projects**

In `ensureScaffold`, state that `.ohno/REQUIREMENTS.md` is Codex’s consolidated interpretation/history, must reference material `.ohno/OWNER-INPUTS.md` ids, and cannot prove which prompt is the final decision. In `renderProjection`, add an `Evidence roles` subsection so projector refresh corrects existing projects too: OWNER-INPUTS is trusted raw hook evidence; REQUIREMENTS is Codex interpretation; neither replaces `state.json`.

- [x] **Step 2: Update only existing Cockpit status copy**

Change the existing English and Chinese brand subtitle/footer/active hint to say that PREPARE resolves decisions and an accepted plan runs automatically under exact proof. Do not add a control, mode switch, field, route, state cache, or layout change.

- [x] **Step 3: Synchronize stable contracts and public README truth**

Document: one PREPARE-to-accepted-auto workflow; raw prompt capture limitations (trusted installed hook only, no older/other-client recovery); two-file roles; exact needs-input categories; warning-only size heuristics; Stop continuation as a cooperative prompt, not an executor; unchanged state authority and hard honesty gates. Update A08 and the required public-test layout with `automatic-execution-after-plan.test.mjs` rather than adding unrelated acceptance rows.

- [x] **Step 4: Add the correction ledger entry before the frozen gate**

Record `Correction 5 — automatic execution after accepted plan` with status `IN_PROGRESS`, the frozen behavior/command/files/budget/stop condition above, and one exact next action: run the owning black box. Do not claim LOCAL_PASS yet.

- [x] **Step 5: Mechanically update hook-count/copy assertions**

Require installed hooks to include `UserPromptSubmit` and public copy to distinguish `.ohno/OWNER-INPUTS.md` from `.ohno/REQUIREMENTS.md`. Preserve all existing trust, publication, package-version, and cooperative-limit assertions.

### Task 6: Verify the frozen slice, close the ledger, and commit once

**Files:**
- Modify: `docs/IMPLEMENTATION-PLAN.md`
- Verify: every allowed file in this plan

- [x] **Step 1: Run the owning black box**

Run: `node --test test/blackbox/automatic-execution-after-plan.test.mjs`

Expected: exit 0; every prompt-capture, continuation, terminal-stop, warning-only heuristic, and unchanged-gate case passes.

- [x] **Step 2: Run the minimum compile boundary**

Run: `npm run typecheck`

Expected: exit 0.

Run: `npm run build`

Expected: exit 0.

- [x] **Step 3: Run compatibility-owning black boxes before the final suite**

Run: `node --test test/blackbox/codex-hooks.test.mjs test/blackbox/git-precommit.test.mjs test/blackbox/field-trial-fixes.test.mjs test/blackbox/release-honesty.test.mjs test/blackbox/acceptance-denominator.test.mjs test/blackbox/correction-2.test.mjs test/blackbox/verify-finish.test.mjs`

Expected: exit 0; automatic behavior changes only the explicitly superseded expectations, while basis, scope, proof, trust, and release honesty remain green.

- [x] **Step 4: Freeze, then run the one allowed full-suite boundary**

Run: `npm test`

Expected: exit 0 for the complete public black-box suite. Do not use this command for diagnosis; if it fails, return to the smallest owning file.

- [x] **Step 5: Check patch integrity**

Run: `git diff --check`

Expected: exit 0 with no output.

- [x] **Step 6: Synchronize earned evidence**

Change Correction 5 to `LOCAL_PASS`, record the exact commands, exit codes, and test counts actually observed, and set exactly one next action: `STOP — AUTO_AFTER_PLAN_LOCAL_PASS; await separate Owner authorization for push, merge, tag, publish, or release.` Do not invent counts before the commands run.

- [x] **Step 7: Review scope and create one local commit**

Run: `git diff --name-only` and compare every path with the frozen allowlist. Then run:

```bash
git add -- <exact changed paths from git diff --name-only>
git commit -m "feat: automate accepted plan execution"
```

Expected: one local commit succeeds on `codex/auto-after-plan`; no push, merge, tag, publish, or release occurs.

- [x] **Step 8: Prove final identity and cleanliness**

Run: `git rev-parse HEAD`, `git rev-parse 'HEAD^{tree}'`, `git status --short`, and `git show --stat --oneline --decorate --no-renames HEAD`.

Expected: final HEAD/tree are recorded; `git status --short` has no output; commit paths equal the correction slice; final report names start HEAD `1d33676b8a6ec4ac57f79fb6c97f2bcc1c4aa36a`, start tree `92292a9f289e20f90b8d60a3601b89b76b1846e1`, exact verification scope/results, raw-capture and cooperative-hook limitations, and exactly one next step.

## Post-commit LIVE performance evidence refresh (2026-08-05)

After the Owner reported normal CPU load, fresh CPU samples were 5.04%, 5.91%,
and 4.99%. Batch `live-20260805T064039Z-834bc92` copied three pristine source
fixtures into new disposable directories and ran the existing real-project
trial. P01–P05 passed on WeChat miniprogram, React/Vite web, and Python service
copies. The maximum P04 capsule was 4025 bytes.

The first P06 run was a valid RED: its browser fixture still expected the old
manual continuation text and timed out during Trial A warm-up. Direct DOM
inspection proved the product already rendered the accepted automatic
work/repair/verify continuation with the correct ACTIVE state. The minimal
GREEN changed only the fixture's English and Chinese expected continuation;
it did not change product code, timeout, sample count, or budget. The same P06
command then passed all three copies at 112 ms, 120 ms, and 122 ms p95.

Before same-batch receipt merge, `npm run test:performance` exited 1 with 1/2
passing and `P06_PENDING_SAME_BATCH_BROWSER_MEASURE`. After exact identity,
batch, runtime-subject, stack, and copy checks, the merged evidence made the
same command exit 0 with 2/2 passing. README projection changes rebind only
`package_subject_sha256`; the measurements remain bound to the unchanged
`runtime_subject_sha256`. The follow-up stops after the smallest owning checks,
one scoped local evidence commit, and a clean worktree. It does not rerun the
already-frozen 160-test denominator or authorize push, merge, tag, publish, or
release.

Fresh closeout evidence: the P06 script syntax check exited 0; the Correction
2, release-honesty, and linear-plan-freshness black boxes passed 14/14;
`npm run test:performance` passed 2/2; `npm pack --dry-run` reported 71 intended
files; and `git diff --check` exited 0 with no output.
