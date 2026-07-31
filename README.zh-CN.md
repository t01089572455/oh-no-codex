<a id="readme-top"></a>

<div align="center">

[English](./README.md) · [**简体中文**](./README.zh-CN.md)

</div>

<br>

<p align="center">
  <img
    src="./assets/brand/oh-no-codex-lockup.png"
    width="920"
    alt="Oh No, Codex!：蓝色编程玩偶还想继续敲键盘，被红叉拦下"
  >
</p>

<p align="center">
  <strong>Codex 代码写得再溜，也照样能把项目带跑偏。</strong><br>
  Oh No 是装在本地的护栏：把活收成「一刀」、用你看得见的验收卡住它、<br>
  换会话不用翻聊天记录 — 收口的是<strong>这一刀任务</strong>，不是把 Codex 关掉。
</p>

<p align="center">
  <code>收束</code>&nbsp;&nbsp;·&nbsp;&nbsp;<code>验收</code>&nbsp;&nbsp;·&nbsp;&nbsp;<code>恢复</code>&nbsp;&nbsp;·&nbsp;&nbsp;<code>这一刀到此为止</code>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/oh-no-codex"><img alt="npm" src="https://img.shields.io/npm/v/oh-no-codex?style=flat-square&color=74D6B1&labelColor=202624&label=npm"></a>
  <img alt="状态" src="https://img.shields.io/badge/status-V1_TRIAL_ACCEPTED-74D6B1?style=flat-square&labelColor=202624">
  <img alt="codex" src="https://img.shields.io/badge/for-Codex_CLI-FF4B35?style=flat-square&labelColor=202624">
  <img alt="skills" src="https://img.shields.io/badge/15_个_Codex_skill-74D6B1?style=flat-square&labelColor=202624">
  <a href="./LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-FFF1CE?style=flat-square&labelColor=202624"></a>
</p>

<p align="center">
  <a href="#痛点">痛点</a> ·
  <a href="#十八宗罪">十八宗罪</a> ·
  <a href="#它到底管什么">它管什么</a> ·
  <a href="#安装">安装</a> ·
  <a href="#像-skill-一样用">Skill 用法</a> ·
  <a href="#证据">证据</a>
</p>

---

## 痛点

模型一直在「干活」，仓库却离你要的越来越远：

| | 现象 | 例子 |
| ---: | --- | --- |
| 1 | **范围被偷换** | 说做外贸系统，写着写着变成重构底层平台 |
| 2 | **假完成** | 单测、mock 全绿，用户真点路径还是挂 |
| 3 | **现场对不上** | 换个会话，只好翻聊天考古「上次说到哪了」 |
| 4 | **这一刀收不掉** | 真过了验收，又拿「下一步」当空白授权继续摊 |

Oh No 要解决的是：打开项目就能从**文件**里读出进度，而不是靠记性。

1. 已经做完什么？  
2. **当前只准做**哪一刀？  
3. 用哪条**用户看得见**的命令算过关？  
4. 卡在哪？  
5. 计划上的**下一步**是什么？（只是指路，不是新授权）

没有「项目总 goal」这道门槛。产品意图写在 **计划任务** 和 **`ohno requirements note`** 里即可。

---

## 十八宗罪

长会话里反复踩的坑，点名成表 — 用来定设计敌，不是再造十八个功能。  
细账见 [`docs/CODEX-SINS.md`](./docs/CODEX-SINS.md)。

| # | 叫法 | 人话 |
| ---: | --- | --- |
| 1 | 越俎代庖 | 你要扇门，它盖座城 |
| 2 | 解释到最大 | 「管控一下」变成整套中台 |
| 3 | 做完不停 | 这一刀过了还接着摊 |
| 4 | 审查变改权 | 「帮我看看」变成默默大改 |
| 5 | 僵尸权威 | 旧计划压过你最新说法 |
| 6 | 摘要当真 | 压缩稿变成假历史 |
| 7 | 局部绿灯 | 一个 mock 就当产品能用 |
| 8 | 自说自话 | 自己写完自己鼓掌 |
| 9 | 测试演戏 | 内部枝条绿，用户路径红 |
| 10 | 目标被置换 | 覆盖率比你的结果还重要 |
| 11 | 审稿加戏 | 验收项越加越多 |
| 12 | 控制税 | 工具比跑偏还贵 |
| 13 | 另起炉灶 | 放着 Git 和测试不用，硬造新体系 |
| 14 | 工作区认错 | 写错目录、写错分支 |
| 15 | 交接甩锅 | 新会话先考古半小时 |
| 16 | 界面垫底 | 内核堆三周，UI 从没认真验 |
| 17 | 附和乱吹 | 秒回「你说得对」+ 无证据承诺 |
| 18 | 道歉白搭 | 对不起完了，明天照犯 |

---

## 它到底管什么

<p align="center">
  <img src="./assets/brand/oh-no-loop.png" width="880" alt="任务 → 验收 → 收口这一刀">
</p>

| 事 | 含义 |
| --- | --- |
| **收束一刀** | 写之前定死：用户可见行为、一条验收命令、可改文件、时限、何时停 |
| **验收** | `ohno verify` 跑**那条**命令，不看 Agent 自吹 |
| **收口** | 真 PASS 才关掉这一刀、推进计划；`next` 只**指路** |
| **找回现场** | `ohno resume` / 驾驶舱读 `.ohno/state.json`（唯一真相源） |

