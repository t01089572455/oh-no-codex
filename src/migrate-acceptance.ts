import { createHash } from "node:crypto";
import {
  access,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";

import {
  assertFrozenTasksMatchBasis,
  loadStructuredAcceptanceBasis,
} from "./acceptance-basis.js";
import { assertSafeProjectRelativePath } from "./paths.js";
import { readGitHead } from "./subject-digest.js";
import {
  compareAndSwapStateAtomic,
  needsAcceptanceBasisMigration,
  planRevisionFor,
  readState,
  truthInventoryDigestFor,
} from "./state.js";
import type {
  ProjectState,
  TruthClassificationEntry,
  TruthInventory,
} from "./state.js";
import type { TruthDocument } from "./truth.js";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function ensureTruthListsBasis(
  projectPath: string,
  basisPath: string,
): Promise<void> {
  const truthPath = resolve(projectPath, ".ohno", "truth.json");
  let truth: TruthDocument;
  try {
    truth = JSON.parse(await readFile(truthPath, "utf8")) as TruthDocument;
  } catch {
    await mkdir(resolve(projectPath, ".ohno"), { recursive: true });
    truth = { schema_version: 1, targets: [] };
  }
  if (truth.schema_version !== 1 || !Array.isArray(truth.targets)) {
    throw new Error("invalid Truth document; cannot register acceptance basis");
  }
  if (!truth.targets.some((t) => t.path === basisPath)) {
    truth.targets.push({
      path: basisPath,
      concerns: ["acceptance-basis", "black-box"],
    });
    await writeFile(truthPath, `${JSON.stringify(truth, null, 2)}\n`, "utf8");
  }
}

function inventoryWithBasisTarget(
  previous: TruthInventory,
  basisPath: string,
): TruthInventory {
  const entry: TruthClassificationEntry = {
    path: basisPath,
    classification: "TRUTH_TARGET",
    governing: true,
    truth_target: true,
  };
  const classification: TruthClassificationEntry[] = [
    ...previous.classification.filter((item) => item.path !== basisPath),
    entry,
  ].toSorted((left, right) => (
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0
  ));
  return {
    inventory_digest: truthInventoryDigestFor(classification),
    classification,
  };
}

/**
 * Build an exact migrate diff so plan_review evidence is real for the new
 * revision (not a recycled pre-basis digest/HEAD).
 */
function migrateExactDiff(
  state: ProjectState,
  nextRevision: string,
  basisPath: string,
  basisDigest: string,
): string {
  return `${JSON.stringify({
    format: "ohno-acceptance-basis-migrate-v1",
    before: {
      schema_version: state.schema_version,
      plan_revision: state.plan_revision,
      ordered_tasks: state.ordered_tasks,
      cursor: state.cursor,
      acceptance_basis: null,
    },
    after: {
      schema_version: 3,
      plan_revision: nextRevision,
      ordered_tasks: state.ordered_tasks,
      cursor: state.cursor,
      acceptance_basis: {
        path: basisPath,
        digest: basisDigest,
      },
    },
  }, null, 2)}\n`;
}

/**
 * Explicit migration from schema 2 → 3.
 * - Works with empty Truth (registers basis into truth.json + inventory).
 * - Records a fresh exact migrate diff + current HEAD as review evidence.
 * - Preserves goal, ordered_tasks, cursor, completed.
 * - Clears active_task / last_verification / pending_plan.
 */
export async function migrateAcceptanceBasis(
  projectPath: string,
  acceptanceSourcePath: string,
): Promise<string> {
  const state = await readState(projectPath);
  if (!needsAcceptanceBasisMigration(state)) {
    throw new Error(
      "acceptance basis migration is not required "
        + `(schema_version=${state.schema_version})`,
    );
  }

  const basisPath = assertSafeProjectRelativePath(
    acceptanceSourcePath,
    "acceptance_source",
  );

  if (state.plan_revision === null || state.ordered_tasks.length === 0) {
    await ensureTruthListsBasis(projectPath, basisPath);
    // Basis file may not exist yet for empty plans; only require path safety.
    try {
      await access(resolve(projectPath, ...basisPath.split("/")));
    } catch {
      // create empty structured template
      await mkdir(resolve(projectPath, ".ohno"), { recursive: true });
      await writeFile(
        resolve(projectPath, ...basisPath.split("/")),
        `${JSON.stringify({ schema_version: 1, tasks: [] }, null, 2)}\n`,
        "utf8",
      );
    }
    const bumped: ProjectState = {
      ...state,
      schema_version: 3,
      pending_plan: null,
      active_task: null,
      truth_inventory: inventoryWithBasisTarget(state.truth_inventory, basisPath),
    };
    if (!await compareAndSwapStateAtomic(projectPath, state, bumped)) {
      throw new Error("state changed during schema bump");
    }
    return "MIGRATED: schema_version=3 (no plan to re-bind)\n";
  }

  // Ensure basis is registered even when old inventory had zero Truth targets.
  await ensureTruthListsBasis(projectPath, basisPath);
  const loaded = await loadStructuredAcceptanceBasis(projectPath, basisPath);
  assertFrozenTasksMatchBasis(state.ordered_tasks, loaded.document);

  const planRevision = planRevisionFor(state.ordered_tasks, {
    path: loaded.path,
    digest: loaded.digest,
  });
  const exactDiff = migrateExactDiff(
    state,
    planRevision,
    loaded.path,
    loaded.digest,
  );
  const diffDigest = sha256(exactDiff);
  const now = new Date().toISOString();
  const head = readGitHead(projectPath);

  const next: ProjectState = {
    ...state,
    schema_version: 3,
    plan_revision: planRevision,
    pending_plan: null,
    active_task: null,
    last_verification: null,
    truth_inventory: inventoryWithBasisTarget(state.truth_inventory, loaded.path),
    status: state.document_sync.status === "PENDING_REVIEW"
      ? "BLOCKED_DOC_SYNC"
      : "IDLE",
    plan_review: {
      status: "LOCAL_REVIEW_RECORDED",
      plan_revision: planRevision,
      diff_digest: diffDigest,
      head,
      proposed_at: now,
      recorded_at: now,
      acceptance_source_path: loaded.path,
      acceptance_source_digest: loaded.digest,
    },
  };

  if (!await compareAndSwapStateAtomic(projectPath, state, next)) {
    throw new Error("state changed during acceptance basis migration");
  }

  return [
    "MIGRATED: schema_version=3",
    `ACCEPTANCE_SOURCE: ${loaded.path}`,
    `ACCEPTANCE_DIGEST: ${loaded.digest}`,
    `PLAN_REVISION: ${planRevision}`,
    `DIFF_DIGEST: ${diffDigest}`,
    `HEAD: ${head}`,
    `CURSOR: ${next.cursor}`,
    `COMPLETED: ${next.completed.length}`,
    "REVIEW: LOCAL_REVIEW_RECORDED for migrate exact diff "
      + "(not recycled pre-basis evidence)",
    "NOTE: active_task and last_verification cleared; re-run task start/verify",
    "",
    "EXACT_MIGRATE_DIFF:",
    exactDiff,
  ].join("\n");
}
