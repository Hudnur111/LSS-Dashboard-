'use strict';

const state = {
  vehicles: [],
  missions: [],
  suggestions: [],
  vehicleFilter: '',
  isDemo: false,
  sortKey: null,
  sortDir: 'asc',
};

const qs = (id) => document.getElementById(id);

// --- Beispieldaten für den Demo-Modus (rein clientseitig, keine echten Daten) ---

const DEMO_VEHICLES = [
  { id: 101, name: 'Florian Musterstadt 1/44/1', vehicle_type_name: 'LF', fms_status: 2 },
  { id: 102, name: 'Florian Musterstadt 1/44/2', vehicle_type_name: 'LF', fms_status: 3 },
  { id: 103, name: 'Florian Musterstadt 1/33/1', vehicle_type_name: 'DLK', fms_status: 2 },
  { id: 104, name: 'Rettung Musterstadt 1/83/1', vehicle_type_name: 'RTW', fms_status: 2 },
  { id: 105, name: 'Rettung Musterstadt 1/76/1', vehicle_type_name: 'NEF', fms_status: 4 },
  { id: 106, name: 'Florian Musterstadt 1/11/1', vehicle_type_name: 'RW', fms_status: 2 },
];

const DEMO_MISSIONS = [
  { id: 901, caption: 'Wohnungsbrand', missing_vehicles: 1 },
  { id: 902, caption: 'Verkehrsunfall', missing_vehicles: 1 },
];

const DEMO_SUGGESTIONS = [
  {
    missionId: 901,
    caption: 'Wohnungsbrand',
    fehlend: [{ type: 'RTW', needed: 1, free: 0 }],
    vollstaendigVerfuegbar: false,
  },
  {
    missionId: 902,
    caption: 'Verkehrsunfall',
    fehlend: [],
    vollstaendigVerfuegbar: true,
  },
];

// --- Toasts ---------------------------------------------------------------

