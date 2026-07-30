import {
  spawn,
  spawnSync,
} from "node:child_process";

export interface ExactCommandResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  interrupted: boolean;
  launchError: boolean;
}

function testOnlyMilliseconds(name: string): number | undefined {
  if (process.env.NODE_ENV !== "test") {
    return undefined;
  }

  const rawValue = process.env[name];
  if (rawValue === undefined) {
    return undefined;
  }

  const value = Number(rawValue);
  return Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

function terminateProcessTree(
  child: ReturnType<typeof spawn>,
): void {
  if (child.pid === undefined) {
    return;
  }

  if (process.platform === "win32") {
    spawnSync(
      "taskkill",
      ["/pid", String(child.pid), "/T", "/F"],
      {
        stdio: "ignore",
        windowsHide: true,
      },
    );
    return;
  }

  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

export function runExactCommand(
  projectPath: string,
  command: string,
  timeBudgetMinutes: number,
): Promise<ExactCommandResult> {
  const timeoutMilliseconds = testOnlyMilliseconds("OHNO_TEST_TIMEOUT_MS")
    ?? timeBudgetMinutes * 60_000;
  const interruptMilliseconds = testOnlyMilliseconds(
    "OHNO_TEST_INTERRUPT_MS",
  );

  return new Promise((resolve) => {
    const child = spawn(command, {
      cwd: projectPath,
      detached: process.platform !== "win32",
      shell: true,
      stdio: "ignore",
      windowsHide: true,
    });
    let timedOut = false;
    let interrupted = false;
    let launchError = false;
    let settled = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      terminateProcessTree(child);
    }, timeoutMilliseconds);
    timeout.unref();

    const interrupt = interruptMilliseconds === undefined
      ? undefined
      : setTimeout(() => {
        interrupted = true;
        terminateProcessTree(child);
      }, interruptMilliseconds);
    interrupt?.unref();

    const finish = (
      exitCode: number | null,
      signal: NodeJS.Signals | null,
    ): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      if (interrupt !== undefined) {
        clearTimeout(interrupt);
      }
      resolve({
        exitCode,
        signal,
        timedOut,
        interrupted,
        launchError,
      });
    };

    child.once("error", () => {
      launchError = true;
      finish(null, null);
    });
    child.once("exit", finish);
  });
}
