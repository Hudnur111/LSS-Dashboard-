'use strict';

// Single source of truth for IPC channel names and game-view configuration
// used by the main process. Preload scripts run under `sandbox: true` and
// therefore cannot `require()` this file (sandboxed preload may only require
// Electron's whitelisted built-ins) - their copies of these constants are
// duplicated inline and must be kept in sync manually. See preload/*.js.
module.exports = {
  GAME_URL: 'https://www.leitstellenspiel.de/',
  GAME_SESSION_PARTITION: 'persist:lss-game',

  // Local-only HTTP bridge the Tampermonkey userscript posts to. Bound to
  // 127.0.0.1 in bridge-server.js - never reachable from the LAN.
  BRIDGE_HOST: '127.0.0.1',
  BRIDGE_PORT: 17845,

  // Best-effort CSS selectors for the game's live mission list. These are a
  // starting point, not verified against the current production markup -
  // adjust them here after inspecting a real logged-in session (DevTools).
  GAME_DOM_SELECTORS: {
    missionListContainer: '#missions, .missionList, #mission_container',
    missionItem: '.mission, [data-mission-id]',
    missionCaption: '.caption, .mission-caption, strong',
  },

  CHANNELS: {
    GAME_RAW_EVENT: 'game:raw-event',
    GAME_VIEW_READY: 'game:view-ready',
    GAME_VIEW_TOGGLE: 'game:view-toggle',
    SETTINGS_GET: 'settings:get',
    TOKEN_SET: 'token:set',
    TOKEN_CLEAR: 'token:clear',
    TOKEN_HAS: 'token:has',
    REFRESH_REQUEST: 'refresh:request',
    BRIDGE_TOKEN_GET: 'bridge:token-get',
    BRIDGE_TOKEN_REGENERATE: 'bridge:token-regenerate',
    AUTOSTART_GET: 'autostart:get',
    AUTOSTART_SET: 'autostart:set',
    EXPORT_REPORT: 'report:export',
    TO_RENDERER: {
      GAME_DATA: 'game:data',
      AAO_SUGGESTIONS: 'aao:suggestions',
      VEHICLE_UPDATE: 'vehicle:update',
      BRIDGE_STATUS: 'bridge:status',
    },
  },
};
