# Architektur – LSS Dashboard (Electron)

## 1. Tech-Stack

| Bereich | Wahl | Begründung |
|---|---|---|
| Runtime | Electron 31 (Chromium + Node.js) | Einziger Weg, ein natives Fenster + eine echte, eingeloggte Instanz der Webseite im selben Prozessbaum zu betreiben. |
| Hauptprozess | Node.js (CommonJS) | Fensterverwaltung, IPC, Secure Storage, API-Client, Polling. Kein Zugriff durch Renderer. |
| Renderer (Dashboard) | Vanilla HTML/CSS/JS, kein Framework | Kleine, prüfbare Angriffsfläche; keine Build-Pipeline nötig. Bei wachsendem UI-Umfang später React/Svelte nachziehbar, ohne die IPC-Architektur zu ändern. |
| Styling | Eigenes CSS (Dark Mode), **keine CDN-Skripte** | Das ursprüngliche `index.html`-Prototyp lud Tailwind/FontAwesome von CDN. In einer Desktop-App ist das ein Sicherheits- und Offline-Risiko (Remote-Code-Abhängigkeit, CSP-Konflikt) – deshalb lokal gebündelt. |
| Spiel-Anbindung | `BrowserView` mit eigener Session-Partition (`persist:lss-game`) | Optionale Live-Ansicht der echten Spielseite im Dashboard-Fenster, getrennt vom Dashboard-Fenster selbst. Login läuft ausschließlich auf der echten Seite. |
| Datenquelle | Offizielle Leitstellenspiel-API v2 (Bearer-Token) | Stabiler Vertrag statt brüchigem HTML-Scraping. |
| Live-Signal | `MutationObserver` in `preload/game-preload.js` | Beobachtet nur, ob sich die Missionsliste im DOM ändert, und löst dadurch einen sofortigen API-Poll aus – keine Interpretation von Spiel-HTML als Wahrheit. |
| Storage (Session/API-Token) | `safeStorage` (Electron, OS-Schlüsselbund) | Siehe SECURITY.md. |
| Packaging | `electron-builder` (NSIS + Portable) | Standard für professionelle Windows-Distribution, Code-Signing-fähig. |
| Erst-Installation | `installer/install.bat` + `create-shortcut.ps1` | Einfache End-User-Experience für die portable Variante: kopiert nach `%LOCALAPPDATA%`, erstellt Verknüpfungen, startet die App. |
| Erststart für Entwickler-Setup | `Start-Dashboard.bat` | Für Nutzer, die aus dem Quellordner starten statt einen fertigen Build zu installieren: prüft Node.js, führt `npm install`/`npm start` selbst aus – kein Terminal/keine Befehle nötig. Siehe Abschnitt 6. |
| Desktop-Integration | `Tray` + `Notification` (Electron, kein npm-Zusatzpaket) | System-Tray statt Beenden beim Schließen, native Windows-Benachrichtigungen für neue Einsätze, Autostart via `app.setLoginItemSettings`. Siehe Abschnitt 7. |
| Testing | Node-eingebauter Test-Runner (`node --test`), kein Testframework als Abhängigkeit | Deckt die reine Logik ab (`aao-engine`, `game-data-hub`, `report-formatter`), die ohne laufendes Electron testbar ist. Siehe Abschnitt 9. |

## 2. Prozess- und Modul-Struktur

