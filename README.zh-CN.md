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
  <strong>再强的 Agent 也会跑偏。</strong><br>
  本地 harness：冻结一块任务，用用户可见的黑盒证明它，<br>
  做完就停 — 而不是「看起来做完了」。
</p>

<p align="center">
  <code>一个目标</code>&nbsp;&nbsp;·&nbsp;&nbsp;<code>一块任务</code>&nbsp;&nbsp;·&nbsp;&nbsp;<code>一条测试</code>&nbsp;&nbsp;·&nbsp;&nbsp;<code>通过就停</code>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/oh-no-codex"><img alt="npm" src="https://img.shields.io/npm/v/oh-no-codex?style=flat-square&color=74D6B1&labelColor=202624&label=npm"></a>
  <img alt="状态" src="https://img.shields.io/badge/status-V1_TRIAL_ACCEPTED-74D6B1?style=flat-square&labelColor=202624">
  <img alt="codex" src="https://img.shields.io/badge/for-Codex_CLI-FF4B35?style=flat-square&labelColor=202624">
  <img alt="node" src="https://img.shields.io/badge/node-%E2%89%A522.20-74D6B1?style=flat-square&labelColor=202624">
  <a href="./LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-FFF1CE?style=flat-square&labelColor=202624"></a>
</p>

<p align="center">
  <a href="#为什么需要它">为什么</a> ·
  <a href="#十八宗罪">十八宗罪</a> ·
  <a href="#规则">规则</a> ·
  <a href="#安装">安装</a> ·
  <a href="#你真正怎么用">使用</a> ·
  <a href="#盒子里有什么">交付</a> ·
  <a href="#证据">证据</a>
</p>

---

## 为什么需要它

Codex 能写出很好的代码，也仍然能把仓库写得比开始更糟。

不是模型弱 — 是**长会话会自己发明权威**。

一句小需求膨胀成平台。  
用户看不见的单测绿了，就宣布完成。  
聊天摘要压过你昨天接受的计划。  
验收过了，「下一步」被当成继续干的授权。

如果你在周五晚上经历过这些，这个仓库是为你写的。

**Oh No, Codex!** 是合作式、本地的 harness —  
不是云产品，不是策略引擎，也不假装能锁死你自己账号下的恶意进程。

---

## 十八宗罪

我们把反复出现的 Codex 失败审成 **十八宗罪**。  
这是产品的敌情表 — 放在正文里，不藏折叠。

| # | 宗罪 | 一句话 |
| ---: | --- | --- |
| 1 | 越俎代庖 | 你要一扇门，它盖一座城。 |
| 2 | 最大解释 | 「控制」变成整套平台。 |
| 3 | 完成以后不停 | 验收过了还继续干。 |
| 4 | 审查变改权 | 「看看」变成「我已经改完了」。 |
| 5 | 僵尸权威 | 旧计划压过你最新决定。 |
| 6 | 摘要当真 | 压缩稿硬化成假历史。 |
| 7 | 局部绿灯 | 一个 mock 当产品完成。 |
| 8 | 自证闭环 | 同一 Agent 写主张也写掌声。 |
| 9 | 测试戏剧 | 内部全绿，用户路径仍坏。 |
| 10 | 代理目标 | 覆盖率压过你的结果。 |
| 11 | 审稿膨胀 | 验收项越加越多。 |
| 12 | 控制税 | 工具比跑偏本身更贵。 |
| 13 | 重造世界 | 丢掉 Git 和普通测试。 |
| 14 | 工作区混乱 | 写进错误树或脏目录。 |
| 15 | 交接税 | 新 Session 先考古聊天。 |
| 16 | 体验最后还 | 内部堆几周，UI 未过浏览器。 |
| 17 | 附和与吹 | 秒道歉 + 无证据承诺。 |
| 18 | 道歉无约束 | 软软对不起，明天再犯。 |

完整审计（脱敏）：[`docs/CODEX-SINS.md`](./docs/CODEX-SINS.md)。

Oh No **不会**为十八宗罪各造十八个衙门。  
它只留几条硬边：**Owner 原话、一块任务、黑盒 verify、单一状态文件、停就是停。**

