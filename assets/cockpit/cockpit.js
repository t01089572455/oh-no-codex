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

let requestInFlight = false;
let refreshTimer;
let lastAnnouncedSignature;

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
    model.current_task?.id ?? null,
    model.proof_freshness,
    model.blocker,
    model.next_action,
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
    ? `Proof changed to ${model.proof_freshness}. `
      + `Blocker is ${model.blocker}. Next is ${model.next_action}.`
    : "Local state became unavailable.";
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
      label: "OFFLINE",
      sub: "State unavailable",
    };
  }
  if (model.blocker !== "NONE") {
    return {
      label: "HOLD",
      sub: model.blocker.replaceAll("_", " "),
    };
  }
  if (model.status === "ACTIVE") {
    return {
      label: "PULSE",
      sub: model.current_task?.id ?? "Active task",
    };
  }
  if (model.next_action === "PROJECT_COMPLETE") {
    return {
      label: "PLAN DONE",
      sub: "This linear plan is complete — not product-finished. Propose next phase.",
    };
  }
  if (model.plan_revision === null) {
    return {
      label: "IDLE",
      sub: "Waiting for plan",
    };
  }
  return {
    label: "READY",
    sub: model.next_action,
  };
}

function renderRecent(model) {
  elements.recent.replaceChildren();
  if (model.completed.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-ledger";
    empty.textContent = "NO COMPLETED TASKS";
    elements.recent.append(empty);
    return;
  }
  for (const entry of model.completed) {
    const item = document.createElement("li");
    const id = document.createElement("strong");
    const behavior = document.createElement("span");
    id.textContent = entry.id;
    behavior.textContent = entry.expected_behavior;
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
  if (board.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-ledger";
    empty.textContent = "NO REVIEWED PLAN";
    elements.planBoard.append(empty);
    return;
  }
  for (const entry of board) {
    const item = document.createElement("li");
    item.className = `board-item phase-${String(entry.phase).toLowerCase()}`;
    const phase = document.createElement("span");
    phase.className = "board-phase";
    phase.textContent = entry.phase;
    const id = document.createElement("strong");
    id.textContent = entry.id;
    const title = document.createElement("span");
    title.textContent = entry.title;
    item.append(phase, id, title);
    elements.planBoard.append(item);
  }
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
  elements.blockerBadge.textContent = blocked ? "BLOCKED" : drifted ? "DRIFT" : "CLEAR";
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
    elements.unavailableTitle.textContent = "COCKPIT SERVER OFFLINE";
    elements.unavailableBody.innerHTML =
      "This browser tab cannot reach the local cockpit process "
      + "(wrong/old port, or the process exited). "
      + "In the project root run <code>ohno cockpit</code> "
      + "(or <code>ohno cockpit --replace</code>), open the "
      + "<strong>new</strong> URL printed in the terminal, "
      + "and close this tab. To free a port: "
      + "<code>ohno cockpit stop</code>. "
      + "This is usually <em>not</em> a corrupt "
      + "<code>.ohno/state.json</code>.";
    return;
  }
  elements.unavailableEyebrow.textContent = "STATE";
  elements.unavailableTitle.textContent = "LOCAL STATE UNAVAILABLE";
  elements.unavailableBody.innerHTML =
    "The local state is missing, corrupt, or unsupported. Repair "
    + "<code>.ohno/state.json</code>, then refresh. "
    + "If the terminal still prints a Cockpit URL and "
    + "<code>ohno status</code> works, you may be on a dead tab — "
    + "open the latest URL instead.";
}

