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
  <strong>面向 Codex vibe coding 的 Truth 绑定 harness</strong><br>
  <em>分支线：<code>prompt-only-harness</code> — 用 hooks 注入高级提示词把漂移的 Agent 拉回 Truth，而不是用编码硬闸天天卡你</em>
</p>

<p align="center">
  <img alt="line" src="https://img.shields.io/badge/line-prompt--only-harness-74D6B1?style=flat-square&labelColor=202624">
  <img alt="status" src="https://img.shields.io/badge/status-FIELD_TRIAL_STEERS-3DDC97?style=flat-square&labelColor=202624">
  <img alt="node" src="https://img.shields.io/badge/node-%3E%3D22.20-74D6B1?style=flat-square&labelColor=202624">
  <img alt="codex" src="https://img.shields.io/badge/for-Codex-FF4B35?style=flat-square&labelColor=202624">
  <a href="./LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-FFF1CE?style=flat-square&labelColor=202624"></a>
</p>

<p align="center">
  <a href="#why">为什么</a> ·
  <a href="#sell">卖点</a> ·
  <a href="#eighteen-sins">十八宗罪</a> ·
  <a href="#how">怎样工作</a> ·
  <a href="#install">安装</a> ·
  <a href="#field">场测事实</a> ·
  <a href="#limits">边界</a> ·
  <a href="#vs-main">相对 main</a>
</p>

---

<a id="why"></a>

## 为什么需要 Oh No？

Codex 能写好代码，也仍然会把项目带偏：没读设计就瞎做、假完成、验收后继续乱扩、新 session 从聊天考古现场。

Owner 在真实 vibe coding 里要的 harness **不是** 第二个治理操作系统，也 **不是** 每写一个文件就 OS 级强制读完 Truth。

**真正的目的是：**

> **平时让它干活；一旦漂移，用 Truth harness 把它拉回轨道。**

这些失败模式被整理成公开事故审计：  
[**Codex 的十八宗罪**](./docs/CODEX-SINS.md)。

本分支把 Owner 长周期 Grok 对话（含完整 compaction 历史）里反复强调的规则，收成 **`OHNO_PROMPT_RAILS`**，由 **hooks 在关键时刻注入**——用「法律提示词 + 状态板 + verify」管 Codex，而不是用一堆编码 hard-deny 制造控制税。

---

<a id="sell"></a>

## 卖点（本分支真正做成的）

### 1. 漂移时拉回 Truth，而不是每步读经

- 不把「每次写文件前强制读 Truth」当目标（慢、烦、像治理 OS）。
- 目标是：**飘了 → 回读 Truth / 设计 / 冻结合同 → 再决策**。
- 场测里表现为：发现软黑盒、出 scope、状态不对时回权威链和 `truth-read`，而不是全程停工。

### 2. 人几乎只聊天；内部自动控

- Owner：`ohno setup` 一次，然后主要跟 Codex 说话。
- 每次 Owner 发言 / Stop / `ohno pipeline`：注入完整 **`OHNO_PROMPT_RAILS`**（生命周期、反 block、十八宗罪、强制读文档…）。
- PreToolUse：**不 hard-deny 当主控**（advisory 文案 + 自纠）；减少「被闸门噎死」的体感。

### 3. 完成仍要真证明（不是散文）

- 唯一完成证明：`ohno verify` + 冻结的用户可见黑盒。
- 软黑盒（例如 `exit 3` 打印“去看 playbook”）会被流程与纪律顶出来，必须改成真可执行验收。

### 4. 跨 session 可读的现场

- `.ohno/state.json` 仍是**唯一运行时权威**。
- `ohno` / `ohno status` / resume / Cockpit：当前任务、证明、下一步——交接税下降。

### 5. 需求已在文档里时特别好用

当你的需求、设计、playbook **已经写清楚**，当前阶段是执行与证明（而不是从零澄清）时：

