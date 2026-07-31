import {
  readdirSync,
  readFileSync,
  writeFileSync,
  statSync,
} from "node:fs";
import { join } from "node:path";

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      walk(p, out);
    } else if (p.endsWith(".mjs") || p.endsWith(".js")) {
      out.push(p);
    }
  }
  return out;
}

for (const f of walk("test")) {
  let t = readFileSync(f, "utf8");
  const orig = t;
  t = t.replace(/\["init",\s*"--goal",\s*[^\]]+\]/gu, '["init"]');
  t = t.replace(
    /"init",\s*\r?\n\s*"--goal",\s*\r?\n\s*[^\n]+,\s*\r?\n/gu,
    '"init",\n',
  );
  // helpers: ["init", "--goal", projectGoal]
  t = t.replace(
    /\[\s*"init",\s*"--goal",\s*projectGoal\s*\]/gu,
    '["init"]',
  );
  t = t.replace(
    /\[\s*"init",\s*"--goal",\s*ownerGoal\s*\]/gu,
    '["init"]',
  );
  t = t.replace(
    /\[\s*"init",\s*"--goal",\s*goal\s*\]/gu,
    '["init"]',
  );
  t = t.replace(
    /\[\s*"init",\s*"--goal",\s*maximumGoal\s*\]/gu,
    '["init"]',
  );
  t = t.replace(
    /\[\s*"init",\s*"--goal",\s*oversizedGoal\s*\]/gu,
    '["init"]',
  );
  if (t !== orig) {
    writeFileSync(f, t);
    console.log("updated", f);
  }
}
