const elements = {
  main: document.querySelector("#current-state"),
  goal: document.querySelector("#goal-value"),
  refresh: document.querySelector("#refresh-button"),
  unavailable: document.querySelector("#unavailable-gate"),
  unavailableEyebrow: document.querySelector("#unavailable-eyebrow"),
  unavailableTitle: document.querySelector("#unavailable-title"),
  unavailableBody: document.querySelector("#unavailable-body"),
  rail: document.querySelector("#calibration-rail"),
  railSummary: document.querySelector("#rail-summary"),
  planRevision: document.querySelector("#plan-revision"),
  nowHeading: document.querySelector("#now-heading"),
  status: document.querySelector("#status-value"),
  behavior: document.querySelector("#behavior-value"),
  testWell: document.querySelector("#test-well"),
  test: document.querySelector("#test-value"),
  proof: document.querySelector("#proof-value"),
  blocker: document.querySelector("#blocker-value"),
  blockerBadge: document.querySelector("#blocker-badge"),
  next: document.querySelector("#next-value"),
  completedCount: document.querySelector("#completed-count"),
  taskCountDisp: document.querySelector("#task-count-disp"),
  recent: document.querySelector("#recent-list"),
  announcer: document.querySelector("#state-announcer"),
  stageTitle: document.querySelector("#stage-title"),
  progressLabel: document.querySelector("#progress-label"),
  progressFill: document.querySelector("#progress-fill"),
  progressAria: document.querySelector("#progress-aria"),
  missionLabel: document.querySelector("#mission-center-label"),
  missionSub: document.querySelector("#mission-center-sub"),
  ringNodes: document.querySelector("#ring-nodes"),
  ringArc: document.querySelector("#ring-arc"),
  vectorProgress: document.querySelector("#vector-progress"),
  attentionCard: document.querySelector("#attention-card"),
  cursorDisp: document.querySelector("#cursor-disp"),
  tasksDisp: document.querySelector("#tasks-disp"),
  doneDisp: document.querySelector("#done-disp"),
  proofMeter: document.querySelectorAll(".meter-seg"),
  guardOk: document.querySelector(".guardrail-segment.ok"),
  guardWarn: document.querySelector(".guardrail-segment.warn"),
  guardFail: document.querySelector(".guardrail-segment.fail"),
  vectorStops: document.querySelectorAll(".vector-stop"),
  planBoard: document.querySelector("#plan-board-list"),
  boardMeta: document.querySelector("#board-meta"),
  recentMeta: document.querySelector("#recent-meta"),
  truthTargetCount: document.querySelector("#truth-target-count"),
  truthTargetsList: document.querySelector("#truth-targets-list"),
  docSyncStatus: document.querySelector("#doc-sync-status"),
  handoffLine: document.querySelector("#handoff-line"),
};

const unavailableProjection = Object.freeze({
  schema_version: 2,
  availability: "UNAVAILABLE",
  goal: null,
  status: "UNAVAILABLE",
  plan_revision: null,
  cursor: 0,
  task_count: 0,
  completed_count: 0,
  completed: [],
  current_task: null,
  plan_board: [],
  proof_freshness: "UNAVAILABLE",
  blocker: "STATE_UNAVAILABLE",
  next_action: "NONE",
  truth_target_count: 0,
  truth_targets: [],
  document_sync_status: "UNAVAILABLE",
  handoff: {
    path: ".",
    branch: null,
    head: null,
    dirty: false,
  },
});

const RING_CIRCUMFERENCE = 2 * Math.PI * 148;

