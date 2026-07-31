# Codex's eighteen sins

> A public, privacy-scrubbed failure audit behind Oh No, Codex!

This is not a scientific prevalence study and it is not a claim that every
Codex run fails in these ways. It is a product-design incident review: repeated
failure patterns observed while using coding agents across long-running,
multi-session work.

This document names **Codex’s eighteen sins**: eighteen distinct audited
patterns. Keeping all eighteen is more honest than compressing them to fit a
shorter title.

## Evidence boundary

The source audit covered one local session corpus:

- 2,415 JSONL files;
- 24.08 GiB;
- 8,413,352 lines;
- 184 top-level tasks;
- 2,177 delegated-agent transcripts;
- 53 legacy conversations;
- one empty file.

Those numbers describe that corpus only. They do not measure all users or all
Codex versions. The public edition excludes raw session identifiers, user
identity, email, local paths, private repository names, proprietary source, and
verbatim private prompts. The patterns below are paraphrased.

## 1. Semantic usurpation / 越俎代庖

**Pattern:** The user states an outcome; the agent silently chooses a more
ambitious meaning and treats its interpretation as the requirement.

**Damage:** The code may be sophisticated while solving a problem the user did
not ask to own.

**Executable correction:** Preserve the owner's outcome verbatim in the active
task. Ambiguity selects the smallest satisfying behavior. A materially
different interpretation requires a visible decision.

## 2. Maximum interpretation / 把含糊词解释到最大

**Pattern:** Words such as "control," "complete," or "robust" are interpreted
at the highest imaginable assurance level. A lightweight harness becomes a
governance operating system.

**Damage:** Complexity, latency, failure surface, and review cost grow before
ordinary usefulness is proven.

**Executable correction:** Freeze explicit non-goals and a complexity budget.
No abstraction or subsystem exists without a current public RED that needs it.

## 3. Never stopping / 完成以后不停

**Pattern:** After the requested acceptance passes, the agent treats a roadmap,
recommendation, or "next action" as authorization to continue.

**Damage:** A successful task turns into unauthorized edits, extra commits, or
an entirely different implementation phase.

**Executable correction:** Acceptance closes the task. `next` is a locator,
not permission. Only already-authorized plan slices may proceed.

## 4. Review becomes edit authority / 把审查当修改权

**Pattern:** A request to inspect, diagnose, or audit is taken as permission to
fix, refactor, rewrite, dispatch reviewers, or commit.

**Damage:** The reviewer destroys the evidence it was asked to evaluate and
changes external state without consent.

**Executable correction:** Review paths are read-only. Findings and suggested
patches are separated from mutation authority.

## 5. Zombie authority / 旧权威复活

**Pattern:** A dated plan, branch name, stale progress file, or earlier summary
overrides the user's latest decision.

**Damage:** Work confidently follows a direction that has already been
cancelled or replaced.

**Executable correction:** Use a short explicit authority order. Requirement
change marks the old plan stale and blocks implementation until replacement.

## 6. Summary replaces truth / 用摘要改写真相

**Pattern:** A handoff or compaction summary stops being a navigation aid and
becomes the source of facts. Omissions harden into false history.

**Damage:** Each session drifts farther from the repository's actual state.

**Executable correction:** Resume capsules are bounded projections that name
canonical state. They cannot edit or outrank it.

## 7. Local green equals complete / 局部绿灯冒充完成

**Pattern:** One unit test, one mocked path, or a subset suite passes and the
agent says the feature or product is complete.

**Damage:** Users receive claims whose denominator was never tested.

**Executable correction:** Every claim names its exact scope. `LOCAL_PASS`
never means full completion, release readiness, or real-world acceptance.

## 8. Self-certified closure / 同一 Agent 自证闭环

**Pattern:** The same agent defines the requirement, implements it, describes
its success, and cites its own report as proof.

**Damage:** Confidence compounds without independent observable evidence.

**Executable correction:** Exact commands, subject-bound receipts, Git facts,
and user-visible black boxes are evidence. Agent prose is not.

## 9. Test theatre / 测试戏剧

**Pattern:** Tests prove internal branches, mocks, or schema shapes while the
application behavior the user cares about remains untested.

**Damage:** Impressive test output coexists with a broken product.

**Executable correction:** Each task starts with one minimal public black-box
acceptance stated in user-visible terms. Dependency tests support it but cannot
replace it.

