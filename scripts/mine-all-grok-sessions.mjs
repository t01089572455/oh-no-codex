import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { join } from "node:path";

const outDir = "D:/python_workspace/oh-no-codex/docs/superpowers/specs";
await mkdir(outDir, { recursive: true });

const inventory = {
  oh_no_codex_workspace_sessions: [
    {
      session_id: "019fb706-5e92-7b01-908f-fd31b3e5566b",
      cwd: "D:\\python_workspace\\oh-no-codex",
      note: "ONLY Grok session registered for this workspace path (sqlite + disk)",
    },
  ],
  related_workspaces: [],
};

const ohnoPh =
  "C:/Users/Administrator/.grok/sessions/D%3A%5Cpython_workspace%5Coh-no-codex/prompt_history.jsonl";
const ohnoPrompts = [];
for (const line of (await readFile(ohnoPh, "utf8")).split("\n").filter(Boolean)) {
  try {
    const o = JSON.parse(line);
    if (o.is_bash) continue;
    const p = String(o.prompt ?? "").trim();
    if (p.length < 8) continue;
    ohnoPrompts.push({
      source: "oh-no-codex",
      session_id: o.session_id,
      t: o.timestamp,
      p,
    });
  } catch {
    // skip
  }
}

const lbRoot =
  "C:/Users/Administrator/.grok/sessions/D%3A%5Cpython_workspace%5Clzs%5CVibeCoding%E5%AE%9E%E6%88%98%5CLoveBuddy-v11";
const lbPh = join(lbRoot, "prompt_history.jsonl");
const lbPrompts = [];
const lbSids = new Set();
for (const line of (await readFile(lbPh, "utf8")).split("\n").filter(Boolean)) {
  try {
    const o = JSON.parse(line);
    if (o.is_bash) continue;
    const p = String(o.prompt ?? "").trim();
    if (!/oh-?no|ohnocodex|十八宗罪|ohno /iu.test(p)) continue;
    lbSids.add(o.session_id);
    lbPrompts.push({
      source: "LoveBuddy-v11",
      session_id: o.session_id,
      t: o.timestamp,
      p,
    });
  } catch {
    // skip
  }
}
inventory.related_workspaces.push({
  cwd: "LoveBuddy-v11",
  session_ids: [...lbSids],
  ohno_related_prompts: lbPrompts.length,
  note: "Field-trial / install conversations that mention Oh No",
});

const chatPath =
  "C:/Users/Administrator/.grok/sessions/D%3A%5Cpython_workspace%5Coh-no-codex/019fb706-5e92-7b01-908f-fd31b3e5566b/chat_history.jsonl";
const chatUser = [];
const seenP = new Set(ohnoPrompts.map((x) => x.p));
const userQueryRe = /<user_query>\s*([\s\S]*?)\s*<\/user_query>/iu;
try {
  const chat = (await readFile(chatPath, "utf8")).split("\n").filter(Boolean);
  for (const line of chat) {
    try {
      const o = JSON.parse(line);
      if (o.type !== "user") continue;
      let text = "";
      if (typeof o.content === "string") text = o.content;
      else if (Array.isArray(o.content)) {
        text = o.content.map((c) => c?.text || c?.content || "").join("\n");
      }
      const m = text.match(userQueryRe);
      const body = (m ? m[1] : text).trim();
      if (body.length < 40) continue;
      if (body.startsWith("<user_info>") || body.startsWith("<git_status>")) {
        continue;
      }
      if (seenP.has(body)) continue;
      if (body.length > 20_000) continue;
      seenP.add(body);
      chatUser.push({
        source: "oh-no-codex-chat",
        session_id: "019fb706-5e92-7b01-908f-fd31b3e5566b",
        t: o.timestamp || "",
        p: body,
      });
    } catch {
      // skip
    }
  }
} catch (error) {
  console.log("chat parse err", error.message);
}

const compactDir =
  "C:/Users/Administrator/.grok/sessions/D%3A%5Cpython_workspace%5Coh-no-codex/019fb706-5e92-7b01-908f-fd31b3e5566b/compaction";
