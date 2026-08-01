import {
  needsAcceptanceBasisMigration,
  type ProjectState,
} from "./state.js";

export const migrateRequiredMessage =
  "MIGRATE_ACCEPTANCE_BASIS required: run "
  + "`ohno migrate acceptance-basis --file <structured-basis.json>` "
  + "before verify, task start, plan write, commit hooks, or scoped mutation "
  + "(cursor/completed are preserved by migrate)";

/** Shared hard stop while schema 2 still needs structured-basis migration. */
export function assertMigrationNotRequired(state: ProjectState): void {
  if (needsAcceptanceBasisMigration(state)) {
    throw new Error(migrateRequiredMessage);
  }
}