/** UI language only (presentation). Not a second authority store. */
const I18N = Object.freeze({
  en: Object.freeze({
    brandSub: "Fast, cooperative vibe-coding harness",
    localReadOnly: "Local · Read Only",
    currentStage: "CURRENT STAGE",
    planCursorNote: "PLAN CURSOR — not product completion",
    closed: "closed",
    refresh: "REFRESH",
    refreshReading: "READING",
    refreshAria: "Refresh local project state",
    language: "Language",
    missionActions: "Mission actions",
    missionPulse: "Mission pulse",
    instruments: "Instruments",
    now: "NOW",
    next: "NEXT",
    attention: "ATTENTION",
    drift: "DRIFT",
    exactTest: "EXACT TEST",
    waitingReadModel: "Waiting for the canonical read model.",
    blockerHint: "Blockers and drift signals from the harness appear here.",
    recent: "RECENT",
    completedStages: "Completed stages",
    noCompleted: "NO COMPLETED TASKS",
    mission: "MISSION",
    readOnly: "READ ONLY",
    pulse: "PULSE",
    waitingForPlan: "Waiting for plan",
    plan: "PLAN",
    calibrationRail: "CALIBRATION RAIL",
    readingLocalState: "READING LOCAL STATE",
    planBoard: "PLAN BOARD",
    planBoardSub: "Done / half / ready / outline — same state as resume",
    noReviewedPlan: "NO REVIEWED PLAN",
    truthTargets: "Truth targets:",
    docSync: "Doc sync:",
    noTruthTargets: "NO TRUTH TARGETS",
    proof: "PROOF",
    vectorSnapshot: "VECTOR SNAPSHOT",
    honestCounts: "Honest counts from the same read model",
    cursor: "Cursor",
    tasks: "Tasks",
    done: "Done",
    completionVector: "COMPLETION VECTOR",
    planProgressSub: "Plan progress from partial to complete",
    partial: "PARTIAL",
    review: "REVIEW",
    ready: "READY",
    footerCopy:
      "Cooperative local guardrail. This view cannot authorize work or stop a same-user process.",
    stateUnavailableTitle: "LOCAL STATE UNAVAILABLE",
    stateUnavailableBody:
      "The local state is missing, corrupt, or unsupported. Repair .ohno/state.json, then refresh.",
    offlineTitle: "COCKPIT SERVER OFFLINE",
    offlineBody:
      "This browser tab cannot reach the local cockpit process. Run ohno cockpit and open the new URL.",
    noActiveTask: "NO ACTIVE TASK",
    noGoal: "NO GOAL AVAILABLE",
    planOnlyNotProduct: "THIS PLAN ONLY — not product complete",
    noActiveBehavior: "No active task is recorded in the canonical read model.",
    unavailableBehavior: "Canonical project state is unavailable.",
    planCompleteBehavior:
      "This linear plan cursor is complete. That is not product completion. Run ohno plan propose for the next phase.",
    tasksMeta: (n) => (n === 0 ? "0 tasks" : `${n} tasks · scroll`),
    doneMeta: (n) => (n === 0 ? "0 done" : `${n} done · scroll`),
    progressLabel: (c, t) =>
      t > 0
        ? `${c} of ${t} plan tasks`
        : "0 of 0 plan tasks (no reviewed plan)",
    progressTitle: "Plan cursor only (cursor/task_count). Never product completion %.",
    progressAria: (c, t) =>
      `Plan cursor ${c} of ${t} tasks (not product completion)`,
    noReviewedPlanShort: "NO REVIEWED PLAN",
    thisPlanComplete: "THIS PLAN COMPLETE",
    cursorOf: (c, t, status) => `CURSOR ${c} OF ${t} · ${status}`,
    handoffUnknown: "AUTHORITY CWD: UNKNOWN",
    handoffLine: (h) =>
      `AUTHORITY CWD: ${h.path} · ${h.branch ?? "NO-BRANCH"} · ${
        h.head ?? "NO-HEAD"
      }${h.dirty ? " · DIRTY" : ""}`,
    handoffTitle:
      "Cockpit reads only this path's .ohno/state.json. Other git worktrees may differ.",
    projectCompleteNext:
      "PROJECT_COMPLETE (this plan only — propose next phase)",
    continueActiveHint: (a) => `${a} (stay on this task — then ohno verify)`,
    runExactHint: (a) => `${a} (re-run frozen black box)`,
    offline: "OFFLINE",
    stateUnavailable: "State unavailable",
    hold: "HOLD",
    planDone: "PLAN DONE",
    planDoneSub:
      "This linear plan is complete — not product-finished. Propose next phase.",
    idle: "IDLE",
    readyLabel: "READY",
    blockedDocSync: "BLOCKED_DOC_SYNC",
    unavailable: "UNAVAILABLE",
    none: "NONE",
    announceAvailable: (proof, blocker, next) =>
      `Proof changed to ${proof}. Blocker is ${blocker}. Next is ${next}.`,
    announceUnavailable: "Local state became unavailable.",
    badgeBlocked: "BLOCKED",
    badgeDrift: "DRIFT",
    badgeClear: "CLEAR",
  }),
  zh: Object.freeze({
    brandSub: "快速、协作的 vibe coding 护栏",
    localReadOnly: "本地 · 只读",
    currentStage: "当前阶段",
    planCursorNote: "计划游标 — 不是产品完成度",
    closed: "已关闭",
    refresh: "刷新",
    refreshReading: "读取中",
    refreshAria: "刷新本地项目状态",
    language: "语言",
    missionActions: "任务动作",
    missionPulse: "任务脉冲",
    instruments: "仪表",
    now: "当前",
    next: "下一步",
    attention: "注意",
    drift: "漂移",
    exactTest: "精确测试",
    waitingReadModel: "正在等待规范读模型。",
    blockerHint: "护栏给出的阻塞与漂移信号显示在这里。",
    recent: "最近完成",
    completedStages: "已完成步骤",
    noCompleted: "暂无已完成任务",
    mission: "任务",
    readOnly: "只读",
    pulse: "脉冲",
    waitingForPlan: "等待计划",
    plan: "计划",
    calibrationRail: "校准轨",
    readingLocalState: "正在读取本地状态",
    planBoard: "计划板",
    planBoardSub: "完成 / 半程 / 就绪 / 大纲 — 与 resume 同源",
    noReviewedPlan: "尚无已审阅计划",
    truthTargets: "Truth 目标：",
    docSync: "文档同步：",
    noTruthTargets: "无 Truth 目标",
    proof: "证明",
    vectorSnapshot: "向量快照",
    honestCounts: "与读模型一致的诚实计数",
    cursor: "游标",
    tasks: "任务数",
    done: "已完成",
    completionVector: "完成向量",
    planProgressSub: "从部分完成到计划完成",
    partial: "部分",
    review: "审阅",
    ready: "就绪",
    footerCopy:
      "协作式本地护栏。本视图不能授权工作，也不能阻止同一用户进程。",
    stateUnavailableTitle: "本地状态不可用",
    stateUnavailableBody:
      "本地状态缺失、损坏或不支持。请修复 .ohno/state.json 后刷新。",
    offlineTitle: "驾驶舱服务离线",
    offlineBody:
      "浏览器无法连接本地驾驶舱进程。请运行 ohno cockpit 并打开终端打印的新 URL。",
    noActiveTask: "无活动任务",
    noGoal: "无可用目标",
    planOnlyNotProduct: "仅本计划完成 — 不是产品完成",
    noActiveBehavior: "规范读模型中没有活动任务。",
    unavailableBehavior: "规范项目状态不可用。",
    planCompleteBehavior:
      "本线性计划游标已完成。这不等于产品完成。请 ohno plan propose 下一阶段。",
    tasksMeta: (n) => (n === 0 ? "0 项" : `${n} 项 · 滚动`),
    doneMeta: (n) => (n === 0 ? "0 已完成" : `${n} 已完成 · 滚动`),
    progressLabel: (c, t) =>
      t > 0 ? `计划任务 ${c} / ${t}` : "计划任务 0 / 0（无已审阅计划）",
    progressTitle: "仅为计划游标（cursor/task_count），不是产品完成百分比。",
    progressAria: (c, t) => `计划游标 ${c} / ${t}（非产品完成）`,
    noReviewedPlanShort: "尚无已审阅计划",
    thisPlanComplete: "本计划完成",
    cursorOf: (c, t, status) => `游标 ${c} / ${t} · ${status}`,
    handoffUnknown: "权威目录：未知",
    handoffLine: (h) =>
      `权威目录：${h.path} · ${h.branch ?? "无分支"} · ${
        h.head ?? "无 HEAD"
      }${h.dirty ? " · 有未提交变更" : ""}`,
    handoffTitle:
      "驾驶舱只读取该路径下的 .ohno/state.json。其他 git worktree 可能不同。",
    projectCompleteNext: "PROJECT_COMPLETE（仅本计划 — 请提议下一阶段）",
    continueActiveHint: (a) => `${a}（留在本任务 — 然后 ohno verify）`,
    runExactHint: (a) => `${a}（重跑冻结黑盒）`,
    offline: "离线",
    stateUnavailable: "状态不可用",
    hold: "暂停",
    planDone: "计划完成",
    planDoneSub: "本线性计划已完成 — 不是产品完成。请提议下一阶段。",
    idle: "空闲",
    readyLabel: "就绪",
    blockedDocSync: "文档同步阻塞",
    unavailable: "不可用",
    none: "无",
    announceAvailable: (proof, blocker, next) =>
      `证明变为 ${proof}。阻塞为 ${blocker}。下一步为 ${next}。`,
    announceUnavailable: "本地状态变为不可用。",
    badgeBlocked: "已阻塞",
    badgeDrift: "漂移",
    badgeClear: "正常",
  }),
});

