# Sicherheitskonzept

## Bedrohungsmodell

Diese App verwaltet genau ein sensibles Geheimnis: den persönlichen
API-Bearer-Token des Spielers. Das eigentliche Spiel-Login (Benutzername/Passwort)
läuft ausschließlich auf der echten Leitstellenspiel-Webseite innerhalb der
eingebetteten `BrowserView` – die App selbst sieht diese Zugangsdaten nie, liest
sie nie aus und speichert sie nie.

## Maßnahmen

### Prozess-/Renderer-Isolation
- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` für **alle**
  Fenster/Views (Dashboard und eingebettete Spiel-Ansicht).
- Der Dashboard-Renderer erhält über `contextBridge` nur eine feste,
  whitelisted API (`window.lssAPI`) – kein roher `ipcRenderer`, keine
  Möglichkeit, beliebige IPC-Kanäle zu senden/abzuhören.
- `preload/game-preload.js` ist rein lesend (nur `MutationObserver`), löst
  keine Klicks/Eingaben aus und exponiert nichts in den Seitenkontext der
  Spielwebseite.
- `setWindowOpenHandler` verweigert neue native Fenster; `will-navigate` lässt
  nur Navigation innerhalb von `leitstellenspiel.de` zu (verhindert, dass eine
  kompromittierte/manipulierte Seite die App zu einer Phishing-Domain umleitet).
- Strikte `Content-Security-Policy` im Dashboard-HTML
  (`default-src 'self'`) – keine CDN-Skripte, keine Inline-Script-Ausführung.

### Speicherung des API-Tokens
- Verschlüsselung über Electrons `safeStorage`-API, die auf plattform-eigene
  OS-Schlüsselspeicher zurückgreift (DPAPI unter Windows, Keychain unter
  macOS, libsecret/kwallet unter Linux). Der Klartext-Token verlässt den
  Prozessspeicher nur verschlüsselt auf die Platte.
- Ablageort: `<userData>/secure/token.enc`, Verzeichnis mit `0700`, Datei mit
  `0600` (nur der aktuelle OS-Benutzer kann lesen).
- Die Verschlüsselung ist an das OS-Benutzerkonto gebunden: Eine kopierte
  `token.enc`-Datei ist auf einem anderen Rechner oder unter einem anderen
  Windows-Benutzerkonto **nicht** entschlüsselbar.
- Der Token wird nur im Hauptprozess gehalten (`secure-store.js`); er wird nie
  an den Renderer-Prozess übertragen – Widgets bekommen bereits aufbereitete
  Daten (`vehicle:update`, `aao:suggestions`), nie den Token selbst.
- "Token entfernen" löscht die Datei sofort und unwiderruflich
  (`clearToken()`); es gibt keinen Papierkorb/Undo.

### Spiel-Session (Cookies/Login)
- Läuft in einer eigenen, persistenten Session-Partition
  (`persist:lss-game`), getrennt von der Standard-Session des Dashboards.
- `setPermissionRequestHandler` lehnt alle Browser-Permission-Anfragen
  (Kamera, Mikrofon, Notifications, Standort, …) der eingebetteten Seite ab –
  sie hat keinen legitimen Grund, danach zu fragen.
- Diese Cookie-/Session-Daten unterliegen dem Standard-Schutz von Chromiums
  Cookie-Store (OS-Dateiberechtigungen); sie sind bewusst getrennt von dem
  zusätzlich verschlüsselten API-Token.

### Netzwerk
- Ausgehende API-Aufrufe laufen ausschließlich über HTTPS gegen die
  offizielle `leitstellenspiel.de`-Domain.
- Kein Telemetrie-/Analytics-Traffic an Dritte.

### Distribution/Updates
- Für produktive Releases: Code-Signing des NSIS-/Portable-Builds
  (electron-builder unterstützt `certificateFile`/`certificateSubjectName`)
  empfohlen, damit Windows SmartScreen und Nutzer die Herkunft verifizieren
  können. Dieses Repo liefert die Konfiguration (`electron-builder.yml`),
  das Signing-Zertifikat selbst ist bewusst nicht Teil des Codes.
- `install.bat`/`uninstall.bat` führen keine Netzwerk-Downloads aus – sie
  kopieren nur lokal vorhandene, bereits gebaute Dateien und legen
  Verknüpfungen an.

### Desktop-Integration (Tray, Export, Autostart)
- Der CSV-Export (`export-report.js`) schreibt ausschließlich an einen Pfad,
  den der Nutzer selbst über den nativen Betriebssystem-Speichern-Dialog
  auswählt - kein automatisches Schreiben an einen festen Ort. Enthaltene
  Daten (Fahrzeuge/Einsätze) sind exakt das, was im Dashboard ohnehin sichtbar
  ist; keine Tokens oder Zugangsdaten landen in der Datei.
- Autostart (`app.setLoginItemSettings`) nutzt ausschließlich den
  Standard-Mechanismus des Betriebssystems (Registry-Eintrag unter Windows,
  ohne erhöhte Rechte) und lässt sich jederzeit über dieselbe Checkbox wieder
  deaktivieren.
- Der System-Tray zeigt im Tooltip nur eine Zahl offener Einsätze, keine
  weiteren Details - auch im gesperrten/minimierten Zustand werden keine
  sensiblen Daten außerhalb des Hauptfensters dargestellt.
- Native Desktop-Benachrichtigungen (`notifier.js`) enthalten nur
  Einsatzbezeichnungen, dieselben Informationen, die ohnehin über die
  offizielle API abgerufen wurden - keine zusätzliche Datenquelle.

## Bewusste Nicht-Ziele

- Keine Automatisierung von Spielhandlungen (kein Auto-Alarmieren, keine
  synthetischen Klicks). Die AAO-Engine gibt ausschließlich Empfehlungen aus
  (siehe `ARCHITECTURE.md`, Abschnitt 4).
- Keine Speicherung von Spiel-Zugangsdaten (Benutzername/Passwort) durch diese
  App.

## Verwandter Branch: Tampermonkey-Bridge

Der Branch `tampermonkey` fügt eine zusätzliche lokale HTTP-Schnittstelle
(gebunden an `127.0.0.1`, token-authentifiziert über `crypto.timingSafeEqual`)
für ein Tampermonkey-Userscript hinzu. Das eigene Sicherheitskonzept dafür
steht in der `SECURITY.md` dieses Branches.