```
desktop-app/
├── main.js                      # App-Bootstrap, Fenster-Erzeugung, globale Hardening-Regeln
├── preload/
│   ├── dashboard-preload.js     # contextBridge-API "window.lssAPI" für das Dashboard-Fenster
│   └── game-preload.js          # Read-only DOM-Beobachter für die eingebettete Spiel-BrowserView
├── src/
│   ├── main/
│   │   ├── windows.js           # Dashboard-BrowserWindow + optionale Spiel-BrowserView, Layout/Resize
│   │   ├── window-state.js       # Merkt sich Fenstergröße/-position zwischen Starts
│   │   ├── ipc.js                # Alle ipcMain-Handler, Polling-Loop, Verdrahtung Renderer <-> Backend
│   │   ├── secure-store.js       # Verschlüsselte Ablage des API-Tokens (safeStorage)
│   │   ├── game-data-hub.js      # Gemeinsamer Publish-Pfad für Polling-Daten -> Renderer + Tray/Notifier
│   │   ├── tray.js               # System-Tray-Symbol, Kontextmenü, Tooltip mit offenen Einsätzen
│   │   ├── notifier.js           # Native OS-Benachrichtigungen bei neuen Einsätzen (nur wenn Fenster unfokussiert)
│   │   ├── export-report.js      # Electron-I/O für den CSV-Export (Speichern-Dialog + Datei schreiben)
│   │   ├── report-formatter.js   # Reine CSV-Formatierungslogik, unabhängig von Electron (getestet)
│   │   ├── api-client.js         # HTTP-Client für die offizielle LSS-API (10s-Timeout, getestet)
│   │   ├── poll-backoff.js       # Reine Backoff-Berechnung fürs Polling-Intervall (getestet)
│   │   └── aao-engine.js         # Regelbasierte AAO-Vorschlagslogik (rein lesend, getestet)
│   ├── renderer/
│   │   ├── index.html            # Dashboard-UI (Übersicht, Fahrzeuge, AAO, Einstellungen)
│   │   ├── styles/dashboard.css  # Dark-Mode-Theme
│   │   └── scripts/dashboard.js  # UI-Logik, konsumiert ausschließlich window.lssAPI
│   └── shared/
│       ├── constants.js          # IPC-Kanalnamen, Game-URL, DOM-Selektoren (single source of truth)
│       └── aao-rules.json        # Konfigurierbares AAO-Regelwerk (Einsatzart -> Fahrzeugtypen)
├── test/                          # node --test - siehe Abschnitt 9
│   ├── aao-engine.test.js
│   ├── game-data-hub.test.js
│   └── report-formatter.test.js
├── installer/
│   ├── install.bat / uninstall.bat
│   └── create-shortcut.ps1
└── electron-builder.yml
```

### Datenfluss

1. `secure-store.js` liefert den gespeicherten API-Token an `ipc.js`.
2. `ipc.js` pollt alle 20s `api-client.js` (offizielle API) und übergibt das
   Ergebnis an `game-data-hub.js`.
3. `game-data-hub.js` ist der zentrale Fan-out-Punkt: schickt `vehicle:update`,
   `game:data` und die daraus berechneten `aao:suggestions` per
   `webContents.send` an das Dashboard-Fenster, und benachrichtigt zusätzlich
   alle über `onPublish()` registrierten Abonnenten (Tray-Tooltip, native
   Benachrichtigungen, CSV-Export) – so existiert die AAO-Berechnung nur an
   einer Stelle.
4. Optional macht der Spieler die eingebettete Spiel-Ansicht sichtbar
   (`game:view-toggle`). Deren `game-preload.js` meldet per `MutationObserver`
   Änderungen an der Missionsliste über `game:raw-event` an den Hauptprozess,
   der daraufhin **sofort** neu pollt (`pollOnce`), statt auf den 20s-Zyklus zu warten.
5. `dashboard-preload.js` exponiert nur eine feste, whitelisted Methodenliste
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

## 6. UI-Politur: Demo-Modus, Benachrichtigungen, Animationen

Rein clientseitig in `src/renderer/scripts/dashboard.js`/`dashboard.css`,
ohne zusätzliche Abhängigkeiten:

- **Demo-Modus**: Ist beim Start kein API-Token vorhanden, lädt die App
  automatisch Beispieldaten (`DEMO_VEHICLES`/`DEMO_MISSIONS`/`DEMO_SUGGESTIONS`)
  statt eines leeren Bildschirms, gut sichtbar über ein Banner markiert.
  Sobald `game:data` vom Backend eintrifft, wird der Demo-Modus automatisch
  beendet (`subscribeToBackend()`). Manuell über Einstellungen → Demo-Modus
  jederzeit ein-/ausschaltbar.
