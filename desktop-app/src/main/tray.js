'use strict';

const fs = require('fs');
const path = require('path');
const { Tray, Menu, nativeImage, app } = require('electron');

// 1x1 placeholder pixel - used only if no packaged icon exists yet (see
// build/README.md). Replace build/icon.png with a real icon before shipping;
// the tray will pick it up automatically.
const FALLBACK_ICON_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

function loadTrayIcon() {
  const customIconPath = path.join(__dirname, '..', '..', 'build', 'icon.png');
  if (fs.existsSync(customIconPath)) {
    const image = nativeImage.createFromPath(customIconPath);
    if (!image.isEmpty()) return image.resize({ width: 16, height: 16 });
  }
  return nativeImage.createFromBuffer(Buffer.from(FALLBACK_ICON_BASE64, 'base64'));
}

// Closing the window hides it instead of quitting (see main.js) so the app
// keeps polling in the background - the tray is the only way back in, and
// its own "Beenden" is the only way to actually quit.
// Takes a getter instead of a window reference so it keeps working across a
// window being recreated (e.g. macOS re-activate after a real destroy).
function createTray(getDashboardWindow) {
  const tray = new Tray(loadTrayIcon());
  tray.setToolTip('LSS Dashboard');

  const showWindow = () => {
    const win = getDashboardWindow();
    if (!win || win.isDestroyed()) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  };

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Dashboard öffnen', click: showWindow },
    { type: 'separator' },
    {
      label: 'Beenden',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(contextMenu);
  tray.on('click', showWindow);

  return tray;
}

function updateTrayStatus(tray, { openMissions = 0 } = {}) {
  if (!tray || tray.isDestroyed()) return;
  let tooltip = 'LSS Dashboard';
  if (openMissions === 1) tooltip = 'LSS Dashboard – 1 offener Einsatz';
  else if (openMissions > 1) tooltip = `LSS Dashboard – ${openMissions} offene Einsätze`;
  tray.setToolTip(tooltip);
}

module.exports = { createTray, updateTrayStatus };
