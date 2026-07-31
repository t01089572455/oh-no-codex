<a id="readme-top"></a>

<div align="center">

[English](./README.md) · [**简体中文**](./README.zh-CN.md)

</div>

<p align="center">
  <img
    src="./assets/brand/oh-no-codex-lockup.png"
    width="920"
    alt="Oh No, Codex!：淘气的蓝色编程玩偶正要继续操作时，被清晰的红叉拦住"
  >
</p>

<h1 align="center">Oh No, Codex!</h1>

<p align="center">
  <strong>Codex 能写出漂亮代码，也仍然能把项目写歪。</strong><br>
  这套 harness 逼它做<strong>该做的那一块</strong>——做完就停。
</p>

<p align="center">
  <code>一个目标</code> · <code>一个有边界的任务</code> · <code>一个黑盒测试</code> · <code>通过就停</code>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/oh-no-codex"><img alt="npm" src="https://img.shields.io/npm/v/oh-no-codex?style=for-the-badge&color=74D6B1&labelColor=202624"></a>
  <img alt="状态" src="https://img.shields.io/badge/status-V1_TRIAL_ACCEPTED-74D6B1?style=for-the-badge&labelColor=202624">
  <img alt="仅 Codex" src="https://img.shields.io/badge/harness-Codex_only-FF4B35?style=for-the-badge&labelColor=202624">
  <a href="./LICENSE"><img alt="MIT" src="https://img.shields.io/badge/license-MIT-FFF1CE?style=for-the-badge&labelColor=202624"></a>
</p>

<p align="center">
  <a href="#故事">故事</a> ·
  <a href="#十八宗罪">十八宗罪</a> ·
  <a href="#ohnocodex-到底干什么">它干什么</a> ·
  <a href="#60-秒上手">上手</a> ·
  <a href="#日常路径">日常</a> ·
  <a href="#驾驶舱">驾驶舱</a> ·
  <a href="#证据不是感觉">证据</a>
</p>

---

## 故事

你对着 Codex 说一句很克制的话：

> 「先把草稿保存做可靠。」

三小时后：多了一套 provider 抽象、一个插件口、第二份状态文件，还有一份写得
很自信的「已完成」摘要——而草稿刷新仍然丢。

这不是「模型笨」。  
**越强的 Agent，越容易在长任务里跑偏。** 它替你「理解」成更大的题，验收过了
还继续，把聊天摘要当真相，用碰不到用户路径的测试给自己放行。

我们把这些失败模式审到能点名——**Codex 十八宗罪**——然后做了**最小**的 harness：
挡得住跑偏，自己却不变成第二个治理操作系统。

> **Oh No, Codex!** 就是玩偶还想「再重构一下」时，红叉拍下来：  
> **要么证明，要么停下。**

<p align="center">
  <img
    src="./assets/brand/oh-no-loop.png"
    width="920"
    alt="一个目标 → 一个有边界任务 → 一个黑盒 → 然后停下"
  >
</p>

---

## 十八宗罪

这是产品的敌情表。不是附录笑话，也不塞进折叠里装看不见。  
完整审计笔记：[`docs/CODEX-SINS.md`](./docs/CODEX-SINS.md)。

| # | 宗罪 | 长什么样 |
| ---: | --- | --- |
| 1 | **越俎代庖** | 你要一扇门，它盖一座城，还管这叫「对齐」。 |
| 2 | **最大解释** | 「控制」变成平台；「完成」变成永续工程。 |
| 3 | **完成以后不停** | 验收过了，把 `next` 当成新授权。 |
| 4 | **审查变改权** | 「看看」悄悄变成「我已经改完了」。 |
| 5 | **僵尸权威** | 旧计划、分支名、聊天摘要压过你最新决定。 |
| 6 | **摘要当真** | 压缩稿硬化成假历史。 |
| 7 | **局部绿灯冒充完成** | 一个单测、一个 mock —— 当产品能用。 |
| 8 | **自证闭环** | 同一 Agent 写需求、写实现、写成功叙事。 |
| 9 | **测试戏剧** | 内部枝条全绿，用户看得见的路径还是坏的。 |
| 10 | **代理目标反客为主** | 覆盖率、架构洁癖、审稿爽感压过你的结果。 |
| 11 | **审稿放大分母** | 审查不断加验收项，切片永远结不了。 |
| 12 | **控制税失明** | 防跑偏的工具比跑偏本身更贵。 |
| 13 | **重造世界** | 丢掉 Git/文件/普通测试，另起炉灶。 |
| 14 | **工作区身份混乱** | 写进错误目录、分支或脏工作区。 |
| 15 | **交接税甩给用户** | 新 Session 先花一小时从聊天考古。 |
| 16 | **体验最后还** | 内部堆了几周，UI 仍像模板且没过浏览器。 |
| 17 | **附和与过度自信** | 秒回「你说得对」+ 又一轮没证据的承诺。 |
| 18 | **道歉无约束** | 软软对不起，下轮还犯。 |

Oh No **不会**为十八宗罪各造十八个衙门。  
它压成几条硬边：**Owner 原话、一块任务、黑盒 verify、单一状态文件、停就是停。**

---

## Oh No 到底干什么

