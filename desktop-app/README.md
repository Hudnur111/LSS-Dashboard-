# LSS Dashboard – Desktop-App (Electron)

Electron-Desktop-Erweiterung für das Browsergame [Leitstellenspiel](https://www.leitstellenspiel.de/):
Dark-Mode-Dashboard mit Fahrzeug-Status, Einsatz-Monitoring, AAO-Alarmierungsvorschlägen,
Demo-Modus, System-Tray-Integration mit nativen Benachrichtigungen, CSV-Berichtsexport,
Autostart mit Windows und optionaler eingebetteter Spiel-Ansicht.

Architektur- und Sicherheitsdetails: siehe [`ARCHITECTURE.md`](./ARCHITECTURE.md) und
[`SECURITY.md`](./SECURITY.md).

## 🚀 Schnellstart (auch ohne Vorkenntnisse)

Kein Terminal, keine Kommandozeile nötig:

1. Falls noch nicht vorhanden: [Node.js](https://nodejs.org/de/download) installieren
   (einmalig, wie jedes normale Windows-Programm – "LTS"-Version, alle Standardwerte
   übernehmen).
2. Doppelklick auf **[`Start-Dashboard.bat`](./Start-Dashboard.bat)**.

Das war's. Beim allerersten Start richtet sich die App automatisch ein (einmalig,
braucht eine Internetverbindung und ein paar Minuten); danach öffnet sie sich bei
jedem weiteren Doppelklick sofort. Direkt nach dem Start zeigt das Dashboard
Beispieldaten (Demo-Modus) – die eigene Spielverbindung wird separat unter
"Verbindung zum Spiel herstellen" (siehe unten) eingerichtet.

## Entwicklung (für Entwickler)

```bash
npm install
npm start
```

### Verbindung zum Spiel herstellen

Unter **Einstellungen** den persönlichen API-Bearer-Token hinterlegen
(Leitstellenspiel → Account → Entwicklereinstellungen). Der Token wird
ausschließlich verschlüsselt lokal gespeichert (siehe `SECURITY.md`).

> Alternative Anbindung ohne API-Token: Der Branch `tampermonkey` dieses
> Repos baut auf diesem Branch auf und ergänzt eine Tampermonkey-Bridge, die
> die Daten direkt aus deinem normalen, bereits eingeloggten Browser liest.

Über "Spiel-Ansicht einblenden" kann zusätzlich die echte Spielseite optisch
eingebettet angezeigt werden (eigene, persistente Login-Session) – das ist
aber nur eine Sichtansicht, kein Datenweg.

### Weitere Funktionen

- **System-Tray**: Schließen des Fensters minimiert nur in die Taskleiste;
  das API-Polling läuft weiter. Über das Tray-Symbol wieder öffnen oder
  vollständig beenden.
- **Native Benachrichtigungen** bei neuen Einsätzen, wenn das Fenster gerade
  nicht im Fokus ist.
- **Autostart mit Windows** (Einstellungen → Desktop-Integration).
- **Bericht exportieren** (Fahrzeuge-Ansicht): speichert Fahrzeuge und
  Einsätze als CSV-Datei über einen nativen Speichern-Dialog.
- **Sortierbare Fahrzeugtabelle**: Spaltenüberschriften anklicken zum Sortieren.

## Build (Windows-Installer/Portable)

```bash
npm run build:win
```

Erzeugt in `dist/` sowohl einen NSIS-Installer als auch eine portable `.exe`.
Für die portable Variante: `dist/LSS Dashboard.exe` zusammen mit
`installer/install.bat` und `installer/create-shortcut.ps1` in einen Ordner
legen und an Endnutzer verteilen – `install.bat` kopiert die App nach
`%LOCALAPPDATA%` und legt Desktop-/Startmenü-Verknüpfungen an.

## Bekannte Anpassungspunkte

Diese App wurde als Architektur-Grundgerüst aufgebaut. Vor Produktivbetrieb
unbedingt gegen eine echte, eingeloggte Session prüfen und anpassen (Details
in `ARCHITECTURE.md`, Abschnitt 5):

- DOM-Selektoren für die Missionsliste (`src/shared/constants.js`)
- API-Endpunkte/Feldnamen (`src/main/api-client.js`)
- FMS-Status-Codes und AAO-Regelwerk (`src/main/aao-engine.js`,
  `src/shared/aao-rules.json`)
