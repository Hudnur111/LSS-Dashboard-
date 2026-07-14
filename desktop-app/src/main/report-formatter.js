'use strict';

// Pure formatting logic, deliberately free of any Electron/Node I/O so it can
// run under a plain `node --test` without a packaged app or native module -
// see test/report-formatter.test.js.

function csvEscape(value) {
  const str = String(value ?? '');
  return /[;"\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function toCsv(rows, columns) {
  const header = columns.join(';');
  const lines = rows.map((row) => columns.map((col) => csvEscape(row[col])).join(';'));
  return [header, ...lines].join('\r\n');
}

function buildReportContent({ vehicles = [], missions = [] }) {
  const vehicleCsv = toCsv(
    vehicles.map((v) => ({
      id: v.id,
      name: v.name,
      typ: v.vehicle_type_name ?? v.type,
      fms_status: v.fms_status ?? v.fmsStatus,
    })),
    ['id', 'name', 'typ', 'fms_status']
  );
  const missionCsv = toCsv(
    missions.map((m) => ({ id: m.id, einsatzart: m.caption ?? m.name })),
    ['id', 'einsatzart']
  );

  // BOM so Excel (still the most common consumer on Windows) detects UTF-8
  // instead of misrendering Umlaute as garbage characters.
  return `﻿Fahrzeuge\r\n${vehicleCsv}\r\n\r\nEinsätze\r\n${missionCsv}\r\n`;
}

function defaultReportFileName(now = new Date()) {
  return `lss-bericht-${now.toISOString().slice(0, 10)}.csv`;
}

module.exports = { csvEscape, toCsv, buildReportContent, defaultReportFileName };
