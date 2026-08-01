# Field trial regression — oh-no-codex@0.1.4

Date: 2026-08-01T05:12:56.508Z
Package: global oh-no-codex@0.1.4 from registry.npmjs.org
Codex: **cannot remote-control Codex app**; CLI regression of session failure modes.

## 1. Master (old micro-plan board)
```
AVAILABILITY: AVAILABLE
GOAL: NONE
STATUS: IDLE
PLAN: 232794e2c019e040f40e097f7989cee7ff685e67c451640e330f3c12d52c704a
CURSOR: 1/1
PLAN_PROGRESS: 1/1 plan-tasks (100% of THIS plan)
BOARD: 0:prepare-isolated-worktree:DONE
COMPLETED: 2
COMPLETED_RECENT: commit-design-doc: 设计文档完整描述核心流程、架构、隐私、规则、异常处理和验收标准。 | prepare-isolated-worktree: 实施计划可追踪，.worktrees 和视觉草案目录被 Git 忽略。
TASK: NONE
EXPECTED: NONE
TEST: NONE
PROOF: FRESH
BLOCKER: NONE
DOC_SYNC: CLEAN
TRUTH_TARGETS: 0
TRUTH_PATHS: NONE
HANDOFF_PATH: D:\python_workspace\lzs\xiaochengxu
HANDOFF_BRANCH: master
HANDOFF_HEAD: 4f72431f7f5ba715a4f74ee06260689791fbf046
HANDOFF_DIRTY: YES
AUTHORITY_NOTE: resume/cockpit read only this cwd's .ohno/state.json (other git worktrees may have a different board — FT-13)
PLAN_COMPLETE_NOTE: linear plan cursor finished (1/1) — not product-finished; propose next phase with ohno plan propose
NEXT: PROJECT_COMPLETE
SIBLING_OHNO_WORKTREES: 1 other worktree(s) have .ohno/state.json: D:\python_workspace\lzs\xiaochengxu\.worktrees\anti-procrastination-mvp (codex/anti-procrastination-mvp). Cockpit/resume only read THIS cwd (FT-13).
```

### Doctor
```
OK: YES
PASS: state — AVAILABLE status=IDLE cursor=1/1 proof=FRESH
PASS: handoff — path=D:\python_workspace\lzs\xiaochengxu branch=master head=4f72431f7f5ba715a4f74ee06260689791fbf046 dirty=YES
WARN: truth — 0 truth targets; doc_sync=CLEAN
WARN: blackbox_discipline — plan task prepare-isolated-worktree: test_command is git diff --check (format only; not product behavior) (FT-02)
WARN: plan_shape — plan looks like a commit-license / docs-only micro-plan (FT-05/14) — cockpit 100% will not mean product done; prefer multi-slice product tasks with behavioral tests
WARN: plan_complete_honesty — NEXT=PROJECT_COMPLETE means this linear plan cursor is done (1/1 tasks), not that the product is finished (FT-01/09/12). Propose next phase: ohno plan propose
WARN: harness_versioned — .ohno/ and/or AGENTS.md appear untracked — authority may not travel with commits (FT-07/22/31); consider committing harness
WARN: worktree_authority — other git worktrees also have .ohno/state.json (1): cockpit/resume only see cwd D:\python_workspace\lzs\xiaochengxu (FT-13/17). Open ohno in the worktree you mean.
PASS: progress_projection — .ohno/PROGRESS.md present
PASS: requirements_log — .ohno/REQUIREMENTS.md present
PASS: working_method — 9/9 rules enabled; research=ON frontend_adapt=ON
PASS: agents_file — AGENTS.md present
PASS: hooks — codex=INSTALLED_TEMPLATE git=INSTALLED_TEMPLATE classification=COOPERATIVE_GUARDRAIL
PASS: control_skill — oh-no skill suite 13/13 installed under ~/.codex/skills
PASS: cli_path — ohno on PATH: D:\Program Files\nodejs\node_global\ohno
NEXT: PROJECT_COMPLETE
```

