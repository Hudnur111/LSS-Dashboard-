'use strict';

const fs = require('fs');
const { dialog } = require('electron');
const { buildReportContent, defaultReportFileName } = require('./report-formatter');

async function exportReport(dashboardWindow, { vehicles = [], missions = [] }) {
  const { canceled, filePath } = await dialog.showSaveDialog(dashboardWindow, {
    title: 'Bericht exportieren',
    defaultPath: defaultReportFileName(),
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  });
  if (canceled || !filePath) return { ok: false, canceled: true };

  fs.writeFileSync(filePath, buildReportContent({ vehicles, missions }), 'utf8');
  return { ok: true, filePath };
}

module.exports = { exportReport };
