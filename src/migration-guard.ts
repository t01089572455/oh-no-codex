import {
  needsAcceptanceBasisMigration,
  type ProjectState,
} from "./state.js";

export const migrateRequiredMessage =
  "MIGRATE_ACCEPTANCE_BASIS required: run "
  + "`ohno migrate acceptance-basis --file <structured-basis.json>` "
  + "for a zero-write preview, then apply with the returned "
  + "`--diff <sha256> --head <git-head>` before verify, task start, plan write, "
  + "commit hooks, or scoped mutation (cursor/completed are preserved)";

/** Shared hard stop while schema 2 still needs structured-basis migration. */
export function assertMigrationNotRequired(state: ProjectState): void {
  if (needsAcceptanceBasisMigration(state)) {
    throw new Error(migrateRequiredMessage);
  }
}
