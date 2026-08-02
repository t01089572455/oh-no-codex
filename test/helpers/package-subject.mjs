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
 * Public projections that document measured trial numbers. Including them in
 * the *sample-binding* digest creates a remeasure loop (write p95 → digest
 * changes → samples look rebound). Full package subject still hashes them.
 */
const SAMPLE_BINDING_EXCLUDES = new Set([
  "README.md",
  "README.zh-CN.md",
]);

async function collectPackedFiles(repositoryRoot, { excludeReadmes }) {
  const packageJsonPath = resolve(repositoryRoot, "package.json");
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
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

  if (!excludeReadmes) {
    return { packageJson, packageJsonPath, sorted };
  }
  return {
    packageJson,
    packageJsonPath,
    sorted: sorted.filter((absolute) => {
      const relativePath = toPosix(repositoryRoot, absolute);
      return !SAMPLE_BINDING_EXCLUDES.has(relativePath);
    }),
  };
}

async function hashPacked(
  repositoryRoot,
  formatLabel,
  { excludeReadmes },
) {
  const { packageJson, sorted } = await collectPackedFiles(repositoryRoot, {
    excludeReadmes,
  });
  const hash = createHash("sha256");
  addFramed(hash, "format", formatLabel);
  addFramed(hash, "name", String(packageJson.name ?? ""));
  addFramed(hash, "version", String(packageJson.version ?? ""));
  addFramed(hash, "bin", JSON.stringify(packageJson.bin ?? null));
  addFramed(hash, "type", String(packageJson.type ?? ""));
  addFramed(hash, "files", JSON.stringify(packageJson.files ?? []));
  if (excludeReadmes) {
    addFramed(hash, "exclude", JSON.stringify([...SAMPLE_BINDING_EXCLUDES]));
  }

  for (const absolute of sorted) {
    const relativePath = toPosix(repositoryRoot, absolute);
    addFramed(hash, "path", relativePath);
    addFramed(hash, "file", await readFile(absolute));
  }

  return hash.digest("hex");
}

/**
 * Full packed package subject (includes README). Use for ship/tarball truth
 * after public surfaces have been filled.
 */
export async function computePackageSubjectSha256(repositoryRoot) {
  return hashPacked(repositoryRoot, "ohno-package-subject-v1", {
    excludeReadmes: false,
  });
}

/**
 * Runtime sample-binding subject: packed package minus README projections.
 * Trial samples bind to this so post-measure p95 documentation in README
 * does not force sample rebinding.
 */
export async function computeRuntimeSubjectSha256(repositoryRoot) {
  return hashPacked(repositoryRoot, "ohno-runtime-subject-v1", {
    excludeReadmes: true,
  });
}
