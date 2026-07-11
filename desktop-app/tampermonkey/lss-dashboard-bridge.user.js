// ==UserScript==
// @name         LSS Dashboard Bridge
// @namespace    https://github.com/Hudnur111/LSS-Dashboard-
// @version      0.1.0
// @description  Sendet Fahrzeug- und Einsatzdaten aus deiner echten, eingeloggten Leitstellenspiel-Session an die LSS-Dashboard-Desktop-App (rein lokal, 127.0.0.1).
// @author       Hudnur111
// @match        https://www.leitstellenspiel.de/*
// @connect      127.0.0.1
// @connect      localhost
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // Dieses Skript ist bewusst rein lesend: Es ruft nur die offizielle API ab
  // bzw. liest die Missionsliste im DOM, löst aber selbst nie Klicks, Formulare
  // oder sonstige Spielhandlungen aus. Alarmierung bleibt manuell im Spiel.

  const DEFAULTS = { bridgeHost: '127.0.0.1', bridgePort: 17845, pollIntervalMs: 15000 };

  const STORAGE_KEYS = {
    BRIDGE_TOKEN: 'lss_bridge_token',
    BRIDGE_PORT: 'lss_bridge_port',
    API_TOKEN: 'lss_api_token', // optional Fallback, siehe promptForApiToken()
  };

  // Best-effort-Selektoren - wie in desktop-app/src/shared/constants.js
  // vermerkt, gegen eine echte Session verifizieren und bei Bedarf anpassen.
  const MISSION_LIST_SELECTOR = '#missions, .missionList, #mission_container';

  const getBridgeToken = () => GM_getValue(STORAGE_KEYS.BRIDGE_TOKEN, '');
  const getBridgePort = () => GM_getValue(STORAGE_KEYS.BRIDGE_PORT, DEFAULTS.bridgePort);
  const getApiToken = () => GM_getValue(STORAGE_KEYS.API_TOKEN, '');
  const bridgeUrl = (pathname) => `http://${DEFAULTS.bridgeHost}:${getBridgePort()}${pathname}`;

  // --- Tampermonkey-Menü: Pairing/Konfiguration -----------------------------

  function promptForBridgeToken() {
    const value = window.prompt(
      'LSS Dashboard: Pairing-Token aus der Desktop-App einfügen\n' +
        '(Einstellungen → Tampermonkey-Bridge → Token kopieren):',
      getBridgeToken()
    );
    if (value !== null) {
      GM_setValue(STORAGE_KEYS.BRIDGE_TOKEN, value.trim());
      updateBadge('idle', 'Token gespeichert – warte auf nächste Übertragung …');
    }
  }

  function promptForApiToken() {
    const value = window.prompt(
      'Optional: API-Bearer-Token hinterlegen (Account → Entwicklereinstellungen).\n' +
        'Nur nötig, falls die API Anfragen mit deiner normalen Browser-Session ' +
        'ablehnt (HTTP 401/403 in der Konsole). Leer lassen für automatische ' +
        'Session-Authentifizierung.',
      getApiToken()
    );
    if (value !== null) GM_setValue(STORAGE_KEYS.API_TOKEN, value.trim());
  }

  function promptForBridgePort() {
    const value = window.prompt('Bridge-Port der Desktop-App:', String(getBridgePort()));
    const port = Number(value);
    if (value && Number.isInteger(port) && port > 0 && port < 65536) {
      GM_setValue(STORAGE_KEYS.BRIDGE_PORT, port);
    }
  }

  GM_registerMenuCommand('LSS Dashboard: Pairing-Token setzen', promptForBridgeToken);
  GM_registerMenuCommand('LSS Dashboard: API-Token setzen (optional)', promptForApiToken);
  GM_registerMenuCommand('LSS Dashboard: Bridge-Port ändern', promptForBridgePort);

  // --- Status-Badge (unten rechts im Spiel) --------------------------------

  let badgeEl = null;
  function ensureBadge() {
    if (badgeEl && document.body.contains(badgeEl)) return badgeEl;
    badgeEl = document.createElement('div');
    badgeEl.id = 'lss-dashboard-bridge-badge';
    Object.assign(badgeEl.style, {
      position: 'fixed',
      bottom: '12px',
      right: '12px',
      zIndex: 2147483647,
      padding: '6px 12px',
      borderRadius: '8px',
      fontFamily: 'sans-serif',
      fontSize: '12px',
      color: '#fff',
      background: '#525252',
      boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
      pointerEvents: 'none',
      transition: 'background-color 0.3s ease',
    });
    document.body.appendChild(badgeEl);
    return badgeEl;
  }

  function updateBadge(state, text) {
    const colors = { ok: '#16a34a', error: '#dc2626', idle: '#525252' };
    const el = ensureBadge();
    el.style.background = colors[state] || colors.idle;
    el.textContent = `LSS Dashboard: ${text}`;
  }

  // --- Datenerfassung: offizielle API über die reale Browser-Session -------

  function apiRequest(pathname) {
    return new Promise((resolve, reject) => {
      const headers = { Accept: 'application/json' };
      const apiToken = getApiToken();
      if (apiToken) headers.Authorization = `Bearer ${apiToken}`;

      GM_xmlhttpRequest({
        method: 'GET',
        url: `https://www.leitstellenspiel.de${pathname}`,
        headers,
        onload: (res) => {
          if (res.status >= 200 && res.status < 300) {
            try {
              resolve(JSON.parse(res.responseText));
            } catch {
              reject(new Error(`${pathname}: Antwort ist kein gültiges JSON`));
            }
          } else {
            reject(new Error(`${pathname} -> HTTP ${res.status}`));
          }
        },
        onerror: () => reject(new Error(`${pathname}: Netzwerkfehler`)),
      });
    });
  }

  async function collectGameData() {
    // GM_xmlhttpRequest ist keinem CORS unterworfen und läuft mit der echten,
    // in diesem Browser bereits angemeldeten Session - daher wird der
    // API-Token normalerweise gar nicht benötigt. `apiToken` bleibt als
    // Fallback verfügbar, falls die API Cookie-Auth für diese Endpunkte
    // ablehnt (dann in der Konsole HTTP 401/403 sichtbar).
    const [vehicles, missions] = await Promise.all([
      apiRequest('/api/v2/vehicles').catch((err) => {
        console.warn('[LSS Dashboard Bridge]', err.message);
        return [];
      }),
      // Endpunkt-Name ist ein Platzhalter (siehe ARCHITECTURE.md) - gegen die
      // tatsächliche API-Antwort des eigenen Accounts abgleichen.
      apiRequest('/api/v2/missions').catch((err) => {
        console.warn('[LSS Dashboard Bridge]', err.message);
        return [];
      }),
    ]);
    return { vehicles, missions };
  }

  // --- Übertragung an die Desktop-App ---------------------------------------

  function pushToDashboard(payload) {
    const token = getBridgeToken();
    if (!token) {
      updateBadge('error', 'kein Pairing-Token hinterlegt (Rechtsklick → Tampermonkey-Menü)');
      return;
    }
    GM_xmlhttpRequest({
      method: 'POST',
      url: bridgeUrl('/ingest'),
      headers: { 'Content-Type': 'application/json', 'X-Bridge-Token': token },
      data: JSON.stringify(payload),
      timeout: 5000,
      onload: (res) => {
        if (res.status === 200) {
          updateBadge('ok', `verbunden (zuletzt ${new Date().toLocaleTimeString('de-DE')})`);
        } else if (res.status === 401) {
          updateBadge('error', 'Pairing-Token ungültig – in der Desktop-App neu abgleichen');
        } else {
          updateBadge('error', `Dashboard antwortete mit HTTP ${res.status}`);
        }
      },
      onerror: () => updateBadge('error', 'Desktop-App nicht erreichbar (läuft sie?)'),
      ontimeout: () => updateBadge('error', 'Zeitüberschreitung beim Senden an die Desktop-App'),
    });
  }

  async function tick() {
    try {
      pushToDashboard(await collectGameData());
    } catch (err) {
      console.error('[LSS Dashboard Bridge] Fehler beim Erfassen der Spieldaten:', err);
      updateBadge('error', 'Fehler beim Erfassen der Spieldaten');
    }
  }

  // Sofort beim Laden, danach im festen Intervall. Ein MutationObserver auf
  // die Missionsliste löst zusätzlich eine sofortige Übertragung aus, sobald
  // sich dort etwas ändert (neuer Einsatz), statt auf den nächsten Poll zu warten.
  function watchMissionList() {
    const container = document.querySelector(MISSION_LIST_SELECTOR);
    if (!container) return;
    let debounceTimer = null;
    const observer = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(tick, 500);
    });
    observer.observe(container, { childList: true, subtree: true });
  }

  updateBadge('idle', 'wird initialisiert …');
  if (!getBridgeToken()) {
    updateBadge('error', 'kein Pairing-Token hinterlegt (Rechtsklick → Tampermonkey-Menü)');
  }

  tick();
  setInterval(tick, DEFAULTS.pollIntervalMs);
  watchMissionList();
})();
