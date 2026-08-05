/**
 * Extract ALL Owner/Human content from Grok compaction segments 000–011
 * for oh-no-codex session 019fb706-…
 */
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";

const COMP =
  "C:/Users/Administrator/.grok/sessions/D%3A%5Cpython_workspace%5Coh-no-codex/019fb706-5e92-7b01-908f-fd31b3e5566b/compaction";
const OUT =
  "D:/python_workspace/oh-no-codex/docs/superpowers/specs";

await mkdir(OUT, { recursive: true });

const files = (await readdir(COMP))
  .filter((f) => /^segment_\d+\.md$/u.test(f))
  .sort();

const allHuman = [];
const allSummaries = [];
const segmentMeta = [];

function extractBetween(text, startRe, endRes) {
  const m = startRe.exec(text);
  if (!m) return null;
  const start = m.index + m[0].length;
  let end = text.length;
  for (const er of endRes) {
    er.lastIndex = 0;
    const em = er.exec(text.slice(start));
    if (em) end = Math.min(end, start + em.index);
  }
  return text.slice(start, end).trim();
}

for (const file of files) {
  const path = join(COMP, file);
  const text = await readFile(path, "utf8");
  const idx = file.match(/segment_(\d+)/u)?.[1] ?? "?";

  // metadata
  const turnCount = /Turn count:\s*(\d+)/u.exec(text)?.[1];
  const ts = /Timestamp:\s*([^\n]+)/u.exec(text)?.[1];
  const stats = /Turns:\s*([^\n]+)/u.exec(text)?.[1];
  segmentMeta.push({
    file,
    index: idx,
    turnCount,
    timestamp: ts?.trim(),
    stats: stats?.trim(),
    bytes: Buffer.byteLength(text, "utf8"),
  });

  // Summary block (curated)
  const summary = extractBetween(
    text,
    /## Summary \(curated by compaction step\)\s*/u,
    [/## Verbatim turns/u, /## Turn statistics/u],
  );
  if (summary) {
    allSummaries.push({ segment: idx, summary });
    // pull "All User Messages" line if present
    const um = /6\.\s*All User Messages:\s*([\s\S]*?)(?=\n\d+\.\s|\n## |\n*$)/u
      .exec(summary);
    if (um) {
      allHuman.push({
        kind: "summary-user-messages",
        segment: idx,
        text: um[1].trim(),
      });
    }
    // Primary Request
    const pr = /1\.\s*Primary Request and Intent:\s*([\s\S]*?)(?=\n\d+\.\s)/u
      .exec(summary);
    if (pr) {
      allHuman.push({
        kind: "summary-primary-intent",
        segment: idx,
        text: pr[1].trim(),
      });
    }
  }

  // Verbatim Human turns: ### Turn N (Human)
  const humanRe = /### Turn (\d+) \(Human\)\s*\n([\s\S]*?)(?=\n### Turn |\n## |\n*$)/gu;
  let hm;
  while ((hm = humanRe.exec(text))) {
    let body = hm[2].trim();
    // strip user_info / git_status wrappers if present; prefer user_query
    const uq = /<user_query>\s*([\s\S]*?)\s*<\/user_query>/iu.exec(body);
    if (uq) body = uq[1].trim();
    // skip empty or pure system paste
    if (body.length < 5) continue;
    if (body.startsWith("You are Grok")) continue;
    allHuman.push({
      kind: "verbatim-human",
      segment: idx,
      turn: hm[1],
      text: body,
    });
  }

  // Also catch (User) or Human: variants
  const altRe = /### Turn (\d+) \(User\)\s*\n([\s\S]*?)(?=\n### Turn |\n## |\n*$)/gu;
  while ((hm = altRe.exec(text))) {
    let body = hm[2].trim();
    const uq = /<user_query>\s*([\s\S]*?)\s*<\/user_query>/iu.exec(body);
    if (uq) body = uq[1].trim();
    if (body.length < 5) continue;
    allHuman.push({
      kind: "verbatim-user",
      segment: idx,
      turn: hm[1],
      text: body,
    });
  }
}

// de-dupe exact text for human messages
const seen = new Set();
const uniqueHuman = [];
for (const item of allHuman) {
  const key = item.text;
  if (seen.has(key)) continue;
  seen.add(key);
  uniqueHuman.push(item);
}

// Build comprehensive markdown
const md = [];
md.push("# Full compaction mining — session 019fb706 (oh-no-codex)");
md.push("");
md.push("Source: `~/.grok/sessions/.../oh-no-codex/019fb706-.../compaction/segment_000..011.md`");
md.push("");
md.push("These are **historical shards of one continuous Grok session**, not separate sessions.");
md.push("Each segment contains: metadata, curated summary, and verbose verbatim turns.");
md.push("");
md.push("## Segment index");
md.push("");
md.push("| Seg | File | Timestamp | Stats | Bytes |");
md.push("| ---: | --- | --- | --- | ---: |");
for (const s of segmentMeta) {
  md.push(
    `| ${s.index} | \`${s.file}\` | ${s.timestamp ?? "?"} | ${
      s.stats ?? s.turnCount ?? "?"
    } | ${s.bytes} |`,
  );
}
md.push("");
md.push(`**Extracted human/summary units (raw):** ${allHuman.length}`);
md.push(`**Unique texts:** ${uniqueHuman.length}`);
md.push("");

md.push("## A. Per-segment Primary Intent + All User Messages (from summaries)");
md.push("");
for (const s of allSummaries) {
  md.push(`### Segment ${s.segment}`);
  md.push("");
  // only intent + user messages + pending if present
  const lines = s.summary.split("\n");
  let keep = false;
  const buf = [];
  for (const line of lines) {
    if (/^\d+\.\s+(Primary Request|All User Messages|Pending Tasks|Current Work|Optional Next)/u.test(line)) {
      keep = true;
    } else if (/^\d+\.\s+/u.test(line)) {
      keep = /Primary|User Messages|Pending|Current Work|Optional Next/u
        .test(line);
    }
    if (keep) buf.push(line);
  }
  // if filter too aggressive, dump full summary truncated
  if (buf.length < 3) {
    md.push(s.summary.slice(0, 4000));
    if (s.summary.length > 4000) md.push("\n…(summary truncated in index; full in section C)…");
  } else {
    md.push(buf.join("\n"));
  }
  md.push("");
  md.push("---");
  md.push("");
}

md.push("## B. Unique Human / Owner texts (chronological by segment then turn)");
md.push("");
// sort: segment num, turn num
uniqueHuman.sort((a, b) => {
  const sa = Number(a.segment) - Number(b.segment);
  if (sa !== 0) return sa;
  return Number(a.turn || 0) - Number(b.turn || 0);
});
let n = 0;
for (const item of uniqueHuman) {
  n += 1;
  md.push(
    `### H${String(n).padStart(3, "0")} | seg ${item.segment} | ${item.kind}`
      + (item.turn ? ` | turn ${item.turn}` : ""),
  );
  md.push("");
  md.push(item.text);
  md.push("");
  md.push("---");
  md.push("");
}

md.push("## C. Full curated summaries (every segment, complete)");
md.push("");
for (const s of allSummaries) {
  md.push(`### Full summary — segment ${s.segment}`);
  md.push("");
  md.push(s.summary);
  md.push("");
  md.push("---");
  md.push("");
}

const outPath = join(OUT, "2026-08-05-compaction-full-extract.md");
await writeFile(outPath, md.join("\n"), "utf8");
console.log("wrote", outPath, "bytes", Buffer.byteLength(md.join("\n")));
console.log("segments", segmentMeta.length);
console.log("human raw", allHuman.length, "unique", uniqueHuman.length);

// Also write a compact Owner-only timeline (verbatim-human + summary-user-messages only)
const ownerOnly = uniqueHuman.filter(
  (x) =>
    x.kind === "verbatim-human"
    || x.kind === "verbatim-user"
    || x.kind === "summary-user-messages"
    || x.kind === "summary-primary-intent",
);
const timeline = [];
timeline.push("# Owner timeline from compaction (unique)");
timeline.push("");
timeline.push(`Count: ${ownerOnly.length}`);
timeline.push("");
let i = 0;
for (const item of ownerOnly) {
  i += 1;
  timeline.push(`## T${String(i).padStart(3, "0")} seg${item.segment} ${item.kind}`);
  timeline.push("");
  timeline.push(item.text);
  timeline.push("");
  timeline.push("---");
  timeline.push("");
}
const tlPath = join(OUT, "2026-08-05-compaction-owner-timeline.md");
await writeFile(tlPath, timeline.join("\n"), "utf8");
console.log("wrote", tlPath, "bytes", Buffer.byteLength(timeline.join("\n")));

// JSON index for tooling
await writeFile(
  join(OUT, "2026-08-05-compaction-extract-index.json"),
  JSON.stringify(
    {
      session_id: "019fb706-5e92-7b01-908f-fd31b3e5566b",
      segments: segmentMeta,
      unique_human_count: uniqueHuman.length,
      kinds: Object.fromEntries(
        [...new Set(allHuman.map((h) => h.kind))].map((k) => [
          k,
          allHuman.filter((h) => h.kind === k).length,
        ]),
      ),
    },
    null,
    2,
  ),
  "utf8",
);
