# Architektur – LSS Dashboard (Electron)

## 1. Tech-Stack

| Bereich | Wahl | Begründung |
|---|---|---|
| Runtime | Electron 31 (Chromium + Node.js) | Einziger Weg, ein natives Fenster + eine echte, eingeloggte Instanz der Webseite im selben Prozessbaum zu betreiben. |
| Hauptprozess | Node.js (CommonJS) | Fensterverwaltung, IPC, Secure Storage, API-Client, Polling. Kein Zugriff durch Renderer. |
| Renderer (Dashboard) | Vanilla HTML/CSS/JS, kein Framework | Kleine, prüfbare Angriffsfläche; keine Build-Pipeline nötig. Bei wachsendem UI-Umfang später React/Svelte nachziehbar, ohne die IPC-Architektur zu ändern. |
| Styling | Eigenes CSS (Dark Mode), **keine CDN-Skripte** | Das ursprüngliche `index.html`-Prototyp lud Tailwind/FontAwesome von CDN. In einer Desktop-App ist das ein Sicherheits- und Offline-Risiko (Remote-Code-Abhängigkeit, CSP-Konflikt) – deshalb lokal gebündelt. |
| Spiel-Anbindung | `BrowserView` mit eigener Session-Partition (`persist:lss-game`) | Rendert die echte Spielseite in einem eigenen Renderer-Prozess/eigener Webseiten-Session, getrennt vom Dashboard-Fenster. Login läuft ausschließlich auf der echten Seite. |
| Datenquelle | Offizielle Leitstellenspiel-API v2 (Bearer-Token) | Stabiler Vertrag statt brüchigem HTML-Scraping als primäre Quelle. |
| Live-Signal | `MutationObserver` in `preload/game-preload.js` | Beobachtet nur, ob sich die Missionsliste im DOM ändert, und löst dadurch einen sofortigen API-Poll aus – keine Interpretation von Spiel-HTML als Wahrheit. |
| Storage (Session/Token) | `safeStorage` (Electron, OS-Schlüsselbund) | Siehe SECURITY.md. |
| Packaging | `electron-builder` (NSIS + Portable) | Standard für professionelle Windows-Distribution, Code-Signing-fähig. |
| Erst-Installation | `installer/install.bat` + `create-shortcut.ps1` | Einfache End-User-Experience für die portable Variante: kopiert nach `%LOCALAPPDATA%`, erstellt Verknüpfungen, startet die App. |

## 2. Prozess- und Modul-Struktur

```
desktop-app/
├── main.js                      # App-Bootstrap, Fenster-Erzeugung, globale Hardening-Regeln
├── preload/
│   ├── dashboard-preload.js     # contextBridge-API "window.lssAPI" für das Dashboard-Fenster
│   └── game-preload.js          # Read-only DOM-Beobachter für die eingebettete Spiel-BrowserView
├── src/
│   ├── main/
│   │   ├── windows.js           # Dashboard-BrowserWindow + Spiel-BrowserView, Layout/Resize
│   │   ├── ipc.js                # Alle ipcMain-Handler, Polling-Loop, Verdrahtung Renderer <-> Backend
│   │   ├── secure-store.js       # Verschlüsselte Ablage des API-Tokens (safeStorage)
│   │   ├── api-client.js         # HTTP-Client für die offizielle LSS-API
│   │   └── aao-engine.js         # Regelbasierte AAO-Vorschlagslogik (rein lesend)
│   ├── renderer/
│   │   ├── index.html            # Dashboard-UI (Übersicht, Fahrzeuge, AAO, Einstellungen)
│   │   ├── styles/dashboard.css  # Dark-Mode-Theme
│   │   └── scripts/dashboard.js  # UI-Logik, konsumiert ausschließlich window.lssAPI
│   └── shared/
│       ├── constants.js          # IPC-Kanalnamen, Game-URL, DOM-Selektoren (single source of truth)
│       └── aao-rules.json        # Konfigurierbares AAO-Regelwerk (Einsatzart -> Fahrzeugtypen)
├── installer/
│   ├── install.bat / uninstall.bat
│   └── create-shortcut.ps1
└── electron-builder.yml
```

### Datenfluss

1. `secure-store.js` liefert den gespeicherten API-Token an `ipc.js`.
2. `ipc.js` pollt alle 20s `api-client.js` (offizielle API) und schickt `vehicle:update`,
   `game:data` und darauf aufbauend `aao:suggestions` per `webContents.send` an das
   Dashboard-Fenster.
3. Optional macht der Spieler die eingebettete Spiel-Ansicht sichtbar
   (`game:view-toggle`). Deren `game-preload.js` meldet per `MutationObserver`
   Änderungen an der Missionsliste über `game:raw-event` an den Hauptprozess,
   der daraufhin **sofort** neu pollt (`pollOnce`), statt auf den 20s-Zyklus zu warten.
4. `dashboard-preload.js` exponiert nur eine feste, whitelisted Methodenliste
   (`window.lssAPI.*`) – der Renderer hat keinen direkten `ipcRenderer`-Zugriff
   und kann keine beliebigen Kanäle abonnieren oder senden.

## 3. Warum kein reines HTML-Scraping als Datenquelle?

Spiel-Frontends ändern ihre Markup-Struktur regelmäßig; CSS-Selektoren sind daher
fragil. Die Architektur nutzt DOM-Beobachtung nur als **Trigger** ("etwas hat sich
geändert"), nicht als Datenquelle – die eigentlichen, dargestellten Werte kommen
immer aus der dokumentierten, versionsstabilen REST-API. Das hält das Dashboard
robust gegen Frontend-Änderungen des Spiels.

## 4. AAO-Vorschlagslogik

`aao-engine.js` ist bewusst rein lesend: Sie vergleicht offene Einsätze
(`src/shared/aao-rules.json`, Einsatzart → benötigte Fahrzeugtypen/-anzahl) mit
den aktuell freien Fahrzeugen (`fms_status`) und meldet nur, welche Typen noch
fehlen. Es gibt keinen Code-Pfad, der Fahrzeuge automatisch alarmiert oder
Aktionen im Spiel auslöst – die eigentliche Alarmierung bleibt manuell im Spiel.
Das ist eine bewusste Grenze: reines Empfehlungs-Tooling statt Automatisierung
von Spielhandlungen.

## 5. Bekannte Anpassungspunkte vor Produktivbetrieb

- `src/shared/constants.js` → `GAME_DOM_SELECTORS`: gegen eine echte,
  eingeloggte Session im DevTools verifizieren.
- `src/main/api-client.js` → Endpunkt-Pfade/Feldnamen (`/vehicles`, `/missions`)
  gegen die tatsächliche API-Antwort des eigenen Accounts abgleichen.
- `src/main/aao-engine.js` → `AVAILABLE_FMS_STATUS` und die `caption`-Zuordnung
  in `aao-rules.json` an die echten `fms_status`-Werte/Einsatznamen anpassen.
- `BrowserView` gilt ab Electron 30 als deprecated (Ersatz: `WebContentsView`).
  Für dieses Projekt weiterhin nutzbar; beim nächsten Electron-Major-Upgrade
  auf `WebContentsView` migrieren.
