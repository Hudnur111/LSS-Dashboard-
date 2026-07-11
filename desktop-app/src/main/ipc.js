'use strict';

const { ipcMain } = require('electron');
const { CHANNELS, BRIDGE_PORT } = require('../shared/constants');
const secureStore = require('./secure-store');
const bridgeTokenStore = require('./bridge-token-store');
const { fetchVehicles, fetchMissions } = require('./api-client');
const hub = require('./game-data-hub');

const POLL_INTERVAL_MS = 20_000;
const BRIDGE_STATUS_INTERVAL_MS = 15_000;
let pollTimer = null;

async function pollOnce(dashboardWindow) {
  const token = secureStore.getToken();
  if (!token || dashboardWindow.isDestroyed()) return;

  try {
    const [vehicles, missions] = await Promise.all([fetchVehicles(token), fetchMissions(token)]);
    hub.publish(dashboardWindow, { vehicles, missions });
  } catch (err) {
    console.error('[lss-dashboard] Polling fehlgeschlagen:', err.message);
  }
}

function startPolling(dashboardWindow) {
  stopPolling();
  pollOnce(dashboardWindow);
  pollTimer = setInterval(() => pollOnce(dashboardWindow), POLL_INTERVAL_MS);
}

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

function registerIpcHandlers(dashboardWindow) {
  // Handlers are re-registered per window instance; drop any stale ones from
  // a previous window first (relevant on macOS activate-without-window).
  for (const channel of [
    CHANNELS.SETTINGS_GET,
    CHANNELS.TOKEN_SET,
    CHANNELS.TOKEN_CLEAR,
    CHANNELS.TOKEN_HAS,
    CHANNELS.GAME_VIEW_TOGGLE,
    CHANNELS.REFRESH_REQUEST,
    CHANNELS.BRIDGE_TOKEN_GET,
    CHANNELS.BRIDGE_TOKEN_REGENERATE,
  ]) {
    ipcMain.removeHandler(channel);
  }

  ipcMain.handle(CHANNELS.SETTINGS_GET, async () => ({ hasToken: secureStore.hasToken() }));

  ipcMain.handle(CHANNELS.TOKEN_SET, async (_event, token) => {
    secureStore.setToken(String(token || '').trim());
    startPolling(dashboardWindow);
    return { ok: true };
  });

  ipcMain.handle(CHANNELS.TOKEN_CLEAR, async () => {
    secureStore.clearToken();
    stopPolling();
    return { ok: true };
  });

  ipcMain.handle(CHANNELS.TOKEN_HAS, async () => secureStore.hasToken());

  ipcMain.handle(CHANNELS.GAME_VIEW_TOGGLE, async (_event, visible) => {
    if (visible) dashboardWindow.showGameView();
    else dashboardWindow.hideGameView();
    return { visible: Boolean(visible) };
  });

  ipcMain.handle(CHANNELS.REFRESH_REQUEST, async () => {
    await pollOnce(dashboardWindow);
    return { ok: true };
  });

  ipcMain.handle(CHANNELS.BRIDGE_TOKEN_GET, async () => ({
    token: bridgeTokenStore.getOrCreateBridgeToken(),
    port: BRIDGE_PORT,
  }));

  ipcMain.handle(CHANNELS.BRIDGE_TOKEN_REGENERATE, async () => {
    const token = bridgeTokenStore.regenerateBridgeToken();
    // Regenerating invalidates every already-paired browser tab immediately -
    // surface that as a hard status reset instead of leaving the previous
    // "connected" badge showing stale trust.
    hub.sendBridgeStatus(dashboardWindow);
    return { token };
  });

  // Signal from the embedded game view's DOM observer (preload/game-preload.js):
  // don't trust the scraped payload itself, just use it to trigger an
  // immediate, authoritative poll against the official API.
  ipcMain.on(CHANNELS.GAME_RAW_EVENT, () => pollOnce(dashboardWindow));
  ipcMain.on(CHANNELS.GAME_VIEW_READY, () => {});

  const bridgeStatusInterval = setInterval(
    () => hub.sendBridgeStatus(dashboardWindow),
    BRIDGE_STATUS_INTERVAL_MS
  );
  dashboardWindow.once('closed', () => clearInterval(bridgeStatusInterval));
  hub.sendBridgeStatus(dashboardWindow);

  if (secureStore.hasToken()) startPolling(dashboardWindow);
}

module.exports = { registerIpcHandlers };
