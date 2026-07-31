---
name: oh-no-init
description: >
  Initialize Oh No, Codex! harness in a Git repo. Use when user says init ohno,
  初始化 ohno, ohno init, set up oh-no-codex, bootstrap harness, or first-time
  setup of .ohno state. Runs shell: ohno init (no --goal).
---

# oh-no-init

在仓库根目录执行：

```bash
ohno init
```

- **不要**再传 `--goal`（已从 CLI 移除；产品意图写在 plan 任务 / requirements 笔记里）。
- 已初始化的项目会拒绝再次 `init`。

通常接着：

```bash
ohno install
```
