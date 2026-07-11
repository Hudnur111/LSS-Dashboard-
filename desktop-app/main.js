'use strict';

const { app, BrowserWindow, session } = require('electron');
const { createDashboardWindow } = require('./src/main/windows');
const { registerIpcHandlers } = require('./src/main/ipc');
const { createBridgeServer } = require('./src/main/bridge-server');
const bridgeTokenStore = require('./src/main/bridge-token-store');
const gameDataHub = require('./src/main/game-data-hub');
const { GAME_SESSION_PARTITION } = require('./src/shared/constants');

let dashboardWindow = null;
let bridgeServer = null;

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
}

// One local HTTP endpoint for the whole app lifetime, independent of window
// creation/recreation - `dashboardWindow` is read through the closure at
// ingest time, so it always targets whichever window currently exists.
function startBridgeServer() {
  if (bridgeServer) return;
  bridgeServer = createBridgeServer({
    getToken: bridgeTokenStore.getOrCreateBridgeToken,
    onIngest: (payload) => gameDataHub.ingestFromBridge(dashboardWindow, payload),
  });
}

app.whenReady().then(() => {
  hardenGameSession();
  boot();
  startBridgeServer();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) boot();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (bridgeServer) bridgeServer.close();
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
