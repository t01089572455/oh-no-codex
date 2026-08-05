# Oh No harness — Owner vision (unified scheme)

Status: **Owner-stated product north star** (2026-08-05; fidelity-patched after
Owner review). Implementation must stay **simple**: few human commands, no
parameter museum, intervene only at critical moments via state + cooperative
hooks.

---

## 1. Core (Owner words)

**Oh No’s job is to keep Codex bound to Truth** — guide it to **read** governing
material and the frozen task before deciding; forbid freestyle autonomy that
ignores Truth. That is anti-drift. That is the harness.

Not: limit model capability, cap plan length, or force the Owner through a
large CLI.

**Human surface ≈ cut away.** Internal automatic control (hooks, skills, verify)
does the work. Owner talks to Codex; Oh No only **hands on at critical
moments**.

---

## 2. Lifecycle (canonical)

```text
[0] SETUP — once per repo (install hooks + skills)

[1] DISCOVER — Codex as PM / requirements researcher
      Clarify *all* demand details before product coding
      Tech/architecture: Codex decides (vibe-coding Owner)
      Every Owner prompt: verbatim capture (raw Truth)
      Confirmed conclusions: Truth system (with supersession)
      Conflict: latest Owner words win
      Gate: requirements not clarified → no product implementation

[2] DESIGN — detailed design + full route (one-shot OK)
      From Truth + Owner words
      Oh No sets how explicit each step must be (contract shape),
      not how short the roadmap is

[3] EXECUTE — one frozen task at a time (context will grow)
      Each task: full detail for the slice (at least expect + hard test + scope)
      Implement in scope; done only when real test + user-visible function pass

[4] RECOVER — drift / black-box fail
      MUST read Truth + design + contract first
      Then decide: implementation wrong vs plan/design wrong
      Auto-adjust; do not ask Owner by default
      (Only Owner-only facts: secrets, devices, business unknowns)

[5] CHANGE — new or changed requirements
      Under harness, re-walk: re-clarify → update design → update plan
      → update expected tests → execute again
      Old plan must not silently authorize the new direction
```

---

## 3. Truth system (Owner wording)

- **All Owner prompts** are immutable raw evidence (verbatim).  
- **Confirmed interaction outcomes** also belong to the Truth system.  
- Interpreted notes (e.g. REQUIREMENTS) must not overwrite raw Owner words.  
- **Latest Owner words win** on conflict.  
- Design docs and acceptance materials used for the project must be on the
  Truth applicability list when they govern work.

---

## 4. Critical moments only (implementation principle)

Oh No **only forces control** when it matters:

| Moment | Control |
| --- | --- |
| No accepted active work (PREPARE) | Hooks: allow Truth / requirements / design / `.ohno` plan files; **deny product code** |
| Active task | Hooks: **scope fence** on mutations |
| Document sync / change pending | Hooks: only required paths |
| Stop under accepted plan | Short continue card; auto work/verify/repair |
| FAIL / UNKNOWN / STALE | Continue card: **must re-read Truth** then decide implement vs plan |
| Soft / fake black box | Refuse plan accept (Owner override only) |
| Requirement change | Invalidates stale authority; re-walk pipeline (skill + change path) |

No extra Owner parameters for normal flow. No stage DSL for humans.

---

## 5. Human vs machine surface

**Human (target):**

```text
npm i -g oh-no-codex
cd <repo> && ohno setup
# talk to Codex only
ohno   # optional one-screen where-am-I
```

**Machine:** prompt capture, PreToolUse, Stop continue, plan/task/verify invoked
by skills/hooks.

---

## 6. Task minimum (not a parameter tax)

Per frozen task at least: `id`, `expect`, `test`, `scope`.  
May carry more detail and design links. Plan **length unrestricted**.

Done = **tests pass and user-visible function passes** (black box must express
function; no soft deferral theatre).

---

## 7. Anti-drift success

1. Work justified by Truth, not freestyle.  
2. No broad coding before requirements clarified.  
3. Each slice: expect + hard test + scope.  
4. Fail/drift → read Truth first, then auto-adjust.  
5. Change → re-clarify → design → plan → expected tests.  
6. Done = real proof, not agent prose.

---

## 8. Implementation mapping (not Owner prose — eng only)

Existing: `state.json`, OWNER-INPUTS hook, truth.json, verify, soft-box refuse,
scope PreToolUse, Stop OHNO_CONTINUE, change begin/diff/accept, bare `ohno`.

Ship toward this vision by:

1. PREPARE path allows Truth/docs/requirements writes; still blocks product src.  
2. Stop REPAIR text: Truth-first + implement-vs-plan + auto-adjust.  
3. Skills + control protocol = this lifecycle only.  
4. `ohno setup` = init + install + skill install.  
5. Default help stays daily-first, not a museum.

No new daemon, DB, policy language, or plan-count caps.

---

## 9. Source

Owner messages: human surface cut + internal auto; Codex-as-PM then design then
execute; all prompts as Truth, latest wins; full route OK; tasks detailed;
problem → read design/Truth, implement vs plan; Oh No steers read-not-guess;
test+function pass; change → re-walk; black-box fail → must read Truth first.
