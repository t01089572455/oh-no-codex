# Oh No, Codex!

> **Born from Codex's sins. Built to stop the next one.**
>
> Ten executable rules. Four tiny loops. One next action.

**Status: design frozen; implementation has not started.**

Oh No, Codex! is a fast, cooperative anti-drift harness for Codex vibe coding.
It behaves like a caliper at task boundaries: define the intended user-visible
result, name one minimal black-box test, keep the task bounded, and stop when
the evidence says to stop.

It is deliberately **not** a security sandbox, compliance platform, workflow
engine, or "AI governance operating system."

## The four loops

| Loop | What the harness requires |
| --- | --- |
| Start | Expected user-visible behavior, one minimal black-box test, a stop condition, allowed files, a time budget, and exactly one proposed next action. |
| Finish | Run the exact test. Failure keeps the current task active. Fresh success closes it and exposes exactly one next action. |
| Change | Read the owner-maintained Truth applicability list, show the exact governing-document diff, require review, then replace the stale plan. |
| Resume | `status`, `resume`, and `next` show the same goal, completed work, current task, proof, blocker, and next action. |

The CLI, Codex hooks, Git hook, and Cockpit will all read one small atomic state
file. The Cockpit is a projection of that state, never a second source of truth.

## Planned v1 interface

These commands are the frozen public design. **They do not work yet.**

```bash
npx oh-no-codex init --goal "Ship reliable draft persistence"
npx oh-no-codex task start \
  --id "draft-persistence" \
  --expect "A user can save a draft and see it after reload" \
  --test "npm test -- draft-persistence" \
  --stop "Stop after that black-box test passes" \
  --files "src/drafts/**,test/draft-persistence.test.*" \
  --minutes 60 \
  --next "Add draft deletion"

npx oh-no-codex verify
npx oh-no-codex status
npx oh-no-codex resume
npx oh-no-codex next
npx oh-no-codex cockpit
```

The installed binary name is planned as `ohno`; `npx oh-no-codex` is shown
until the package exists.

## Codex hooks: useful guardrails, honestly described

The thin integration will use project-local `.codex/hooks.json`:

- `SessionStart` and `PostCompact` inject a bounded resume capsule.
- `PreToolUse` denies supported mutation calls when there is no active task,
  document sync is pending, or the target is demonstrably outside the file
  boundary.
- `Stop` continues the turn when an Oh No completion claim has no fresh exact
  PASS receipt. The cooperative claim marker is
  `OHNO_COMPLETE:<active-task-id>`; ordinary prose is not misrepresented as
  enforceable.
- A Git `pre-commit` hook rejects stale proof and staged files outside scope.

