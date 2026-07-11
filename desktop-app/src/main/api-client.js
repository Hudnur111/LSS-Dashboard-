'use strict';

// Thin wrapper around the official Leitstellenspiel API (v2). This is the
// primary, reliable data source for the dashboard - the embedded game view's
// DOM observer (see preload/game-preload.js) only supplements it with an
// early "something changed" signal to shorten the poll interval, since page
// markup drifts far more often than a documented API contract.
const API_BASE = 'https://www.leitstellenspiel.de/api/v2';

async function authorizedGet(pathname, token) {
  const res = await fetch(`${API_BASE}${pathname}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`LSS API ${pathname} antwortete mit HTTP ${res.status}`);
  }
  return res.json();
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
