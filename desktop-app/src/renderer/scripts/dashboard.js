'use strict';

const state = {
  vehicles: [],
  missions: [],
  suggestions: [],
};

const qs = (id) => document.getElementById(id);

function renderOverview() {
  const free = state.vehicles.filter((v) => (v.fms_status ?? v.fmsStatus) === 2).length;
  qs('wVehicleCount').textContent = state.vehicles.length;
  qs('wVehicleFree').textContent = free;
  qs('wOpenMissions').textContent = state.missions.length;
  qs('wFullyAlerted').textContent = state.suggestions.filter((s) => s.vollstaendigVerfuegbar).length;
}

function renderVehicles() {
  const tbody = qs('vehicleTableBody');
  tbody.innerHTML = '';
  for (const vehicle of state.vehicles) {
    const status = vehicle.fms_status ?? vehicle.fmsStatus ?? '–';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${vehicle.id ?? ''}</td>
      <td>${vehicle.name ?? ''}</td>
      <td>${vehicle.vehicle_type_name ?? vehicle.type ?? ''}</td>
      <td><span class="status-pill">${status}</span></td>
    `;
    tbody.appendChild(tr);
  }
}

function renderAao() {
  const container = qs('aaoList');
  container.innerHTML = '';
  if (state.suggestions.length === 0) {
    container.innerHTML = '<p class="hint">Keine offenen Einsätze mit fehlender Alarmierung.</p>';
    return;
  }
  for (const suggestion of state.suggestions) {
    const card = document.createElement('div');
    card.className = `aao-card${suggestion.vollstaendigVerfuegbar ? ' ok' : ''}`;
    const missingText = suggestion.fehlend
      .map((m) => `${m.type}: ${m.free}/${m.needed} verfügbar`)
      .join(', ');
    card.innerHTML = `
      <h3>${suggestion.caption ?? 'Einsatz'}</h3>
      <p>${
        suggestion.vollstaendigVerfuegbar
          ? 'Alle erforderlichen Fahrzeugtypen sind verfügbar.'
          : `Fehlend: ${missingText}`
      }</p>
    `;
    container.appendChild(card);
  }
}

function renderAll() {
  renderOverview();
  renderVehicles();
  renderAao();
}

function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach((btn) => {
    btn.addEventListener('click', () => {
      navItems.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.view').forEach((v) => v.classList.add('hidden'));
      qs(`view-${btn.dataset.view}`).classList.remove('hidden');
      qs('viewTitle').textContent = btn.textContent;
    });
  });
}

async function setupSettings() {
  const settings = await window.lssAPI.getSettings();
  if (settings.hasToken) {
    qs('tokenInput').placeholder = 'Token gespeichert (zum Ändern neu eingeben)';
  }

  qs('saveTokenBtn').addEventListener('click', async () => {
    const value = qs('tokenInput').value.trim();
    if (!value) return;
    await window.lssAPI.setApiToken(value);
    qs('tokenInput').value = '';
    qs('tokenInput').placeholder = 'Token gespeichert (zum Ändern neu eingeben)';
  });

  qs('clearTokenBtn').addEventListener('click', async () => {
    await window.lssAPI.clearApiToken();
    qs('tokenInput').placeholder = 'Bearer-Token aus den Leitstellenspiel-Entwicklereinstellungen';
  });
}

function setupGameViewToggle() {
  let visible = false;
  qs('toggleGameView').addEventListener('click', async () => {
    visible = !visible;
    await window.lssAPI.toggleGameView(visible);
    qs('toggleGameView').textContent = visible ? 'Spiel-Ansicht ausblenden' : 'Spiel-Ansicht einblenden';
  });
}

function setupRefresh() {
  qs('refreshBtn').addEventListener('click', () => window.lssAPI.requestRefresh());
}

function subscribeToBackend() {
  window.lssAPI.onGameData(({ vehicles, missions }) => {
    state.vehicles = vehicles ?? state.vehicles;
    state.missions = missions ?? state.missions;
    renderAll();
  });
  window.lssAPI.onAaoSuggestions((suggestions) => {
    state.suggestions = suggestions ?? [];
    renderAll();
  });
}

window.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupSettings();
  setupGameViewToggle();
  setupRefresh();
  subscribeToBackend();
});
