/**
 * Exclusive-lock helpers: create lock with pid in one atomic write so peers
 * never observe an empty lock and reclaim a live owner.
 */
import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

export function processLooksAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** Atomic create of a lock file containing `${pid}\\n` (O_EXCL). */
export async function tryCreatePidLockFile(lockPath: string): Promise<boolean> {
  await mkdir(dirname(lockPath), { recursive: true });
  try {
    await writeFile(lockPath, `${process.pid}\n`, { flag: "wx", mode: 0o600 });
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      return false;
    }
    throw error;
  }
}

export async function readLockPid(lockPath: string): Promise<number | null> {
  try {
    const body = await readFile(lockPath, "utf8");
    const pid = Number.parseInt(body.trim().split(/\s+/u)[0] ?? "", 10);
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

/**
 * True only when we can prove the lock owner is dead, or the lock has been
 * empty/unreadable longer than emptyStaleMs (crash mid-create).
 */
export async function isPidLockStale(
  lockPath: string,
  emptyStaleMs = 5_000,
): Promise<boolean> {
  const pid = await readLockPid(lockPath);
  if (pid !== null) {
    return !processLooksAlive(pid);
  }
  try {
    const info = await stat(lockPath);
    return Date.now() - info.mtimeMs >= emptyStaleMs;
  } catch {
    return true;
  }
}

export async function removePathForce(path: string): Promise<void> {
  await rm(path, { force: true, recursive: true }).catch(() => undefined);
}

/**
 * Directory lock: mkdir exclusive + owner file with pid+token.
 * Release only removes the directory when the same token still owns it.
 * Stale reclaim renames the dead dir away (does not rm a path a peer may have
 * just recreated).
 */
export async function withDirectoryLock<T>(
  lockDir: string,
  work: () => Promise<T>,
  options: { deadlineMs?: number; emptyStaleMs?: number } = {},
): Promise<T> {
  const deadlineMs = options.deadlineMs ?? 30_000;
  const emptyStaleMs = options.emptyStaleMs ?? 5_000;
  const ownerPath = resolve(lockDir, "owner");
  const deadline = Date.now() + deadlineMs;
  const token = randomUUID();
  let held = false;
  while (!held) {
    try {
      await mkdir(lockDir);
      await writeFile(ownerPath, `${process.pid}\n${token}\n`, "utf8");
      held = true;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      // Windows can return EPERM while a peer is renaming/removing the dir.
      if (code === "EPERM" || code === "EACCES" || code === "EBUSY") {
        if (Date.now() >= deadline) {
          throw new Error(`cannot acquire lock ${lockDir}`);
        }
        await delay(30 + Math.floor(Math.random() * 50));
        continue;
      }
      if (code !== "EEXIST") {
        throw error;
      }
      let stale = false;
      try {
        const body = await readFile(ownerPath, "utf8");
        const pid = Number.parseInt(body.trim().split(/\s+/u)[0] ?? "", 10);
        if (Number.isInteger(pid) && pid > 0) {
          stale = !processLooksAlive(pid);
        } else {
          const info = await stat(lockDir);
          stale = Date.now() - info.mtimeMs >= emptyStaleMs;
        }
      } catch {
        try {
          const info = await stat(lockDir);
          stale = Date.now() - info.mtimeMs >= emptyStaleMs;
        } catch {
          stale = true;
        }
      }
      if (stale) {
        // Move dead lock aside instead of rm'ing a path a new owner may hold.
        const grave = `${lockDir}.${randomUUID()}.stale`;
        try {
          await rename(lockDir, grave);
          await removePathForce(grave);
        } catch {
          // Peer already reclaimed or recreated — retry acquire.
        }
        continue;
      }
      if (Date.now() >= deadline) {
        throw new Error(`cannot acquire lock ${lockDir}`);
      }
      await delay(30 + Math.floor(Math.random() * 50));
    }
  }
  try {
    return await work();
  } finally {
    try {
      const body = await readFile(ownerPath, "utf8");
      if (body.includes(token)) {
        await removePathForce(lockDir);
      }
    } catch {
      // Lock already gone or reassigned — do not force-delete peers.
    }
  }
}