function showToast(message, type = 'info', durationMs = 4000) {
  const container = qs('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast${type !== 'info' ? ` ${type}` : ''}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('leaving');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, durationMs);
}

// --- Zähl-Animation für Widget-Werte ---------------------------------------

const widgetAnimations = new Map();

function animateCount(el, toValue) {
  const fromValue = Number(el.dataset.value || 0);
  el.classList.remove('skeleton');
  if (fromValue === toValue) {
    el.textContent = toValue;
    return;
  }
  el.dataset.value = toValue;
  cancelAnimationFrame(widgetAnimations.get(el));

  const durationMs = 400;
  const startTime = performance.now();

  function step(now) {
    const progress = Math.min((now - startTime) / durationMs, 1);
    const eased = 1 - (1 - progress) * (1 - progress);
    const current = Math.round(fromValue + (toValue - fromValue) * eased);
    el.textContent = current;
    if (progress < 1) {
      widgetAnimations.set(el, requestAnimationFrame(step));
    }
  }
  widgetAnimations.set(el, requestAnimationFrame(step));
}

// --- Rendering --------------------------------------------------------------

function renderOverview() {
  const free = state.vehicles.filter((v) => (v.fms_status ?? v.fmsStatus) === 2).length;
  animateCount(qs('wVehicleCount'), state.vehicles.length);
  animateCount(qs('wVehicleFree'), free);
  animateCount(qs('wOpenMissions'), state.missions.length);
  animateCount(qs('wFullyAlerted'), state.suggestions.filter((s) => s.vollstaendigVerfuegbar).length);
}

function vehicleSortValue(vehicle, key) {
  if (key === 'vehicle_type_name') return vehicle.vehicle_type_name ?? vehicle.type ?? '';
  if (key === 'fms_status') return vehicle.fms_status ?? vehicle.fmsStatus ?? -1;
  return vehicle[key] ?? '';
}

function sortVehicles(vehicles) {
  if (!state.sortKey) return vehicles;
  const direction = state.sortDir === 'asc' ? 1 : -1;
  return [...vehicles].sort((a, b) => {
    const valueA = vehicleSortValue(a, state.sortKey);
    const valueB = vehicleSortValue(b, state.sortKey);
    if (typeof valueA === 'number' && typeof valueB === 'number') return (valueA - valueB) * direction;
    return String(valueA).localeCompare(String(valueB), 'de') * direction;
  });
}

function renderVehicles() {
  const tbody = qs('vehicleTableBody');
  tbody.innerHTML = '';
  const filter = state.vehicleFilter.trim().toLowerCase();
  const filtered = state.vehicles.filter((vehicle) => {
    if (!filter) return true;
    const name = (vehicle.name ?? '').toLowerCase();
    const type = (vehicle.vehicle_type_name ?? vehicle.type ?? '').toLowerCase();
    return name.includes(filter) || type.includes(filter);
  });
  const sorted = sortVehicles(filtered);

  qs('vehicleEmptyHint').classList.toggle('hidden', sorted.length !== 0);

  for (const vehicle of sorted) {
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
  } else {
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

  const openCount = state.suggestions.filter((s) => !s.vollstaendigVerfuegbar).length;
  const badge = qs('aaoNavBadge');
  badge.textContent = openCount;
  badge.classList.toggle('hidden', openCount === 0);
}

function renderAll() {
  renderOverview();
  renderVehicles();
  renderAao();
}

// --- Demo-Modus -------------------------------------------------------------

function setDemoBannerVisible(visible) {
  qs('demoBanner').classList.toggle('hidden', !visible);
  qs('stopDemoBtn').classList.toggle('hidden', !visible);
}

function loadDemoData({ silent = false } = {}) {
  state.isDemo = true;
  state.vehicles = DEMO_VEHICLES;
  state.missions = DEMO_MISSIONS;
  state.suggestions = DEMO_SUGGESTIONS;
  setDemoBannerVisible(true);
  renderAll();
  if (!silent) showToast('Demo-Daten geladen.', 'success');
}

function exitDemoMode({ silent = false } = {}) {
  state.isDemo = false;
  state.vehicles = [];
  state.missions = [];
  state.suggestions = [];
  setDemoBannerVisible(false);
  qs('wVehicleCount').classList.add('skeleton');
  qs('wVehicleFree').classList.add('skeleton');
  qs('wOpenMissions').classList.add('skeleton');
  qs('wFullyAlerted').classList.add('skeleton');
  renderVehicles();
  renderAao();
  if (!silent) showToast('Demo-Modus beendet.');
}

function setupDemoMode() {
  qs('loadDemoBtn').addEventListener('click', () => loadDemoData());
  qs('stopDemoBtn').addEventListener('click', () => exitDemoMode());
  qs('dismissDemoBtn').addEventListener('click', () => qs('demoBanner').classList.add('hidden'));
}

// --- Navigation --------------------------------------------------------------

function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach((btn) => {
    btn.addEventListener('click', () => {
      navItems.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.view').forEach((v) => v.classList.add('hidden'));
      const view = qs(`view-${btn.dataset.view}`);
      view.classList.remove('hidden');
      // Restart the CSS fade-in animation on every switch, not just first paint.
      view.style.animation = 'none';
      void view.offsetWidth;
      view.style.animation = '';
      qs('viewTitle').textContent = btn.querySelector('span').textContent;
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
    showToast('API-Token gespeichert.', 'success');
  });

  qs('clearTokenBtn').addEventListener('click', async () => {
    await window.lssAPI.clearApiToken();
    qs('tokenInput').placeholder = 'Bearer-Token aus den Leitstellenspiel-Entwicklereinstellungen';
    showToast('API-Token entfernt.');
  });

  return settings;
}

async function setupBridgeSettings() {
  const { token, port } = await window.lssAPI.getBridgeInfo();
  qs('bridgeTokenDisplay').value = token;
  qs('bridgePort').textContent = port;

  qs('copyBridgeTokenBtn').addEventListener('click', () => {
    window.lssAPI.copyText(qs('bridgeTokenDisplay').value);
    showToast('Token in die Zwischenablage kopiert.', 'success', 2000);
  });

  qs('regenerateBridgeTokenBtn').addEventListener('click', async () => {
    const confirmed = window.confirm(
      'Neuen Token generieren? Bereits im Tampermonkey-Menü hinterlegte Tokens funktionieren danach nicht mehr, bis du sie dort aktualisierst.'
    );
    if (!confirmed) return;
    const { token: newToken } = await window.lssAPI.regenerateBridgeToken();
    qs('bridgeTokenDisplay').value = newToken;
    showToast('Neuer Pairing-Token generiert.', 'success');
  });

  let wasConnected = false;
  window.lssAPI.onBridgeStatus(({ connected, lastSeenAt }) => {
    qs('bridgeStatusDot').classList.toggle('online', connected);
    qs('bridgeStatusText').textContent = connected
      ? `Verbunden (zuletzt ${new Date(lastSeenAt).toLocaleTimeString('de-DE')})`
      : 'Kein Kontakt';
    if (connected && !wasConnected) showToast('Tampermonkey-Bridge verbunden.', 'success');
    if (!connected && wasConnected) showToast('Tampermonkey-Bridge getrennt.', 'error');
    wasConnected = connected;
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
  qs('refreshBtn').addEventListener('click', async () => {
    const icon = document.querySelector('.refresh-icon');
    icon.classList.add('spinning');
    try {
      await window.lssAPI.requestRefresh();
    } finally {
      icon.classList.remove('spinning');
    }
  });
}

function setupVehicleSearch() {
  qs('vehicleSearch').addEventListener('input', (event) => {
    state.vehicleFilter = event.target.value;
    renderVehicles();
  });
}

function setupVehicleSort() {
  const headers = document.querySelectorAll('#view-vehicles th.sortable');
  headers.forEach((th) => {
    th.addEventListener('click', () => {
      const key = th.dataset.sortKey;
      state.sortDir = state.sortKey === key && state.sortDir === 'asc' ? 'desc' : 'asc';
      state.sortKey = key;
      headers.forEach((h) => h.classList.remove('sort-asc', 'sort-desc'));
      th.classList.add(state.sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
      renderVehicles();
    });
  });
}

function setupExport() {
  qs('exportReportBtn').addEventListener('click', async () => {
    const result = await window.lssAPI.exportReport();
    if (result.canceled) return;
    if (result.ok) showToast(`Bericht gespeichert: ${result.filePath}`, 'success');
    else showToast('Export fehlgeschlagen.', 'error');
  });
}

async function setupAutostart() {
  const { enabled } = await window.lssAPI.getAutostart();
  qs('autostartToggle').checked = enabled;

  qs('autostartToggle').addEventListener('change', async (event) => {
    const { enabled: applied } = await window.lssAPI.setAutostart(event.target.checked);
    showToast(applied ? 'Autostart mit Windows aktiviert.' : 'Autostart deaktiviert.', 'success');
  });
}

function subscribeToBackend() {
  let previousMissionCount = 0;

  window.lssAPI.onGameData(({ vehicles, missions }) => {
    if (state.isDemo) exitDemoMode({ silent: true });
    state.vehicles = vehicles ?? state.vehicles;
    state.missions = missions ?? state.missions;
    if (previousMissionCount && state.missions.length > previousMissionCount) {
      showToast('Neuer Einsatz erkannt.', 'success');
    }
    previousMissionCount = state.missions.length;
    renderAll();
  });
  window.lssAPI.onAaoSuggestions((suggestions) => {
    state.suggestions = suggestions ?? [];
    renderAll();
  });
}

window.addEventListener('DOMContentLoaded', async () => {
  setupNavigation();
  setupDemoMode();
  setupGameViewToggle();
  setupRefresh();
  setupVehicleSearch();
  setupVehicleSort();
  setupExport();
  subscribeToBackend();

  const settings = await setupSettings();
  await setupBridgeSettings();
  await setupAutostart();

  // Frisch installierte App ohne jede Verbindung: sofort Beispieldaten zeigen,
  // statt den Nutzer mit einem leeren Dashboard zurückzulassen. Sobald echte
  // Daten eintreffen, beendet subscribeToBackend() den Demo-Modus automatisch.
  if (!settings.hasToken) {
    loadDemoData({ silent: true });
  }
});