- **Toast-Benachrichtigungen** (`showToast()`): für Token gespeichert/entfernt,
  neuer Einsatz erkannt, Bericht exportiert.
- **AAO-Badge** in der Navigation: zeigt die Anzahl offener (nicht vollständig
  alarmierbarer) Einsätze direkt neben "AAO-Vorschläge" an.
- **Fahrzeug-Suche + Sortierung**: clientseitiger Filter über Name/Typ und
  klickbare, sortierbare Spaltenüberschriften – keine Server-Anfrage.
- **Zähl-Animation** (`animateCount()`) für die Übersichts-Widgets sowie
  Skeleton-Loading-Zustand, bis die erste Datenlieferung eintrifft.
- Reine CSS-Animationen für View-Wechsel, Karten-Hover –
  alle über `prefers-reduced-motion` deaktivierbar (Barrierefreiheit).
- **Barrierefreiheit**: sichtbarer `:focus-visible`-Ring in Akzentfarbe (der
  dunkle Hintergrund verschluckt sonst den Standard-Fokusring der meisten
  Browser), `aria-current="page"` auf dem aktiven Navigationspunkt,
  `aria-live="polite"` auf dem Toast-Container.

Bewusst nicht verwendet: keine Chart-/Animation-Bibliothek, kein CSS-Framework
– konsistent mit der "keine CDN-Skripte, minimale Abhängigkeiten"-Entscheidung
aus Abschnitt 1.

## 7. Desktop-Integration: Tray, Benachrichtigungen, Autostart, Export

- **System-Tray statt Beenden** (`main.js`, `tray.js`): Das Schließen des
  Fensters (X-Button) ruft `event.preventDefault()` in einem `close`-Handler
  auf und versteckt das Fenster nur (`hide()`), statt den Prozess zu beenden -
  der Polling-Loop läuft unbeeinträchtigt weiter. Einziger echter
  Beenden-Weg ist "Beenden" im Tray-Kontextmenü, das `app.isQuitting` setzt;
  nur dann lässt der `close`-Handler das eigentliche Schließen zu. Tray-Icon
  fällt auf ein eingebettetes 1x1-Platzhalterbild zurück, falls kein
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
- **Fensterzustand merken** (`window-state.js`): Größe/Position werden beim
  Verschieben/Resizen debounced (500ms) nach `<userData>/window-state.json`
  geschrieben und beim nächsten Start wiederhergestellt. Liegt die gespeicherte
  Position außerhalb aller aktuell angeschlossenen Bildschirme (z. B. nach dem
  Abstecken eines externen Monitors), wird auf die Standardgröße/-position
  zurückgefallen, statt ein unerreichbares Fenster zu öffnen.
- **Verbindungsstatus sichtbar machen** (`ipc.js`/`game-data-hub.js`): Schlägt
  das API-Polling fehl, meldet `ipc.js` das über den neuen `poll:status`-Kanal
  an den Renderer - dieser zeigt ein rotes Banner plus Toast
  ("Verbindung zur API fehlgeschlagen") an. Nur die *erste* Fehlermeldung
  einer Fehlerserie wird gesendet (kein Flackern alle 20s); bei Erfolg nach
  einer Fehlerserie erscheint einmalig "Verbindung wiederhergestellt". Vorher
  verschwanden Polling-Fehler stillschweigend im Log, ohne dass der Nutzer es
  bemerkt hätte.

## 8. Verwandter Branch: Tampermonkey-Bridge

Der Branch `tampermonkey` baut auf diesem Branch auf und ergänzt eine
alternative Datenquelle: ein Tampermonkey-Userscript, das im normalen,
bereits eingeloggten Browser des Spielers läuft und die Daten lokal an eine
zusätzliche HTTP-Schnittstelle dieser App sendet – ohne eingebettetes
Login-Fenster. Details dort in `ARCHITECTURE.md`, Abschnitt 6-8.