let uiLang = navigator.language?.toLowerCase().startsWith("zh") ? "zh" : "en";
let requestInFlight = false;
let refreshTimer;
let lastAnnouncedSignature;
let lastRenderedSignature = "";
let lastModelForUi = null;

function t(key, ...args) {
  const table = I18N[uiLang] ?? I18N.en;
  const value = table[key] ?? I18N.en[key] ?? key;
  return typeof value === "function" ? value(...args) : value;
}

function abbreviateRevision(revision) {
  if (!revision || revision === "NONE") {
    return t("none");
  }
  return revision.length > 12 ? `${revision.slice(0, 12)}…` : revision;
}

function applyStaticI18n() {
  document.documentElement.lang = uiLang === "zh" ? "zh-CN" : "en";
  for (const node of document.querySelectorAll("[data-i18n]")) {
    const key = node.getAttribute("data-i18n");
    if (!key) {
      continue;
    }
    // Dynamic fields are owned by render(); skip ids that render overwrites.
    if (
      node.id === "now-heading"
      || node.id === "behavior-value"
      || node.id === "mission-center-label"
      || node.id === "mission-center-sub"
      || node.id === "plan-revision"
      || node.id === "next-value"
      || node.id === "status-value"
      || node.id === "goal-value"
    ) {
      continue;
    }
    const text = t(key);
    if (node.tagName === "INPUT" || node.tagName === "TEXTAREA") {
      node.value = text;
    } else {
      node.textContent = text;
    }
  }
  for (const node of document.querySelectorAll("[data-i18n-aria]")) {
    const key = node.getAttribute("data-i18n-aria");
    if (key) {
      node.setAttribute("aria-label", t(key));
    }
  }
  const refresh = document.querySelector("#refresh-button");
  if (refresh && refresh.getAttribute("aria-disabled") !== "true") {
    refresh.textContent = t("refresh");
  }
  document.querySelector("#lang-en")?.classList.toggle("is-active", uiLang === "en");
  document.querySelector("#lang-zh")?.classList.toggle("is-active", uiLang === "zh");
}

