const fs = require("fs");
const path = process.argv[2];
const outPath = process.argv[3];
const mdPath = process.argv[4];
const lines = fs.readFileSync(path, "utf8").split(/\n/).filter(Boolean);

function clip(s, n = 220) {
  s = String(s || "");
  return s.length > n ? s.slice(0, n) + "…" : s;
}
function walk(obj, fn, depth = 0) {
  if (obj == null || depth > 12) return;
  if (typeof obj === "string") {
    fn(obj);
    return;
  }
  if (Array.isArray(obj)) {
    for (const x of obj) walk(x, fn, depth + 1);
    return;
  }
  if (typeof obj === "object") {
    for (const k of Object.keys(obj)) walk(obj[k], fn, depth + 1);
  }
}

const toolCalls = []; // {line,ts,name,inputSummary,raw}
const toolOutputs = [];
const ohnoCmds = [];
const allCmds = [];
const skillHits = [];
const spawnEvents = [];
const waitEvents = [];
const listAgents = [];
const sendMessages = [];
const pathFails = [];
const ohnoMentions = [];
const hookBlocks = [];
const commits = [];
const userMsgs = [];
const commentary = [];
const finals = [];
const taskComplete = [];
const turnAborted = [];
const errors = [];
const multiAgentNarrative = [];
let firstTs = null, lastTs = null;
const typeHist = {};
const payloadHist = {};
const toolNameHist = {};

