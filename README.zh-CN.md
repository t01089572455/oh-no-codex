<a id="readme-top"></a>

<div align="center">

[English](./README.md) · [**简体中文**](./README.zh-CN.md)

</div>

<br>

<p align="center">
  <img
    src="./assets/brand/oh-no-codex-lockup.png"
    width="920"
    alt="Oh No, Codex!：蓝色编程玩偶被红叉拦下"
  >
</p>

<p align="center">
  <strong>Codex 能写出好代码，也可能把项目带跑偏。</strong><br>
  Oh No 是装在本地的防漂移护栏：冻结<strong>一个</strong>切片、用你看得见的黑盒验收、<br>
  用项目内状态恢复现场——收口的是<strong>这一刀任务</strong>，不是关掉 Codex。
</p>

<p align="center">
  <code>收敛</code>&nbsp;&nbsp;·&nbsp;&nbsp;<code>验收</code>&nbsp;&nbsp;·&nbsp;&nbsp;<code>恢复</code>&nbsp;&nbsp;·&nbsp;&nbsp;<code>这一刀到此为止</code>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/oh-no-codex"><img alt="npm" src="https://img.shields.io/npm/v/oh-no-codex?style=flat-square&color=74D6B1&labelColor=202624&label=npm"></a>
  <img alt="status" src="https://img.shields.io/badge/status-ANTI_DRIFT_CORE_WORKS-3DDC97?style=flat-square&labelColor=202624">
  <img alt="codex" src="https://img.shields.io/badge/for-Codex_CLI-FF4B35?style=flat-square&labelColor=202624">
  <img alt="skills" src="https://img.shields.io/badge/13_个_Codex_skill-74D6B1?style=flat-square&labelColor=202624">
  <a href="./LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-FFF1CE?style=flat-square&labelColor=202624"></a>
</p>

---

## 痛点

模型一直在「干活」，仓库却离你要的越来越远：范围膨胀、假绿、会话失忆、PASS 后仍当空白支票。

Oh No 把答案放在**项目文件**里，而不是聊天记忆。

## 它管什么

- 线性计划 + 结构化验收分母（acceptance basis）
- `task start` / `ohno verify` 黑盒收口
- 需求变更 `change` 与 Truth 同步
- 只读 Cockpit、Codex/Git 协作护栏（**不是**敌对安全边界）
- schema 2→3：`ohno migrate acceptance-basis` 两阶段预览/应用

## 安装（摘要）

Node.js **≥ 22.20**。包名 [oh-no-codex](https://www.npmjs.com/package/oh-no-codex)。

```bash
npm install -g oh-no-codex   # 发布后
# 镜像延迟时：npm install -g oh-no-codex@0.1.7 --registry https://registry.npmjs.org
cd your-git-repo
ohno init --goal "你的产品目标"
ohno install
```

日常优先用 Codex skill（`ohno skill install`），详见英文 README 的 skill 表。

## 证据（与英文 README 对齐）

| 声明 | 标签 |
| --- | --- |
| 核心防漂移 | `ANTI_DRIFT_CORE_WORKS` |
| 公开发布 | Owner 已授权 **`0.1.7`**（非 `V1_TRIAL_ACCEPTED`；性能为本地 trial） |
| CLI / hooks / 原子状态 | `LOCAL_PASS` |
| Correction 4 结构化分母 | `LOCAL_PASS`（已合入 main） |
| 可丢弃真实副本性能 P01–P06 | **`TRIAL_PASS`** LIVE — p95 ms A/B/C：status 139.361 / 140.512 / 132.802；next 169.689 / 157.331 / 136.215；resume 168.616 / 195.458 / 193.012；task_start 136.947 / 156.410 / 159.346；P06 163 / 178 / 164；P04 resume 4006 B（非全球性能保证；batch id 见 trial evidence JSON） |
| npm | **`oh-no-codex@0.1.7`**（Owner 已授权；镜像可能延迟） |

契约：[Product](./docs/PRODUCT-CONTRACT.md) · [Design](./docs/DESIGN.md) · [Acceptance](./docs/ACCEPTANCE.md) · [Publish](./docs/PUBLISH.md)

---

<p align="center">
  <sub>MIT · 独立社区项目 · 与 OpenAI 无隶属关系</sub>
</p>
