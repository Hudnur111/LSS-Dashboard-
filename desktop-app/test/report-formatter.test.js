'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { csvEscape, toCsv, buildReportContent, defaultReportFileName } = require('../src/main/report-formatter');

test('csvEscape leaves plain values untouched', () => {
  assert.equal(csvEscape('LF 1'), 'LF 1');
  assert.equal(csvEscape(42), '42');
  assert.equal(csvEscape(undefined), '');
  assert.equal(csvEscape(null), '');
});

test('csvEscape quotes and doubles internal quotes for values with delimiters', () => {
  assert.equal(csvEscape('RTW; mit "Sonderzeichen"'), '"RTW; mit ""Sonderzeichen"""');
  assert.equal(csvEscape('Zeile 1\nZeile 2'), '"Zeile 1\nZeile 2"');
});

test('toCsv builds a header row plus one row per entry, in column order', () => {
  const csv = toCsv(
    [
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
    ],
    ['id', 'name']
  );
  assert.equal(csv, 'id;name\r\n1;A\r\n2;B');
});

test('buildReportContent produces both sections with a leading UTF-8 BOM', () => {
  const content = buildReportContent({
    vehicles: [{ id: 1, name: 'Florian 1', vehicle_type_name: 'LF', fms_status: 2 }],
    missions: [{ id: 10, caption: 'Wohnungsbrand' }],
  });

  assert.ok(content.startsWith('﻿Fahrzeuge'), 'should start with BOM + section header');
  assert.match(content, /id;name;typ;fms_status\r\n1;Florian 1;LF;2/);
  assert.match(content, /Einsätze\r\nid;einsatzart\r\n10;Wohnungsbrand/);
});

test('buildReportContent tolerates missing vehicles/missions', () => {
  const content = buildReportContent({});
  assert.match(content, /id;name;typ;fms_status\r\n\r\n/);
  assert.match(content, /id;einsatzart\r\n/);
});

test('defaultReportFileName formats as lss-bericht-YYYY-MM-DD.csv', () => {
  const name = defaultReportFileName(new Date('2026-07-12T10:00:00Z'));
  assert.equal(name, 'lss-bericht-2026-07-12.csv');
});
