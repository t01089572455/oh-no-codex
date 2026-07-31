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
```

## 启动后会发生什么

1. 本机起一个只监听 `127.0.0.1` 的 HTTP 服务（随机端口）。
2. 终端打印一行，例如：

```text
Cockpit: http://127.0.0.1:5xxx/
```

3. 用浏览器打开该 URL（不要用局域网 IP；仅本机）。
4. 页面约每 2.5s 轮询 `GET /api/state`，与 `ohno status --json` 同源。
5. **只读**：没有写接口；关终端/Ctrl+C 即停服务。

## 注意

- 必须在含 `.ohno/state.json` 的仓库目录下启动。
- 也可说：用 skill **oh-no-cockpit** / 「打开 Oh No 驾驶舱」。