function setUiLang(lang) {
  if (lang !== "en" && lang !== "zh") {
    return;
  }
  if (uiLang === lang) {
    return;
  }
  uiLang = lang;
  lastRenderedSignature = "";
  applyStaticI18n();
  if (lastModelForUi) {
    render(lastModelForUi, { offline: false });
  }
}

function stateTone(model) {
  if (
    model.availability !== "AVAILABLE"
    || model.proof_freshness === "UNKNOWN"
  ) {
    return "unknown";
  }
  if (
    model.proof_freshness === "FAIL"
    || model.proof_freshness === "STALE"
    || model.blocker === "DOCUMENT_SYNC_PENDING"
    || model.blocker === "EXACT_TEST_FAILED"
    || model.blocker === "STALE_PASS"
  ) {
    return "stop";
  }
  if (model.proof_freshness === "FRESH") {
    return "fresh";
  }
  if (
    model.status === "ACTIVE"
    || model.next_action.startsWith("START_TASK:")
    || model.next_action.startsWith("CONTINUE_ACTIVE:")
    || model.next_action.startsWith("RUN_EXACT_TEST:")
  ) {
    return "active";
  }
  return "neutral";
}

function stateSignature(model) {
  return JSON.stringify([
    model.availability,
    model.status,
    model.cursor,
    model.task_count,
    model.completed_count,
    model.current_task?.id ?? null,
    model.current_task?.expected_behavior ?? null,
    model.current_task?.test_command ?? null,
    model.proof_freshness,
    model.blocker,
    model.next_action,
    model.goal,
    model.plan_revision,
    model.document_sync_status,
    model.truth_target_count,
    model.plan_board,
    model.completed,
    model.truth_targets,
    model.handoff,
  ]);
}

