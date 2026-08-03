<a id="readme-top"></a>

<div align="center">

[English](./README.md) · [**简体中文**](./README.zh-CN.md)

</div>

<br>

<p align="center">
  <img
    src="./assets/brand/oh-no-codex-lockup.png"
    width="720"
    alt="Oh No, Codex!"
  >
</p>

<p align="center">
  <strong>面向 Codex 的本机防漂移护栏。</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/oh-no-codex"><img alt="npm" src="https://img.shields.io/npm/v/oh-no-codex?style=flat-square&color=74D6B1&labelColor=202624&label=npm"></a>
  <img alt="status" src="https://img.shields.io/badge/status-ANTI_DRIFT_CORE_WORKS-3DDC97?style=flat-square&labelColor=202624">
  <img alt="node" src="https://img.shields.io/badge/node-%3E%3D22.20-74D6B1?style=flat-square&labelColor=202624">
  <img alt="codex" src="https://img.shields.io/badge/for-Codex-FF4B35?style=flat-square&labelColor=202624">
  <a href="./LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-FFF1CE?style=flat-square&labelColor=202624"></a>
</p>

<p align="center">
  <a href="#契约">契约</a> ·
  <a href="#权威">权威</a> ·
  <a href="#失败模式">失败模式</a> ·
  <a href="#安装">安装</a> ·
  <a href="#操作">操作</a> ·
  <a href="#cockpit">Cockpit</a> ·
  <a href="#证据">证据</a>
</p>

---

## 契约

