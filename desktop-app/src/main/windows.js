'use strict';

const path = require('path');
const { BrowserWindow, BrowserView } = require('electron');
const { GAME_URL, GAME_SESSION_PARTITION } = require('../shared/constants');

const SIDEBAR_WIDTH = 420;

function createDashboardWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0f1115',
    title: 'LSS Dashboard',
    webPreferences: {
      preload: path.join(__dirname, '..', '..', 'preload', 'dashboard-preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  // The real game lives in its own BrowserView/WebContents (separate renderer
  // process) so a busy game DOM can never block or slow down the dashboard's
  // own UI thread. It only becomes visible when the user opts in.
  const gameView = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, '..', '..', 'preload', 'game-preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      partition: GAME_SESSION_PARTITION,
    },
  });
  gameView.webContents.loadURL(GAME_URL);

  win.gameView = gameView;
  win.gameViewVisible = false;

  const layoutGameView = () => {
    if (!win.gameViewVisible) return;
    const [width, height] = win.getContentSize();
    gameView.setBounds({ x: 0, y: 0, width: Math.max(width - SIDEBAR_WIDTH, 0), height });
  };

  win.showGameView = () => {
    win.gameViewVisible = true;
    win.addBrowserView(gameView);
    layoutGameView();
  };

  win.hideGameView = () => {
    win.gameViewVisible = false;
    win.removeBrowserView(gameView);
  };

  win.on('resize', layoutGameView);
  win.on('closed', () => {
    win.gameView = null;
  });

  return win;
}

module.exports = { createDashboardWindow };
