---
name: oh-no-cockpit
description: >
  Start Oh No read-only glass cockpit in the browser. Use when user says cockpit,
  驾驶舱, 打开看板, dashboard, open board, or ohno cockpit. Shell: ohno cockpit.
---

# oh-no-cockpit

在**已 `ohno init` 的项目根目录**终端执行：

```bash
ohno cockpit
# 固定端口（多项目时各自选不同端口）
ohno cockpit --port 13521
# 关掉本项目 cockpit，释放端口
ohno cockpit stop
# 顶掉本项目旧进程再开
ohno cockpit --replace
ohno cockpit --replace --port 13521
```

## 启动后会发生什么

1. 本机起一个只监听 `127.0.0.1` 的 HTTP 服务（默认随机端口，或 `--port`）。
2. 若本项目已有存活 cockpit：打印已有 URL 并退出（不叠开第二个）。
3. 终端打印一行，例如：

```text
Cockpit: http://127.0.0.1:5xxx/
Stop: Ctrl+C in this terminal, or from another shell: ohno cockpit stop
```

4. 用浏览器打开该 URL（不要用局域网 IP；仅本机）。
5. 页面约每 2.5s 轮询 `GET /api/state`，与 `ohno status --json` 同源。
6. **只读**：没有写接口。

## 关端口 / 别一直占着

| 做法 | 命令 |
| --- | --- |
| 前台终端 | `Ctrl+C` |
| 任意终端（本项目 cwd） | `ohno cockpit stop` |
| 重启并换新 URL | `ohno cockpit --replace` |

运行时指针：`.ohno/cockpit.runtime.json`（pid/port only，**不是** `.ohno/state.json` 权威）。

浏览器若显示 **COCKPIT SERVER OFFLINE**：多半是旧标签 / 进程已停，不是 state 损坏——重新 `ohno cockpit` 并打开**新** URL。

## 注意

- 必须在含 `.ohno/state.json` 的仓库目录下启动。
- 多项目 = 多个 cwd 各起一个；需要固定标签就各自 `--port`。
- 也可说：用 skill **oh-no-cockpit** / 「打开 Oh No 驾驶舱」。
