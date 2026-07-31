/**
 * Industry pattern (Ant Design, etc.):
 * - README.md = English only
 * - README.zh-CN.md = Chinese only
 * - Side-by-side language links at the top of each file
 */
import { readFileSync, writeFileSync } from "node:fs";

const raw = readFileSync("README.md", "utf8");

function extractPanelAfterAnchor(body, anchorHtml, summaryNeedle) {
  const anchorAt = body.indexOf(anchorHtml);
  if (anchorAt < 0) {
    throw new Error(`missing anchor ${anchorHtml}`);
  }
  const detailsAt = body.indexOf("<details", anchorAt);
  if (detailsAt < 0) {
    throw new Error(`missing details after ${anchorHtml}`);
  }
  const summaryEnd = body.indexOf("</summary>", detailsAt);
  if (summaryEnd < 0) {
    throw new Error("missing </summary>");
  }
  const summary = body.slice(detailsAt, summaryEnd);
  if (!summary.includes(summaryNeedle)) {
    throw new Error(
      `summary after ${anchorHtml} does not contain ${summaryNeedle}`,
    );
  }

  let i = summaryEnd + "</summary>".length;
  let depth = 1;
  while (i < body.length && depth > 0) {
    const nextOpen = body.indexOf("<details", i);
    const nextClose = body.indexOf("</details>", i);
    if (nextClose < 0) {
      throw new Error("unclosed details");
    }
    if (nextOpen >= 0 && nextOpen < nextClose) {
      depth += 1;
      i = nextOpen + 8;
    } else {
      depth -= 1;
      if (depth === 0) {
        return body.slice(summaryEnd + "</summary>".length, nextClose).trim();
      }
      i = nextClose + "</details>".length;
    }
  }
  throw new Error("failed to extract panel");
}

// Prefer lang anchors from details layout; fall back if already split.
let enBody;
let zhBody;
if (raw.includes('id="lang-en"') && raw.includes('id="lang-zh"')) {
  enBody = extractPanelAfterAnchor(raw, '<a id="lang-en"></a>', "English");
  zhBody = extractPanelAfterAnchor(raw, '<a id="lang-zh"></a>', "简体中文");
} else if (raw.includes("## Why") && raw.includes("## 为什么需要它")) {
  // stacked layout
  const zhMark = raw.indexOf("## 为什么需要它");
  const enMark = raw.indexOf("## Why");
  // crude: find Chinese brand alt or 为什么 section start via readme-zh
  const zhAnchor = raw.indexOf('id="readme-zh"') >= 0
    ? raw.indexOf('<a id="readme-zh"></a>')
    : raw.indexOf("## 为什么需要它");
  enBody = raw.slice(0, zhAnchor).replace(/^[\s\S]*?<a id="readme-en"><\/a>\s*/u, "").replace(/\n---\s*$/u, "").trim();
  zhBody = raw.slice(zhAnchor).replace(/^[\s\S]*?<\/p>\s*/u, "").trim();
  // if still bad, throw
  if (!zhBody.includes("为什么需要它")) {
    throw new Error("fallback split failed for Chinese body");
  }
} else if (
  raw.includes("## Why")
  && !raw.includes("## 为什么需要它")
  && raw.includes("README.zh-CN.md")
) {
  console.log("already English-only main README; skip split");
  process.exit(0);
} else {
  throw new Error("unrecognized README layout");
}

const enSwitcher = `<div align="center">

[**English**](./README.md) · [简体中文](./README.zh-CN.md)

</div>

`;

const zhSwitcher = `<div align="center">

[English](./README.md) · [**简体中文**](./README.zh-CN.md)

</div>

`;

function polish(body, topId) {
  return body
    .replaceAll('href="#lang-en"', `href="#${topId}"`)
    .replaceAll('href="#lang-zh"', `href="#${topId}"`)
    .replaceAll('href="#readme-en"', `href="#${topId}"`)
    .replaceAll('href="#readme-zh"', `href="#${topId}"`)
    .replaceAll("./README.zh-CN.md", "./README.zh-CN.md")
    .replace(/^<a id="readme-en-top"><\/a>\s*/u, "")
    .replace(/^<a id="readme-zh-top"><\/a>\s*/u, "");
}

const en = `<a id="readme-top"></a>

${enSwitcher}
${polish(enBody, "readme-top")}
`;

const zh = `<a id="readme-top"></a>

${zhSwitcher}
${polish(zhBody, "readme-top")}
`;

if (!en.includes("## Why")) {
  throw new Error("English body missing ## Why");
}
if (!zh.includes("为什么需要它")) {
  throw new Error("Chinese body missing 为什么需要它");
}

writeFileSync("README.md", en.endsWith("\n") ? en : `${en}\n`, "utf8");
writeFileSync("README.zh-CN.md", zh.endsWith("\n") ? zh : `${zh}\n`, "utf8");

console.log("README.md bytes", Buffer.byteLength(en, "utf8"));
console.log("README.zh-CN.md bytes", Buffer.byteLength(zh, "utf8"));
console.log("en Why", en.includes("## Why"));
console.log("zh 为什么", zh.includes("为什么需要它"));
console.log("en npm 0.1.0", en.includes("0.1.0"));
console.log("zh npm 0.1.0", zh.includes("0.1.0"));
