# 完整版 Prompt-Only Harness 目录

**数据来源：** Owner 对本产品的要求与场测结论（原 session 全文已从仓库移除，不入库）。

**产品决策：** 不做编码硬拦截；只用 harness + hooks **内嵌提示词** 约束模型。  
**实现：** `src/prompt-rails.ts` → hooks 注入 `OHNO_PROMPT_RAILS`。

---

## 一、你提到的问题 → 对应方案 → 写入法律的条文

| # | 你反复提到的问题 | 你给出的方案 / 要求 | Prompt 条文位置 |
| ---: | --- | --- | --- |
| 1 | 长上下文跑偏、忘最新目标 | 强制读 Truth；state/resume 恢复现场 | A, E |
| 2 | 没弄清需求就猜着写代码 | Codex 当 PM 先澄清；未清禁止产品码 | C DISCOVER |
| 3 | 自己扩大范围 / 先做大框 | 最小满足；禁止治理 OS；scope | B, H#1–2, I |
| 4 | 做一点就说全部完成 | 仅 ohno verify；禁止自证 | C EXECUTE, H#7–8 |
| 5 | 无关大测试、控制税 | 薄 harness；禁止全套诊断 | H#12 |
| 6 | 新 session 不知做到哪 | ohno / resume / pipeline | G, J |
| 7 | 需求变了文档不同步 | CHANGE 重走 clarify→design→plan | C CHANGE |
| 8 | PASS 后还不停 | next 只是 locator | H#3 |
| 9 | 要 Owner 不停点继续 | 内部自动；默认不问 Owner | B, F |
| 10 | 挂了就 block 问人 | 读 Truth → A/B 自调；禁 Owner 当搜索引擎 | F, C RECOVER |
| 11 | Truth 写了不读 | 关键时刻强制打开文档 | E |
| 12 | CLI 参数博物馆、字数/任务数上限 | 人侧砍光；禁止能力税 | B, H2 |
| 13 | 软黑盒 / 测试剧场 | 用户可见硬测；诚实 LOCAL_PASS | H#9, I |
| 14 | 十八宗罪未全治 | 1–18 全部 prompt rails | H |
| 15 | 前端差、不调研 OSS | 先调研；能用 OSS 就用；前端可抄后改 | H2 |
| 16 | 需求要汇总成文件 | OWNER-INPUTS + REQUIREMENTS Latest | D, H2 |
| 17 | 驾驶舱/可见现场 | 只读 cockpit；非第二权威 | H#16 |
| 18 | 发布/状态不诚实 | 无证据不宣称完成/已治十八罪 | H#17, H2 |
| 19 | mega-plan 过大 | 全路线可设计，执行板宜小 MVP | H2, I |
| 20 | 只做提示词、不做编码硬拦 | PROMPT_ONLY + advisory | 全文件头 + hooks |

---

## 二、Canonical Owner 主流程（原文压缩，法律 C 节）

```
setup → 对话提需求(PM) → 全提示词=Truth 最新优先
→ 详细设计+全路线 → 拆任务(expect+硬测+scope)
→ 逐个执行 → 出事读 Truth/设计(A实现|B计划)自调
→ verify 功能过 → 变更则重走
```

Oh No 核心：**指导去读，禁止不看 Truth 的自主决策。**

---

## 三、注入面（hook 管理，无 hard deny）

| Hook / 表面 | 注入内容 |
| --- | --- |
| UserPromptSubmit | 完整 `OHNO_PROMPT_RAILS` + 当前 `OHNO_PIPELINE` |
| Stop 续跑 | 同上 |
| `ohno pipeline` / 裸 `ohno` | 完整 rails |
| SessionStart / resume | `OHNO_PROMPT_RAILS_STAMP`（≤4KiB） |
| PreToolUse | `OHNO_PROMPT_ADVISORY`（允许工具 + 文字纠正） |
| skill `oh-no-control` | 短镜像 |

---

## 四、诚实边界

- 合作式提示词，不是 OS 沙箱。  
- 不做语义「是否读懂」裁判，只强制「去读文档」。  
- 编码硬门在本分支策略上不再作为主手段。
