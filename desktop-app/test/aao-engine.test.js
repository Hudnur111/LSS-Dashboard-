'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSuggestions } = require('../src/main/aao-engine');

test('flags missing vehicle types for an open mission', () => {
  const vehicles = [{ id: 1, vehicle_type_name: 'LF', fms_status: 2 }];
  const missions = [{ id: 100, caption: 'Verkehrsunfall', missing_vehicles: 1 }];

  const [suggestion] = buildSuggestions(vehicles, missions);

  assert.equal(suggestion.vollstaendigVerfuegbar, false);
  assert.deepEqual(
    suggestion.fehlend.map((f) => f.type).sort(),
    ['RTW', 'RW']
  );
});

test('marks a mission fully alertable once all required types are free', () => {
  const vehicles = [
    { id: 1, vehicle_type_name: 'RW', fms_status: 2 },
    { id: 2, vehicle_type_name: 'RTW', fms_status: 2 },
  ];
  const missions = [{ id: 100, caption: 'Verkehrsunfall', missing_vehicles: 1 }];

  const [suggestion] = buildSuggestions(vehicles, missions);

  assert.equal(suggestion.vollstaendigVerfuegbar, true);
  assert.deepEqual(suggestion.fehlend, []);
});

test('does not count a vehicle as available unless its fms_status is 2', () => {
  const vehicles = [{ id: 1, vehicle_type_name: 'LF', fms_status: 3 }];
  const missions = [{ id: 100, caption: 'Kleiner Küchenbrand', missing_vehicles: 1 }];

  const [suggestion] = buildSuggestions(vehicles, missions);

  assert.equal(suggestion.vollstaendigVerfuegbar, false);
  assert.equal(suggestion.fehlend[0].free, 0);
});

test('reserves vehicles per mission in order, so a later mission cannot double-count them', () => {
  const vehicles = [{ id: 1, vehicle_type_name: 'RTW', fms_status: 2 }];
  const missions = [
    { id: 100, caption: 'Verkehrsunfall', missing_vehicles: 1 },
    { id: 101, caption: 'Reanimation', missing_vehicles: 1 },
  ];

  const [first, second] = buildSuggestions(vehicles, missions);

  const rtwInFirst = first.fehlend.find((f) => f.type === 'RTW');
  assert.equal(rtwInFirst, undefined, 'first mission should have claimed the only RTW');
  const rtwInSecond = second.fehlend.find((f) => f.type === 'RTW');
  assert.equal(rtwInSecond.free, 0, 'second mission should see no RTW left');
});

test('missions with missing_vehicles = 0 are filtered out entirely', () => {
  const suggestions = buildSuggestions([], [{ id: 1, caption: 'Verkehrsunfall', missing_vehicles: 0 }]);
  assert.deepEqual(suggestions, []);
});

test('falls back to the default rule for an unknown mission caption', () => {
  const vehicles = [{ id: 1, vehicle_type_name: 'LF', fms_status: 2 }];
  const missions = [{ id: 1, caption: 'Ganz neue Einsatzart', missing_vehicles: 1 }];

  const [suggestion] = buildSuggestions(vehicles, missions);

  assert.equal(suggestion.vollstaendigVerfuegbar, true);
});
