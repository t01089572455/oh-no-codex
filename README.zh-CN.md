<a id="readme-top"></a>

<div align="center">

[English](./README.md) · [**简体中文**](./README.zh-CN.md)

</div>

<br>

<p align="center">
  <img
    src="./assets/brand/oh-no-codex-lockup.png"
    width="920"
    alt="Oh No, Codex!：蓝色编程玩偶被红叉拦下"
  >
</p>

<p align="center">
  <strong>Codex 能写出好代码，也可能把项目带跑偏。</strong><br>
  Oh No 是本地、协作式的防漂移护栏：冻结<strong>一个</strong>任务，<br>
  用用户看得见的黑盒验收，并从项目状态恢复现场。<br>
  它收口的是<strong>这一刀任务</strong>，不是关掉 Codex。
</p>

<p align="center">
  <code>收敛</code>&nbsp;&nbsp;·&nbsp;&nbsp;<code>验收</code>&nbsp;&nbsp;·&nbsp;&nbsp;<code>恢复</code>&nbsp;&nbsp;·&nbsp;&nbsp;<code>这一刀到此为止</code>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/oh-no-codex"><img alt="npm" src="https://img.shields.io/npm/v/oh-no-codex?style=flat-square&color=74D6B1&labelColor=202624&label=npm"></a>
  <img alt="status" src="https://img.shields.io/badge/status-ANTI_DRIFT_CORE_WORKS-3DDC97?style=flat-square&labelColor=202624">
  <img alt="codex" src="https://img.shields.io/badge/for-Codex_CLI-FF4B35?style=flat-square&labelColor=202624">
  <img alt="skills" src="https://img.shields.io/badge/13_个_Codex_skill-74D6B1?style=flat-square&labelColor=202624">
  <a href="./LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-FFF1CE?style=flat-square&labelColor=202624"></a>
</p>

<p align="center">
  <a href="#痛点">痛点</a> ·
  <a href="#核心模型">核心模型</a> ·
  <a href="#安装">安装</a> ·
  <a href="#cockpit-驾驶舱">Cockpit</a> ·
  <a href="#实际怎么用">使用</a> ·
  <a href="#证据与边界">证据</a>
</p>

---

## 痛点

模型一直在「干活」，仓库却可能离你的目标越来越远：

| 问题 | 常见表现 |
| --- | --- |
| 范围与语义漂移 | 你要一扇门，它开始造一座城 |
| 假完成 | mock 全绿，真实用户路径仍然坏 |
| 当前事实丢失 | 新会话相信聊天摘要，而不是项目状态 |
| 验收后不停 | 这一刀已经 PASS，却继续增加标准和施工 |

Oh No 把答案放在**项目文件**里，而不是聊天记忆里：

1. Owner 的项目目标是什么？
2. 已经完成了什么？
3. 当前唯一的有界任务是什么？
4. 哪条用户可见黑盒命令决定成败？
5. 当前 blocker 和唯一 next 是什么？

完整反例清单见 [`docs/CODEX-SINS.md`](./docs/CODEX-SINS.md)。

---

## 核心模型

| 动作 | 含义 |
| --- | --- |
| **冻结任务** | 固定用户可见行为、一个黑盒命令、允许文件、预算和停止条件 |
| **验收** | `ohno verify` 原样运行被冻结的命令 |
| **收口** | fresh PASS 推进一次计划 cursor；`next` 只负责指路 |
| **恢复** | `status`、`resume`、`next` 和 Cockpit 投影同一份状态 |

`.ohno/state.json` 是唯一当前运行时权威。Cockpit、hooks、
`.ohno/PROGRESS.md`、`.ohno/REQUIREMENTS.md` 和聊天摘要都只是投影或证据。

Codex hooks 与 Git pre-commit 是**协作式护栏**。它们帮助注入恢复胶囊、
限制明确可识别的越界写入，但不声称能对抗同一用户权限下的恶意进程。

---

## 安装

要求 Node.js **>= 22.20**。

```bash
npm install -g oh-no-codex
# 镜像尚未同步 0.1.8 时：
# npm install -g oh-no-codex@0.1.8 --registry https://registry.npmjs.org
cd your-git-repo
ohno init --goal "你的产品目标"
ohno install              # hooks + 日常 oh-no-* skills
```

只刷新 skills：

```bash
ohno skill install
ohno skill status
# 然后新开一个 Codex 会话，让 skill discovery 重新加载
```