包：[`oh-no-codex`](https://www.npmjs.com/package/oh-no-codex) · 可执行文件：`ohno` · 当前：**`0.1.8`**。

| 规则 | 含义 |
| --- | --- |
| 冻结 | cursor 任务固定期望行为、**一条**精确测试命令、允许 glob、预算、停止条件 |
| 验收 | `ohno verify` 只跑那条命令；PASS 是收据（任务 + 计划修订 + HEAD + 作用域 digest） |
| 推进 | 新鲜 PASS 关闭任务一次并推进 `cursor`；FAIL / UNKNOWN 任务保持 active |
| 定位 | `next` 是**定位器**，不是开工授权 |
| 恢复 | `status` / `resume` / hooks / Cockpit 读同一份原子状态 |
| 变更 | 需求变更经 `ohno change` 同步命名治理文档后，才继续编码 |

**不宣称：** 自主 multi-agent OS、对抗同用户的安全边界、数据库、daemon、托管控制面。

---

## 权威

```text
ohno CLI  ──原子替换──►  .ohno/state.json   （唯一运行时权威）
                              │
                              ├─ status / resume / next
                              ├─ Codex hooks + Git pre-commit
                              └─ GET /api/state  →  Cockpit（只读）

.ohno/truth.json  →  需求变更时哪些 Owner 文档适用
```

| 产物 | 角色 |
| --- | --- |
| `.ohno/state.json` | 当前目标、计划、cursor、活跃契约、证明、next |
| `.ohno/truth.json` | 治理文档适用列表（Owner 维护） |
| PASS 收据 | 溯源 + verify CAS；不是第二套「当前真相」 |
| `PROGRESS.md` / resume 文案 / Cockpit | 仅投影 |
| `.ohno/cockpit.runtime.json` | 仅 pid / URL 指针 |

协作式 hooks 注入 resume 胶囊，并拒绝部分越界写入。同一用户进程仍可绕过；这是明确的非目标。

---

## 失败模式

Codex 可以一直「在干活」，仓库仍在漂移。护栏针对这些模式（全文：[`docs/CODEX-SINS.md`](./docs/CODEX-SINS.md)）：

| # | 模式 | 症状 |
| ---: | --- | --- |
| 1 | 语义僭越 | 要门 → 造城 |
| 2 | 最大解释 | 「管控」→ 平台 |
| 3 | 停不下来 | 这一刀已 PASS；施工继续 |
| 4 | 审查即改权 | 「看看」→ 静默重写 |
| 5 | 僵尸权威 | 旧计划压过最新决定 |
| 6 | 摘要当真相 | 压缩后的摘要硬化成假历史 |
| 7 | 局部绿 = 完成 | mock 当完成 |
| 8 | 自证闭环 | 同一 Agent 既宣称又鼓掌 |
| 9 | 测试剧场 | 内部绿；用户路径坏 |
| 10 | 代理目标 | 覆盖率压过结果 |
| 11 | 评审膨胀 | 无尽新验收 |
| 12 | 控制税盲目 | 工具成本超过漂移本身 |
| 13 | 重建世界 | 造新机器而不是用 Git/测试 |
| 14 | 工作区混乱 | 错树 / 错分支 / 脏检出 |
| 15 | 交接税 | 下一会话从聊天考古 |
| 16 | UX 垫底 | 内务几周；UI 不测 |
| 17 | 附和 + 夸大 | 立刻道歉；未度量的承诺 |
| 18 | 无约束道歉 | 软遗憾；明天同一失败 |

产品侧折叠：**Owner 语义优先 · 一份冻结契约 · 证据结束这一刀 · 审查只读 · 项目状态压过聊天 · 公开黑盒压过内部绿 · 延迟是验收条件 · 工作区身份精确。**

---

## 安装

```bash
npm install -g oh-no-codex
# 镜像可能滞后：
# npm install -g oh-no-codex@0.1.8 --registry https://registry.npmjs.org

cd your-git-repo
ohno init --goal "Owner 项目目标"   # 目标必填
ohno install                        # hooks + ~/.codex/skills/oh-no-*
```

```bash
ohno skill install    # 仅 skills
ohno skill status
# 需新开 Codex 会话，skill discovery 才会加载
```

Node.js **≥ 22.20**（稳定 `path.matchesGlob`）。

### Windows

- 全局 npm bin 进 `PATH`（`%AppData%\npm` 或自定义 prefix）。
- 用 `ohno` / `ohno.cmd`。不要双击 `dist\cli.js`（WSH 跑不了该 ESM 入口）。
- Cockpit 进度是 **`cursor / task_count`**，不是产品完成度。

---

## 操作

安装只走终端。日常：自然语言 → Codex 加载 `oh-no-*` skill → 跑对应 `ohno` 命令。hooks 协助；**完成仍要求真实 `ohno verify`**。

### 最小闭环

```bash
ohno plan propose --file plan.json
ohno plan accept --revision <rev> --diff <digest>
ohno task start                 # 不接受调用方塞契约字段
# …只改 allowed_files…
ohno verify                     # 冻结的精确 test_command
ohno resume                     # 从文件恢复，不靠聊天
ohno next                       # 仅定位
```

### 说法 → skill

| 你 | Skill / 命令 |
| --- | --- |
| 起草 / 接受线性计划 | `oh-no-plan` |
| 开始 / 重开 cursor 这一刀 | `oh-no-task` → `ohno task start` |
| 做完了 | `oh-no-verify` → `ohno verify` |
| 做到哪了 | `oh-no-resume` / `ohno status` |
| 记住 Owner 原话 | `oh-no-requirements` |
| 需求变了 | `oh-no-change` |
| 看板 | `oh-no-cockpit` → `ohno cockpit` |
| 体检 | `oh-no-doctor` |
| 总入口 | `oh-no-control` |

另有：`oh-no-status`、`oh-no-next`、`oh-no-preferences`、`oh-no-projectors`（共 13 个 skill）。`init` / `install` 不是 skill。

### 何时自己跑 CLI

| 情况 | 动作 |
| --- | --- |
| 仓库第一次接入 | `ohno init` + `ohno install` |
| 模型宣称完成却没 verify | 强制 `ohno verify` |
| 升级后 skill 丢失 | `ohno skill install` + 新会话 |
| 要确定性 | 自己在终端跑命令 |

**硬规则：** 没有 PASS ≠ 做完。`next` ≠ 空白授权。聊天里贴长 CLI 是噪声。

---

## Cockpit

本机只读看板。载荷与 `ohno status --json` 相同。永不改写计划/状态。

```bash
cd your-git-repo            # 必须已 init
# worktree：cd 进该 worktree —— 每棵树各自有 .ohno/
ohno cockpit
ohno cockpit --port 13521
ohno cockpit stop
ohno cockpit --replace
ohno cockpit --replace --port 13521
```

```text
Cockpit: http://127.0.0.1:<port>/
```

可见标签约 100ms 轮询 `/api/state`（设计带 100–125ms）。不是 daemon：Ctrl+C 或 `ohno cockpit stop`。

| 规则 | 行为 |
| --- | --- |
| 默认端口 | OS 临时端口（`0`），除非 `--port N` |
| 同项目已在跑 | 打印已有 URL 后退出 |
| `--replace` | 先杀本 cwd 上一个 cockpit，再启动 |
| 多项目 | 每项目 cwd 一个进程；稳定标签用不同端口 |
| 死标签 | **COCKPIT SERVER OFFLINE**（不是 `state.json` 坏了） |
| 进度条 | 仅 `cursor / task_count` |

```text
plan accept / task start / verify
        │ 原子替换
        ▼
  .ohno/state.json
        │ readModel()
        ├── status / resume / next
        └── GET /api/state ── 轮询 ── UI
```

---

## 交付物

| 组件 | 作用 |
| --- | --- |
| CLI | `init` · `plan` · `task` · `verify` · `change` · `migrate acceptance-basis` · `resume` · `status` · `next` · `doctor` · `cockpit` · … |
| 13 个 Codex skill | 可发现的日常流程 |
| Hooks + pre-commit | 注入胶囊 + 协作式范围护栏 |
| Projectors | `PROGRESS.md`、`REQUIREMENTS.md`、AGENTS 短块 |
| Preferences | 可选工作默认 |
| Cockpit | 只读 status 面 |

V1 预算：一个包、一个二进制、一份 state、一份 truth、一份 hook 配置、一个 Git hook、一个本机只读 Cockpit。

---

## 证据

| 声明 | 标签 |
| --- | --- |
| 核心护栏 | `ANTI_DRIFT_CORE_WORKS` |
| 公开发布 | **`0.1.8` 已发布**（Cockpit 体验）；本地试验仍是 `TRIAL_PASS`，不是 `V1_TRIAL_ACCEPTED` |
| CLI / hooks / 原子状态 | `LOCAL_PASS` |
| Cockpit = status JSON | `LOCAL_PASS` |
| Correction 4 验收分母 | `LOCAL_PASS`（已在 main） |
| 可丢弃真实副本 P01–P06 | **`TRIAL_PASS` LIVE** — p95 ms A/B/C：status 139.361 / 140.512 / 132.802；next 169.689 / 157.331 / 136.215；resume 168.616 / 195.458 / 193.012；task_start 136.947 / 156.410 / 159.346；P06 163 / 178 / 164；P04 resume 4006 B（绑定 batch；非全球性能保证） |
| npm | **`oh-no-codex@0.1.8`** 在 registry.npmjs.org；镜像可能滞后 |
| Schema 2 → 3 | 两阶段迁移：preview，再 `--diff` / `--head` apply |

契约：[Product](./docs/PRODUCT-CONTRACT.md) · [Design](./docs/DESIGN.md) · [Acceptance](./docs/ACCEPTANCE.md) · [Publish](./docs/PUBLISH.md) · [Sins](./docs/CODEX-SINS.md)

---

<p align="center">
  <sub>MIT · 独立社区项目 · 与 OpenAI 无隶属关系</sub>
</p>

<p align="center"><a href="#readme-top">↑ 顶部</a></p>
