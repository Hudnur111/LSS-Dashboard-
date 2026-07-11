'use strict';

const { CHANNELS } = require('../shared/constants');
const { buildSuggestions } = require('./aao-engine');

// Single fan-out point for game data, regardless of where it came from (the
// API-token poll loop in ipc.js, or a Tampermonkey POST via bridge-server.js).
// Keeps the AAO-suggestion computation in exactly one place.
const BRIDGE_STALE_AFTER_MS = 60_000;
let lastBridgeSeenAt = null;

function publish(dashboardWindow, { vehicles = [], missions = [] } = {}) {
  if (!dashboardWindow || dashboardWindow.isDestroyed()) return;
  dashboardWindow.webContents.send(CHANNELS.TO_RENDERER.VEHICLE_UPDATE, vehicles);
  dashboardWindow.webContents.send(CHANNELS.TO_RENDERER.GAME_DATA, { vehicles, missions });
  dashboardWindow.webContents.send(
    CHANNELS.TO_RENDERER.AAO_SUGGESTIONS,
    buildSuggestions(vehicles, missions)
  );
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

module.exports = { publish, ingestFromBridge, sendBridgeStatus };
