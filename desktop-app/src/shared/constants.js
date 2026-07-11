'use strict';

// Single source of truth for IPC channel names and game-view configuration
// used by the main process. Preload scripts run under `sandbox: true` and
// therefore cannot `require()` this file (sandboxed preload may only require
// Electron's whitelisted built-ins) - their copies of these constants are
// duplicated inline and must be kept in sync manually. See preload/*.js.
module.exports = {
  GAME_URL: 'https://www.leitstellenspiel.de/',
  GAME_SESSION_PARTITION: 'persist:lss-game',

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
    TO_RENDERER: {
      GAME_DATA: 'game:data',
      AAO_SUGGESTIONS: 'aao:suggestions',
      VEHICLE_UPDATE: 'vehicle:update',
    },
  },
};
