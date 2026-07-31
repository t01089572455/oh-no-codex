<a id="readme-top"></a>

<div align="center">

[English](./README.md) · [**简体中文**](./README.zh-CN.md)

</div>

<br>

<p align="center">
  <img
    src="./assets/brand/oh-no-codex-lockup.png"
    width="920"
    alt="Oh No, Codex!：淘气的蓝色编程玩偶正要继续操作时，被清晰的红叉拦住"
  >
</p>

<p align="center">
  <strong>Codex 能写出很好的代码，也仍然能把项目写歪。</strong><br>
  Oh No 是本地 harness，用来在 vibe coding 时<strong>把项目拉回对齐</strong>：<br>
  一个目标、一块冻结任务、一条用户可见的黑盒、新鲜证据 — 以及<strong>这一刀任务</strong>的干净收口。
</p>

<p align="center">
  <code>对齐</code>&nbsp;&nbsp;·&nbsp;&nbsp;<code>有界</code>&nbsp;&nbsp;·&nbsp;&nbsp;<code>证明</code>&nbsp;&nbsp;·&nbsp;&nbsp;<code>恢复</code>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/oh-no-codex"><img alt="npm" src="https://img.shields.io/npm/v/oh-no-codex?style=flat-square&color=74D6B1&labelColor=202624&label=npm"></a>
  <img alt="状态" src="https://img.shields.io/badge/status-V1_TRIAL_ACCEPTED-74D6B1?style=flat-square&labelColor=202624">
  <img alt="codex" src="https://img.shields.io/badge/for-Codex_CLI-FF4B35?style=flat-square&labelColor=202624">
  <img alt="node" src="https://img.shields.io/badge/node-%E2%89%A522.20-74D6B1?style=flat-square&labelColor=202624">
  <a href="./LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-FFF1CE?style=flat-square&labelColor=202624"></a>
</p>

<p align="center">
  <a href="#真正的问题">问题</a> ·
  <a href="#十八宗罪">十八宗罪</a> ·
  <a href="#ohnocodex-是干什么的">它干什么</a> ·
  <a href="#安装">安装</a> ·
  <a href="#日常怎么用">日常</a> ·
  <a href="#证据">证据</a>
</p>

---

## 真正的问题

主问题**不是**「Codex 服务没关干净」。  
主问题是 **一边写代码一边跑偏（drift）**：仓库离你要的东西越来越远，而 Agent 看起来还在「很勤奋」。

常见形态：

| 优先级 | 出什么事 | 例子 |
| --- | --- | --- |
| **1 · 语义与范围** | 把你的话解释大、解释偏 | 「草稿保存」变成一整套平台 |
| **2 · 假完成** | 内部绿灯 ≠ 用户看得见的成功 | mock 绿了，刷新草稿还是丢 |
| **3 · 真相丢失** | 聊天 / 旧计划压过项目状态 | 新 Session 靠聊天考古重建现场 |
| **4 · 这一刀收不掉** | 真验收过了还继续摊大 | 把「下一步」当成可以随便开新阶段的授权 |

第 4 点是真的（十八宗罪第 3 条），但只是**跑偏的一种症状**，不是产品的全部定义。

我们真正优化的，是新 Session 能否从**项目文件**里立刻回答：

1. Owner 要达成什么？  
2. 已经完成了什么？  
3. **当前唯一**有边界的任务是什么？  
4. 用户可见行为 + **精确**测试命令是什么？  
5. 卡在哪？  
6. **唯一下一步**是什么？（只是**定位**，不是新授权）

这就是产品合同的白话版。

---

## 两句容易读歪的话（先说清楚）

### 「验收之后，下一步被当成可以继续干」

意思是：

- 某一刀任务已经 PASS 了；  
- Agent 却把 `next` / 「下一步建议」当成**新权限**，自动开下一坨未授权工作。  

Oh No 的处理是：`next` **只告诉你计划里下一刀是什么**，**不等于**已经批准开工；新一刀仍要冻结合同、再 `task start` / `verify`。

### 「冻结任务 + 黑盒 + 停下」

意思是：

| 说法 | 正确含义 | 不是 |
| --- | --- | --- |
| 冻结任务 | 写代码前把行为、测试、文件范围、停止条件写死 | 冻结整个 Codex 软件 |
| 用户可见黑盒 | 用你关心的那条命令证明（例如保存后刷新仍在） | 只跑内部 mock 就叫完成 |
| 停下 | **这一刀任务**收口，禁止假完成、禁止摊成平台 | **关掉 Codex 服务 / 退出应用** |

---

## 十八宗罪

长会话失败模式的点名表 — 设计敌情，不是十八个新功能。

