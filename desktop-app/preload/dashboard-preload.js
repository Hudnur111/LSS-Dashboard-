'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Duplicated from src/shared/constants.js - see the note there. Keep in sync
// by hand whenever channel names change.
const CHANNELS = {
  SETTINGS_GET: 'settings:get',
  TOKEN_SET: 'token:set',
  TOKEN_CLEAR: 'token:clear',
  TOKEN_HAS: 'token:has',
  GAME_VIEW_TOGGLE: 'game:view-toggle',
  REFRESH_REQUEST: 'refresh:request',
  AUTOSTART_GET: 'autostart:get',
  AUTOSTART_SET: 'autostart:set',
  EXPORT_REPORT: 'report:export',
  TO_RENDERER: {
    GAME_DATA: 'game:data',
    AAO_SUGGESTIONS: 'aao:suggestions',
    VEHICLE_UPDATE: 'vehicle:update',
  },
};

const ALLOWED_RENDERER_CHANNELS = new Set(Object.values(CHANNELS.TO_RENDERER));

// Whitelisted subscribe helper: the renderer never gets a raw ipcRenderer, so
// it can never listen on (or send to) an arbitrary channel - only the exact
// surface exposed below.
function on(channel, callback) {
  if (!ALLOWED_RENDERER_CHANNELS.has(channel)) {
    throw new Error(`Blocked subscribe to unknown channel: ${channel}`);
  }
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('lssAPI', {
  onGameData: (cb) => on(CHANNELS.TO_RENDERER.GAME_DATA, cb),
  onAaoSuggestions: (cb) => on(CHANNELS.TO_RENDERER.AAO_SUGGESTIONS, cb),
  onVehicleUpdate: (cb) => on(CHANNELS.TO_RENDERER.VEHICLE_UPDATE, cb),

  getSettings: () => ipcRenderer.invoke(CHANNELS.SETTINGS_GET),
  setApiToken: (token) => ipcRenderer.invoke(CHANNELS.TOKEN_SET, token),
  clearApiToken: () => ipcRenderer.invoke(CHANNELS.TOKEN_CLEAR),
  hasApiToken: () => ipcRenderer.invoke(CHANNELS.TOKEN_HAS),

  toggleGameView: (visible) => ipcRenderer.invoke(CHANNELS.GAME_VIEW_TOGGLE, visible),
  requestRefresh: () => ipcRenderer.invoke(CHANNELS.REFRESH_REQUEST),

  getAutostart: () => ipcRenderer.invoke(CHANNELS.AUTOSTART_GET),
  setAutostart: (enabled) => ipcRenderer.invoke(CHANNELS.AUTOSTART_SET, enabled),

  exportReport: () => ipcRenderer.invoke(CHANNELS.EXPORT_REPORT),
});