## 2. Worktree (implementation board)
```
AVAILABILITY: AVAILABLE
GOAL: NONE
STATUS: IDLE
PLAN: e96dbac8154e61af8b86f01ee297de0e6d196bf496b5525fe6fd454eb9efed66
CURSOR: 5/10
PLAN_PROGRESS: 5/10 plan-tasks (50% of THIS plan)
BOARD: 0:task-01-scaffold:DONE | 1:task-01b-scaffold-quality-fixes:DONE | 2:task-02-core-rules:DONE | 3:task-03-repository:DONE | 4:task-04-cloud-ai:DONE | 5:task-05-dashboard:OUTLINE | 6:task-06-wizard:OUTLINE | 7:task-07-timeline-history:OUTLINE | 8:task-08-reminders:OUTLINE | 9:task-09-acceptance:OUTLINE
COMPLETED: 5
COMPLETED_RECENT: task-02-core-rules: 纯函数 API 按已批准规则完成估算来源选择、难度与缓冲评估、向后排程及溢出计算、风险与免打扰提醒调度，并默认禁止云端 AI。 | task-03-repository: 任务模型校验字段与状态转移；草稿和计划先写本地并进入去重 outbox，离线读取缓存，联网时只同步当前用户数据且成功事件不会重复发送。 | task-04-cloud-ai: 服务端以 OPENID 校验计划和复盘写入，每个云函数声明可部署的 wx-server-sdk 依赖，outbox 事件映射到现有云端写入接口；规则副本可重复同步并严格校验；local_only 永不调用 AI，允许模式的超时…
TASK: NONE
EXPECTED: NONE
TEST: NONE
PROOF: FRESH
BLOCKER: NONE
DOC_SYNC: CLEAN
TRUTH_TARGETS: 0
TRUTH_PATHS: NONE
HANDOFF_PATH: D:\python_workspace\lzs\xiaochengxu\.worktrees\anti-procrastination-mvp
HANDOFF_BRANCH: codex/anti-procrastination-mvp
HANDOFF_HEAD: cb5b3620dd4ef7028614ead1d2e0836a5c15aec2
HANDOFF_DIRTY: YES
AUTHORITY_NOTE: resume/cockpit read only this cwd's .ohno/state.json (other git worktrees may have a different board — FT-13)
NEXT: FREEZE_TASK:task-05-dashboard
SIBLING_OHNO_WORKTREES: 1 other worktree(s) have .ohno/state.json: D:\python_workspace\lzs\xiaochengxu (master). Cockpit/resume only read THIS cwd (FT-13).
```

### Doctor
```
OK: YES
PASS: state — AVAILABLE status=IDLE cursor=5/10 proof=FRESH
PASS: handoff — path=D:\python_workspace\lzs\xiaochengxu\.worktrees\anti-procrastination-mvp branch=codex/anti-procrastination-mvp head=cb5b3620dd4ef7028614ead1d2e0836a5c15aec2 dirty=YES
WARN: truth — 0 truth targets; doc_sync=CLEAN
PASS: plan_shape — plan shape does not match known commit-license micro-pattern
WARN: harness_versioned — .ohno/ and/or AGENTS.md appear untracked — authority may not travel with commits (FT-07/22/31); consider committing harness
WARN: worktree_authority — other git worktrees also have .ohno/state.json (1): cockpit/resume only see cwd D:\python_workspace\lzs\xiaochengxu\.worktrees\anti-procrastination-mvp (FT-13/17). Open ohno in the worktree you mean.
PASS: progress_projection — .ohno/PROGRESS.md present
PASS: requirements_log — .ohno/REQUIREMENTS.md present
PASS: working_method — 9/9 rules enabled; research=ON frontend_adapt=ON
PASS: agents_file — AGENTS.md present
WARN: hooks — codex=MISSING git=MISSING classification=COOPERATIVE_GUARDRAIL
PASS: control_skill — oh-no skill suite 13/13 installed under ~/.codex/skills
PASS: cli_path — ohno on PATH: D:\Program Files\nodejs\node_global\ohno
NEXT: FREEZE_TASK:task-05-dashboard
```

## 3. Micro-plan path (session failure mode)
- propose has WARN: YES
- accept without override status: 1 (expect != 0)
- refuse mentions discipline: YES
- accept --allow-weak-plan status: 0 (expect 0)

```
ohno: plan discipline refused accept:
- COMMIT_LICENSE_MICRO_PLAN: plan looks like a commit-license / docs-only micro-plan (FT-05/14). Refuse single-task design/gitignore/worktree-only plans when building a product. Split into multi-slice tasks with behavioral tests, or pass --allow-weak-plan if the Owner explicitly accepts a meta-only plan.
- WEAK_BLACKBOX: task commit-design-doc: test_command is git diff --check (format only; not product behavior) (FT-02). Use a user-visible black box (e.g. npm test / app smoke). Or pass --allow-weak-plan if the Owner explicitly accepts this test.
Override only with Owner intent: ohno plan accept … --allow-weak-plan
```

## 4. Good plan + reopen
- accept: 0
- start: 0
- verify1: 0 → FREEZE_TASK:t2
- reopen: 0 REOPENED
- verify2: 0
- PLAN_PROGRESS: YES
- AUTHORITY_NOTE: YES

## Verdict
**PASS** — 0.1.4 hard-refuses session micro-plan path; honest dual-tree resume; reopen works.
