'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const hub = require('../src/main/game-data-hub');

function fakeWindow() {
  const sent = [];
  return {
    isDestroyed: () => false,
    webContents: { send: (channel, payload) => sent.push({ channel, payload }) },
    sent,
  };
}

test('publish() sends vehicle/game/aao channels and computes suggestions', () => {
  const win = fakeWindow();
  hub.publish(win, {
    vehicles: [{ id: 1, vehicle_type_name: 'LF', fms_status: 2 }],
    missions: [{ id: 10, caption: 'Verkehrsunfall', missing_vehicles: 1 }],
  });

  const channels = win.sent.map((entry) => entry.channel);
  assert.deepEqual(channels, ['vehicle:update', 'game:data', 'aao:suggestions']);

  const aaoPayload = win.sent.find((entry) => entry.channel === 'aao:suggestions').payload;
  assert.equal(aaoPayload[0].vollstaendigVerfuegbar, false);
});

test('publish() is a no-op for a destroyed window but still notifies onPublish listeners', () => {
  const destroyedWindow = { isDestroyed: () => true, webContents: { send: () => assert.fail('should not send') } };
  let received = null;
  const unsubscribe = hub.onPublish((payload) => {
    received = payload;
  });

  hub.publish(destroyedWindow, { vehicles: [], missions: [] });

  assert.deepEqual(received, { vehicles: [], missions: [], suggestions: [] });
  unsubscribe();
});

test('getLastSnapshot() reflects the most recent publish() call', () => {
  const win = fakeWindow();
  const vehicles = [{ id: 42, vehicle_type_name: 'RTW', fms_status: 2 }];
  const missions = [{ id: 1, caption: 'Reanimation', missing_vehicles: 1 }];

  hub.publish(win, { vehicles, missions });

  assert.deepEqual(hub.getLastSnapshot(), { vehicles, missions });
});

test('onPublish() unsubscribe stops further notifications', () => {
  const win = fakeWindow();
  let callCount = 0;
  const unsubscribe = hub.onPublish(() => {
    callCount += 1;
  });

  hub.publish(win, { vehicles: [], missions: [] });
  unsubscribe();
  hub.publish(win, { vehicles: [], missions: [] });

  assert.equal(callCount, 1);
});

test('a throwing onPublish listener does not stop other listeners or publish() itself', () => {
  const win = fakeWindow();
  let secondListenerCalled = false;
  const unsubscribeFaulty = hub.onPublish(() => {
    throw new Error('boom');
  });
  const unsubscribeOk = hub.onPublish(() => {
    secondListenerCalled = true;
  });

  assert.doesNotThrow(() => hub.publish(win, { vehicles: [], missions: [] }));
  assert.equal(secondListenerCalled, true);

  unsubscribeFaulty();
  unsubscribeOk();
});