for (let i = 0; i < lines.length; i++) {
  const lineNo = i + 1;
  let o;
  try {
    o = JSON.parse(lines[i]);
  } catch (e) {
    errors.push({ line: lineNo, kind: "parse", msg: e.message });
    continue;
  }
  const ts = o.timestamp || "";
  if (ts) {
    if (!firstTs) firstTs = ts;
    lastTs = ts;
  }
  typeHist[o.type || "?"] = (typeHist[o.type || "?"] || 0) + 1;
  const p = o.payload || {};
  const pt = p.type || o.type || "?";
  payloadHist[pt] = (payloadHist[pt] || 0) + 1;

  // Collect all strings that look like shell commands from payload
  const strings = [];
  walk(p, (s) => strings.push(s));
  for (const s of strings) {
    if (/ohno\s+(init|install|plan|task|verify|resume|status|next|doctor|requirements|preferences|cockpit|projectors|change|skill|hook|git)/i.test(s)) {
      ohnoCmds.push({ line: lineNo, ts, snip: clip(s.replace(/\s+/g, " "), 240) });
    }
    if (/Get-Content|shell_command|npm |git |node /i.test(s) && s.length < 2000 && s.length > 8) {
      if (/command[:\s]|shell_command|workdir/i.test(s) || /^(git|npm|node|ohno)\b/i.test(s.trim())) {
        // skip huge
      }
    }
    if (/skills[\\\/][a-z0-9\-]+[\\\/]SKILL\.md|\.agents[\\\/]skills[\\\/]/i.test(s)) {
      const m = s.match(/skills[\\\/]([a-z0-9\-]+)[\\\/]SKILL/i);
      skillHits.push({ line: lineNo, ts, skill: m ? m[1] : "?", snip: clip(s, 160) });
    }
    if (/The term 'ohno'|not recognized|不是内部或外部命令/i.test(s)) {
      pathFails.push({ line: lineNo, ts, snip: clip(s, 180) });
    }
    if (/Oh No|ohno|guardrail|pre-commit|没有活动任务|拒绝|拦/i.test(s) && /commit|hook|guard|PASS|FAIL|verify/i.test(s)) {
      hookBlocks.push({ line: lineNo, ts, snip: clip(s.replace(/\s+/g, " "), 200) });
    }
    if (/git commit/i.test(s)) commits.push({ line: lineNo, ts, snip: clip(s.replace(/\s+/g, " "), 160) });
  }

  // Tool calls structured
  if (pt === "custom_tool_call" || pt === "function_call") {
    const name = p.name || (p.function && p.function.name) || "?";
    toolNameHist[name] = (toolNameHist[name] || 0) + 1;
    let input = p.input ?? p.arguments ?? p.command ?? "";
    if (typeof input !== "string") input = JSON.stringify(input);
    const rec = { line: lineNo, ts, name, input: clip(input, 400) };
    toolCalls.push(rec);
    if (name === "spawn_agent" || /spawn_agent/i.test(name)) spawnEvents.push(rec);
    if (name === "wait_agent" || name === "wait") waitEvents.push({ line: lineNo, ts, name, input: clip(input, 200) });
    if (name === "list_agents") listAgents.push(rec);
    if (name === "send_message" || name === "followup_task") sendMessages.push(rec);
    if (/ohno/i.test(input)) ohnoCmds.push({ line: lineNo, ts, snip: clip(input.replace(/\s+/g, " "), 240) });
    // extract shell from exec input like tools.shell_command({command:"..."
    const cmdMatches = [...String(input).matchAll(/command\s*[:=]\s*[\"']([^\"']{3,500})[\"']/g)];
    for (const m of cmdMatches) {
      allCmds.push({ line: lineNo, ts, cmd: m[1] });
      if (/\bohno\b/i.test(m[1])) ohnoCmds.push({ line: lineNo, ts, snip: m[1] });
    }
    // also command: "..." with escaped quotes in JSON string already unescaped partially
    const cmd2 = [...String(input).matchAll(/command\":\"((?:\\.|[^\"\\])*)\"/g)];
    for (const m of cmd2) {
      const c = m[1].replace(/\\n/g, " ").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
      allCmds.push({ line: lineNo, ts, cmd: clip(c, 300) });
      if (/\bohno\b/i.test(c)) ohnoCmds.push({ line: lineNo, ts, snip: clip(c, 240) });
    }
  }
  if (pt === "custom_tool_call_output" || pt === "function_call_output") {
    const out = typeof p.output === "string" ? p.output : JSON.stringify(p.output || p);
    if (/ohno|PLAN_REVISION|PROJECT_COMPLETE|PASS|FAIL|not recognized/i.test(out)) {
      toolOutputs.push({ line: lineNo, ts, snip: clip(out.replace(/\s+/g, " "), 250) });
    }
    if (/The term 'ohno'|not recognized/i.test(out)) pathFails.push({ line: lineNo, ts, snip: clip(out, 180) });
  }

  if (pt === "sub_agent_activity") {
    multiAgentNarrative.push({ line: lineNo, ts, kind: "sub_agent_activity", snip: clip(JSON.stringify(p), 300) });
  }

  if (pt === "user_message" && p.message && !/AGENTS\.md|managed-begin|in-app-browser|app-context/i.test(p.message)) {
    userMsgs.push({ line: lineNo, ts, text: clip(p.message.replace(/\s+/g, " "), 160) });
  }
  if (pt === "agent_message") {
    const msg = (p.message || "").replace(/\s+/g, " ");
    if (p.phase === "commentary" && msg) {
      commentary.push({ line: lineNo, ts, text: clip(msg, 220) });
      if (/子代理|subagent|审查|Oh No|ohno|worktree|隔离|验收|verify|spawn|代理/i.test(msg)) {
        multiAgentNarrative.push({ line: lineNo, ts, kind: "commentary", text: clip(msg, 220) });
      }
    }
    if (p.phase === "final_answer" && msg.trim()) finals.push({ line: lineNo, ts, text: clip(msg, 280) });
  }
  if (pt === "task_complete") taskComplete.push({ line: lineNo, ts });
  if (pt === "turn_aborted") turnAborted.push({ line: lineNo, ts });
}

// Dedupe ohno cmds
const ohnoUniq = [];
const seenO = new Set();
for (const x of ohnoCmds) {
  const k = x.snip.slice(0, 120);
  if (seenO.has(k)) continue;
  seenO.add(k);
  ohnoUniq.push(x);
}

// Classify ohno subcommands
const ohnoSub = {};
for (const x of ohnoUniq) {
  const m = x.snip.match(/ohno\s+([a-z]+)(?:\s+([a-z\-]+))?/i);
  const k = m ? m[1] + (m[2] ? " " + m[2] : "") : "mention";
  ohnoSub[k] = (ohnoSub[k] || 0) + 1;
}

// Skill hist
const skillHist = {};
for (const s of skillHits) skillHist[s.skill] = (skillHist[s.skill] || 0) + 1;

// Spawn agent details - try parse input for agent role/prompt
const spawnDetail = spawnEvents.map((s) => {
  let role = "?", goal = "";
  try {
    const j = typeof s.input === "string" && s.input.trim().startsWith("{") ? JSON.parse(s.input) : null;
    if (j) {
      role = j.role || j.agent_type || j.name || j.task || "?";
      goal = clip(j.prompt || j.instructions || j.message || JSON.stringify(j), 300);
    } else {
      goal = s.input;
      const m = s.input.match(/role[\"']?\s*[:=]\s*[\"']([^\"']+)/i);
      if (m) role = m[1];
    }
  } catch {
    goal = s.input;
  }
  return { line: s.line, ts: s.ts, role, goal: clip(goal, 300) };
});

const audit = {
  meta: {
    path,
    bytes: fs.statSync(path).size,
    lines: lines.length,
    firstTs,
    lastTs,
    parseErrors: errors.filter((e) => e.kind === "parse").length,
  },
  histograms: {
    topLevelTypes: Object.entries(typeHist).sort((a, b) => b[1] - a[1]),
    payloadTypes: Object.entries(payloadHist).sort((a, b) => b[1] - a[1]).slice(0, 25),
    tools: Object.entries(toolNameHist).sort((a, b) => b[1] - a[1]),
    ohnoSubcommands: ohnoSub,
    skills: skillHist,
  },
  multiAgent: {
    spawn_agent: spawnDetail,
    wait_agent_count: waitEvents.filter((w) => w.name === "wait_agent").length,
    wait_count: waitEvents.filter((w) => w.name === "wait").length,
    list_agents: listAgents.length,
    send_message: sendMessages,
    sub_agent_activity: multiAgentNarrative.filter((m) => m.kind === "sub_agent_activity").length,
    narrative: multiAgentNarrative.filter((m) => m.kind === "commentary"),
  },
  ohno: {
    uniqueSnips: ohnoUniq,
    pathFails,
    hookBlocks: hookBlocks.slice(0, 40),
    toolOutputsMention: toolOutputs.slice(0, 40),
  },
  skills: skillHits.slice(0, 60),
  allCmdsSample: allCmds.filter((c) => /ohno|npm test|git commit|worktree/i.test(c.cmd)).slice(0, 80),
  userMsgs,
  finals,
  commentaryOhNoOrAgent: commentary.filter((c) =>
    /Oh No|ohno|子代理|审查|worktree|验收|verify|代理|hook|计划|PASS|FAIL|freeze|FREEZE/i.test(c.text)
  ),
  taskCompleteCount: taskComplete.length,
  turnAborted,
  commits: commits.slice(0, 40),
};

fs.writeFileSync(outPath, JSON.stringify(audit, null, 2), "utf8");

// Markdown report
const linesOut = [];
const w = (s = "") => linesOut.push(s);
w("# Full session audit — 019fb9be");
w("");
w(`- File: \`${path}\``);
w(`- Lines parsed: **${lines.length}** (100%, parse errors: ${audit.meta.parseErrors})`);
w(`- Time: ${firstTs} → ${lastTs}`);
w(`- Bytes: ${audit.meta.bytes}`);
w("");
w("## Multi-agent machinery (Codex native)");
w("");
w("| Tool | Count |");
w("| --- | ---: |");
for (const [k, v] of audit.histograms.tools) w(`| ${k} | ${v} |`);
w("");
w(`- **spawn_agent**: ${spawnDetail.length}`);
w(`- **wait_agent**: ${audit.multiAgent.wait_agent_count}`);
w(`- **wait** (generic): ${audit.multiAgent.wait_count}`);
w(`- **list_agents**: ${audit.multiAgent.list_agents}`);
w(`- **send_message / followup_task**: ${sendMessages.length}`);
w(`- **sub_agent_activity events**: ${audit.multiAgent.sub_agent_activity}`);
w("");
w("### spawn_agent calls (all)");
w("");
for (const s of spawnDetail) {
  w(`- L${s.line} @ ${s.ts}`);
  w(`  - role/type hint: \`${clip(s.role, 80)}\``);
  w(`  - goal: ${clip(s.goal, 280)}`);
}
w("");
w("### Multi-agent related agent commentary (filtered)");
w("");
for (const n of audit.multiAgent.narrative) {
  w(`- L${n.line} ${n.ts}: ${n.text}`);
}
w("");
w("## Oh No CLI / harness signals");
w("");
w("### Subcommand frequency (unique snips classified)");
w("");
w("```");
w(JSON.stringify(ohnoSub, null, 2));
w("```");
w("");
w("### All unique ohno-related command/output snips");
w("");
for (const x of ohnoUniq) w(`- L${x.line} ${x.ts}: \`${x.snip.replace(/`/g, "'")}\``);
w("");
w("### PATH failures");
w("");
for (const x of pathFails) w(`- L${x.line}: ${x.snip}`);
w("");
w("### Hook / block related (sample)");
w("");
for (const x of hookBlocks.slice(0, 25)) w(`- L${x.line}: ${x.snip}`);
w("");
w("## Skills read");
w("");
w("```");
w(JSON.stringify(skillHist, null, 2));
w("```");
w("");
w("## User messages (all non-system)");
w("");
for (const u of userMsgs) w(`- L${u.line} ${u.ts}: ${u.text}`);
w("");
w("## Final answers (all)");
w("");
for (const f of finals) w(`- L${f.line} ${f.ts}: ${f.text}`);
w("");
w("## Task complete / aborted");
w("");
w(`- task_complete events: ${taskComplete.length}`);
w(`- turn_aborted: ${turnAborted.length}`);
w("");
w("## Payload type histogram (top)");
w("");
for (const [k, v] of audit.histograms.payloadTypes) w(`- ${k}: ${v}`);
w("");
fs.writeFileSync(mdPath, linesOut.join("\n"), "utf8");
console.log("JSON", outPath);
console.log("MD", mdPath);
console.log("lines", lines.length, "ohnoUniq", ohnoUniq.length, "spawns", spawnDetail.length);
console.log("tools", toolNameHist);
console.log("ohnoSub", ohnoSub);
console.log("skills", skillHist);
console.log("pathFails", pathFails.length);
console.log("allCmds", allCmds.length);
console.log("spawn detail:");
spawnDetail.forEach((s) => console.log(s.line, clip(s.role, 40), clip(s.goal, 100)));
