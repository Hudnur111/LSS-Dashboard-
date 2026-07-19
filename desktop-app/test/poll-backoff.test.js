'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { computeNextDelayMs } = require('../src/main/poll-backoff');

test('computeNextDelayMs returns the base interval with no failures', () => {
  assert.equal(computeNextDelayMs(0), 20_000);
});

test('computeNextDelayMs doubles per consecutive failure', () => {
  assert.equal(computeNextDelayMs(1), 40_000);
  assert.equal(computeNextDelayMs(2), 80_000);
  assert.equal(computeNextDelayMs(3), 160_000);
});

test('computeNextDelayMs caps at 5 minutes however many failures pile up', () => {
  assert.equal(computeNextDelayMs(5), 5 * 60_000);
  assert.equal(computeNextDelayMs(20), 5 * 60_000);
});