| # | 宗罪 | 一句话 |
| ---: | --- | --- |
| 1 | 越俎代庖 | 你要门，它盖城。 |
| 2 | 最大解释 | 「控制」变成平台。 |
| 3 | 完成以后不停 | 这一刀过了还继续摊。 |
| 4 | 审查变改权 | 「看看」变成偷改。 |
| 5 | 僵尸权威 | 旧计划压过新决定。 |
| 6 | 摘要当真 | 压缩稿变假历史。 |
| 7 | 局部绿灯 | mock 绿 = 产品完成。 |
| 8 | 自证闭环 | 自己写主张自己鼓掌。 |
| 9 | 测试戏剧 | 内部绿、用户路径坏。 |
| 10 | 代理目标 | 覆盖率压过你的结果。 |
| 11 | 审稿膨胀 | 验收项越加越多。 |
| 12 | 控制税 | 工具比跑偏更贵。 |
| 13 | 重造世界 | 丢掉 Git 和普通测试。 |
| 14 | 工作区混乱 | 写错目录/分支。 |
| 15 | 交接税 | 新 Session 先考古。 |
| 16 | 体验最后还 | UI 拖到最后且未验收。 |
| 17 | 附和与吹 | 秒道歉 + 无证据承诺。 |
| 18 | 道歉无约束 | 对不起，明天再犯。 |

全文：[`docs/CODEX-SINS.md`](./docs/CODEX-SINS.md)。

---

## Oh No 是干什么的

**不是**关掉 Codex 应用。  
**是**让每一刀工作：**有界、可证、可恢复**。

<p align="center">
  <img
    src="./assets/brand/oh-no-loop.png"
    width="880"
    alt="目标 → 任务 → 证明 → 收口这一刀（不是关掉 Codex）"
  >
</p>

| 能力 | 含义 |
| --- | --- |
| **冻结任务** | 受支持写入前：用户可见行为、一条黑盒命令、允许文件、时间预算、停止条件 |
| **黑盒证明** | `ohno verify` 跑**那条**命令，不是 Agent 自述 |
| **收口这一刀** | 新鲜 PASS 关闭当前任务并推进计划光标；`next` 只**指向**下一刀，不自动授权乱开 |
| **恢复现场** | `ohno resume` / 驾驶舱读 `.ohno/state.json`（唯一运行时权威） |

Hooks 与 pre-commit 是**合作式护栏**。  
不是敌对安全沙箱。

---

## 安装

```bash
npm install -g oh-no-codex
cd your-git-repo

# --goal = 用一句话说清「这个项目要达成什么」（Owner 原话，自由文本）
ohno init --goal "用户能登录并看到自己的工作台"
ohno install
```

`--goal` **不是**固定咒语或模板名，就是你给项目定的**当前总目标**一句话，
会写进 `.ohno/state.json`。以后要改目标，走需求变更流程，不要再 `init` 一次。

Node.js **≥ 22.20**，普通 Git 仓库。  
npm：[oh-no-codex](https://www.npmjs.com/package/oh-no-codex)（`0.1.1`）。

---

## 日常怎么用

装好后主要**和 Codex 说话**，harness 在下面托着。

| 意图 | 命令 |
| --- | --- |
| 开这一刀 | `ohno task start` |
| 证明这一刀 | **只** `ohno verify` |
| 需求变了 | `ohno change begin --summary "…"` |
| 记下 Owner 原话 | `ohno requirements note --text "…"` |
| 现在卡在哪 | `ohno resume` · `ohno doctor` · `ohno cockpit` |

对话映射在 `AGENTS.md` 托管块；可选 [`skills/oh-no-control/SKILL.md`](./skills/oh-no-control/SKILL.md)。

工艺默认（可关）：先调研、复用开源、前端基于参考改 — `ohno preferences show`。

**永不静默：** 未审 accept · 伪造 PASS · 把 `next` 当空白支票。

---

## 盒子里有什么

| 表面 | 作用 |
| --- | --- |
| `plan` · `task` · `verify` | 有界 → 证明 → 收口 |
| `status` · `resume` · `next` · `doctor` | 不用聊天考古 |
| `change` | 需求与治理文档同步 |
| `projectors` · `preferences` · `requirements` | 进度、工艺、原话日志 |
| hooks · pre-commit · `cockpit` | 护栏 + 只读看板 |

**V1 故意没有：** 数据库、守护进程、技能市场、多 Agent 操作系统、「绝对安全」。

---

## 证据

| 主张 | 标签 |
| --- | --- |
| 产品状态 | `V1_TRIAL_ACCEPTED` |
| CLI / hooks / 原子状态 | `LOCAL_PASS` |
| 驾驶舱 = `status --json` | `LOCAL_PASS` |
| 可弃用真实副本 | `TRIAL_PASS`（P01–P06） |
| npm | **`0.1.1`** |

合同：[产品](./docs/PRODUCT-CONTRACT.md) · [设计](./docs/DESIGN.md) · [验收](./docs/ACCEPTANCE.md) · [账本](./docs/IMPLEMENTATION-PLAN.md)

---

<p align="center">
  <sub>MIT · 独立社区项目 · 与 OpenAI 无隶属关系</sub>
</p>

<p align="center">
  <strong>对齐项目。证明这一刀。干净收口。</strong>
</p>

<p align="center"><a href="#readme-top">↑ 顶部</a></p>
