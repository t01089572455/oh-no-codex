/**
 * Field-trial discipline (FT-02/05/11/14/15).
 * Soft warnings for propose; hard gate on accept unless --allow-weak-plan.
 */

export function looksLikeTrivialBlackbox(testCommand: string): boolean {
  const cmd = testCommand.trim();
  if (cmd.length < 8) {
    return true;
  }
  if (/process\.exit\(0\)|exit\s+0\b|true\s*;?\s*$/iu.test(cmd)) {
    return true;
  }
  // Entire command is only git format/ignore probes (FT-02).
  if (/^git\s+diff\b/iu.test(cmd) && /--check\b/u.test(cmd)) {
    // Allow if also runs a real test runner in the same command.
    if (!/\b(npm|node|pnpm|yarn|pytest|cargo|go\s+test|vitest|jest)\b/iu.test(cmd)) {
      return true;
    }
  }
  if (/^git\s+check-ignore\b/iu.test(cmd) && !/\b(npm|node|pnpm|yarn)\b/iu.test(cmd)) {
    return true;
  }
  if (/^(cmd\.exe\s+\/c\s+)?(echo|rem|::)\b/iu.test(cmd)) {
    return true;
  }
  if (/^npm\s+(?:run\s+)?(?:noop|true)\b/iu.test(cmd)) {
    return true;
  }
  return false;
}

export function looksLikeDocsOrMetaOnlyTask(task: {
  id: string;
  title: string;
  goal: string;
  expected_behavior?: string;
  allowed_files?: string[];
  test_command?: string;
}): boolean {
  const blob = [
    task.id,
    task.title,
    task.goal,
    task.expected_behavior ?? "",
  ].join("\n").toLowerCase();
  const metaWords =
    /\b(commit|gitignore|worktree|scaffold doc|design doc|implementation plan|docs?\/|readme|submit|check-in|isolated worktree|prepare.?isolat)\b/u;
  if (!metaWords.test(blob)) {
    return false;
  }
  const files = task.allowed_files ?? [];
  if (files.length === 0) {
    return true;
  }
  const productCode = files.some((f) =>
    /\.(js|ts|tsx|jsx|py|go|rs|java|kt|swift|cs|cpp|c|h|wxml|wxss)\b/iu.test(f)
    || /(^|\/)(src|lib|app|miniprogram|server|cmd|pkg|cloudfunctions|test)\//iu.test(f)
  );
  if (productCode) {
    return false;
  }
  return files.every((f) =>
    /\.(md|txt|gitignore)$/iu.test(f)
    || f === ".gitignore"
    || f.startsWith("docs/")
    || f.startsWith(".ohno/")
  );
}

export function planLooksLikeCommitLicense(tasks: Array<{
  id: string;
  title: string;
  goal: string;
  status: string;
  expected_behavior?: string;
  allowed_files?: string[];
  test_command?: string;
}>): boolean {
  if (tasks.length === 0) {
    return false;
  }
  if (tasks.length === 1) {
    const only = tasks[0]!;
    if (only.status === "FROZEN" || only.status === "OUTLINE") {
      if (looksLikeDocsOrMetaOnlyTask(only)) {
        return true;
      }
      if (
        only.test_command !== undefined
        && looksLikeTrivialBlackbox(only.test_command)
      ) {
        return true;
      }
    }
  }
  const frozen = tasks.filter((t) => t.status === "FROZEN");
  if (frozen.length > 0 && frozen.every((t) => looksLikeDocsOrMetaOnlyTask(t))) {
    return true;
  }
  return false;
}

export function weakBlackboxSummary(testCommand: string): string | null {
  if (!looksLikeTrivialBlackbox(testCommand)) {
    return null;
  }
  if (/git\s+diff/iu.test(testCommand) && /--check/u.test(testCommand)) {
    return "test_command is git diff --check (format only; not product behavior)";
  }
  if (/git\s+check-ignore/iu.test(testCommand)) {
    return "test_command is only git check-ignore (not product behavior)";
  }
  if (testCommand.trim().length < 8) {
    return "test_command is too short to be a meaningful black box";
  }
  return "test_command looks trivial (always-pass / non-behavioral)";
}

/**
 * Heavy acceptance-path signals. When present in freeze contract or external
 * acceptance basis but absent from frozen test_command, that is denominator
 * shrink (#7/#9). Hard-gated on plan propose/accept (not overridable by
 * --allow-weak-plan).
 */
const heavyPathSignals: Array<{ re: RegExp; label: string }> = [
  { re: /微信开发者工具/u, label: "WeChat DevTools" },
  { re: /devtools/iu, label: "devtools" },
  { re: /\be2e\b/iu, label: "e2e" },
  { re: /playwright|cypress|puppeteer/iu, label: "browser automation" },
  { re: /manual\s+(qa|test|验收|smoke)/iu, label: "manual QA/smoke" },
  { re: /multi[- ]?user|多用户/iu, label: "multi-user path" },
  { re: /真实(设备|环境|路径)|real[- ]world/iu, label: "real-world path" },
];

/**
 * Detect heavier acceptance language in freeze contract prose and/or an
 * optional external acceptance source (detailed plan) that is not covered by
 * the frozen test_command. Contract-only hits are "internal contradiction";
 * external-only hits are true acceptance-source denominator shrink (Task2).
 */