Codex's current hook documentation says project hooks require trust review,
`PreToolUse` covers shell, `apply_patch`, MCP, and most local function tools,
while hosted and some specialized tool paths can bypass that hook path.
Therefore Oh No reports **cooperative guardrail evidence**, never hostile-agent
containment or production-grade authority. See the
[official Codex hooks documentation](https://learn.chatgpt.com/docs/hooks).

## Codex's eighteen sins / Codex 十八宗罪

"十宗罪" was the original shorthand. A privacy-scrubbed session audit found
**18 recurring failure patterns**, so the public record keeps all eighteen
instead of forcing the evidence into a catchy number. These are product and
workflow failure modes—not claims about every Codex run.

| # | Sin / 罪 | What Oh No turns it into |
| ---: | --- | --- |
| 1 | **Semantic usurpation / 越俎代庖** — the agent decides what the user meant. | Preserve the owner's words; ambiguity cannot silently expand scope. |
| 2 | **Maximum interpretation / 把含糊词解释到最大** — a harness becomes a governance OS. | Choose the smallest interpretation that satisfies the stated outcome. |
| 3 | **Never stopping / 完成以后不停** — "next" is treated as fresh authorization. | Acceptance ends the task; the next action is information, not permission. |
| 4 | **Review becomes edit authority / 把审查当修改权**. | Review and audit are read-only unless fixes are explicitly requested. |
| 5 | **Zombie authority / 旧权威复活** — an old plan overrides the latest decision. | A short, explicit authority order and stale-plan blocking. |
| 6 | **Summary replaces truth / 用摘要改写真相**. | Resume capsules point to canonical state; they never become authority. |
| 7 | **Local green equals complete / 局部绿灯冒充完成**. | Claims name their exact scope; local PASS is never full completion. |
| 8 | **Self-certified closure / 同一 Agent 自证闭环**. | Evidence comes from exact commands and user-visible outcomes, not prose. |
| 9 | **Test theatre / 测试戏剧** — internals pass while the product fails. | Every task owns one public, user-visible black-box acceptance. |
| 10 | **Proxy goals take over / 代理目标反客为主**. | One current owner goal and one bounded active task. |
| 11 | **Reviewer denominator inflation / Reviewer 扩大分母**. | Review checks the frozen acceptance contract; extra ideas are non-blocking proposals. |
| 12 | **Control-tax blindness / 对控制税失明**. | Hard latency and capsule-size budgets are product acceptance criteria. |
| 13 | **Rebuilding the world / 重造轮子**. | No new abstraction without a reproduced failure or current acceptance need. |
| 14 | **Workspace identity confusion / 工作区身份混乱**. | Handoffs name real path, branch, commit, tree, and clean/dirty state. |
| 15 | **Handoff tax on the user / 把交接税转嫁给用户**. | `resume` returns a compact operational capsule in one command. |
| 16 | **UX debt last / 用户体验最后偿还**. | Cockpit design is frozen before implementation and accepted through the browser. |
| 17 | **Agreement plus overconfidence / 附和与过度自信**. | Honest capability labels, explicit non-goals, and measured performance. |
| 18 | **Apology without constraint / 道歉没有变成约束**. | Every confirmed failure becomes an executable rule or regression test. |

Read the expanded, sanitized audit in
[`docs/CODEX-SINS.md`](docs/CODEX-SINS.md).

## The anti-overdesign contract

V1 has a hard complexity budget:

- one Node.js package and one executable;
- one canonical current-state file;
- one owner-maintained Truth applicability file;
- one project Codex hook configuration and one Git hook;
- one local, read-only Cockpit;
- no database, daemon, hosted service, plugin platform, policy language, or
  multi-agent scheduler.

A new module, concept, state machine, or dependency is rejected unless a
failing public acceptance test requires it. Passing the current acceptance
means stop.

## Performance is evidence, not a promise

V1 is accepted only after measurement on three disposable copies of real
projects:

- `status` and `next`: local p95 under 250 ms;
- `resume`: local p95 under 500 ms;
- resume capsule: under 4 KiB;
- task-start control overhead: under 2 seconds, excluding the user's test;
- state-to-Cockpit update: under 250 ms;
- normal paths do not scan every document or run the full test suite.

## 中文速览

这个项目先只支持 **Codex**。它不是要控制一个恶意 Agent，也不承诺“绝对
不会绕过”；它要解决的是日常 vibe coding 最烦的漂移：

1. 开工前先写清用户能看到什么、用哪个最小黑盒测试验证、改哪些文件、何时停。
2. 测试失败就留在当前任务；测试通过就结束，并只显示一个下一步。
3. 需求变化时按 Truth 清单找齐规范文件，先展示精确 diff，确认后再替换旧计划。
4. 新会话运行 `resume`，几百毫秒内知道做到哪、证据是什么、下一步是什么。

当前仓库只有已经冻结的设计文档，**没有可用实现**。唯一实施起点写在
[`docs/IMPLEMENTATION-PLAN.md`](docs/IMPLEMENTATION-PLAN.md)。

## Authority and roadmap

Read in this order:

1. [`docs/PRODUCT-CONTRACT.md`](docs/PRODUCT-CONTRACT.md)
2. [`docs/DESIGN.md`](docs/DESIGN.md)
3. [`docs/ACCEPTANCE.md`](docs/ACCEPTANCE.md)
4. [`docs/IMPLEMENTATION-PLAN.md`](docs/IMPLEMENTATION-PLAN.md)
5. the current task's public black-box test

Historical VibeTether repositories are inspiration and regression references,
not authority for this clean product.

## License

[MIT](LICENSE)
