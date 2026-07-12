'use strict';

const { ipcMain, app } = require('electron');
const { CHANNELS } = require('../shared/constants');
const secureStore = require('./secure-store');
const { fetchVehicles, fetchMissions } = require('./api-client');
const { exportReport } = require('./export-report');
const hub = require('./game-data-hub');

const POLL_INTERVAL_MS = 20_000;
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
    CHANNELS.AUTOSTART_GET,
    CHANNELS.AUTOSTART_SET,
    CHANNELS.EXPORT_REPORT,
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

  // `openAtLogin` is per-OS-user, not per-app-instance - electron-builder's
  // packaged app is what actually gets registered, so this only takes effect
  // in a built/installed copy, not `electron .` from source.
  ipcMain.handle(CHANNELS.AUTOSTART_GET, async () => ({
    enabled: app.getLoginItemSettings().openAtLogin,
  }));

  ipcMain.handle(CHANNELS.AUTOSTART_SET, async (_event, enabled) => {
    app.setLoginItemSettings({ openAtLogin: Boolean(enabled) });
    return { enabled: Boolean(enabled) };
  });

  ipcMain.handle(CHANNELS.EXPORT_REPORT, async () => {
    const { vehicles, missions } = hub.getLastSnapshot();
    return exportReport(dashboardWindow, { vehicles, missions });
  });

  // Signal from the embedded game view's DOM observer (preload/game-preload.js):
  // don't trust the scraped payload itself, just use it to trigger an
  // immediate, authoritative poll against the official API.
  ipcMain.on(CHANNELS.GAME_RAW_EVENT, () => pollOnce(dashboardWindow));
  ipcMain.on(CHANNELS.GAME_VIEW_READY, () => {});

  if (secureStore.hasToken()) startPolling(dashboardWindow);
}

module.exports = { registerIpcHandlers };
