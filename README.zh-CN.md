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
  <strong>给 Codex vibe coding 的本机防漂移 harness</strong><br>
  <em>让它干活。一飘，就用 Truth 拉回来。</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/oh-no-codex"><img alt="npm" src="https://img.shields.io/npm/v/oh-no-codex?style=flat-square&color=74D6B1&labelColor=202624&label=npm"></a>
  <img alt="status" src="https://img.shields.io/badge/status-ANTI_DRIFT_HARNESS-3DDC97?style=flat-square&labelColor=202624">
  <img alt="node" src="https://img.shields.io/badge/node-%3E%3D22.20-74D6B1?style=flat-square&labelColor=202624">
  <img alt="codex" src="https://img.shields.io/badge/for-Codex-FF4B35?style=flat-square&labelColor=202624">
  <a href="./LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-FFF1CE?style=flat-square&labelColor=202624"></a>
</p>

<p align="center">
  <a href="#why">为什么</a> ·
  <a href="#what">Oh No 做什么</a> ·
  <a href="#eighteen-sins">十八宗罪</a> ·
  <a href="#how">怎么工作</a> ·
  <a href="#install">安装</a> ·
  <a href="#cockpit">驾驶舱</a> ·
  <a href="#limits">边界</a>
</p>

---

<a id="why"></a>

## 为什么需要它

Codex 很会写代码，也仍然会把项目带偏：

- 没读设计 / 需求就开写  
- 单测绿了就说「做完了」  
- 验收通过还继续扩 scope  
- 新开一个 session，又要从聊天里考古「我们做到哪了」  

这些不是模型「不够聪明」那么简单，而是 **没有绑在真相上**。  
公开事故审计把它们写成了 [**Codex 的十八宗罪**](./docs/CODEX-SINS.md)。

**Oh No 不是第二个项目管理软件，也不是沙箱 OS。**  
它是一层 **本机、合作式 harness**：把 Codex 箍在 **Owner 原话 + 设计文档 + 有边界的任务 + 真实黑盒证明** 上。

> **让它干活。一飘，就用 Truth 拉回来。**  
> 不是每写一行代码都强制读经——那是控制税，不是防偏。

---

<a id="what"></a>

## Oh No 做什么（一句话统筹）

在真实 Codex 会话里，Oh No 干的是同一件事，不论项目新旧：

| 作用 | 你看到什么 |
| --- | --- |
| **记真相** | 你的提示词进 OWNER-INPUTS；需求与设计进 `.ohno`；最新 Owner 话优先 |
| **定阶段** | 澄清 / 设计 / 计划 / 执行——hooks 注入 `OHNO_PROMPT_RAILS`，提醒别跳步乱写 |
| **钉任务** | 计划板：每刀有 expect、硬测、文件范围；一次只 ACTIVE 一个 |
| **验完成** | 只有 `ohno verify` 算过；假黑盒、散文自证不算 |
| **拉漂移** | 软测、出范围、卡住时：回读 Truth / 设计 / 合同，再改实现或改计划 |
| **可续跑** | 下一 session 看 `ohno` / resume / 驾驶舱，不用聊天考古 |

人几乎只做：

```text
ohno setup   →   跟 Codex 说话   →   （可选）ohno / verify / cockpit
```

内部由 **hooks + skills + state** 推：注入法律、记原话、跟板子、跑验收。

**场测一句话：**  
空仓能从「一句话需求」自动走到调研、设计、拆刀、实现与 verify；存量大项目能在大文档与长会话里继续按板推进、用验收防假完成——**同一套 harness，不同项目只是刀多刀少。**

---

<a id="eighteen-sins"></a>

## Codex 的十八宗罪

正式名称。18 种独立失败模式——**不是**说每次都会翻车。

