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
  <a href="#eighteen-sins">十八宗罪</a> ·
  <a href="#cockpit">驾驶舱</a> ·
  <a href="#install-use">安装与使用</a> ·
  <a href="#how-control-works">怎样控制</a> ·
  <a href="#limits-evidence">边界与证据</a>
</p>

---

<a id="why-oh-no"></a>

## 为什么需要 Oh No？

Codex 可以写出不错的代码，却仍把项目带向错误方向：扩大原需求、验收通过后
继续乱做、复活过期计划，或者让下一会话重新从聊天里考古项目现场。

Oh No, Codex! 在现有开发流程外加一层很小的本机护栏。它让 Owner 原话、
一个有边界的任务、一条精确黑盒测试、新鲜证据和唯一下一步跨会话可读。

这些反复出现的问题被整理成一份公开事故审计：
[**Codex 的十八宗罪**](./docs/CODEX-SINS.md)。

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

<a id="cockpit"></a>

## 驾驶舱

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

驾驶舱是 CLI 同一份项目状态的只读视图。它显示当前任务和精确测试、证据
新鲜度、阻塞原因、计划位置与唯一下一步，不会建立第二套真相。

---

<a id="install-use"></a>

## 安装与使用

需要 Node.js **22.20 或更高版本**。当前版本：**`0.3.0`**。
### 新仓库或空仓库

```bash
npm install -g oh-no-codex

cd your-git-repo
ohno setup    # init + hooks + skills（phase=DISCOVER）
# 主要对 Codex 说话。流水线（多由 Agent 跑）：
#   seal-requirements → seal-design → plan accept → task/verify
#   FAIL → truth-read → 再改；需求变 → declare-change → 再 seal
```

`ohno install` 会添加项目 hooks，并安装 `oh-no-*` Codex skills。安装后请
新开一个 Codex 会话，让 skill discovery 重新加载。

也可以单独刷新 skills：

```bash
ohno skill install
ohno skill status
```

### 已有代码或做到一半的仓库

Oh No 可以安装在现有代码旁边，但它不会根据 Git 历史自动猜出旧真相、
已完成工作或正确计划。

1. 用**当前阶段**目标初始化，而不是塞入整个历史愿景。
2. 由可信 prompt hook 把新的 Owner 原话保存在 `.ohno/OWNER-INPUTS.md`，再把已成立事实、本阶段交付、非目标和硬约束整合进 `.ohno/REQUIREMENTS.md`。
3. 审阅哪些 PRD、设计、验收、计划、README 和 Agent 文件仍是当前权威；Truth 只保留一套作准文件。
4. Plan 只安排仍需用户可见黑盒证明的工作，不要伪造历史 PASS 收据。
5. 接受审阅后的计划；Codex 随后自动启动 cursor、在边界内工作、修复证明、验证并推进。

```bash
ohno init
ohno install
ohno doctor
ohno requirements note --text "这个仓库里已经成立的事实"
ohno requirements note --text "本阶段仍然必须交付的结果"
```

接入后若权威需求发生变化，使用 `ohno change`；不要手改
`.ohno/state.json`，也不要静默替换计划。

### 日常闭环

平时可以直接对 Codex 说“起草一份有边界的计划并做完”。安装后的
`oh-no-plan` skill 会在 PREPARE 阶段解决实质歧义并审阅计划。计划接受后，
Codex 会跨普通任务边界自动执行，不再反复确认。底层确定性命令仍可直接使用：

```bash
ohno                    # 一屏 harness 简报
ohno next | ohno task start | ohno verify
# 任务形状：id + expect + test + scope（其余有默认）
# plan propose/accept：短垂直切片（进阶）
```

- 精确测试以 0 退出，且作用域文件前后不变，才产生新鲜 PASS 并推进一次。
- FAIL、超时、状态不可读或测试期间文件变化，都会把任务留在当前项。
- `next` 只定位计划做到哪里，不授权 Agent 自己发明更多工作；已接受计划会授权 Codex 自动执行这个规范下一步。
- Oh No 只在 `PROJECT_COMPLETE` 或真正、任务绑定的 `NEEDS_INPUT` 停止，例如缺少密钥/设备/业务事实、未授权付费或破坏性动作、没有诚实验收路径、状态或平台阻塞；输入补齐后继续同一份已接受计划。

### 在 Codex 里直接说人话

| 你怎么说 | Skill / 命令 |
| --- | --- |
| “整合这条当前有效需求” | `oh-no-requirements` → `ohno requirements note` |
| “起草或审阅有边界的计划” | `oh-no-plan` |
| “开始当前任务” | `oh-no-task` → `ohno task start`（计划接受后自动） |
| “我觉得这项做完了” | `oh-no-verify` → `ohno verify`（自动证明闭环） |
| “现在做到哪里了？” | `oh-no-resume` / `ohno status` |
| “需求变了” | `oh-no-change` |
| “打开看板” | `oh-no-cockpit` → `ohno cockpit` |
| “检查安装是否正常” | `oh-no-doctor` |

