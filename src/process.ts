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

const terminationGraceMilliseconds = 250;

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

function terminateWindowsProcessTree(
  child: ReturnType<typeof spawn>,
): void {
  if (child.pid === undefined) {
    return;
  }

  const result = spawnSync(
    "taskkill",
    ["/pid", String(child.pid), "/T", "/F"],
    {
      stdio: "ignore",
      timeout: 1_000,
      windowsHide: true,
    },
  );
  if (result.error !== undefined || result.status !== 0) {
    child.kill("SIGKILL");
  }
}

function signalPosixProcessGroup(
  child: ReturnType<typeof spawn>,
  signal: "SIGTERM" | "SIGKILL",
): void {
  if (child.pid === undefined) {
    return;
  }
  try {
    process.kill(-child.pid, signal);
  } catch {
    child.kill(signal);
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
    let terminationStarted = false;
    let escalationRequired = false;
    let observedExit:
      | {
        exitCode: number | null;
        signal: NodeJS.Signals | null;
      }
      | undefined;
    let terminationWatchdog: ReturnType<typeof setTimeout> | undefined;

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
      if (terminationWatchdog !== undefined) {
        clearTimeout(terminationWatchdog);
      }
      resolve({
        exitCode,
        signal,
        timedOut,
        interrupted,
        launchError,
      });
    };

    const terminate = (): void => {
      if (terminationStarted) {
        return;
      }
      terminationStarted = true;

      if (process.platform === "win32") {
        terminateWindowsProcessTree(child);
        terminationWatchdog = setTimeout(() => {
          child.kill("SIGKILL");
          finish(
            observedExit?.exitCode ?? null,
            observedExit?.signal ?? "SIGKILL",
          );
        }, terminationGraceMilliseconds);
        return;
      }

      escalationRequired = true;
      signalPosixProcessGroup(child, "SIGTERM");
      terminationWatchdog = setTimeout(() => {
        signalPosixProcessGroup(child, "SIGKILL");
        escalationRequired = false;
        finish(
          observedExit?.exitCode ?? null,
          observedExit?.signal ?? "SIGKILL",
        );
      }, terminationGraceMilliseconds);
    };

    const timeout = setTimeout(() => {
      timedOut = true;
      terminate();
    }, timeoutMilliseconds);
    timeout.unref();

    const interrupt = interruptMilliseconds === undefined
      ? undefined
      : setTimeout(() => {
        interrupted = true;
        terminate();
      }, interruptMilliseconds);
    interrupt?.unref();

    child.once("error", () => {
      launchError = true;
      finish(null, null);
    });
    child.once("exit", (exitCode, signal) => {
      observedExit = {
        exitCode,
        signal,
      };
      if (!escalationRequired) {
        finish(exitCode, signal);
      }
    });
  });
}