Hooks 和 Git pre-commit 是**合作式护栏**（注入进度、拦越权写），不是防你自己账号作恶的安全沙箱。

日常给模型用的入口是 **15 个 Codex skill**（`oh-no-init`、`oh-no-verify` …），装在 `~/.codex/skills/` 下，和别的 skill 一样可被发现。别把长命令整段贴进聊天——会被冲淡。

---

## 安装

```bash
npm install -g oh-no-codex
cd 你的业务仓库
ohno init                 # 建 .ohno/，不要再写 --goal
ohno install              # hooks + 全套 oh-no-* skill
```

```bash
ohno skill install        # 只刷新 skill
ohno skill status
# 新开一个 Codex 会话，方便 skill 被扫到
```

需要 Node.js **≥ 22.20**。包名：[oh-no-codex](https://www.npmjs.com/package/oh-no-codex)（`0.1.2`）。

---

## 驾驶舱怎么开

本地**只读**看板，数据和 `ohno status --json` 一致。

```bash
cd 你的业务仓库           # 先 ohno init 过
ohno cockpit
```

终端会打印本机地址，例如：

```text
Cockpit: http://127.0.0.1:53123/
```

1. 用浏览器打开这行 URL（仅本机，不要用局域网 IP）。  
2. 页面大约每 2.5 秒拉一次 `/api/state`。  
3. 终端里 Ctrl+C 结束（没有后台守护进程）。  
4. 或在 Codex 里用 skill **`oh-no-cockpit`** / 说「打开驾驶舱」。

### 驾驶舱数据从哪来（它不「管」进度）

```text
plan accept / task start / verify …
        ↓ 写入
  .ohno/state.json          ← 唯一权威
        ↓ readModel()
  GET /api/state            ← 与 status --json 同源
        ↓ 浏览器轮询
  驾驶舱画面
```

| 你在屏上看到的 | 实际怎么来的 |
| --- | --- |
| 一共多少子任务 | 计划里 `ordered_tasks.length`（`task_count`） |
| 推进到哪一刀 | 状态里的 `cursor` + 当前 `active_task` |
| 总体完成度条 | 前端用 **`cursor / task_count`**（没有别的假百分比） |
| 看板 DONE/ACTIVE… | 由 cursor、任务类型、验收是否失败推导，**不另存库** |

进度只由 CLI / skill 改 state 推动；驾驶舱**只读展示**，点不了「完成 50%」。

---

## 像 skill 一样用

说人话，或直接点 skill 名。模型应去终端执行对应 `ohno`：

| Skill | 你怎么说 | 背后命令 |
| --- | --- | --- |
| `oh-no-init` | 初始化护栏 | `ohno init` |
| `oh-no-install` | 装 hooks / skill | `ohno install` |
| `oh-no-plan` | 排计划、接计划 | `ohno plan …` |
| `oh-no-task` | 开工 | `ohno task start` |
| `oh-no-verify` | 做完了、帮我验收 | **`ohno verify`** |
| `oh-no-resume` | 现在卡在哪 | `ohno resume` |
| `oh-no-status` | 看状态 | `ohno status` |
| `oh-no-next` | 下一步是啥 | `ohno next` |
| `oh-no-change` | 需求变了 | `ohno change …` |
| `oh-no-requirements` | 把这句话记下来 | `ohno requirements …` |
| `oh-no-preferences` | 改工作习惯开关 | `ohno preferences …` |
| `oh-no-doctor` | 体检一下 | `ohno doctor` |
| `oh-no-cockpit` | 开驾驶舱 | `ohno cockpit` |
| `oh-no-projectors` | 刷进度文件 | `ohno projectors refresh` |
| `oh-no-control` | 不知道用哪个 | 总表 / 路由 |

硬规矩：

- 没跑过 **`ohno verify` 且 PASS**，不许说做完了  
- **`next` 不是开工许可证**  
- 真相只在 **`.ohno/state.json`**

---

## 盒子里有什么

| 块 | 干什么 |
| --- | --- |
| CLI | init / plan / task / verify / change / resume … |
| 15 个 skill | 每条能力对应可发现的 skill |
| Hooks + pre-commit | 注入现场、拦越权写 |
| 投影文件 | PROGRESS、需求日志、AGENTS 短胶囊 |
| 偏好 | 可选：先调研、复用开源、前端先抄再改 |
| 驾驶舱 | 只读看板，和 `status --json` 同源 |

**V1 故意不做：** 数据库、常驻进程、技能市场产品、多 Agent 调度、「绝对防君子也防小人」。

---

## 证据

| 说法 | 标签 |
| --- | --- |
| 产品状态 | `V1_TRIAL_ACCEPTED` |
| CLI / hooks / 原子状态 | `LOCAL_PASS` |
| 驾驶舱 = status JSON | `LOCAL_PASS` |
| 真实项目副本试验 | `TRIAL_PASS`（P01–P06） |
| npm | **`0.1.2`**（含 skill 套件、去掉项目 `--goal`、驾驶舱说明） |

合同：[产品](./docs/PRODUCT-CONTRACT.md) · [设计](./docs/DESIGN.md) · [验收](./docs/ACCEPTANCE.md) · [十八宗罪](./docs/CODEX-SINS.md)

---

<p align="center">
  <sub>MIT · 独立社区项目 · 与 OpenAI 无隶属或背书关系</sub>
</p>

<p align="center">
  <strong>收成一刀。验给你看。别靠聊天考古。</strong>
</p>

<p align="center"><a href="#readme-top">↑ 回顶</a></p>
