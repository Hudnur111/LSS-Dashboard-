'use strict';

const { ipcRenderer } = require('electron');

// Duplicated from src/shared/constants.js (sandboxed preload restriction, see
// that file's header comment).
const GAME_RAW_EVENT_CHANNEL = 'game:raw-event';
const GAME_VIEW_READY_CHANNEL = 'game:view-ready';

const SELECTORS = {
  missionListContainer: '#missions, .missionList, #mission_container',
  missionItem: '.mission, [data-mission-id]',
  missionCaption: '.caption, .mission-caption, strong',
};

// This preload is READ-ONLY: it only observes the DOM to learn "something
// changed", it never dispatches synthetic clicks/keys and never touches game
// state. All actual gameplay actions remain manual, in the real page, by the
// player - this keeps the bridge firmly on the "read a dashboard" side of the
// game's fair-use line rather than the "automate play" side.
const DEBOUNCE_MS = 500;
let pendingPayload = null;
let debounceTimer = null;

function emitDebounced(kind, payload) {
  pendingPayload = { kind, payload, capturedAt: Date.now() };
  if (debounceTimer) return;
  // Debounced on the sender side so a burst of DOM mutations (a whole mission
  // list re-rendering) collapses into a single IPC message instead of
  // flooding the main process.
  debounceTimer = setTimeout(() => {
    if (pendingPayload) ipcRenderer.send(GAME_RAW_EVENT_CHANNEL, pendingPayload);
    pendingPayload = null;
    debounceTimer = null;
  }, DEBOUNCE_MS);
}

function extractMissionAlerts() {
  const container = document.querySelector(SELECTORS.missionListContainer);
  if (!container) return [];
  return Array.from(container.querySelectorAll(SELECTORS.missionItem)).map((el) => ({
    id: el.getAttribute('data-mission-id') || el.id || null,
    caption: el.querySelector(SELECTORS.missionCaption)?.textContent?.trim() ?? null,
  }));
}

function observeMissionList() {
  const target = document.querySelector(SELECTORS.missionListContainer);
  if (!target) {
    // Page may still be loading, or the player isn't logged in yet - keep
    // retrying quietly instead of failing once and going silent forever.
    setTimeout(observeMissionList, 1000);
    return;
  }
  const observer = new MutationObserver(() => {
    emitDebounced('mission-list-changed', extractMissionAlerts());
  });
  observer.observe(target, { childList: true, subtree: true });
  emitDebounced('mission-list-changed', extractMissionAlerts());
}

window.addEventListener('DOMContentLoaded', () => {
  ipcRenderer.send(GAME_VIEW_READY_CHANNEL);
  observeMissionList();
});
