'use strict';

// Thin wrapper around the official Leitstellenspiel API (v2). This is the
// primary, reliable data source for the dashboard - the embedded game view's
// DOM observer (see preload/game-preload.js) only supplements it with an
// early "something changed" signal to shorten the poll interval, since page
// markup drifts far more often than a documented API contract.
const API_BASE = 'https://www.leitstellenspiel.de/api/v2';
const REQUEST_TIMEOUT_MS = 10_000;

async function authorizedGet(pathname, token) {
  const controller = new AbortController();
  // Without this, a request that never resolves (dead connection, API stuck)
  // would hang pollOnce() forever - since ipc.js awaits both requests before
  // scheduling the next poll, one stuck request would silently stop all
  // future polling until the app is restarted.
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}${pathname}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`LSS API ${pathname} antwortete mit HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`LSS API ${pathname}: Zeitüberschreitung nach ${REQUEST_TIMEOUT_MS / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

function fetchVehicles(token) {
  return authorizedGet('/vehicles', token);
}

function fetchMissions(token) {
  // NOTE: endpoint name is a placeholder - confirm the exact path/shape
  // against the account's actual API docs/response before relying on it.
  return authorizedGet('/missions', token);
}

module.exports = { fetchVehicles, fetchMissions };
