'use strict';

const { app, BrowserWindow, session } = require('electron');
const { createDashboardWindow } = require('./src/main/windows');
const { registerIpcHandlers } = require('./src/main/ipc');
const { createTray, updateTrayStatus } = require('./src/main/tray');
const { notifyNewMissions } = require('./src/main/notifier');
const gameDataHub = require('./src/main/game-data-hub');
const { GAME_SESSION_PARTITION } = require('./src/shared/constants');

let dashboardWindow = null;
let tray = null;
let knownMissionIds = new Set();

function hardenGameSession() {
  // The embedded game view runs in its own persistent session partition so the
  // player's LSS login survives restarts without ever touching this app's own
  // storage. Deny permission prompts (camera, mic, notifications, ...) it has
  // no legitimate reason to request.
  const gameSession = session.fromPartition(GAME_SESSION_PARTITION);
  gameSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
}

function boot() {
  dashboardWindow = createDashboardWindow();
  registerIpcHandlers(dashboardWindow);

  // Closing the window (the X button) minimizes to tray instead of quitting,
  // so the poll loop keeps running in the background - the only real quit
  // path is the tray's own "Beenden" (sets app.isQuitting).
  dashboardWindow.on('close', (event) => {
    if (app.isQuitting) return;
    event.preventDefault();
    dashboardWindow.hide();
  });
}

// Keeps the tray tooltip and native notifications in sync with every
// published snapshot from the API-token poll loop - single subscription
// point, see game-data-hub.js.
function watchGameData() {
  gameDataHub.onPublish(({ missions }) => {
    updateTrayStatus(tray, { openMissions: missions.length });
    notifyNewMissions(missions, knownMissionIds, dashboardWindow);
    knownMissionIds = new Set(missions.map((mission) => mission.id));
  });
}

app.whenReady().then(() => {
  hardenGameSession();
  boot();
  tray = createTray(() => dashboardWindow);
  watchGameData();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      boot();
    } else {
      dashboardWindow.show();
    }
  });
});

// With minimize-to-tray active, this normally only fires on macOS (where a
// window can be closed for real while the app stays in the dock) or during
// an actual quit - either way, Windows/Linux should still exit cleanly.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  app.isQuitting = true;
  if (tray && !tray.isDestroyed()) tray.destroy();
});

// Defense in depth: never let any renderer (dashboard or embedded game view)
// spawn native windows or navigate away from the game's own domain.
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('will-navigate', (navEvent, url) => {
    let allowed = false;
    try {
      allowed = new URL(url).hostname.endsWith('leitstellenspiel.de');
    } catch {
      allowed = false;
    }
    if (!allowed) navEvent.preventDefault();
  });
});