function announceMeaningfulChange(model) {
  const signature = stateSignature(model);
  if (lastAnnouncedSignature === undefined) {
    lastAnnouncedSignature = signature;
    return;
  }
  if (signature === lastAnnouncedSignature) {
    return;
  }
  lastAnnouncedSignature = signature;
  elements.announcer.textContent = model.availability === "AVAILABLE"
    ? t(
      "announceAvailable",
      model.proof_freshness,
      model.blocker,
      model.next_action,
    )
    : t("announceUnavailable");
}

function progressRatio(model) {
  if (model.task_count <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, model.cursor / model.task_count));
}

function stageTitle(model) {
  if (model.availability !== "AVAILABLE") {
    return "UNAVAILABLE";
  }
  if (model.current_task?.id) {
    return model.current_task.id;
  }
  if (model.next_action && model.next_action !== "NONE") {
    return model.next_action;
  }
  return model.status;
}

function missionCenter(model) {
  if (model.availability !== "AVAILABLE") {
    return {
      label: t("offline"),
      sub: t("stateUnavailable"),
    };
  }
  if (model.blocker !== "NONE") {
    return {
      label: t("hold"),
      sub: model.blocker.replaceAll("_", " "),
    };
  }
  if (model.status === "ACTIVE") {
    return {
      label: t("pulse"),
      sub: model.current_task?.id ?? t("noActiveTask"),
    };
  }
  if (model.next_action === "PROJECT_COMPLETE") {
    return {
      label: t("planDone"),
      sub: t("planDoneSub"),
    };
  }
  if (model.plan_revision === null) {
    return {
      label: t("idle"),
      sub: t("waitingForPlan"),
    };
  }
  return {
    label: t("readyLabel"),
    sub: model.next_action,
  };
}

function setListMeta(node, text) {
  if (node) {
    node.textContent = text;
  }
}