const compactSnips = [];
try {
  const files = (await readdir(compactDir)).filter(
    (f) => f.startsWith("segment_") && f.endsWith(".md"),
  );
  const re = /(?:^|\n)(?:User|user_query|Owner)[:：]\s*([^\n]{40,800})/giu;
  for (const f of files) {
    const t = await readFile(join(compactDir, f), "utf8");
    let m;
    while ((m = re.exec(t))) {
      const p = m[1].trim();
      if (seenP.has(p)) continue;
      if (/Implemented|Inspected|Fixed|Monitor/iu.test(p)) continue;
      seenP.add(p);
      compactSnips.push({
        source: `compaction:${f}`,
        session_id: "019fb706-5e92-7b01-908f-fd31b3e5566b",
        t: "",
        p,
      });
    }
  }
} catch (error) {
  console.log("compact", error.message);
}

// Also list every session folder under oh-no-codex path
const ohnoRoot =
  "C:/Users/Administrator/.grok/sessions/D%3A%5Cpython_workspace%5Coh-no-codex";
const diskSessions = (await readdir(ohnoRoot, { withFileTypes: true }))
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

const all = [...ohnoPrompts, ...lbPrompts, ...chatUser, ...compactSnips];
const uniq = [];
const u = new Set();
for (const item of all) {
  if (u.has(item.p)) continue;
  u.add(item.p);
  uniq.push(item);
}

const summary = {
  disk_session_folders_under_oh_no_codex: diskSessions,
  inventory,
  counts: {
    ohno_prompt_history: ohnoPrompts.length,
    lovebuddy_ohno: lbPrompts.length,
    chat_extra: chatUser.length,
    compact_extra: compactSnips.length,
    unique_all: uniq.length,
  },
};
console.log(JSON.stringify(summary, null, 2));

const md = [];
md.push("# Complete Grok session inventory for Oh No work");
md.push("");
md.push("## Fact: workspace-bound sessions");
md.push("");
md.push("Grok stores sessions per **cwd workspace**.");
md.push("");
md.push("| Workspace | Session IDs on disk | Notes |");
md.push("| --- | --- | --- |");
md.push(
  "| `D:\\\\python_workspace\\\\oh-no-codex` | "
    + diskSessions.map((s) => `\`${s}\``).join(", ")
    + " | **Only these folders exist under this workspace path** |",
);
md.push(
  "| LoveBuddy-v11 (field tests) | "
    + [...lbSids].map((s) => `\`${s}\``).join(", ")
    + " | Mentions Oh No; different cwd |",
);
md.push("");
md.push(
  "Verified via disk listing + `session_search.sqlite` "
    + "(`cwd LIKE %oh-no-codex%` → only `019fb706-…`).",
);
md.push("");
md.push(
  "Long history of `019fb706` was compacted into `segment_000`…`011` "
    + "(same session, not separate sessions).",
);
md.push("");
md.push("## Counts");
md.push("");
md.push(`- oh-no-codex prompt_history: ${ohnoPrompts.length}`);
md.push(`- LoveBuddy oh-no-related prompts: ${lbPrompts.length}`);
md.push(`- chat_history extras: ${chatUser.length}`);
md.push(`- compaction snips: ${compactSnips.length}`);
md.push(`- **unique prompts total: ${uniq.length}**`);
md.push("");
md.push("---");
md.push("");
for (let i = 0; i < uniq.length; i += 1) {
  const it = uniq[i];
  md.push(
    `## U${String(i + 1).padStart(3, "0")} | ${it.source} | ${
      it.session_id || ""
    } | ${it.t || ""}`,
  );
  md.push("");
  md.push(it.p);
  md.push("");
  md.push("---");
  md.push("");
}
await writeFile(
  join(outDir, "2026-08-05-all-grok-sessions-inventory.md"),
  md.join("\n"),
  "utf8",
);
console.log("wrote inventory");

console.log("--- LB OHNO PROMPTS ---");
for (const p of lbPrompts) {
  console.log("====", p.session_id, p.t);
  console.log(p.p.slice(0, 1000));
  console.log();
}
