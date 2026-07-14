'use strict';

const fs = require('fs');
const path = require('path');
const { app, screen } = require('electron');

const DEFAULTS = { width: 1440, height: 900 };
const SAVE_DEBOUNCE_MS = 500;

function statePath() {
  return path.join(app.getPath('userData'), 'window-state.json');
}

// A position saved from a previous session can point at a monitor that's no
// longer connected (laptop undocked, external display unplugged) - falling
// back to the default, centered size/position is safer than restoring a
// window the user can no longer see or reach.
function isOnScreen(bounds) {
  return screen.getAllDisplays().some((display) => {
    const { x, y, width, height } = display.workArea;
    return (
      bounds.x >= x &&
      bounds.y >= y &&
      bounds.x < x + width &&
      bounds.y < y + height
    );
  });
}

function loadWindowState() {
  try {
    const saved = JSON.parse(fs.readFileSync(statePath(), 'utf8'));
    if (typeof saved.x === 'number' && typeof saved.y === 'number' && !isOnScreen(saved)) {
      return { ...DEFAULTS };
    }
    return { ...DEFAULTS, ...saved };
  } catch {
    return { ...DEFAULTS };
  }
}

function persist(win) {
  if (!win || win.isDestroyed()) return;
  const bounds = win.isMaximized() ? win.getNormalBounds() : win.getBounds();
  try {
    fs.writeFileSync(
      statePath(),
      JSON.stringify({ ...bounds, maximized: win.isMaximized() })
    );
  } catch (err) {
    console.error('[lss-dashboard] Fensterzustand konnte nicht gespeichert werden:', err.message);
  }
}

// Saving on every single 'resize'/'move' event (which fire continuously
// while dragging) would mean dozens of disk writes per second - debounce to
// one write shortly after the user stops interacting with the window.
function trackWindowState(win) {
  let saveTimer = null;
  const scheduleSave = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => persist(win), SAVE_DEBOUNCE_MS);
  };

  win.on('resize', scheduleSave);
  win.on('move', scheduleSave);
  win.on('close', () => {
    clearTimeout(saveTimer);
    persist(win);
  });
}

module.exports = { loadWindowState, trackWindowState };