包已发布为 [`oh-no-codex@0.1.8`](https://www.npmjs.com/package/oh-no-codex)。

### Windows 提示

- 把 npm 全局 bin 放进 **PATH**，常见位置是 `%AppData%\npm` 或自定义 global prefix。
- 使用 `ohno` / `ohno.cmd` shim，不要双击 `dist\cli.js`；Windows Script Host 不能直接运行该 ESM 文件。
- Cockpit 的进度是计划 cursor（`cursor/task_count`），不是“整个产品完成百分比”。

---

## Cockpit 驾驶舱

Cockpit 是本机、只读的状态面板，数据与 `ohno status --json` 相同。

```bash
cd your-git-repo          # 此目录必须已经执行 ohno init
ohno cockpit

# 可选：固定端口
ohno cockpit --port 13521

# 停止当前项目的 Cockpit
ohno cockpit stop

# 替换当前项目已有的 Cockpit 进程
ohno cockpit --replace --port 13521
```

终端会打印 `http://127.0.0.1:.../`。在同一台机器的浏览器中打开即可。
页面可见时约每 100ms 读取一次 `/api/state`；后台标签会暂停刷新。

Cockpit 不会开始任务、推进计划或写入状态。它只读取：

```text
CLI 变更 ──原子替换──> .ohno/state.json（唯一权威）
                            │ readModel()
                            ├── status / resume / next
                            └── GET /api/state ──> Cockpit
```

一个 Git worktree 对应自己目录内的 `.ohno/`。切换 worktree 后，应在目标
worktree 中重新运行 Cockpit，避免看错项目现场。

---

## 实际怎么用

### 首次设置

```bash
npm install -g oh-no-codex
cd your-git-repo
ohno init --goal "你的产品目标"
ohno install
# 新开一个 Codex 会话
```

### 日常对话

安装后通常不需要手动挑 skill。你用自然语言表达意图，Codex 应加载匹配的
`oh-no-*` skill，并执行对应的 `ohno` 命令。

| 你说 | Codex 应做什么 |
| --- | --- |
| “先给这个需求做一个线性计划。” | `oh-no-plan`：提议计划，等待你审阅后再 accept |
| “开始当前任务。” | `oh-no-task`：执行无参数的 `ohno task start` |
| “做完了，验收。” | `oh-no-verify`：运行被冻结的精确黑盒命令 |
| “现在做到哪了？” | `oh-no-resume` 或 `oh-no-status` |
| “记住：暂时不要多租户。” | `oh-no-requirements`：记录 Owner 原话 |
| “需求变了，先做导出 PDF。” | `oh-no-change`：进入文档同步并替换计划 |
| “打开驾驶舱。” | `oh-no-cockpit`：启动 Cockpit 并返回本机 URL |

`next` 是**定位器，不是新授权**。PASS 后出现下一个动作，不代表 Agent 可以
自动扩大工作范围。

### 13 个日常 skills

| Skill | 用途 |
| --- | --- |
| `oh-no-plan` | 提议 / 接受计划 |
| `oh-no-task` | 开始 / 重开这一刀任务 |
| `oh-no-verify` | 运行验收并诚实报告 PASS/FAIL |
| `oh-no-resume` | 恢复完整工作现场 |
| `oh-no-status` | 查看紧凑状态 |
| `oh-no-next` | 查看唯一 next |
| `oh-no-change` | 处理需求变更 |
| `oh-no-requirements` | 记录 Owner 原话 |
| `oh-no-preferences` | 管理可选工作偏好 |
| `oh-no-doctor` | 检查状态、投影与安装健康度 |
| `oh-no-cockpit` | 打开只读 Cockpit |
| `oh-no-projectors` | 刷新 PROGRESS / REQUIREMENTS / AGENTS 投影 |
| `oh-no-control` | 总入口与 skill 路由 |

首次 `init` / `install` 仍建议由你在终端执行。若模型声称完成却没有运行
`ohno verify`，直接要求它验收，或由你在终端运行该命令。

---

## 它交付什么

| 组件 | 作用 |
| --- | --- |
| CLI | `init`、`plan`、`task`、`verify`、`change`、`resume` 等 |
| 13 个 Codex skills | 把日常自然语言映射到稳定操作流程 |
| Codex hooks + Git pre-commit | 注入恢复胶囊并提供协作式范围护栏 |
| Projectors | `.ohno/PROGRESS.md`、`.ohno/REQUIREMENTS.md`、AGENTS 短胶囊 |
| Preferences | 可选的研究、开源和 UI 工作偏好 |
| Cockpit | `status --json` 的只读浏览器投影 |

V1 不包含数据库、后台 daemon、托管服务、multi-agent OS、skill 市场平台，
也不声称提供绝对的同用户安全边界。

---

## 证据与边界

| 声明 | 标签 |
| --- | --- |
| 核心防漂移 | `ANTI_DRIFT_CORE_WORKS` |
| 公开发布 | **`0.1.8` 已发布**（Cockpit 体验）；本地试验仍是 `TRIAL_PASS`，不是 `V1_TRIAL_ACCEPTED` |
| CLI / hooks / 原子状态 | `LOCAL_PASS` |
| Cockpit = status JSON | `LOCAL_PASS` |
| Correction 4 结构化验收分母 | `LOCAL_PASS`（已合入 main） |
| 可丢弃真实副本性能 P01–P06 | **`TRIAL_PASS`** LIVE — p95 ms A/B/C：status 139.361 / 140.512 / 132.802；next 169.689 / 157.331 / 136.215；resume 168.616 / 195.458 / 193.012；task_start 136.947 / 156.410 / 159.346；P06 163 / 178 / 164；P04 resume 4006 B（非全球性能保证；batch id 见 trial evidence JSON） |
| npm | **`oh-no-codex@0.1.8`** 已在公共 npm registry 发布；镜像可能延迟 |
| schema 2 → 3 迁移 | 两阶段：先 preview，再用 `--diff` / `--head` apply |

契约：[Product](./docs/PRODUCT-CONTRACT.md) · [Design](./docs/DESIGN.md) · [Acceptance](./docs/ACCEPTANCE.md) · [Publish](./docs/PUBLISH.md) · [Sins](./docs/CODEX-SINS.md)

---

<p align="center">
  <sub>MIT · 独立社区项目 · 与 OpenAI 无隶属关系</sub>
</p>

<p align="center">
  <strong>收敛这一刀。用黑盒证明。下次回来不用考古。</strong>
</p>

<p align="center"><a href="#readme-top">→ 回到顶部</a></p>
