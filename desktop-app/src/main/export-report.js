'use strict';

const fs = require('fs');
const { dialog } = require('electron');

function csvEscape(value) {
  const str = String(value ?? '');
  return /[;"\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function toCsv(rows, columns) {
  const header = columns.join(';');
  const lines = rows.map((row) => columns.map((col) => csvEscape(row[col])).join(';'));
  return [header, ...lines].join('\r\n');
}

async function exportReport(dashboardWindow, { vehicles = [], missions = [] }) {
  const { canceled, filePath } = await dialog.showSaveDialog(dashboardWindow, {
    title: 'Bericht exportieren',
    defaultPath: `lss-bericht-${new Date().toISOString().slice(0, 10)}.csv`,
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  });
  if (canceled || !filePath) return { ok: false, canceled: true };

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
  const content = `﻿Fahrzeuge\r\n${vehicleCsv}\r\n\r\nEinsätze\r\n${missionCsv}\r\n`;
  fs.writeFileSync(filePath, content, 'utf8');
  return { ok: true, filePath };
}

module.exports = { exportReport };
