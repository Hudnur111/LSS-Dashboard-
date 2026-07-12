# Architektur – LSS Dashboard (Electron)

## 1. Tech-Stack

| Bereich | Wahl | Begründung |
|---|---|---|
| Runtime | Electron 31 (Chromium + Node.js) | Einziger Weg, ein natives Fenster + eine echte, eingeloggte Instanz der Webseite im selben Prozessbaum zu betreiben. |
| Hauptprozess | Node.js (CommonJS) | Fensterverwaltung, IPC, Secure Storage, API-Client, Polling. Kein Zugriff durch Renderer. |
| Renderer (Dashboard) | Vanilla HTML/CSS/JS, kein Framework | Kleine, prüfbare Angriffsfläche; keine Build-Pipeline nötig. Bei wachsendem UI-Umfang später React/Svelte nachziehbar, ohne die IPC-Architektur zu ändern. |
| Styling | Eigenes CSS (Dark Mode), **keine CDN-Skripte** | Das ursprüngliche `index.html`-Prototyp lud Tailwind/FontAwesome von CDN. In einer Desktop-App ist das ein Sicherheits- und Offline-Risiko (Remote-Code-Abhängigkeit, CSP-Konflikt) – deshalb lokal gebündelt. |
| Spiel-Anbindung (primär) | **Tampermonkey-Userscript** im normalen Browser des Spielers | Läuft in der echten, bereits eingeloggten Session – kein zweiter Login, keine Bot-/Automatisierungserkennung durch ein eingebettetes Fenster. Siehe `tampermonkey/`. |
| Spiel-Anbindung (optional) | `BrowserView` mit eigener Session-Partition (`persist:lss-game`) | Rein optionale Live-Ansicht der Spielseite im Dashboard-Fenster; nicht mehr der primäre Datenweg (siehe Abschnitt 6). |
| Bridge-Transport | Lokaler HTTP-Server (Node `http`, nur `127.0.0.1`) + `GM_xmlhttpRequest` | Kein zusätzliches npm-Paket nötig; `GM_xmlhttpRequest` umgeht CORS/CSP der Zielseite, der Server bindet bewusst nie an `0.0.0.0`. Siehe Abschnitt 6. |
| Datenquelle | Offizielle Leitstellenspiel-API v2 (Bearer-Token **oder** Browser-Session-Cookies) | Stabiler Vertrag statt brüchigem HTML-Scraping als primäre Quelle. Das Tampermonkey-Skript nutzt die Session-Cookies automatisch; der Bearer-Token bleibt als Fallback/für den reinen API-Polling-Modus ohne Tampermonkey nutzbar. |
| Live-Signal | `MutationObserver` (in `preload/game-preload.js` bzw. im Userscript) | Beobachtet nur, ob sich die Missionsliste im DOM ändert, und löst dadurch eine sofortige Neu-Erfassung aus – keine Interpretation von Spiel-HTML als Wahrheit. |
| Storage (Session/API-Token/Bridge-Token) | `safeStorage` (Electron, OS-Schlüsselbund) | Siehe SECURITY.md. |
| Packaging | `electron-builder` (NSIS + Portable) | Standard für professionelle Windows-Distribution, Code-Signing-fähig. |
| Erst-Installation | `installer/install.bat` + `create-shortcut.ps1` | Einfache End-User-Experience für die portable Variante: kopiert nach `%LOCALAPPDATA%`, erstellt Verknüpfungen, startet die App. |
| Erststart für Entwickler-Setup | `Start-Dashboard.bat` | Für Nutzer, die aus dem Quellordner starten statt einen fertigen Build zu installieren: prüft Node.js, führt `npm install`/`npm start` selbst aus – kein Terminal/keine Befehle nötig. Siehe Abschnitt 7. |
| Desktop-Integration | `Tray` + `Notification` (Electron, kein npm-Zusatzpaket) | System-Tray statt Beenden beim Schließen, native Windows-Benachrichtigungen für neue Einsätze, Autostart via `app.setLoginItemSettings`. Siehe Abschnitt 8. |

## 2. Prozess- und Modul-Struktur

