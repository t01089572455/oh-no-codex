---
name: oh-no-init
description: >
  Initialize Oh No, Codex! harness in a Git repo. Use when user says init ohno,
  初始化 ohno, ohno init, set up oh-no-codex, bootstrap harness, or first-time
  setup of .ohno state. Runs shell ohno init (optional --goal).
---

# oh-no-init

Run in the project root (Git repo):

```bash
ohno init
```

Optional product name line only if Owner wants it on resume:

```bash
ohno init --goal "外贸业务系统"
```

Then usually:

```bash
ohno install
```

Do not re-init an already initialized project.