---

## 规则

<p align="center">
  <img
    src="./assets/brand/oh-no-loop.png"
    width="880"
    alt="目标 → 任务 → 证明 → 停下"
  >
</p>

| 时刻 | 没有它 | 有 Oh No |
| --- | --- | --- |
| **开工** | 任务未冻就开始写 | 只启光标任务：行为、一条测试、文件、预算、停止 |
| **收工** | 「看着行」 | `ohno verify` 跑精确黑盒 |
| **改需求** | 文档落后代码狂奔 | 展示治理 diff，换 plan 前拦住编码 |
| **恢复** | 聊天考古 | `ohno resume`：目标、证明、阻塞、下一步 |

**唯一运行时权威：** `.ohno/state.json`  
其余全部是**投影**，不是第二真相。

---

## 安装

```bash
npm install -g oh-no-codex
cd your-git-repo
ohno init --goal "让草稿保存可靠"
ohno install
```

需要 **Node.js ≥ 22.20** 与普通 Git 仓库。  
包：[npm 上的 oh-no-codex](https://www.npmjs.com/package/oh-no-codex)（`0.1.1`）。

---

## 你真正怎么用

`init` + `install` 之后，多数时候**对 Codex 说话**。  
Hooks 注入 resume、刷新投影、协作拦越权写。

| 你的意思 | Codex 执行 |
| --- | --- |
| 开工 | `ohno task start`（或先 plan） |
| 做完了 | **只** `ohno verify` |
| 需求变了 | `ohno change begin --summary "…"` |
| 记下来 | `ohno requirements note --text "…"` |
| 卡在哪 | `ohno resume` / `ohno doctor` |

映射写在 `AGENTS.md` 托管块。可选：[`skills/oh-no-control/SKILL.md`](./skills/oh-no-control/SKILL.md)。

```bash
ohno cockpit          # 只读玻璃看板，与 status --json 同源
ohno preferences show # 默认：先调研、复用开源、前端先抄再改
```

**永不静默：** 未审 accept · 伪造 PASS · 把 `next` 当空白支票。

---

## 盒子里有什么

| 表面 | 作用 |
| --- | --- |
| `plan` · `task` · `verify` | 有界开工 → 证据收工 |
| `status` · `resume` · `next` · `doctor` | 秒级恢复 |
| `change` | 诚实需求与文档同步 |
| `projectors` | PROGRESS + AGENTS 胶囊 |
| `preferences` · `requirements` | 工艺开关 + Owner 日志 |
| hooks · pre-commit | 合作式护栏 |
| `cockpit` | 只读任务板 |

**V1 故意没有：** 数据库、守护进程、技能市场、多 Agent 调度、敌对同用户硬隔离。

---

## 证据

诚实是品牌的一部分（第 17 宗）。

| 主张 | 标签 |
| --- | --- |
| 公开状态 | `V1_TRIAL_ACCEPTED` |
| CLI / hooks / 原子状态 | `LOCAL_PASS` |
| 驾驶舱 = status JSON | `LOCAL_PASS` |
| 可弃用真实副本 | `TRIAL_PASS`（P01–P06） |
| npm | **`0.1.1`** |

本地试验 p95（命名副本，非普适 SLA）：`status`/`next`/`resume` 百毫秒级，驾驶舱反射 &lt; 80 ms 级。

合同：[产品](./docs/PRODUCT-CONTRACT.md) · [设计](./docs/DESIGN.md) · [验收](./docs/ACCEPTANCE.md) · [账本](./docs/IMPLEMENTATION-PLAN.md)

---

## 什么时候值得 star

- 你用 Codex vibe coding，周末被跑偏吃掉  
- 你要的是**停止条件**，不是又一个编排框架  
- 你更信**可测标签**，而不是 “production-ready” 表演  

贡献约定：切片要小，黑盒要用户可见，不要发明第二权威。

---

<p align="center">
  <sub>MIT · 独立社区项目 · 与 OpenAI 无隶属关系</sub>
</p>

<p align="center">
  <strong>量清任务。证明行为。停下 Agent。</strong>
</p>

<p align="center"><a href="#readme-top">↑ 顶部</a></p>