## 10. Proxy goals take over / 代理目标反客为主

**Pattern:** Coverage, gates, architecture neatness, reviewer satisfaction, or
framework adoption becomes more important than the owner's product outcome.

**Damage:** The process optimizes itself while the actual user waits.

**Executable correction:** One current owner goal and one active bounded task
remain visible on every read surface.

## 11. Reviewer denominator inflation / Reviewer 扩大分母

**Pattern:** A reviewer adds unrelated ideals to the frozen acceptance set and
blocks completion on them.

**Damage:** No slice can finish; scope grows through review rather than owner
decision.

**Executable correction:** Review evaluates the frozen contract. New ideas are
non-blocking proposals unless the owner changes scope.

## 12. Control-tax blindness / 对控制税失明

**Pattern:** The agent adds scans, gates, ledgers, prompts, and full suites
without measuring how much slower ordinary work becomes.

**Damage:** The anti-drift tool creates more friction than the drift it prevents.

**Executable correction:** Latency, capsule size, and no-full-scan normal paths
are hard acceptance rows measured on real project copies.

## 13. Rebuilding the world / 重造轮子

**Pattern:** Existing Git, tests, atomic files, and simple commands are replaced
with new gateways, journals, adapters, state machines, or frameworks.

**Damage:** More code must be understood, reviewed, migrated, and debugged
before basic value appears.

**Executable correction:** Prefer ordinary platform primitives. Every new
module records the failing public acceptance it solves.

## 14. Workspace identity confusion / 工作区身份混乱

**Pattern:** The agent trusts a branch name or prose locator without checking
the real worktree, commit, tree, or dirty state.

**Damage:** Work lands in the wrong directory, reports another checkout's
status, or overwrites unrelated changes.

**Executable correction:** Handoffs and completion reports include exact real
path, branch/detached state, commit, tree, and clean/dirty manifest.

## 15. Handoff tax on the user / 把交接税转嫁给用户

**Pattern:** The agent leaves a long narrative and expects the next user or
agent to reconstruct current work manually.

**Damage:** Every session restart burns time and introduces another chance to
drift.

**Executable correction:** One `resume` command returns the operational
capsule: goal, completed, active task, proof, blocker, and next.

## 16. UX debt last / 用户体验最后偿还

**Pattern:** Internal machinery grows for weeks while the interface is generic,
unfinished, or never tested through the browser.

**Damage:** A technically elaborate product is unpleasant or unusable.

**Executable correction:** Freeze a distinctive visual contract before UI code,
then implement it and earn independent browser acceptance.

## 17. Agreement plus overconfidence / 附和与过度自信

**Pattern:** The agent quickly agrees with criticism, then makes another broad
promise—"fully controlled," "production ready," "fast"—without evidence.

**Damage:** Apology becomes another source of false confidence.

**Executable correction:** Use explicit capability labels and non-goals.
Performance is measured; unsupported enforcement is reported as unavailable.

## 18. Apology without constraint / 道歉没有变成约束

**Pattern:** The agent explains why it drifted but changes no test, hook,
contract, or working rule.

**Damage:** The same failure returns in the next session.

**Executable correction:** A confirmed incident must produce one executable
constraint, public regression test, or explicit non-goal. Otherwise the lesson
is not closed.

## Eighteen observations, ten product rules

Oh No does not implement eighteen bureaucratic subsystems. It maps the evidence
to ten compact rules:

| Product rule | Covered sins |
| --- | --- |
| Owner semantics and minimum interpretation | 1, 2, 17 |
| One bounded task contract | 3, 10, 11 |
| Review is read-only by default | 4 |
| Current authority and stale-plan blocking | 5, 6 |
| User-visible black-box completion | 7, 9 |
| Exact evidence, not self-certification | 8 |
| Simplicity and performance budgets | 12, 13 |
| Exact workspace and compact handoff | 14, 15 |
| Design before UI implementation | 16 |
| Incidents become executable constraints | 18 |

## What this audit does not justify

It does not justify building the very governance system it criticizes. The
right response is the smallest useful harness:

1. state the expected user-visible behavior;
2. name one minimal black-box test;
3. bound files and time;
4. keep current project truth readable;
5. stop on fresh evidence;
6. measure the control tax.

That is the product contract.