| 时刻 | 没有它 | 有它 |
| --- | --- | --- |
| **开工** | 任务还没冻就开始写 | 只启动光标任务：行为、一条测试、文件、预算、停止条件 |
| **收工** | 「看着行」/ Agent 自述 | `ohno verify` 跑**精确**黑盒，PASS 绑到 Git 科目 |
| **改需求** | 文档落后、代码狂奔 | `change` 展示治理文档 diff，换 plan 前拦住编码 |
| **恢复** | 聊天考古 | `ohno resume`：目标、看板、证明、阻塞、唯一下一步 |

**唯一运行时权威：** `.ohno/state.json`  
resume、PROGRESS、AGENTS 托管块、驾驶舱 —— 全是**投影**，不是第二真相。

**合作式，不是敌对沙箱。** Hooks 与 pre-commit 是同用户 vibe 的护栏，  
不承诺拦住恶意同权进程。这句故意写清楚（对第 17 宗）。

---

## 60 秒上手

```bash
npm install -g oh-no-codex
cd your-git-project
ohno init --goal "让草稿保存可靠"
ohno install
```

然后打开 Codex 说人话。装完之后，日常主要是**对话**，不是背 CLI。

| 你的意思 | Codex 应执行 |
| --- | --- |
| 开工 | `ohno task start`（或先 plan） |
| 做完了 | **只** `ohno verify` |
| 需求变了 | `ohno change begin --summary "…"` |
| 记下来 | `ohno requirements note --text "…"` |
| 卡在哪 | `ohno resume` / `ohno doctor` |

这张表会写进项目 `AGENTS.md` 托管块。可选副本：  
[`skills/oh-no-control/SKILL.md`](./skills/oh-no-control/SKILL.md)。

**永不静默：** 未审 accept plan、伪造 PASS、把 `next` 当空白支票。

---

## 日常路径

```text
一次     →  npm i -g  ·  ohno init  ·  ohno install
每天     →  和 Codex 说话（hooks 注入 resume、拦写范围、刷投影）
可选     →  ohno cockpit  ·  doctor  ·  preferences  ·  requirements note
```

### 工作方法默认（可关）

`init` 会写入 `.ohno/preferences.json`，默认 **开启**：

- 重大实现前先调研开源  
- 能复用包/模板就复用  
- 前端：基于真实参考改，不从零发明整套 UI  

```bash
ohno preferences show
ohno preferences set --id frontend_adapt_not_invent --enabled false
```

### Owner 需求汇总

那些「千万别先造平台」的话，别再死在聊天里：

```bash
ohno requirements note --text "Owner：先做用户可见保存，不要先造平台"
ohno requirements show   # → .ohno/REQUIREMENTS.md
```

---

## 驾驶舱

本地、**只读**玻璃任务板。与 `ohno status --json` 同一模型。  
约 2.5s 轮询 `/api/state`。不写状态，不做第二权威。

```bash
ohno cockpit
```

一屏三问：

1. **现在**在干什么？  
2. **唯一**下一步是什么？  
3. 证明是否**新鲜**，有没有堵住？

---

## 盒子里有什么

| 表面 | 作用 |
| --- | --- |
| `ohno init / plan / task / verify` | 有界开工 → 证据收工 |
| `ohno status · resume · next · doctor` | 秒级恢复 |
| `ohno change` | 诚实的需求与文档同步 |
| `ohno projectors refresh` | PROGRESS + AGENTS 托管胶囊 |
| `ohno preferences` · `requirements` | 工艺开关 + Owner 原话日志 |
| Codex hooks + Git pre-commit | 合作式护栏 |
| `ohno cockpit` | 只读任务看板 |

**V1 故意没有：** 数据库、守护进程、技能市场、多 Agent 调度、敌对同用户硬隔离、Claude 双栈。

---

## 证据，不是感觉

| 主张 | 标签 | 边界 |
| --- | --- | --- |
| 产品状态 | `V1_TRIAL_ACCEPTED` | Tasks 1–7、Corrections 1–2、精华 E1–E12 |
| CLI / hooks / 原子状态 | `LOCAL_PASS` | 公开 Node 黑盒 |
| 驾驶舱 = status JSON | `LOCAL_PASS` | A13 |
| 真实可弃用副本 | `TRIAL_PASS` | P01–P06 |
| npm | **`0.1.1`** | [oh-no-codex](https://www.npmjs.com/package/oh-no-codex) |

本地试验最差 p95（命名副本、本机 —— 不是普适 SLA）：

| 表面 | 预算 | 观测 |
| --- | ---: | ---: |
| `status` / `next` | &lt;250 ms | ~92 / ~84 ms |
| `resume` | &lt;500 ms | ~86 ms |
| 驾驶舱反射 | &lt;250 ms | ~74 ms |

---

## 合同

1. [`docs/PRODUCT-CONTRACT.md`](./docs/PRODUCT-CONTRACT.md)  
2. [`docs/DESIGN.md`](./docs/DESIGN.md)  
3. [`docs/ACCEPTANCE.md`](./docs/ACCEPTANCE.md)  
4. [`docs/IMPLEMENTATION-PLAN.md`](./docs/IMPLEMENTATION-PLAN.md)  
5. [`docs/CODEX-SINS.md`](./docs/CODEX-SINS.md)  
6. [`docs/ESSENCE-BACKLOG.md`](./docs/ESSENCE-BACKLOG.md)  

---

## 许可

[MIT](./LICENSE)

Oh No, Codex! 是独立社区项目，与 OpenAI 无隶属或背书关系。

<p align="center">
  <strong>量清任务。证明行为。停下 Agent。</strong>
</p>

<p align="center"><a href="#readme-top">返回顶部 ↑</a></p>