可信 `UserPromptSubmit` hook 会把新的精确提示追加到本地私有
`.ohno/OWNER-INPUTS.md`；`.ohno/REQUIREMENTS.md` 保存 Codex 当前解释和可见历史，
重要内容引用 input id。Oh No 不能可靠判断哪条提示才是最终决定，也不能恢复旧提示、
覆盖其他客户端或被绕过/未信任的 hook。

### 打开驾驶舱

```bash
ohno cockpit                       # 使用空闲本机端口启动
ohno cockpit --port 13521          # 可选固定端口
ohno cockpit --replace             # 替换本仓库正在运行的驾驶舱
ohno cockpit stop
```

每个仓库或 worktree 都有自己的 `.ohno/` 状态和驾驶舱。

### Windows

把全局 npm bin 目录加入 `PATH`，然后在终端运行 `ohno` 或 `ohno.cmd`。
不要双击 `dist\cli.js`；Windows Script Host 无法运行这个 ESM 入口。

---

<a id="how-control-works"></a>

## Oh No 怎样控制开发流程

安装以后，控制来自项目文件和明确检查点，而不是一条更长的提示词：

1. **Owner 原话与 Codex 解释分开保存。** 可信 hook 把精确提示追加到本地私有 `.ohno/OWNER-INPUTS.md`；Codex 在 `.ohno/REQUIREMENTS.md` 整合当前含义和可见历史。
2. **一次只冻结一个任务。** 当前计划项固定期望行为、一条黑盒测试、允许文件、预算和停止条件。
3. **受支持的写入会被约束。** Codex hooks 与 Git pre-commit 拒绝无任务、文档待审和可解析的越界修改。
4. **只有证据能推进计划。** `ohno verify` 运行冻结命令；FAIL / UNKNOWN 留在当前项，新鲜 PASS 只推进一次。
5. **所有界面读取同一状态。** `status`、`resume`、`next`、hooks 和驾驶舱对项目位置给出一致答案。
6. **接受后的计划自动执行。** Stop hook 返回带规范下一步的 `OHNO_AUTO_CONTINUE`；真正启动、修复、验证和推进的是 Codex，不是 hook。
7. **需求变化会暂停编码。** `ohno change` 按 Owner 维护的 Truth 清单工作，并要求审阅权威文档 diff 和替代计划；清晰的新 Owner 意图无需再次口头确认。

### Authority / 权威关系

```text
ohno CLI  ──原子替换──►  .ohno/state.json   （唯一运行时权威）
                              │
                              ├─ status / resume / next
                              ├─ Codex hooks + Git pre-commit
                              └─ GET /api/state  →  驾驶舱（只读）

.ohno/truth.json  →  需求变化时哪些 Owner 文档适用
```

| 产物 | 作用 |
| --- | --- |
| `.ohno/state.json` | 当前目标、计划、cursor、活跃合同、证明和下一步 |
| `.ohno/OWNER-INPUTS.md` | 本地私有、追加式可信 hook 原始提示证据；不负责判定最终需求 |
| `.ohno/REQUIREMENTS.md` | Codex 当前解释与可见替代历史，重要内容引用 Owner input id |
| `.ohno/truth.json` | Owner 维护的权威文档适用清单 |
| PASS 收据 | 验证溯源与新鲜度证据；不是另一份当前权威 |
| `PROGRESS.md` / resume 文案 / 驾驶舱 | 当前状态的只读投影 |
| `.ohno/cockpit.runtime.json` | 本机驾驶舱 pid / URL 指针 |

协作式 hooks 会注入 resume 胶囊并拒绝部分越界写入。同一用户进程仍然可以
绕过它们；这是明确的非目标。

---

<a id="limits-evidence"></a>

## 诚实边界与证据

Oh No 是协作式本机护栏，不是自主 Agent OS 或安全边界。它无法阻止
`--no-verify`、同一用户直接写文件、不受支持的托管工具，或故意无视所有
规则的 Agent。

它不会用 NLP 自动判断文案语义，不会自动重建半成品项目，也不保证所有仓库
都绝对正确、绝对快速。驾驶舱进度是 `cursor / task_count`，不是产品完成
百分比。
自动执行只移除 Oh No 自己的对话确认仪式；它不能压制 Codex 或操作系统的安全审批。

| 公开事实 | 当前证据 |
| --- | --- |
| npm 包 | [`oh-no-codex@0.3.0`](https://www.npmjs.com/package/oh-no-codex) 已发布 |
| 核心闭环 | `ANTI_DRIFT_CORE_WORKS`，有本机公开黑盒覆盖 |
| Harness 面 | `0.2.0+`：id+expect+test+scope、scope 钩子、硬黑盒、短 `OHNO_CONTINUE`；**不限制 plan 任务数**；放宽写作字数；acceptance_source 可省略 |
| 真实项目试验 | 当前本地 Correction 5 package subject 已在三个具名一次性副本上获得同批次 LIVE `TRIAL_PASS`（`live-20260805T064039Z-834bc92`）；这不是普遍速度或已发布包声明 |
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
