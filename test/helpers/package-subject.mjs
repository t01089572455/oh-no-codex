import { createHash } from "node:crypto";
import {
  readdir,
  readFile,
  stat,
} from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";

function addFramed(hash, label, value) {
  const bytes = typeof value === "string" ? Buffer.from(value) : value;
  hash.update(`${label}:${bytes.length}:`);
  hash.update(bytes);
  hash.update("\0");
}

async function walkFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.toSorted((left, right) =>
    left.name < right.name ? -1 : left.name > right.name ? 1 : 0
  )) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkFiles(absolute));
    } else if (entry.isFile()) {
      files.push(absolute);
    }
  }
  return files;
}

function toPosix(repositoryRoot, absolutePath) {
  return relative(repositoryRoot, absolutePath).split(sep).join("/");
}

/**
 * Deterministic hash of the package runtime subject that ships to consumers:
 * package.json identity fields plus every packed path listed in `files`.
 */
export async function computePackageSubjectSha256(repositoryRoot) {
  const packageJsonPath = resolve(repositoryRoot, "package.json");
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
  const hash = createHash("sha256");
  addFramed(hash, "format", "ohno-package-subject-v1");
  addFramed(hash, "name", String(packageJson.name ?? ""));
  addFramed(hash, "version", String(packageJson.version ?? ""));
  addFramed(hash, "bin", JSON.stringify(packageJson.bin ?? null));
  addFramed(hash, "type", String(packageJson.type ?? ""));
  addFramed(hash, "files", JSON.stringify(packageJson.files ?? []));

  const packedRoots = Array.isArray(packageJson.files)
    ? packageJson.files
    : [];
  const absoluteFiles = new Set();
  for (const entry of packedRoots) {
    const absolute = resolve(repositoryRoot, entry);
    let entryStat;
    try {
      entryStat = await stat(absolute);
    } catch {
      continue;
    }
    if (entryStat.isDirectory()) {
      for (const file of await walkFiles(absolute)) {
        absoluteFiles.add(file);
      }
    } else if (entryStat.isFile()) {
      absoluteFiles.add(absolute);
    }
  }
  absoluteFiles.add(packageJsonPath);
  absoluteFiles.add(resolve(repositoryRoot, "LICENSE"));

  const sorted = [...absoluteFiles].toSorted((left, right) => {
    const leftPath = toPosix(repositoryRoot, left);
    const rightPath = toPosix(repositoryRoot, right);
    return leftPath < rightPath ? -1 : leftPath > rightPath ? 1 : 0;
  });

  for (const absolute of sorted) {
    const relativePath = toPosix(repositoryRoot, absolute);
    addFramed(hash, "path", relativePath);
    addFramed(hash, "file", await readFile(absolute));
  }

  return hash.digest("hex");
}