export function denominatorShrinkSummary(
  task: {
    id?: string;
    expected_behavior?: string;
    stop_condition?: string;
    test_command?: string;
  },
  externalAcceptanceProse = "",
): string | null {
  const test = task.test_command ?? "";
  if (test.trim() === "") {
    return null;
  }
  const contractProse =
    `${task.expected_behavior ?? ""}\n${task.stop_condition ?? ""}`;
  const external = externalAcceptanceProse;
  const contractHits: string[] = [];
  const externalHits: string[] = [];
  for (const signal of heavyPathSignals) {
    if (signal.re.test(test)) {
      continue;
    }
    if (signal.re.test(contractProse)) {
      contractHits.push(signal.label);
    } else if (external !== "" && signal.re.test(external)) {
      externalHits.push(signal.label);
    }
  }
  if (contractHits.length === 0 && externalHits.length === 0) {
    return null;
  }
  const who = task.id !== undefined ? `task ${task.id}: ` : "";
  if (externalHits.length > 0) {
    return (
      `${who}acceptance source mentions ${externalHits.join(", ")} but frozen `
      + "test_command does not — acceptance-denominator shrink vs governing "
      + "plan (#7/#9). Bind the heavier path into test_command / stop, or "
      + "narrow the external plan claim for this slice."
    );
  }
  return (
    `${who}stop/expected mentions ${contractHits.join(", ")} but frozen `
    + "test_command does not — freeze-contract internal contradiction "
    + "(#7/#9). Align test_command with the claimed path, or reword stop/"
    + "expected so the frozen black box is the full claim."
  );
}

export interface PlanDisciplineViolation {
  code: "WEAK_BLACKBOX" | "COMMIT_LICENSE_MICRO_PLAN";
  message: string;
}

/** Hard-gate violations for plan accept (unless Owner passes --allow-weak-plan). */
export function planDisciplineViolations(tasks: Array<{
  id: string;
  title: string;
  goal: string;
  status: string;
  expected_behavior?: string;
  allowed_files?: string[];
  test_command?: string;
}>): PlanDisciplineViolation[] {
  const out: PlanDisciplineViolation[] = [];
  if (planLooksLikeCommitLicense(tasks)) {
    out.push({
      code: "COMMIT_LICENSE_MICRO_PLAN",
      message:
        "plan looks like a commit-license / docs-only micro-plan (FT-05/14). "
        + "Refuse single-task design/gitignore/worktree-only plans when building "
        + "a product. Split into multi-slice tasks with behavioral tests, or pass "
        + "--allow-weak-plan if the Owner explicitly accepts a meta-only plan.",
    });
  }
  for (const task of tasks) {
    if (task.status !== "FROZEN" || task.test_command === undefined) {
      continue;
    }
    const weak = weakBlackboxSummary(task.test_command);
    if (weak !== null) {
      out.push({
        code: "WEAK_BLACKBOX",
        message: `task ${task.id}: ${weak} (FT-02). `
          + "Use a user-visible black box (e.g. npm test / app smoke). "
          + "Or pass --allow-weak-plan if the Owner explicitly accepts this test.",
      });
    }
  }
  return out;
}

/** Soft warnings for propose (never hard-gate alone; denominator is hard). */
export function planSoftWarnings(
  tasks: Array<{
    id: string;
    title: string;
    goal: string;
    status: string;
    expected_behavior?: string;
    stop_condition?: string;
    allowed_files?: string[];
    test_command?: string;
  }>,
  options: {
    externalAcceptanceProse?: string;
    skipDenominator?: boolean;
  } = {},
): string[] {
  const warnings: string[] = [];
  if (planLooksLikeCommitLicense(tasks)) {
    warnings.push(
      "WARN: plan looks like a commit-license / docs-only micro-plan "
        + "(FT-05/14). Accepting will make cockpit show this plan as complete "
        + "at 100% of plan tasks — not product done.",
    );
  }
  const external = options.externalAcceptanceProse ?? "";
  for (const task of tasks) {
    if (task.status !== "FROZEN") {
      continue;
    }
    const weak = weakBlackboxSummary(task.test_command ?? "");
    if (weak !== null) {
      warnings.push(`WARN: task ${task.id}: ${weak}`);
    }
    if (options.skipDenominator !== true) {
      const shrink = denominatorShrinkSummary(task, external);
      if (shrink !== null) {
        warnings.push(`WARN: ${shrink}`);
      }
    }
  }
  return warnings;
}

/**
 * Hard gate: frozen tasks must not shrink the acceptance denominator relative
 * to freeze-contract prose or the external acceptance basis. Not overridable
 * by --allow-weak-plan.
 */
export function assertAcceptanceDenominator(
  tasks: Array<{
    id?: string;
    status?: string;
    expected_behavior?: string;
    stop_condition?: string;
    test_command?: string;
  }>,
  externalAcceptanceProse: string,
): void {
  for (const task of tasks) {
    if (task.status !== undefined && task.status !== "FROZEN") {
      continue;
    }
    const shrink = denominatorShrinkSummary(task, externalAcceptanceProse);
    if (shrink !== null) {
      throw new Error(`ACCEPTANCE_DENOMINATOR_SHRINK: ${shrink}`);
    }
  }
}

export function assertPlanDiscipline(
  tasks: Array<{
    id: string;
    title: string;
    goal: string;
    status: string;
    expected_behavior?: string;
    allowed_files?: string[];
    test_command?: string;
  }>,
  options: { allowWeakPlan: boolean },
): void {
  if (options.allowWeakPlan) {
    return;
  }
  const violations = planDisciplineViolations(tasks);
  if (violations.length === 0) {
    return;
  }
  throw new Error(
    "plan discipline refused accept:\n"
      + violations.map((v) => `- ${v.code}: ${v.message}`).join("\n")
      + "\nOverride only with Owner intent: ohno plan accept … --allow-weak-plan",
  );
}
