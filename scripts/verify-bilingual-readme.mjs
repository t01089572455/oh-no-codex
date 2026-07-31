import { readFileSync } from "node:fs";

const t = readFileSync("README.md", "utf8");
const marker = '<a id="readme-zh"></a>';
const i = t.indexOf(marker);
if (i < 0) {
  throw new Error("missing readme-zh anchor");
}
console.log(t.slice(i - 40, i + 500));
console.log("---checks---");
console.log("why", (t.match(/## Why/g) ?? []).length);
console.log("为什么", (t.match(/## 为什么需要它/g) ?? []).length);
console.log("E12 en", t.includes("E1–E12"));
console.log("E12 zh", t.includes("E1–E12") || t.includes("E1-E12"));
console.log("protocol zh", t.includes("日常路径"));
console.log("no file link zh-cn", !t.includes("README.zh-CN.md"));