## 9. Tests

`npm test` führt `node --test` aus (Node.js' eingebauter Test-Runner, keine
zusätzliche Abhängigkeit). Getestet wird ausschließlich reine Logik, die ohne
laufendes Electron auskommt:

- `test/aao-engine.test.js` – AAO-Vorschlagslogik: fehlende Fahrzeugtypen,
  vollständige Alarmierbarkeit, `fms_status`-Filterung, Reservierung über
  mehrere Einsätze hinweg, Fallback-Regel.
- `test/game-data-hub.test.js` – Publish-Pfad: IPC-Kanalreihenfolge,
  Verhalten bei zerstörtem Fenster, `onPublish()`-Abonnements inkl.
  Fehlerisolation zwischen Listenern, `getLastSnapshot()`.
- `test/report-formatter.test.js` – CSV-Escaping (Semikolons, Anführungszeichen,
  Zeilenumbrüche), Berichtsinhalt inkl. BOM, Dateinamensformat.
- `test/api-client.test.js` – HTTP-Client gegen einen gemockten `global.fetch`:
  Erfolgsfall, HTTP-Fehlerstatus, Timeout/Abort-Übersetzung, sonstige
  Netzwerkfehler.
- `test/poll-backoff.test.js` – Backoff-Berechnung: Basisintervall,
  Verdopplung pro Fehlversuch, Deckelung bei 5 Minuten.

Module mit direkter Electron-Abhängigkeit (`ipc.js`, `windows.js`, `tray.js`,
`main.js`, `secure-store.js`, …) sind bewusst nicht unit-getestet - dafür
bräuchte es einen laufenden Electron-Prozess (z. B. über Playwrights
Electron-Unterstützung); das bleibt manuellem/End-to-End-Testen vorbehalten.
Reine Logik, die diese Module benötigen (CSV-Formatierung, Backoff-Berechnung),
wird deshalb konsequent in eigene, Electron-freie Module ausgelagert
(`report-formatter.js`, `poll-backoff.js`) statt in den Electron-Wrappern
selbst zu leben - das hält sie testbar, auch wenn `electron` gerade nicht
installiert ist.

Eine GitHub-Actions-Pipeline (`.github/workflows/test.yml`) führt `npm test`
bei jedem Push/PR auf `main`, `dashboard` und `tampermonkey` automatisch aus.

## 10. Resilienz: Netzwerk-Timeout und Backoff

- `api-client.js`: Jede API-Anfrage hat ein 10-Sekunden-Timeout
  (`AbortController`). Ohne das könnte eine hängende Verbindung
  `pollOnce()` unbegrenzt blockieren, da `ipc.js` beide Anfragen abwartet,
  bevor der nächste Poll geplant wird - ein einziger hängender Request hätte
  sonst das gesamte weitere Polling lautlos gestoppt.
- `poll-backoff.js`: Nach wiederholten Fehlschlägen verdoppelt sich das
  Poll-Intervall (20s → 40s → 80s → … ), gedeckelt bei 5 Minuten, statt eine
  erkennbar down API alle 20s weiter anzufragen. `ipc.js` plant den nächsten
  Poll deshalb über eine sich selbst neu terminierende `setTimeout`-Kette
  statt eines festen `setInterval`.
- `ipc.js` (`TOKEN_CLEAR`-Handler): Entfernt der Nutzer den API-Token, wird
  zusätzlich ein `poll:status`-Erfolgssignal gesendet, das ein eventuell noch
  sichtbares Fehler-Banner löscht - sonst hätte "Verbindung fehlgeschlagen"
  weiter angezeigt, obwohl gar kein Polling mehr läuft. Der Renderer lädt in
  diesem Fall zusätzlich wieder die Demo-Daten (`dashboard.js`), statt die
  zuletzt bekannten echten Daten eingefroren stehen zu lassen.