function scrollFocusIntoPanel(item) {
  if (!item || typeof item.scrollIntoView !== "function") {
    return;
  }
  // Keep active/half tasks visible without yanking the whole page.
  item.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function renderRecent(model) {
  elements.recent.replaceChildren();
  const completed = model.completed ?? [];
  setListMeta(elements.recentMeta, t("doneMeta", completed.length));
  if (completed.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-ledger";
    empty.textContent = t("noCompleted");
    elements.recent.append(empty);
    return;
  }
  // Newest completed last in state; show newest first for scanability.
  for (const entry of [...completed].toReversed()) {
    const item = document.createElement("li");
    const id = document.createElement("strong");
    const behavior = document.createElement("span");
    id.textContent = entry.id;
    id.title = entry.id;
    behavior.textContent = entry.expected_behavior;
    behavior.title = entry.expected_behavior;
    item.append(id, behavior);
    elements.recent.append(item);
  }
}

function renderPlanBoard(model) {
  if (!elements.planBoard) {
    return;
  }
  elements.planBoard.replaceChildren();
  const board = model.plan_board ?? [];
  const activeId = model.current_task?.id ?? null;
  setListMeta(elements.boardMeta, t("tasksMeta", board.length));
  if (board.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-ledger";
    empty.textContent = t("noReviewedPlan");
    elements.planBoard.append(empty);
    return;
  }
  let focusItem = null;
  for (const entry of board) {
    const item = document.createElement("li");
    const phaseName = String(entry.phase).toLowerCase();
    item.className = `board-item phase-${phaseName}`;
    if (
      entry.id === activeId
      || phaseName === "half"
      || phaseName === "active"
    ) {
      item.classList.add("is-focus");
      if (focusItem === null) {
        focusItem = item;
      }
    }
    const phase = document.createElement("span");
    phase.className = "board-phase";
    phase.textContent = entry.phase;
    const id = document.createElement("strong");
    id.textContent = entry.id;
    id.title = entry.id;
    const title = document.createElement("span");
    title.textContent = entry.title;
    title.title = entry.title;
    item.append(phase, id, title);
    elements.planBoard.append(item);
  }
  // After layout: keep the current/half row in the scroll panel.
  requestAnimationFrame(() => {
    scrollFocusIntoPanel(focusItem);
  });
}

function renderRing(model) {
  const count = Math.max(0, Math.min(12, model.task_count || 0));
  const ratio = progressRatio(model);
  document.documentElement.style.setProperty(
    "--progress-ratio",
    String(ratio),
  );
  if (elements.ringArc) {
    elements.ringArc.style.strokeDasharray = String(RING_CIRCUMFERENCE);
    elements.ringArc.style.strokeDashoffset = String(
      RING_CIRCUMFERENCE * (1 - ratio),
    );
  }

  elements.ringNodes.replaceChildren();
  if (count === 0) {
    return;
  }

  const cx = 200;
  const cy = 200;
  const radius = 148;
  for (let index = 0; index < count; index += 1) {
    const angle = ((Math.PI * 2) * index) / count - Math.PI / 2;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    const node = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    node.setAttribute("class", "ring-node");
    node.setAttribute("cx", String(x));
    node.setAttribute("cy", String(y));
    node.setAttribute("r", "14");
    if (index < model.cursor) {
      node.classList.add("is-done");
    } else if (index === model.cursor && model.status === "ACTIVE") {
      node.classList.add("is-current");
    }
    elements.ringNodes.append(node);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("class", "ring-node-label");
    label.setAttribute("x", String(x));
    label.setAttribute("y", String(y + 1));
    label.textContent = String(index + 1);
    elements.ringNodes.append(label);
  }
}

function renderProofMeter(model) {
  for (const seg of elements.proofMeter) {
    seg.classList.toggle(
      "is-active",
      seg.dataset.proof === model.proof_freshness,
    );
  }
}

function renderGuardrail(model) {
  const blocked = model.blocker !== "NONE";
  const drifted = model.proof_freshness === "STALE"
    || model.proof_freshness === "FAIL"
    || model.proof_freshness === "UNKNOWN";
  elements.guardOk?.classList.toggle("is-active", !blocked && !drifted);
  elements.guardWarn?.classList.toggle("is-active", !blocked && drifted);
  elements.guardFail?.classList.toggle("is-active", blocked);
  elements.blockerBadge.textContent = blocked
    ? t("badgeBlocked")
    : drifted
    ? t("badgeDrift")
    : t("badgeClear");
  elements.attentionCard?.classList.toggle("is-hot", blocked || drifted);
}

function renderVector(model) {
  const ratio = progressRatio(model);
  elements.vectorProgress.style.width = `${(ratio * 100).toFixed(3)}%`;
  for (const stop of elements.vectorStops) {
    const name = stop.dataset.stop;
    let active = false;
    if (name === "partial") {
      active = ratio > 0 && ratio < 1;
    } else if (name === "review") {
      active = model.blocker === "DOCUMENT_SYNC_PENDING"
        || model.proof_freshness === "STALE"
        || model.proof_freshness === "FAIL";
    } else if (name === "ready") {
      active = model.next_action === "PROJECT_COMPLETE"
        || (ratio >= 1 && model.blocker === "NONE");
    }
    stop.classList.toggle("is-active", active);
  }
}

function setUnavailableGate(kind) {
  if (!elements.unavailableEyebrow || !elements.unavailableTitle
    || !elements.unavailableBody) {
    return;
  }
  if (kind === "offline") {
    elements.unavailableEyebrow.textContent = "SERVER";
    elements.unavailableTitle.textContent = t("offlineTitle");
    elements.unavailableBody.textContent = t("offlineBody");
    return;
  }
  elements.unavailableEyebrow.textContent = "STATE";
  elements.unavailableTitle.textContent = t("stateUnavailableTitle");
  elements.unavailableBody.textContent = t("stateUnavailableBody");
}

function render(model, meta = {}) {
  lastModelForUi = model;
  const available = model.availability === "AVAILABLE";
  // Quiet polls: do not thrash the DOM (or scroll position) when nothing changed.
  const signature = stateSignature(model)
    + `|offline:${meta.offline === true ? 1 : 0}|lang:${uiLang}`;
  if (signature === lastRenderedSignature) {
    return;
  }
  lastRenderedSignature = signature;

  const task = model.current_task;
  const ratio = progressRatio(model);
  // 0.1.6: do not lead with a bare percent — that reads as product complete.
  // Keep fraction as the primary truth (plan cursor only).
  const progressLabel = t("progressLabel", model.cursor, model.task_count);
  const mission = missionCenter(model);
  const nextDisplay = model.next_action === "PROJECT_COMPLETE"
    ? t("projectCompleteNext")
    : model.next_action.startsWith("CONTINUE_ACTIVE:")
    ? t("continueActiveHint", model.next_action)
    : model.next_action.startsWith("RUN_EXACT_TEST:")
    ? t("runExactHint", model.next_action)
    : model.next_action;

  document.body.dataset.tone = stateTone(model);
  // Progress fill still uses ratio; label text stays fraction-only (FT-01 / 0.1.6).
  document.documentElement.style.setProperty(
    "--progress",
    `${Math.round(ratio * 100)}%`,
  );
  elements.main.setAttribute("aria-busy", "false");
  elements.unavailable.hidden = available;
  if (!available) {
    setUnavailableGate(meta.offline ? "offline" : "state");
  }

  elements.goal.textContent = model.goal
    ?? (
      model.next_action === "PROJECT_COMPLETE"
        ? t("planOnlyNotProduct")
        : t("noGoal")
    );
  elements.status.textContent = model.status;
  elements.stageTitle.textContent = stageTitle(model);
  elements.nowHeading.textContent = task?.id ?? (
    !available
      ? t("unavailable")
      : model.status === "BLOCKED_DOC_SYNC"
      ? t("blockedDocSync")
      : t("noActiveTask")
  );
  elements.behavior.textContent = task?.expected_behavior ?? (
    available
      ? model.next_action === "PROJECT_COMPLETE"
        ? t("planCompleteBehavior")
        : t("noActiveBehavior")
      : t("unavailableBehavior")
  );
  elements.testWell.hidden = task === null;
  elements.test.textContent = task?.test_command ?? t("none");
  elements.proof.textContent = model.proof_freshness;
  elements.blocker.textContent = model.blocker === "NONE"
    ? t("none")
    : model.blocker;
  elements.next.textContent = nextDisplay === "NONE" ? t("none") : nextDisplay;
  elements.completedCount.textContent = String(model.completed_count);
  elements.taskCountDisp.textContent = String(model.task_count);
  elements.cursorDisp.textContent = String(model.cursor);
  elements.tasksDisp.textContent = String(model.task_count);
  elements.doneDisp.textContent = String(model.completed_count);
  elements.planRevision.textContent = abbreviateRevision(
    model.plan_revision ?? null,
  );
  elements.planRevision.title = model.plan_revision ?? t("noReviewedPlanShort");
  elements.progressLabel.textContent = progressLabel;
  elements.progressLabel.title = t("progressTitle");
  elements.progressFill.style.width = `${Math.round(ratio * 100)}%`;
  elements.progressAria.setAttribute(
    "aria-valuenow",
    String(model.task_count > 0 ? model.cursor : 0),
  );
  elements.progressAria.setAttribute(
    "aria-valuemax",
    String(model.task_count > 0 ? model.task_count : 1),
  );
  elements.progressAria.setAttribute(
    "aria-label",
    t("progressAria", model.cursor, model.task_count),
  );
  elements.missionLabel.textContent = mission.label;
  elements.missionSub.textContent = mission.sub;
  elements.railSummary.textContent = model.plan_revision === null
    ? t("noReviewedPlanShort")
    : model.cursor >= model.task_count && model.task_count > 0
    ? t("thisPlanComplete")
    : t("cursorOf", model.cursor, model.task_count, model.status);
  elements.rail.setAttribute(
    "aria-label",
    t("progressAria", model.cursor, model.task_count)
      + ` · ${model.status} · ${model.proof_freshness} · ${model.blocker}`,
  );

  // FT-13/17: show which tree's state we are projecting.
  if (elements.handoffLine) {
    const h = model.handoff;
    elements.handoffLine.textContent = h
      ? t("handoffLine", h)
      : t("handoffUnknown");
    elements.handoffLine.title = t("handoffTitle");
  }

  if (elements.truthTargetCount) {
    elements.truthTargetCount.textContent = String(
      model.truth_target_count ?? 0,
    );
  }
  if (elements.docSyncStatus) {
    elements.docSyncStatus.textContent = model.document_sync_status
      ?? "UNAVAILABLE";
  }
  if (elements.truthTargetsList) {
    elements.truthTargetsList.replaceChildren();
    const targets = model.truth_targets ?? [];
    if (targets.length === 0) {
      const empty = document.createElement("li");
      empty.className = "empty-ledger";
      empty.textContent = t("noTruthTargets");
      elements.truthTargetsList.append(empty);
    } else {
      for (const path of targets) {
        const item = document.createElement("li");
        item.textContent = path;
        item.title = path;
        elements.truthTargetsList.append(item);
      }
    }
  }
  renderRecent(model);
  renderPlanBoard(model);
  renderRing(model);
  renderProofMeter(model);
  renderGuardrail(model);
  renderVector(model);
  announceMeaningfulChange(model);
}

function setRefreshBusy(busy, { manual = false } = {}) {
  requestInFlight = busy;
  // Never flash the masthead button on background polls — only on user click.
  if (manual) {
    elements.refresh.textContent = busy ? t("refreshReading") : t("refresh");
    elements.refresh.setAttribute("aria-disabled", String(busy));
    elements.main.setAttribute("aria-busy", String(busy));
  } else if (!busy) {
    elements.refresh.textContent = t("refresh");
    elements.refresh.setAttribute("aria-disabled", "false");
    elements.main.setAttribute("aria-busy", "false");
  }
  document.body.dataset.live = busy && !manual ? "polling" : "idle";
}

function scheduleRefresh() {
  clearTimeout(refreshTimer);
  if (!document.hidden) {
    refreshTimer = setTimeout(() => {
      void refreshState({ manual: false });
    }, 120);
  }
}

async function refreshState(options = {}) {
  const manual = options.manual === true;
  if (requestInFlight) {
    return;
  }
  setRefreshBusy(true, { manual });
  try {
    const response = await fetch("/api/state", {
      cache: "no-store",
      headers: {
        accept: "application/json",
      },
    });
    let model;
    try {
      model = await response.json();
    } catch {
      render(unavailableProjection, { offline: true });
      return;
    }
    // Network reached server: use API availability (503 = real state problem).
    render(model, { offline: false });
  } catch {
    // fetch failed: process gone, wrong port, or tab left open after stop.
    render(unavailableProjection, { offline: true });
  } finally {
    setRefreshBusy(false, { manual });
  }
}

elements.refresh.addEventListener("click", () => {
  if (elements.refresh.getAttribute("aria-disabled") === "true") {
    return;
  }
  void refreshState({ manual: true });
});

document.querySelector("#lang-en")?.addEventListener("click", () => {
  setUiLang("en");
});
document.querySelector("#lang-zh")?.addEventListener("click", () => {
  setUiLang("zh");
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    scheduleRefresh();
  }
});

applyStaticI18n();
void refreshState({ manual: false });
// COCKPIT-DESIGN-CONTRACT: 100-125 ms cadence (silent; no masthead thrash).
setInterval(() => {
  if (!document.hidden) {
    void refreshState({ manual: false });
  }
}, 100);