| # | 模式 | 你会看到什么 |
| ---: | --- | --- |
| 1 | 越俎代庖 | 窄需求被做成更大产品或架构 |
| 2 | 把含糊词解释到最大 | 「稳健」「管控」被抬到军工级 |
| 3 | 完成以后不停 | 验收过了仍继续改 |
| 4 | 把审查当修改权 | 只读审计变成擅自提交 |
| 5 | 旧权威复活 | 旧计划压过你的最新决定 |
| 6 | 用摘要改写真相 | 压缩交接变成假历史 |
| 7 | 局部绿灯冒充完成 | mock 绿 = 功能完成 |
| 8 | 同一 Agent 自证闭环 | 自己定标准、自己当证据 |
| 9 | 测试剧场 | 内部路径绿，用户路径仍坏 |
| 10 | 代理目标反客为主 | 覆盖率洁癖压过你的结果 |
| 11 | Reviewer 扩大分母 | 审查加从未冻结的标准 |
| 12 | 对控制税失明 | 护栏比漂移更重 |
| 13 | 重造轮子 | 交付前先换平台 |
| 14 | 工作区混乱 | 错分支 / worktree |
| 15 | 交接税给用户 | 每 session 从聊天考古 |
| 16 | 体验最后偿还 | 机器膨胀，界面粗糙 |
| 17 | 附和与过度自信 | 道歉后再来空头承诺 |
| 18 | 道歉没有变成约束 | 解释了失败，规则没变 |

完整审计：[`docs/CODEX-SINS.md`](./docs/CODEX-SINS.md)。

Oh No 用 **提示词法律（`OHNO_PROMPT_RAILS`）+ 状态板 + verify** 对着这些模式下手——合作式约束，不是魔法免疫。

---

<a id="how"></a>

## 怎么工作

```text
你：ohno setup 一次，然后只跟 Codex 聊
     │
     ▼
Hooks  ──►  记下你的原话 + 注入 OHNO_PROMPT_RAILS（十八宗罪 / 读 Truth / 少问 Owner…）
     │
     ▼
.state  ──►  .ohno/state.json = 唯一当前权威（任务、证明、下一步）
     │
     ▼
Codex ──►  澄清 → 设计 → 拆刀 → 实现 → ohno verify
     │
     ▼
飘了  ──►  回读 Truth / 设计 / 冻结合同 → 改代码或改计划 → 再 verify
```

### 人会用到的命令

```bash
ohno setup       # 一次：init + hooks + skills
ohno             # 一眼：状态 + 下一步
ohno pipeline    # 给 Agent 的精确下一步
ohno verify      # 唯一「做完了」证明
ohno doctor      # 安装与健康检查
ohno cockpit     # 只读驾驶舱（可选）
```

日常你可以说人话；装好的 `oh-no-*` skills 会把 Codex 导向这些命令。

---

<a id="install"></a>

## 安装

需要 Node.js **≥ 22.20**。

```bash
npm install -g oh-no-codex

cd your-git-repo
ohno setup
# 新开一个 Codex 会话，再开始聊
```

从源码（当前默认 `main`）：

```bash
git clone https://github.com/t01089572455/oh-no-codex.git
cd oh-no-codex
npm install && npm run build && npm install -g .
```

**已有项目：** setup 不会根据 Git 历史自动猜旧真相。把当前目标、已成立事实写进需求/Truth，再 plan；不要伪造历史 PASS。

**需求变了：** 用 change / 重新澄清与封存路径，不要手改 `.ohno/state.json` 装完成。

---

<a id="cockpit"></a>

## 驾驶舱

<p align="center">
  <img
    src="./assets/brand/oh-no-cockpit.png"
    width="960"
    alt="Oh No, Codex! 驾驶舱"
  >
</p>

<p align="center">
  <sub>与 CLI 同一份 state 的只读视图。cursor 是「本计划」进度，不是整个产品完成度。</sub>
</p>

```bash
ohno cockpit
```

---

<a id="limits"></a>

## 边界（诚实）

- **合作式护栏**，不是 OS 级沙箱；模型仍可能无视提示词。  
- **不做法官式语义理解**（不判「读懂没」）；做的是 **读文档、跟板子、真验收**。  
- **漂移时拉回**，不是每一步强制读 Truth。  
- 完成证明依赖 **冻结的用户可见测试**；测写软了，护栏也硬不起来。  
- 不能替你决定产品方向；你的总目标仍是 Owner 的。

---

## 许可证

[MIT](./LICENSE)
