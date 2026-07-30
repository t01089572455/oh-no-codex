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
  next: document.querySelector("#next-value"),
  completedCount: document.querySelector("#completed-count"),
  recent: document.querySelector("#recent-list"),
  announcer: document.querySelector("#state-announcer"),
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

function render(model) {
  const available = model.availability === "AVAILABLE";
  const task = model.current_task;
  const cursorRatio = model.task_count === 0
    ? 0
    : Math.min(1, model.cursor / model.task_count);
  const progress = `${(cursorRatio * 100).toFixed(3)}%`;

  document.body.dataset.tone = stateTone(model);
  document.documentElement.style.setProperty("--progress", progress);
  elements.main.setAttribute("aria-busy", "false");
  elements.unavailable.hidden = available;
  elements.goal.textContent = model.goal ?? "NO GOAL AVAILABLE";
  elements.status.textContent = model.status;
  elements.nowHeading.textContent = task?.id ?? (
    model.status === "BLOCKED_DOC_SYNC"
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
  elements.planRevision.textContent = model.plan_revision ?? "NONE";
  elements.planRevision.title = model.plan_revision ?? "No reviewed plan";
  elements.railSummary.textContent = model.plan_revision === null
    ? "NO REVIEWED PLAN"
    : model.cursor >= model.task_count
    ? "PROJECT COMPLETE"
    : `CURSOR ${model.cursor} OF ${model.task_count} ${model.status}`;
  elements.rail.setAttribute(
    "aria-label",
    `Cursor ${model.cursor} of ${model.task_count}. `
      + `Status ${model.status}. Proof ${model.proof_freshness}. `
      + `Blocker ${model.blocker}.`,
  );
  renderRecent(model);
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
    scheduleRefresh();
  }
}

elements.refresh.addEventListener("click", () => {
  if (!requestInFlight) {
    clearTimeout(refreshTimer);
    void refreshState();
  }
});

document.addEventListener("visibilitychange", () => {
  clearTimeout(refreshTimer);
  if (!document.hidden) {
    void refreshState();
  }
});

window.addEventListener("focus", () => {
  clearTimeout(refreshTimer);
  void refreshState();
});

window.addEventListener("pagehide", () => {
  clearTimeout(refreshTimer);
});

void refreshState();