- Oh No 逼它 **读文档 + 跟板子 + verify**，而不是再跟你反复确认。
- 场测（LoveBuddy-v11 / Codex session `019fd4f0…`）里：贴着 state 推进、改假黑盒、多波 verify 闭环——**Owner 体感明显比「硬编码处处 deny」顺手**。

### 6. 十八宗罪仍是公开卖点与对照表

不是口号：每一宗罪在 `OHNO_PROMPT_RAILS` 里有对应 prompt rail；完成/假测/旧权威等仍有状态与 verify 支撑。

---

<a id="eighteen-sins"></a>

## Codex 的十八宗罪

“十八宗罪”是正式名称。它们是 18 种隐私清理后的失败模式——**不是**说每次 Codex 都会翻车。

| # | 模式 | 你会看到什么 |
| ---: | --- | --- |
| 1 | 越俎代庖 | 窄需求被悄悄做成更大产品或架构 |
| 2 | 把含糊词解释到最大 | “管控”“稳健”被抬到最高保证级别 |
| 3 | 完成以后不停 | 验收过了仍继续改或擅自开新阶段 |
| 4 | 把审查当修改权 | 只读审计变成擅自改代码提交 |
| 5 | 旧权威复活 | 旧计划/旧摘要压过 Owner 最新决定 |
| 6 | 用摘要改写真相 | 压缩交接变成虚假项目史 |
| 7 | 局部绿灯冒充完成 | 单测/mock 绿就声称功能完成 |
| 8 | 同一 Agent 自证闭环 | 自己定标准、自己做、自己当证据 |
| 9 | 测试剧场 | 测内部路径，用户真路径仍坏 |
| 10 | 代理目标反客为主 | 覆盖率/洁癖压过 Owner 结果 |
| 11 | Reviewer 扩大分母 | 审查加从未冻结的标准 |
| 12 | 对控制税失明 | 护栏比漂移更慢更重 |
| 13 | 重造轮子 | 交付前先换平台 |
| 14 | 工作区混乱 | 错分支 / worktree / 脏检出 |
| 15 | 把交接税转嫁给用户 | 每 session 从聊天考古 |
| 16 | 用户体验最后偿还 | 内部机器膨胀，界面粗糙 |
| 17 | 附和与过度自信 | 道歉后再来一句无证据大承诺 |
| 18 | 道歉没有变成约束 | 解释了失败，规则和测试没变 |

完整审计：[`docs/CODEX-SINS.md`](./docs/CODEX-SINS.md)。

---

<a id="how"></a>

## 怎样工作（本分支）

```text
Owner:  ohno setup → 跟 Codex 说话
Hooks:  UserPromptSubmit / Stop / pipeline  →  注入 OHNO_PROMPT_RAILS
State:  .ohno/state.json = 唯一当前权威
Agent:  跟 next/ACTIVE 干活 → ohno verify 才算过
Drift:  回读 Truth / 设计 / 合同 → 改实现(A) 或 改计划(B) → 再 verify
```

**人表面尽量薄：**

```bash
ohno setup      # 一次
ohno            # 一眼状态 + pipeline
ohno pipeline   # 精确下一步（给 Agent）
ohno verify     # 唯一完成证明
```

其余（plan / task / truth-read / change…）多半由 Agent 在 skill 与 rails 下自己跑。

法律全文实现：`src/prompt-rails.ts`（`OHNO_PROMPT_RAILS`）。  
Owner 对话与压缩历史整理：`docs/superpowers/specs/2026-08-05-complete-prompt-harness-catalog.md`。

---

<a id="install"></a>

## 安装与使用

需要 Node.js **≥ 22.20**。

### 使用本分支（推荐当前线）

```bash
git clone https://github.com/t01089572455/oh-no-codex.git
cd oh-no-codex
git checkout prompt-only-harness
npm install
npm run build
npm install -g .

cd your-project   # 必须是 git 仓库
ohno setup        # 或已有 .ohno 时：ohno skill install + 刷新 hooks
```

