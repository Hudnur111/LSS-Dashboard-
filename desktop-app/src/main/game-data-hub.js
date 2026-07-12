'use strict';

const { CHANNELS } = require('../shared/constants');
const { buildSuggestions } = require('./aao-engine');

// Single fan-out point for game data, regardless of where it came from (the
// API-token poll loop in ipc.js, or a Tampermonkey POST via bridge-server.js).
// Keeps the AAO-suggestion computation in exactly one place.
const BRIDGE_STALE_AFTER_MS = 60_000;
let lastBridgeSeenAt = null;

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

function ingestFromBridge(dashboardWindow, payload) {
  lastBridgeSeenAt = Date.now();
  publish(dashboardWindow, {
    vehicles: Array.isArray(payload?.vehicles) ? payload.vehicles : [],
    missions: Array.isArray(payload?.missions) ? payload.missions : [],
  });
  sendBridgeStatus(dashboardWindow);
}

function sendBridgeStatus(dashboardWindow) {
  if (!dashboardWindow || dashboardWindow.isDestroyed()) return;
  const connected = lastBridgeSeenAt !== null && Date.now() - lastBridgeSeenAt < BRIDGE_STALE_AFTER_MS;
  dashboardWindow.webContents.send(CHANNELS.TO_RENDERER.BRIDGE_STATUS, {
    connected,
    lastSeenAt: lastBridgeSeenAt,
  });
}

function getLastSnapshot() {
  return lastSnapshot;
}

module.exports = { publish, ingestFromBridge, sendBridgeStatus, onPublish, getLastSnapshot };
