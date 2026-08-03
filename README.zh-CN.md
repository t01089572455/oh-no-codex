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
  <strong>面向 Codex vibe coding 的快速、本机防漂移护栏。</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/oh-no-codex"><img alt="npm" src="https://img.shields.io/npm/v/oh-no-codex?style=flat-square&color=74D6B1&labelColor=202624&label=npm"></a>
  <img alt="status" src="https://img.shields.io/badge/status-ANTI_DRIFT_CORE_WORKS-3DDC97?style=flat-square&labelColor=202624">
  <img alt="node" src="https://img.shields.io/badge/node-%3E%3D22.20-74D6B1?style=flat-square&labelColor=202624">
  <img alt="codex" src="https://img.shields.io/badge/for-Codex-FF4B35?style=flat-square&labelColor=202624">
  <a href="./LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-FFF1CE?style=flat-square&labelColor=202624"></a>
</p>

<p align="center">
  <a href="#why-oh-no">为什么需要它</a> ·
  <a href="#how-control-works">怎样控制 Codex</a> ·
  <a href="#cockpit">驾驶舱</a> ·
  <a href="#eighteen-sins">十八宗罪</a> ·
  <a href="#install">安装</a> ·
  <a href="#daily-use">使用</a> ·
  <a href="#limits-evidence">边界与证据</a>
</p>

---

<a id="why-oh-no"></a>

## 为什么需要 Oh No？

Codex 可以写出不错的代码，却仍把项目带向错误方向：扩大原需求、验收通过后
继续乱做、复活过期计划，或者让下一会话重新从聊天里考古项目现场。

Oh No, Codex! 在现有开发流程外加一层很小的本机护栏。它让 Owner 原话、
一个有边界的任务、一条精确黑盒测试、新鲜证据和唯一下一步跨会话可读。

> **Owner 目标 → 冻结任务 → 有边界地工作 → 精确测试 → PASS 或停住 → 唯一下一步**

这个产品来自一份公开事故审计：[**Codex 的十八宗罪**](./docs/CODEX-SINS.md)。
它们描述的是 Agent 看似一直在干活、项目却持续漂移的反复失败模式。

