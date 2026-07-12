'use strict';

const { CHANNELS } = require('../shared/constants');
const { buildSuggestions } = require('./aao-engine');

// Single fan-out point for game data coming from the API-token poll loop in
// ipc.js. Keeps the AAO-suggestion computation in exactly one place, and
// gives other consumers (tray tooltip, native notifications, CSV export) a
// shared subscription point instead of re-deriving state themselves.

// Last known snapshot, kept around for consumers that don't sit on the IPC
// stream themselves (CSV export, tray tooltip, native notifications).
let lastSnapshot = { vehicles: [], missions: [] };

const publishListeners = new Set();

function onPublish(fn) {
  publishListeners.add(fn);
  return () => publishListeners.delete(fn);
}

function publish(dashboardWindow, { vehicles = [], missions = [] } = {}) {
  lastSnapshot = { vehicles, missions };
  const suggestions = buildSuggestions(vehicles, missions);

  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.webContents.send(CHANNELS.TO_RENDERER.VEHICLE_UPDATE, vehicles);
    dashboardWindow.webContents.send(CHANNELS.TO_RENDERER.GAME_DATA, { vehicles, missions });
    dashboardWindow.webContents.send(CHANNELS.TO_RENDERER.AAO_SUGGESTIONS, suggestions);
  }

  for (const fn of publishListeners) {
    try {
      fn({ vehicles, missions, suggestions });
    } catch (err) {
      console.error('[lss-dashboard] onPublish-Listener fehlgeschlagen:', err.message);
    }
  }
}

function getLastSnapshot() {
  return lastSnapshot;
}

module.exports = { publish, onPublish, getLastSnapshot };
