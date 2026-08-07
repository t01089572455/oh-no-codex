# 完整版 Prompt-Only Harness 目录

**数据来源：** Owner 对本产品的要求与场测结论（原 session 全文已从仓库移除，不入库）。

**产品决策：** **PROMPT-FIRST hybrid** — 语义靠 harness + hooks 内嵌提示词；
仅对清晰结构违规（phase / scope / document-sync / RECOVER 未读 Truth）做 **短 hard deny**。
禁止在每次工具调用上灌 full law。
**实现：** `src/prompt-rails.ts` + `src/hooks/codex.ts`。

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
| 20 | 控制税 / 刷屏 vs 结构失控 | PROMPT_FIRST hybrid：语义 prompt；结构短 hard deny；默认无 full rails | hooks + prompt-rails |

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

## 三、注入面（hook 管理）

| Hook / 表面 | 行为 |
| --- | --- |
| UserPromptSubmit | 短 `OHNO_PIPELINE` + Latest 重绑；Owner 暂停/继续标记 |
| Stop 续跑 | 短 continue card；Owner 暂停则不自动续；anti-ask 可续 |
| `ohno pipeline` | 短 next + stamp；`--full` 才完整 rails |
| 裸 `ohno` | brief + 短 pipeline（无 full law） |
| SessionStart / resume | stamp / 胶囊（≤4KiB） |
| PreToolUse | 静默 allow，或一行 hard deny（无 rails 刷屏） |
| skill `oh-no-control` | 短镜像 |

---

## 四、诚实边界

- 合作式护栏，不是 OS 沙箱。
- 不做语义「是否读懂」裁判，只强制「去读文档」+ 结构门。
- 真机 / 真猫 / 听感等用户体验不能被 unit 自动证明 — 用 LOCAL_PASS 诚实标签。
