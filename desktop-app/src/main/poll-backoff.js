'use strict';

// Pure scheduling logic, deliberately free of any Electron dependency so it
// can run under a plain `node --test` regardless of whether the 'electron'
// npm package happens to be installed - see test/poll-backoff.test.js.

const BASE_POLL_INTERVAL_MS = 20_000;
const MAX_POLL_INTERVAL_MS = 5 * 60_000;

// Exponential backoff after repeated failures (doubling, capped at 5
// minutes) so a genuinely down API doesn't get hammered every 20s forever.
function computeNextDelayMs(failureCount) {
  if (failureCount <= 0) return BASE_POLL_INTERVAL_MS;
  const backoff = BASE_POLL_INTERVAL_MS * 2 ** Math.min(failureCount, 5);
  return Math.min(backoff, MAX_POLL_INTERVAL_MS);
}

module.exports = { computeNextDelayMs, BASE_POLL_INTERVAL_MS, MAX_POLL_INTERVAL_MS };
