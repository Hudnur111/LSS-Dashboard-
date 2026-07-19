'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { fetchVehicles, fetchMissions } = require('../src/main/api-client');

function withMockedFetch(implementation, run) {
  const original = global.fetch;
  global.fetch = implementation;
  return run().finally(() => {
    global.fetch = original;
  });
}

test('fetchVehicles resolves with the parsed JSON body on success', async () => {
  await withMockedFetch(
    async (url, options) => {
      assert.equal(url, 'https://www.leitstellenspiel.de/api/v2/vehicles');
      assert.equal(options.headers.Authorization, 'Bearer test-token');
      return { ok: true, json: async () => [{ id: 1 }] };
    },
    async () => {
      const vehicles = await fetchVehicles('test-token');
      assert.deepEqual(vehicles, [{ id: 1 }]);
    }
  );
});

test('a non-OK HTTP response is rejected with the status code in the message', async () => {
  await withMockedFetch(
    async () => ({ ok: false, status: 503 }),
    async () => {
      await assert.rejects(fetchMissions('test-token'), /HTTP 503/);
    }
  );
});

test('an aborted request is rejected with a friendly timeout message, not a raw AbortError', async () => {
  await withMockedFetch(
    async () => {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      throw err;
    },
    async () => {
      await assert.rejects(fetchVehicles('test-token'), /Zeitüberschreitung/);
    }
  );
});

test('a network error other than an abort is passed through unchanged', async () => {
  await withMockedFetch(
    async () => {
      throw new Error('getaddrinfo ENOTFOUND');
    },
    async () => {
      await assert.rejects(fetchVehicles('test-token'), /ENOTFOUND/);
    }
  );
});