```
desktop-app/
├── main.js                      # App-Bootstrap, Fenster-Erzeugung, globale Hardening-Regeln
├── preload/
│   ├── dashboard-preload.js     # contextBridge-API "window.lssAPI" für das Dashboard-Fenster
│   └── game-preload.js          # Read-only DOM-Beobachter für die eingebettete Spiel-BrowserView
├── src/
│   ├── main/
│   │   ├── windows.js             # Dashboard-BrowserWindow + optionale Spiel-BrowserView, Layout/Resize
│   │   ├── ipc.js                  # Alle ipcMain-Handler, Polling-Loop, Verdrahtung Renderer <-> Backend
│   │   ├── secure-store.js         # Verschlüsselte Ablage des API-Tokens (safeStorage)
│   │   ├── bridge-token-store.js   # Verschlüsselte Ablage des Tampermonkey-Pairing-Tokens (safeStorage)
│   │   ├── bridge-server.js        # Lokaler HTTP-Server (127.0.0.1) für die Tampermonkey-Bridge
│   │   ├── game-data-hub.js        # Gemeinsamer Publish-Pfad für Polling- und Bridge-Daten -> Renderer + Tray/Notifier
│   │   ├── tray.js                 # System-Tray-Symbol, Kontextmenü, Tooltip mit offenen Einsätzen
│   │   ├── notifier.js             # Native OS-Benachrichtigungen bei neuen Einsätzen (nur wenn Fenster unfokussiert)
│   │   ├── export-report.js        # CSV-Berichtsexport (Fahrzeuge + Einsätze) über nativen Speichern-Dialog
│   │   ├── api-client.js           # HTTP-Client für die offizielle LSS-API
│   │   └── aao-engine.js           # Regelbasierte AAO-Vorschlagslogik (rein lesend)
│   ├── renderer/
│   │   ├── index.html            # Dashboard-UI (Übersicht, Fahrzeuge, AAO, Einstellungen)
│   │   ├── styles/dashboard.css  # Dark-Mode-Theme
│   │   └── scripts/dashboard.js  # UI-Logik, konsumiert ausschließlich window.lssAPI
│   └── shared/
│       ├── constants.js          # IPC-Kanalnamen, Game-URL, Bridge-Host/Port, DOM-Selektoren (single source of truth)
│       └── aao-rules.json        # Konfigurierbares AAO-Regelwerk (Einsatzart -> Fahrzeugtypen)
├── tampermonkey/
│   ├── lss-dashboard-bridge.user.js  # Userscript: liest Spieldaten, sendet an bridge-server.js
│   └── README.md                     # Installations-/Pairing-Anleitung
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
- `tampermonkey/lss-dashboard-bridge.user.js` → `/api/v2/vehicles`,
  `/api/v2/missions` und der DOM-Selektor der Missionsliste sind dieselben
  unverifizierten Platzhalter wie oben – im echten Browser mit DevTools
  gegenprüfen.

## 6. Tampermonkey-Bridge: warum kein eingebettetes Login?

Ein per `BrowserView` eingebettetes Login-Fenster hat sich als unzuverlässig
erwiesen (eigene, von der normalen Browser-Session getrennte Cookies; die
Spielseite kann eine Electron-`WebContents` potenziell anders behandeln als
einen gewöhnlichen Chrome/Firefox-Tab). Die Lösung: Datenerfassung komplett
aus dem Browser heraus, in dem der Spieler ohnehin schon eingeloggt ist.

**Ablauf:**

1. `bridge-server.js` startet beim App-Start einen reinen Node-`http`-Server,
   gebunden ausschließlich an `127.0.0.1:17845` (nie `0.0.0.0`) – siehe
   `BRIDGE_HOST`/`BRIDGE_PORT` in `src/shared/constants.js`.
2. `bridge-token-store.js` erzeugt beim ersten Start ein zufälliges
   Pairing-Token (`crypto.randomBytes(24)`), verschlüsselt via `safeStorage`
   abgelegt – analog zum API-Token in `secure-store.js`. Einstellungen zeigt
   dieses Token zum Kopieren an.
3. Der Spieler installiert `tampermonkey/lss-dashboard-bridge.user.js` in
   seinem normalen Browser und hinterlegt das Pairing-Token einmalig über das
   Tampermonkey-Menü (`GM_setValue`, browserseitig gespeichert - nie im
   Klartext im Seiten-DOM).
4. Das Userscript ruft periodisch (alle 15s, zusätzlich sofort bei
   DOM-Änderungen an der Missionsliste) die offizielle API auf – authentifiziert
   über die reale Session-Cookies des Browsers via `GM_xmlhttpRequest`
   (bypasst CORS/CSP der Zielseite; ein optionaler Bearer-Token dient nur als
   Fallback, falls Cookie-Auth abgelehnt wird).
5. Ergebnis wird per `POST /ingest` mit Header `X-Bridge-Token` an
   `bridge-server.js` geschickt. Der Server vergleicht das Token
   zeitkonstant (`crypto.timingSafeEqual`, siehe SECURITY.md) und reicht die
   Nutzlast bei Erfolg an `game-data-hub.js` weiter.
6. `game-data-hub.js` ist der gemeinsame Fan-out-Punkt für **beide**
   Datenquellen (API-Token-Polling in `ipc.js` **und** Bridge-Ingest) – so
   existiert die AAO-Berechnung nur an einer Stelle, unabhängig davon, woher
   die Daten kamen.
7. Einstellungen → Tampermonkey-Bridge zeigt den Verbindungsstatus
   (`bridge:status`, alle 15s aktualisiert, "getrennt" nach 60s Funkstille)
   und erlaubt das Neugenerieren des Pairing-Tokens.

Der API-Token-Polling-Pfad (`ipc.js`/`api-client.js`) bleibt vollständig
erhalten und funktioniert unabhängig von der Bridge – wer kein Tampermonkey
nutzen möchte, kann weiterhin nur mit dem Bearer-Token arbeiten.

## 7. UI-Politur: Demo-Modus, Benachrichtigungen, Animationen

Rein clientseitig in `src/renderer/scripts/dashboard.js`/`dashboard.css`,
ohne zusätzliche Abhängigkeiten:

- **Demo-Modus**: Ist beim Start weder ein API-Token noch eine verbundene
  Bridge vorhanden, lädt die App automatisch Beispieldaten (`DEMO_VEHICLES`/
  `DEMO_MISSIONS`/`DEMO_SUGGESTIONS`) statt eines leeren Bildschirms, gut
  sichtbar über ein Banner markiert. Sobald `game:data` vom Backend eintrifft,
  wird der Demo-Modus automatisch beendet (`subscribeToBackend()`). Manuell
  über Einstellungen → Demo-Modus jederzeit ein-/ausschaltbar.
- **Toast-Benachrichtigungen** (`showToast()`): für Token gespeichert/entfernt,
  Bridge verbunden/getrennt, neuer Einsatz erkannt, Token kopiert.
- **AAO-Badge** in der Navigation: zeigt die Anzahl offener (nicht vollständig
  alarmierbarer) Einsätze direkt neben "AAO-Vorschläge" an.
- **Fahrzeug-Suche**: clientseitiger Filter über Name/Typ, keine Server-Anfrage.
- **Zähl-Animation** (`animateCount()`) für die Übersichts-Widgets sowie
  Skeleton-Loading-Zustand, bis die erste Datenlieferung eintrifft.
- Reine CSS-Animationen für View-Wechsel, Status-Punkt-Puls, Karten-Hover –
  alle über `prefers-reduced-motion` deaktivierbar (Barrierefreiheit).

Bewusst nicht verwendet: keine Chart-/Animation-Bibliothek, kein CSS-Framework
– konsistent mit der "keine CDN-Skripte, minimale Abhängigkeiten"-Entscheidung
aus Abschnitt 1.

## 8. Desktop-Integration: Tray, Benachrichtigungen, Autostart, Export

- **System-Tray statt Beenden** (`main.js`, `tray.js`): Das Schließen des
  Fensters (X-Button) ruft `event.preventDefault()` in einem `close`-Handler
  auf und versteckt das Fenster nur (`hide()`), statt den Prozess zu beenden -
  Polling-Loop und Bridge-Server laufen unbeeinträchtigt weiter. Einziger
  echter Beenden-Weg ist "Beenden" im Tray-Kontextmenü, das `app.isQuitting`
  setzt; nur dann lässt der `close`-Handler das eigentliche Schließen zu.
  Tray-Icon fällt auf ein eingebettetes 1x1-Platzhalterbild zurück, falls kein
  `build/icon.png` existiert (siehe `build/README.md`).
- **Native Benachrichtigungen** (`notifier.js`): Bei neu erkannten Einsätzen
  (Vergleich gegen die vorherige Missions-ID-Menge) zeigt Electrons
  `Notification`-API einen System-Hinweis - aber nur, wenn das Dashboard-
  Fenster gerade *nicht* fokussiert ist (der In-App-Toast deckt den
  fokussierten Fall bereits ab) und nicht beim allerersten Snapshot nach
  Start/Demo-Ende (sonst würde jeder bereits offene Einsatz fälschlich als
  "neu" gemeldet).
- **Autostart mit Windows** (`ipc.js` `AUTOSTART_GET`/`AUTOSTART_SET`):
  dünner Wrapper um `app.setLoginItemSettings()`. Greift nur in einem
  gepackten/installierten Build, nicht bei `electron .` aus dem Quellordner.
- **CSV-Berichtsexport** (`export-report.js`): schreibt Fahrzeuge und
  Einsätze aus dem zuletzt bekannten Snapshot (`game-data-hub.getLastSnapshot()`)
  als zwei CSV-Abschnitte in eine vom Nutzer gewählte Datei (nativer
  Speichern-Dialog). UTF-8-BOM vorangestellt, damit Excel unter Windows
  Umlaute korrekt anzeigt statt sie als Kauderwelsch zu interpretieren.
- Alle vier Features hängen an `game-data-hub.onPublish()` bzw. eigenen
  IPC-Handlern und benötigen keine zusätzlichen npm-Abhängigkeiten.
