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
  <strong>给 Codex 用的防跑偏工具</strong><br>
  <em>平时让它干活。一飘，就把它拉回你的需求文档。</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/oh-no-codex"><img alt="npm" src="https://img.shields.io/npm/v/oh-no-codex?style=flat-square&color=74D6B1&labelColor=202624&label=npm"></a>
  <img alt="node" src="https://img.shields.io/badge/node-%3E%3D22.20-74D6B1?style=flat-square&labelColor=202624">
  <img alt="codex" src="https://img.shields.io/badge/for-Codex-FF4B35?style=flat-square&labelColor=202624">
  <a href="./LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-FFF1CE?style=flat-square&labelColor=202624"></a>
</p>

---

## 一句话

Codex 很会写代码，也很容易跑偏。  
**Oh No** 装在你电脑上，帮你把 Codex 拴在「你说的话 + 需求/设计文档 + 真验收」上。

你主要做两件事：**装一次，然后跟它聊天。**  
剩下的尽量让它自己在后台按规矩走。

---

## Codex 常见翻车（我们叫它十八宗罪）

这些不是骂模型笨，是长项目里反复出现的坑：

| 你会看到啥 | 一句话 |
| --- | --- |
| 小需求被做成大系统 | 越做越大 |
| 「稳健」「管控」被理解成军工级 | 含糊词被放大 |
| 验收过了还接着改 | 做完了不停 |
| 让你看看，它却直接改代码提交 | 审查变擅自修改 |
| 旧计划压过你最新一句话 | 旧权威复活 |
| 摘要当历史真相 | 压缩交接变假历史 |
| 单测绿了就说功能好了 | 局部绿灯冒充完成 |
| 自己定标准、自己测、自己说过了 | 自己给自己盖章 |
| 测内部路径，用户真路径还坏着 | 测试演戏 |
| 覆盖率洁癖压过你要的结果 | 代理目标反客为主 |
| 审查时加从未说过的标准 | 审查扩大分母 |
| 护栏比跑偏还烦人 | 控制税太重 |
| 交付前先换平台重写 | 重造轮子 |
| 进错目录 / 错工作区 | 工作区混乱 |
| 每个新对话都从聊天里考古 | 交接税给你 |
| 内部很复杂，界面很糙 | 体验最后还 |
| 道歉后再来一句空头大话 | 附和 + 过度自信 |
| 解释了失败，规矩和测试没变 | 道歉没变成约束 |

完整说明：[docs/CODEX-SINS.md](./docs/CODEX-SINS.md)。

---

## Oh No 具体帮你干什么

用你自己的话来说，目标很简单：

1. **除了安装和初始化，尽量别让你管**  
   你跟 Codex 说话；Oh No 在后台记进度、塞规矩、盯验收。

2. **你说的每句话都算数**  
   提示词会记下来；和旧说法冲突时，**以你最新说的为准**。

3. **先把需求聊清楚 / 写清楚，再写产品代码**  
   文档里已经写清的项目，就逼它读文档、跟任务板干活，少来回问你。

4. **做完了要真测，不是嘴上说完了**  
   只有跑过约定的用户可见测试（`ohno verify`）才算过。  
   「exit 3 + 去看 playbook」这种软验收会被顶出来。

5. **一跑偏：先读文档，再自己改**  
   别一失败就卡住问你。  
   正常路径是：打开需求/设计/合同 → 判断是实现错了还是计划错了 → 改完再测。

6. **不是每写一行都强制读文档**  
   那又慢又烦。  
   目的是：**平时干活；飘了再用文档把它拉回来。**

7. **提示词优先，而不是硬卡博物馆**
   日常靠短下一步提示 + 你的最新原话。
   只有清晰结构违规（阶段 / 范围 / 文档同步）才会 **短** 硬拦——绝不是每次工具调用灌长文。
   仍要靠模型听话；这不是操作系统级沙箱。

---

## 怎么用

需要 Node.js **≥ 22.20**。

```bash
npm install -g oh-no-codex

cd 你的git项目
ohno setup
```

**装完请新开一个 Codex 会话**，否则旧的技能/钩子可能还在。

然后：

1. 在项目根目录跟 Codex 说话（说需求、说目标就行）  
2. 需要看进度时敲：`ohno`  
3. 当前这一刀做完了：`ohno verify`  
4. 可选看看板：`ohno cockpit`

从源码装：

```bash
git clone https://github.com/t01089572455/oh-no-codex.git
cd oh-no-codex
npm install
npm run build
npm install -g .
```

### 需求已经写在文档里时

给新开的 Codex 贴一条总目标就够了，例如：

> 只信本目录的 `.ohno/state.json`。先读需求/设计，按任务板连续做、连续 `ohno verify`。文档里有答案就别问我。只有密钥、设备、业务未知才问。

### 老项目 / 半成品

`ohno setup` **不会**根据 Git 历史自动猜「你已经做到哪」。  
要把当前目标、已成立事实写进需求/文档，再让它按板子走。  
不要手改状态文件假装已经验收通过。

需求变了：在 Oh No 管着下重新问清 → 改设计 → 改计划 → 改预期测试 → 再做。别偷偷沿用旧计划。

---

## 真实用过怎么样（实话）

在真实长会话里，能看到它：

- 跟着当前任务板往前推  
- 发现假验收、改成真测试  
- 多次回去读文档再继续  
- 体感比「处处硬拦截」顺手，能较长时间自己干  

同时写清楚：

- 主轴仍是 **状态板 + 计划 + 真验收**；提示词是加强，不是魔法  
- **不能消灭幻觉**；能做的是压假完成、压乱飘、把工作箍在文档和测试上  
- 你自己要它「干完全宇宙」，它会听你——Oh No 管的是怎么证明、怎么回读，不是否决你的总目标  

---

## 它做不到什么

- **合作式规矩**，不是系统沙箱；模型仍可能无视提示词  
- **不判「读懂没」**；只强制「去打开文档再做事」  
- **飘了再拉**，不是每一步读经  
- 验收测写软了，护栏也硬不起来  
- 产品方向还是你说了算  

---

## 驾驶舱（可选，仍然有用）

本机浏览器里的 **只读看板**：和 `ohno` / `ohno status` 同一份状态，没有写接口。  
不想盯终端时用来看一眼进度就行；只敲命令也可以，不必开。

```bash
ohno cockpit
```

进度条是「当前这批计划」，不是整个产品完成度。

<p align="center">
  <img
    src="./assets/brand/oh-no-cockpit.png"
    width="960"
    alt="Oh No, Codex! 驾驶舱"
  >
</p>

---

## 许可证

[MIT](./LICENSE)