function render(model, meta = {}) {
  const available = model.availability === "AVAILABLE";
  const task = model.current_task;
  const ratio = progressRatio(model);
  // 0.1.6: do not lead with a bare percent — that reads as product complete.
  // Keep fraction as the primary truth (plan cursor only).
  const progressLabel = model.task_count > 0
    ? `${model.cursor} of ${model.task_count} plan tasks`
    : "0 of 0 plan tasks (no reviewed plan)";
  const mission = missionCenter(model);
  const nextDisplay = model.next_action === "PROJECT_COMPLETE"
    ? "PROJECT_COMPLETE (this plan only — propose next phase)"
    : model.next_action.startsWith("CONTINUE_ACTIVE:")
    ? `${model.next_action} (stay on this task — then ohno verify)`
    : model.next_action.startsWith("RUN_EXACT_TEST:")
    ? `${model.next_action} (re-run frozen black box)`
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
        ? "THIS PLAN ONLY — not product complete"
        : "NO GOAL AVAILABLE"
    );
  elements.status.textContent = model.status;
  elements.stageTitle.textContent = stageTitle(model);
  elements.nowHeading.textContent = task?.id ?? (
    !available
      ? "UNAVAILABLE"
      : model.status === "BLOCKED_DOC_SYNC"
      ? "BLOCKED_DOC_SYNC"
      : "NO ACTIVE TASK"
  );
  elements.behavior.textContent = task?.expected_behavior ?? (
    available
      ? model.next_action === "PROJECT_COMPLETE"
        ? "This linear plan cursor is complete. That is not product completion. "
          + "Run ohno plan propose for the next phase."
        : "No active task is recorded in the canonical read model."
      : "Canonical project state is unavailable."
  );
  elements.testWell.hidden = task === null;
  elements.test.textContent = task?.test_command ?? "NONE";
  elements.proof.textContent = model.proof_freshness;
  elements.blocker.textContent = model.blocker;
  elements.next.textContent = nextDisplay;
  elements.completedCount.textContent = String(model.completed_count);
  elements.taskCountDisp.textContent = String(model.task_count);
  elements.cursorDisp.textContent = String(model.cursor);
  elements.tasksDisp.textContent = String(model.task_count);
  elements.doneDisp.textContent = String(model.completed_count);
  elements.planRevision.textContent = model.plan_revision ?? "NONE";
  elements.planRevision.title = model.plan_revision ?? "No reviewed plan";
  elements.progressLabel.textContent = progressLabel;
  elements.progressLabel.title =
    "Plan cursor only (cursor/task_count). Never product completion %.";
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
    `Plan cursor ${model.cursor} of ${model.task_count} tasks `
      + "(not product completion)",
  );
  elements.missionLabel.textContent = mission.label;
  elements.missionSub.textContent = mission.sub;
  elements.railSummary.textContent = model.plan_revision === null
    ? "NO REVIEWED PLAN"
    : model.cursor >= model.task_count && model.task_count > 0
    ? "THIS PLAN COMPLETE"
    : `CURSOR ${model.cursor} OF ${model.task_count} · ${model.status}`;
  elements.rail.setAttribute(
    "aria-label",
    `Plan cursor ${model.cursor} of ${model.task_count}. `
      + `Status ${model.status}. Proof ${model.proof_freshness}. `
      + `Blocker ${model.blocker}. Authority path ${model.handoff?.path ?? "cwd"}.`,
  );

  // FT-13/17: show which tree's state we are projecting.
  if (elements.handoffLine) {
    const h = model.handoff;
    elements.handoffLine.textContent = h
      ? `AUTHORITY CWD: ${h.path} · ${h.branch ?? "NO-BRANCH"} · ${
        h.head ?? "NO-HEAD"
      }${h.dirty ? " · DIRTY" : ""}`
      : "AUTHORITY CWD: UNKNOWN";
    elements.handoffLine.title =
      "Cockpit reads only this path's .ohno/state.json. Other git worktrees may differ.";
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
      empty.textContent = "NO TRUTH TARGETS";
      elements.truthTargetsList.append(empty);
    } else {
      for (const path of targets) {
        const item = document.createElement("li");
        item.textContent = path;
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

function setRefreshBusy(busy) {
  requestInFlight = busy;
  elements.refresh.textContent = busy ? "READING" : "REFRESH";
  elements.refresh.setAttribute("aria-disabled", String(busy));
  elements.main.setAttribute("aria-busy", String(busy));
}

function scheduleRefresh() {
  clearTimeout(refreshTimer);
  if (!document.hidden) {
    refreshTimer = setTimeout(() => {
      void refreshState();
    }, 120);
  }
}

async function refreshState() {
  if (requestInFlight) {
    return;
  }
  setRefreshBusy(true);
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
    setRefreshBusy(false);
  }
}

elements.refresh.addEventListener("click", () => {
  if (elements.refresh.getAttribute("aria-disabled") === "true") {
    return;
  }
  void refreshState();
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    scheduleRefresh();
  }
});

void refreshState();
// COCKPIT-DESIGN-CONTRACT: 100-125 ms cadence
setInterval(() => {
  if (!document.hidden) {
    void refreshState();
  }
}, 100);
