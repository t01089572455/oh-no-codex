import { spawnSync } from "node:child_process";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

/** Runtime pointer only — not plan authority (that remains state.json). */
export const cockpitRuntimeRelativePath = ".ohno/cockpit.runtime.json";

export interface CockpitRuntimeRecord {
  pid: number;
  port: number;
  url: string;
  cwd: string;
  started_at: string;
}

export interface CockpitStartOptions {
  /** Fixed port. Omit or 0 → OS assigns an ephemeral port. */
  port?: number;
  /** Kill the project's previous cockpit (if any) before starting. */
  replace?: boolean;
}

export function cockpitRuntimePath(projectPath: string): string {
  return resolve(projectPath, cockpitRuntimeRelativePath);
}

export function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function readCockpitRuntime(
  projectPath: string,
): Promise<CockpitRuntimeRecord | null> {
  const path = cockpitRuntimePath(projectPath);
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as Partial<CockpitRuntimeRecord>;
    if (
      typeof parsed.pid !== "number"
      || typeof parsed.port !== "number"
      || typeof parsed.url !== "string"
      || typeof parsed.cwd !== "string"
      || typeof parsed.started_at !== "string"
    ) {
      return null;
    }
    return {
      pid: parsed.pid,
      port: parsed.port,
      url: parsed.url,
      cwd: parsed.cwd,
      started_at: parsed.started_at,
    };
  } catch {
    return null;
  }
}

export async function writeCockpitRuntime(
  projectPath: string,
  record: CockpitRuntimeRecord,
): Promise<void> {
  const path = cockpitRuntimePath(projectPath);
  await mkdir(resolve(projectPath, ".ohno"), { recursive: true });
  await writeFile(path, `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

export async function clearCockpitRuntime(projectPath: string): Promise<void> {
  await rm(cockpitRuntimePath(projectPath), { force: true });
}

export async function probeCockpitUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(new URL("api/state", url), {
      signal: AbortSignal.timeout(1_500),
      headers: { accept: "application/json" },
    });
    return response.ok || response.status === 503;
  } catch {
    return false;
  }
}

export async function findLiveCockpit(
  projectPath: string,
): Promise<CockpitRuntimeRecord | null> {
  const record = await readCockpitRuntime(projectPath);
  if (record === null) {
    return null;
  }
  if (!isProcessAlive(record.pid)) {
    await clearCockpitRuntime(projectPath);
    return null;
  }
  if (!(await probeCockpitUrl(record.url))) {
    return null;
  }
  return record;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, ms);
  });
}

/**
 * Stop the cockpit recorded for this project (if any).
 * Returns whether a process was signaled.
 */
export async function stopProjectCockpit(
  projectPath: string,
): Promise<{ stopped: boolean; record: CockpitRuntimeRecord | null }> {
  const record = await readCockpitRuntime(projectPath);
  if (record === null) {
    return { stopped: false, record: null };
  }
  let signaled = false;
  if (isProcessAlive(record.pid) && record.pid !== process.pid) {
    try {
      if (process.platform === "win32") {
        // Windows: SIGTERM is unreliable for Node children; force-end by PID.
        spawnSync(
          "taskkill",
          ["/PID", String(record.pid), "/T", "/F"],
          { windowsHide: true, stdio: "ignore" },
        );
      } else {
        process.kill(record.pid, "SIGTERM");
      }
      signaled = true;
    } catch {
      // already gone
    }
    for (let i = 0; i < 40; i += 1) {
      if (!isProcessAlive(record.pid)) {
        break;
      }
      await sleep(50);
    }
    // Brief grace so the TCP port can be rebound on the same machine.
    await sleep(100);
  }
  await clearCockpitRuntime(projectPath);
  return { stopped: signaled, record };
}

export function parseCockpitCliArgs(args: readonly string[]): {
  stop: boolean;
  port: number | undefined;
  replace: boolean;
} {
  let stop = false;
  let port: number | undefined;
  let replace = false;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "stop") {
      stop = true;
      continue;
    }
    if (arg === "--replace") {
      replace = true;
      continue;
    }
    if (arg === "--port") {
      const raw = args[i + 1];
      if (raw === undefined || raw.startsWith("--")) {
        throw new Error("--port requires a positive integer");
      }
      const value = Number(raw);
      if (!Number.isInteger(value) || value < 1 || value > 65535) {
        throw new Error("--port requires a positive integer 1..65535");
      }
      port = value;
      i += 1;
      continue;
    }
    throw new Error(`unknown cockpit argument: ${arg}`);
  }
  if (stop && (port !== undefined || replace)) {
    throw new Error("cockpit stop does not take --port or --replace");
  }
  return { stop, port, replace };
}

export async function ensureProjectInitialized(
  projectPath: string,
): Promise<void> {
  try {
    await access(resolve(projectPath, ".ohno", "state.json"));
  } catch {
    throw new Error(
      "no .ohno/state.json — run ohno init in this project first",
    );
  }
}