包：[`oh-no-codex`](https://www.npmjs.com/package/oh-no-codex) · 命令：
`ohno` · 当前版本：**`0.1.10`**。

---

<a id="how-control-works"></a>

## 它怎样控制 Codex

它不是一条超长提示词，也不尝试读取 Agent 的内心。控制落在开发流程中的
几个明确位置：

| 时机 | Oh No 做什么 |
| --- | --- |
| 记住 | 把重要的 Owner 原话保存到 `.ohno/REQUIREMENTS.md`，不依赖聊天摘要 |
| 计划 | 冻结当前任务的期望行为、一条精确测试、允许文件、时间预算和停止条件 |
| 工作 | Codex hooks 与 Git pre-commit 在无活跃任务、文档待同步或路径越界时拦截受支持的写入 |
| 验收 | `ohno verify` 只运行冻结的黑盒命令；FAIL / UNKNOWN 不推进任务 |
| 恢复 | `status`、`resume`、`next`、hooks 和驾驶舱读取同一份原子状态 |
| 变更 | `ohno change` 按 Owner 维护的 Truth 清单选择适用权威文档；精确 diff 和替代计划审阅前阻断编码 |

```text
Owner 原话 + 审阅后的计划
              │
              ▼
          当前任务 ──► 精确黑盒测试 ──► PASS / 留在当前任务
              │
              ▼
     .ohno/state.json ──► resume / next / hooks / 驾驶舱

.ohno/truth.json ──► 需求变化时必须同步哪些文档
```

`.ohno/state.json` 是唯一当前运行时权威。resume 文案、`PROGRESS.md`、收据
和驾驶舱只是投影或证据，不会再建立一套互相打架的“真相”。

Hooks 是协作式护栏，同一用户进程仍能绕过。Oh No 不声称对抗恶意 Agent，
也不声称能自动理解所有语义。

---

<a id="cockpit"></a>

## 驾驶舱：一眼看懂当前现场

<p align="center">
  <img
    src="./assets/brand/oh-no-cockpit.png"
    width="960"
    alt="Oh No, Codex! 驾驶舱 — 当前任务、计划板、证明、漂移与下一步"
  >
</p>

<p align="center">
  <sub>真实本机布局演示截图。cursor 3/14 表示计划进度，不是产品完成度。</sub>
</p>

驾驶舱只读，并且与 `ohno status --json` 显示同一份数据：

- **NOW**：当前任务、用户可见期望和精确测试；
- **PROOF / DRIFT**：证据是否新鲜、当前被什么阻塞；
- **NEXT / PLAN BOARD**：唯一下一步以及线性计划做到哪里。

```bash
ohno cockpit                       # 使用空闲本机端口启动
ohno cockpit --port 13521          # 可选固定端口
ohno cockpit --replace             # 替换本仓库正在运行的驾驶舱
ohno cockpit stop
```

每个仓库或 worktree 都有自己的 `.ohno/` 状态和驾驶舱。页面只轮询本机
只读状态接口；它不是 daemon，也不是第二份状态仓库。

---

<a id="eighteen-sins"></a>

## Codex 的十八宗罪

“十八宗罪”是正式名称。它们是 18 种经过隐私清理、彼此独立的失败模式；
并不是说每次 Codex 运行都会失败。

| # | 模式 | 你会看到什么 |
| ---: | --- | --- |
| 1 | 越俎代庖 | 一个窄需求被悄悄做成更大的产品或架构 |
| 2 | 把含糊词解释到最大 | “管控”“稳健”等词被解释到最高保证级别 |
| 3 | 完成以后不停 | 验收已经通过，Agent 仍继续修改或自行开启新阶段 |
| 4 | 把审查当修改权 | 只读审计变成未经授权的改代码和提交 |
| 5 | 旧权威复活 | 旧计划或旧摘要压过 Owner 最新决定 |
| 6 | 用摘要改写真相 | 压缩交接中的遗漏在下一会话变成虚假历史 |
| 7 | 局部绿灯冒充完成 | 一个单测或 mock 通过，就声称整个功能完成 |
| 8 | 同一 Agent 自证闭环 | 同一 Agent 定成功标准、做实现，再引用自己当证明 |
| 9 | 测试剧场 | 测试只证明内部路径，用户真正使用的路径仍坏着 |
| 10 | 代理目标反客为主 | 覆盖率、架构洁癖或 Reviewer 口味压过 Owner 结果 |
| 11 | Reviewer 扩大分母 | 审查加入从未冻结的新标准，任务永远无法结束 |
| 12 | 对控制税失明 | 护栏本身比它防住的漂移更慢、更重 |
| 13 | 重造轮子 | 价值交付前，先用新平台替换 Git、测试和简单文件 |
| 14 | 工作区混乱 | 工作落在错误分支、worktree、HEAD 或脏检出上 |
| 15 | 把交接税转嫁给用户 | 每个新会话都要重新从聊天考古项目现场 |
| 16 | 用户体验最后偿还 | 内部机器不断增长，用户界面仍通用、粗糙或没验收 |
| 17 | 附和与过度自信 | 道歉以后，立刻给出另一个没有证据的大承诺 |
| 18 | 道歉没有变成约束 | 解释了失败，却没有改变测试或工作规则 |

完整事故审计和证据边界：
[`docs/CODEX-SINS.md`](./docs/CODEX-SINS.md)。

---

<a id="install"></a>

## 安装

需要 Node.js **22.20 或更高版本**。

```bash
npm install -g oh-no-codex

cd your-git-repo
ohno init --goal "Owner 项目目标"
ohno install
ohno doctor
```

`ohno install` 会添加项目 hooks，并安装 `oh-no-*` Codex skills。安装 skill
后请新开一个 Codex 会话，让 skill discovery 重新加载。

也可以单独刷新 skills：

```bash
ohno skill install
ohno skill status
```

### Windows

把全局 npm bin 目录加入 `PATH`，然后在终端运行 `ohno` 或 `ohno.cmd`。
不要双击 `dist\cli.js`；Windows Script Host 无法运行这个 ESM 入口。

### 已有代码或做到一半的仓库

Oh No 可以安装在现有代码旁边，但它不会根据 Git 历史自动猜出旧真相、
已完成工作或正确计划。

1. 用**当前阶段**目标初始化，而不是塞入整个历史愿景。
2. 用 Owner 原话记录已经成立的事实、本阶段必须交付、非目标和硬约束。
3. 审阅哪些 PRD、设计、验收、计划、README 和 Agent 文件仍是当前权威；Truth 只保留一套作准文件。
4. Plan 只安排仍需用户可见黑盒证明的工作，不要伪造历史 PASS 收据。
5. 启动 cursor 任务，在文件边界内工作，让 `ohno verify` 决定是否推进。

```bash
ohno init --goal "当前阶段 Owner 目标"
ohno install
ohno doctor
ohno requirements note --text "这个仓库里已经成立的事实"
ohno requirements note --text "本阶段仍然必须交付的结果"
```

接入后若权威需求发生变化，使用 `ohno change`；不要手改
`.ohno/state.json`，也不要静默替换计划。

---

<a id="daily-use"></a>

## 日常使用

### 最小闭环

平时可以直接对 Codex 说“起草一份有边界的计划”。安装后的 `oh-no-plan`
skill 会准备计划文件和审阅流程；想自己确定性执行时，使用下面同一套命令。

```bash
ohno requirements note --text "Owner 原话，勿改写"  # 真正作出决定时记录
ohno plan propose --file plan.json
ohno plan accept --revision <rev> --diff <digest>
ohno task start
# Codex 只做冻结任务和允许文件
ohno verify
ohno resume
ohno next
```

- 精确测试以 0 退出，且作用域文件前后不变，才产生新鲜 PASS 并推进一次。
- FAIL、超时、状态不可读或测试期间文件变化，都会把任务留在当前项。
- `next` 只说明计划做到哪里，不授权 Agent 自己发明下一项工作。

### 在 Codex 里直接说人话

安装后的 skills 会把普通说法映射到正确流程：

| 你怎么说 | Skill / 命令 |
| --- | --- |
| “把这条需求原样记下来” | `oh-no-requirements` → `ohno requirements note` |
| “起草或审阅有边界的计划” | `oh-no-plan` |
| “开始当前任务” | `oh-no-task` → `ohno task start` |
| “我觉得这项做完了” | `oh-no-verify` → `ohno verify` |
| “现在做到哪里了？” | `oh-no-resume` / `ohno status` |
| “需求变了” | `oh-no-change` |
| “打开看板” | `oh-no-cockpit` → `ohno cockpit` |
| “检查安装是否正常” | `oh-no-doctor` |

Owner 决定应该进入 `.ohno/REQUIREMENTS.md`，不能只留在聊天里。同一仓库
里的所有 Codex 会话读取同一组项目文件，因此新会话不必相信旧聊天摘要。

---

<a id="limits-evidence"></a>

## 诚实边界与证据

Oh No 是协作式本机护栏，不是自主 Agent OS 或安全边界。它无法阻止
`--no-verify`、同一用户直接写文件、不受支持的托管工具，或故意无视所有
规则的 Agent。

它也不会用 NLP 自动判断文案语义，不会自动重建半成品项目，更不保证所有
仓库都绝对正确、绝对快速。驾驶舱进度是 `cursor / task_count`，不是产品
完成百分比。

| 公开事实 | 当前证据 |
| --- | --- |
| npm 包 | [`oh-no-codex@0.1.10`](https://www.npmjs.com/package/oh-no-codex) 已发布 |
| 核心闭环 | `ANTI_DRIFT_CORE_WORKS`，有本机公开黑盒覆盖 |
| 真实项目试验 | 三份小型可丢弃项目副本 `TRIAL_PASS`；不是大仓普遍保证 |
| 驾驶舱 | 与 CLI 状态同源，并经过浏览器和本机状态反射检查 |

精确合同与证据：

- [产品合同](./docs/PRODUCT-CONTRACT.md)
- [设计](./docs/DESIGN.md)
- [验收合同](./docs/ACCEPTANCE.md)
- [实施台账](./docs/IMPLEMENTATION-PLAN.md)
- [驾驶舱设计合同](./docs/COCKPIT-DESIGN-CONTRACT.md)
- [发布流程](./docs/PUBLISH.md)

---

<p align="center">
  <sub>MIT · 独立社区项目 · 与 OpenAI 无隶属关系</sub>
</p>

<p align="center"><a href="#readme-top">↑ 顶部</a></p>
