import { readFileSync, writeFileSync } from "node:fs";

const path = "README.md";
const t = readFileSync(path, "utf8");

const enStart = t.indexOf('<a id="readme-en"></a>');
const zhStart = t.indexOf('<a id="readme-zh"></a>');
if (enStart < 0 || zhStart < 0 || zhStart <= enStart) {
  // Already details-based?
  if (t.includes("<details open>") && t.includes('id="lang-zh"')) {
    console.log("already details-based; skip");
    process.exit(0);
  }
  throw new Error("expected readme-en / readme-zh anchors");
}

const between = t.slice(enStart, zhStart);
let enBody = between
  .replace(/^<a id="readme-en"><\/a>\s*/u, "")
  .replace(/\n---\s*$/u, "")
  .trim();

let zhBody = t
  .slice(zhStart)
  .replace(/^<a id="readme-zh"><\/a>\s*/u, "")
  .trim();

// Drop leading language badge block inside Chinese section
zhBody = zhBody.replace(
  /^<p align="center">\s*<a href="#readme-en">[\s\S]*?<\/p>\s*/u,
  "",
);
zhBody = zhBody.replace(
  /^<p align="center">\s*<a href="#lang-en">[\s\S]*?<\/p>\s*/u,
  "",
);

enBody = enBody
  .replaceAll('href="#readme-en"', 'href="#lang-en"')
  .replaceAll('href="#readme-zh"', 'href="#lang-zh"');
zhBody = zhBody
  .replaceAll('href="#readme-en"', 'href="#lang-en"')
  .replaceAll('href="#readme-zh"', 'href="#lang-zh"');

const out = `<!-- Bilingual homepage: <details> panels keep each language at the same place.
     GitHub README cannot run JS, so true tabs / no-scroll SPA switching is impossible. -->
<p align="center">
  <a href="#lang-en"><img alt="English" src="https://img.shields.io/badge/English-74D6B1?style=for-the-badge&labelColor=202624&color=74D6B1"></a>
  &nbsp;
  <a href="#lang-zh"><img alt="简体中文" src="https://img.shields.io/badge/%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-FF4B35?style=for-the-badge&labelColor=202624&color=FF4B35"></a>
</p>

<p align="center"><sub>
  Same spot on the page: expand one language panel and collapse the other.
  GitHub does not allow real dropdown tabs inside README (no JavaScript).
</sub></p>

<a id="lang-en"></a>
<details open>
<summary><strong>English</strong> — click the arrow to expand / collapse</summary>

${enBody}

</details>

<a id="lang-zh"></a>
<details>
<summary><strong>简体中文</strong> — 点击箭头展开 / 折叠</summary>

${zhBody}

</details>
`;

writeFileSync(path, out, "utf8");
console.log("wrote", path, "bytes", Buffer.byteLength(out, "utf8"));
console.log(
  "ok",
  out.includes("<details open>"),
  out.includes("简体中文"),
  out.includes("## Why"),
  out.includes("## 为什么需要它"),
);
