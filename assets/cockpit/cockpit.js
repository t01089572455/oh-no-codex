const elements = {
  main: document.querySelector("#current-state"),
  goal: document.querySelector("#goal-value"),
  refresh: document.querySelector("#refresh-button"),
  unavailable: document.querySelector("#unavailable-gate"),
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
  proof_freshness: "UNAVAILABLE",
  blocker: "STATE_UNAVAILABLE",
  next_action: "NONE",
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
      label: "DONE",
      sub: "Project complete",
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

function render(model) {
  const available = model.availability === "AVAILABLE";
  const task = model.current_task;
  const ratio = progressRatio(model);
  const percent = `${Math.round(ratio * 100)}%`;
  const mission = missionCenter(model);

  document.body.dataset.tone = stateTone(model);
  document.documentElement.style.setProperty("--progress", percent);
  elements.main.setAttribute("aria-busy", "false");
  elements.unavailable.hidden = available;

  elements.goal.textContent = model.goal ?? "NO GOAL AVAILABLE";
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
      ? "No active task is recorded in the canonical read model."
      : "Canonical project state is unavailable."
  );
  elements.testWell.hidden = task === null;
  elements.test.textContent = task?.test_command ?? "NONE";
  elements.proof.textContent = model.proof_freshness;
  elements.blocker.textContent = model.blocker;
  elements.next.textContent = model.next_action;
  elements.completedCount.textContent = String(model.completed_count);
  elements.taskCountDisp.textContent = String(model.task_count);
  elements.cursorDisp.textContent = String(model.cursor);
  elements.tasksDisp.textContent = String(model.task_count);
  elements.doneDisp.textContent = String(model.completed_count);
  elements.planRevision.textContent = model.plan_revision ?? "NONE";
  elements.planRevision.title = model.plan_revision ?? "No reviewed plan";
  elements.progressLabel.textContent = percent;
  elements.progressFill.style.width = percent;
  elements.progressAria.setAttribute(
    "aria-valuenow",
    String(Math.round(ratio * 100)),
  );
  elements.missionLabel.textContent = mission.label;
  elements.missionSub.textContent = mission.sub;
  elements.railSummary.textContent = model.plan_revision === null
    ? "NO REVIEWED PLAN"
    : model.cursor >= model.task_count && model.task_count > 0
    ? "PROJECT COMPLETE"
    : `CURSOR ${model.cursor} OF ${model.task_count} · ${model.status}`;
  elements.rail.setAttribute(
    "aria-label",
    `Cursor ${model.cursor} of ${model.task_count}. `
      + `Status ${model.status}. Proof ${model.proof_freshness}. `
      + `Blocker ${model.blocker}.`,
  );

  renderRecent(model);
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
    const model = await response.json();
    render(model);
  } catch {
    render(unavailableProjection);
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
setInterval(() => {
  if (!document.hidden) {
    void refreshState();
  }
}, 2500);
