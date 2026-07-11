# LSS Dashboard – Desktop-App (Electron)

Electron-Desktop-Erweiterung für das Browsergame [Leitstellenspiel](https://www.leitstellenspiel.de/):
Dark-Mode-Dashboard mit Fahrzeug-Status, Einsatz-Monitoring und AAO-Alarmierungsvorschlägen,
plus optionaler eingebetteter Spiel-Ansicht.

Architektur- und Sicherheitsdetails: siehe [`ARCHITECTURE.md`](./ARCHITECTURE.md) und
[`SECURITY.md`](./SECURITY.md).

## Entwicklung

```bash
npm install
npm start
```

Beim ersten Start unter **Einstellungen** den persönlichen API-Bearer-Token
hinterlegen (Leitstellenspiel → Account → Entwicklereinstellungen). Der Token
wird ausschließlich verschlüsselt lokal gespeichert (siehe `SECURITY.md`).

Über "Spiel-Ansicht einblenden" kann die echte Spielseite eingebettet
angezeigt werden (eigene, persistente Login-Session).

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
