import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const enPath = resolve(root, "README.md");
const zhPath = resolve(root, "README.zh-CN.md");

function stripLangHeader(text) {
  let t = text.replace(/^\uFEFF/u, "");
  t = t.replace(/^<a id="readme-top"><\/a>\s*/u, "");
  t = t.replace(
    /^<p align="center">\s*(?:<strong>English<\/strong>|<a href="[^"]+">English<\/a>)[\s\S]*?<\/p>\s*/u,
    "",
  );
  return t;
}

// Expect clean monlingual sources restored from git before merge.
const enRaw = readFileSync(enPath, "utf8");
const zhRaw = readFileSync(zhPath, "utf8");

if (!zhRaw.includes("为什么需要它")) {
  throw new Error(
    "README.zh-CN.md does not look like the full Chinese README; abort merge",
  );
}
if (!enRaw.includes("## Why")) {
  throw new Error("README.md does not look like the full English README; abort");
}

let enBody = stripLangHeader(enRaw);
let zhBody = stripLangHeader(zhRaw);

enBody = enBody
  .replaceAll('id="readme-top"', 'id="readme-en-top"')
  .replaceAll('href="#readme-top"', 'href="#readme-en"')
  .replaceAll("./README.zh-CN.md", "#readme-zh")
  .replaceAll("./README.md", "#readme-en");

zhBody = zhBody
  .replaceAll('id="readme-top"', 'id="readme-zh-top"')
  .replaceAll('href="#readme-top"', 'href="#readme-zh"')
  .replaceAll("./README.md", "#readme-en")
  .replaceAll("./README.zh-CN.md", "#readme-zh");

const switcher = [
  '<p align="center">',
  '  <a href="#readme-en"><strong>English</strong></a>',
  "  &nbsp;·&nbsp;",
  '  <a href="#readme-zh"><strong>简体中文</strong></a>',
  "</p>",
  "",
  '<p align="center"><sub>Same homepage — in-page jump, no other file.</sub></p>',
  "",
].join("\n");

const combined = [
  "<!-- Bilingual homepage: language switch uses in-page anchors only. -->",
  switcher,
  '<a id="readme-en"></a>',
  "",
  enBody.trimEnd(),
  "",
  "---",
  "",
  '<a id="readme-zh"></a>',
  "",
  '<p align="center">',
  '  <a href="#readme-en">English</a>',
  "  &nbsp;·&nbsp;",
  "  <strong>简体中文</strong>",
  "</p>",
  "",
  zhBody.trimEnd(),
  "",
].join("\n");

writeFileSync(enPath, combined, "utf8");

const stub = [
  "# 简体中文",
  "",
  "仓库 **GitHub 主页**上的完整中文说明已合并进主 `README.md`。",
  "在主页顶部点击 **「简体中文」** 即可在同一页跳转，无需打开本文件。",
  "",
  "- [主 README · 简体中文区](./README.md#readme-zh)",
  "- [主 README · English](./README.md#readme-en)",
  "",
  "本文件仅作旧链接兼容；请以 [`README.md`](./README.md) 为准。",
  "",
].join("\n");

writeFileSync(zhPath, stub, "utf8");

console.log("merged README.md bytes", Buffer.byteLength(combined, "utf8"));
console.log("has 简体中文", combined.includes("简体中文"));
console.log("has 为什么需要它", combined.includes("为什么需要它"));
console.log("has ## Why", combined.includes("## Why"));
console.log("stub ok", stub.includes("旧链接兼容"));