**装完请新开 Codex 会话**，否则 skill/hooks 可能仍是旧的。

### 日常

```bash
ohno                 # 状态 + 管道 + 法律摘要路径
ohno status
ohno pipeline
ohno verify          # 证明当前任务
ohno doctor
ohno cockpit         # 只读驾驶舱（可选）
```

### 给新 Codex session 的用法（需求已在文档时）

1. cwd 固定到项目根  
2. 贴一条总目标：**只信本 cwd 的 `.ohno/state.json`，读 Truth，连续 task/verify，少问 Owner**  
3. 让它自己 `ohno status` → 干活 → `ohno verify`  
4. 你只在密钥 / 设备 / 业务未知时介入  

---

<a id="field"></a>

## 场测事实（实事求是）

在真实项目 **LoveBuddy-v11**、Codex session `019fd4f0-c913-7653-8254-d7d6369f8263` 上：

**观察到的有效行为：**

- 锁定 cwd 与 `.ohno/state.json`，跟 ACTIVE / next 推进  
- 识别并修正 **软黑盒**，再 `ohno verify`  
- 多次 `truth-read` / 读权威与设计，按板子多波交付  
- 工具路径 **未见 hard deny 主路径**（符合本分支设计）  
- Owner 体感：**比 main 硬编码处处卡更顺手**，能长时间自动推进  

**同时诚实写清：**

- 推进的主轴仍是 **state + plan + verify**；完整 `OHNO_PROMPT_RAILS` 是强加持，不是每行事件都出现  
- 「读 Truth」是 **纠偏与装载**，不是每一次写文件前 OS 强制  
- 不能声称 **消灭幻觉**；只能声称 **压假完成、压乱飘、把工作箍在设计与验收上**  
- 若 Owner 自己写「干完全宇宙 / 3833 点」，Agent 会听 Owner——Oh No 管的是 **怎么证明与回读**，不是否决你的总目标  

自动化回归（本仓库）：黑盒与性能证据套件在分支上保持绿色（以当前 `npm test` / `npm run test:performance` 为准）。

---

<a id="limits"></a>

## 边界（必须诚实）

- **合作式**（COOPERATIVE_GUARDRAIL），不是 OS 沙箱。  
- **不做语义裁判**（不判断「读懂没」）。  
- **漂移时拉回**，不是每步读经。  
- pre-commit / verify 等 **少量硬事实闸** 仍可存在——那是「钱」相关证明，不是参数博物馆。  
- npm 上 `latest` 若仍指向旧发布线，**以本分支源码安装为准**。

---

<a id="vs-main"></a>

## 相对 `main` 硬编码线（体验向）

| | `main`（硬门更重） | 本分支 `prompt-only-harness` |
| --- | --- | --- |
| 主控手段 | phase / 写文件 deny 等硬闸 | hooks 注入 `OHNO_PROMPT_RAILS` + state/verify |
| 体感 | 容易被闸卡住 | 更顺，适合文档已齐、全自动执行 |
| 漂移时 | 硬拦 + 收据 | 法律要求回读 Truth + verify 拉回 |
| Owner 评价（本场测） | 控制税更明显 | **更好用**（少 deny、仍贴板子验收） |

本分支 **不是** 宣称「科学上全面碾压 main」；是宣称：

> **在真实 vibe coding（需求在文档、要自动干、要防假完成）里，这套 Truth 提示词 harness 更好用、也更贴 Owner 初心。**

`main` 仍保留作硬门对照线；本 README 描述的是 **`prompt-only-harness` 产品叙事与事实**。

---

## 驾驶舱

<p align="center">
  <img
    src="./assets/brand/oh-no-cockpit.png"
    width="960"
    alt="Oh No, Codex! 驾驶舱"
  >
</p>

<p align="center">
  <sub>只读投影，不是第二真相。cursor 进度是「本计划」进度，不是整个产品完成度。</sub>
</p>

---

## 许可证

[MIT](./LICENSE)
