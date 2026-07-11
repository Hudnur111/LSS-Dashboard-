# Tampermonkey-Bridge

Verbindet die Desktop-App mit deiner **echten, normal eingeloggten** Browser-Session
auf leitstellenspiel.de – ohne eingebettetes Login-Fenster in Electron. Ein
Tampermonkey-Skript läuft im Hintergrund deines gewohnten Browser-Tabs, liest die
Fahrzeug-/Einsatzdaten über die offizielle API und schickt sie an eine lokale
HTTP-Schnittstelle, die die Desktop-App auf `127.0.0.1` bereitstellt.

## Warum dieser Weg?

Ein in Electron eingebettetes Login-Fenster (BrowserView) bringt in der Praxis
Probleme mit sich: eigene Session, mögliche Bot-/Automatisierungserkennung,
zweiter gleichzeitiger Login. Die Tampermonkey-Bridge umgeht das komplett – es
gibt nur *eine* Session, nämlich die, in der du sowieso spielst.

## Installation

1. **Tampermonkey installieren** (Chrome, Firefox, Edge – jeweils im offiziellen
   Extension-Store suchen).
2. **Skript installieren**: Tampermonkey-Dashboard öffnen → "Neues Skript" →
   Inhalt von [`lss-dashboard-bridge.user.js`](./lss-dashboard-bridge.user.js)
   einfügen → Speichern. (Alternativ: Datei lokal öffnen, Tampermonkey bietet
   dann direkt "Installieren" an.)
3. **Desktop-App starten** und zu **Einstellungen → Tampermonkey-Bridge**
   wechseln. Dort den **Pairing-Token** kopieren.
4. Auf **leitstellenspiel.de** einloggen (dein normaler Account, normaler Tab).
   Über das Tampermonkey-Icon in der Symbolleiste → **"LSS Dashboard:
   Pairing-Token setzen"** → Token einfügen.
5. Unten rechts auf der Seite erscheint ein kleines Status-Badge. Nach kurzer
   Zeit sollte es auf **"verbunden"** wechseln – die Desktop-App zeigt
   denselben Status in den Einstellungen an.

## Optional: API-Token hinterlegen

Das Skript ruft die API standardmäßig mit deiner normalen Browser-Session auf
(keine zusätzliche Anmeldung nötig). Falls die Konsole `HTTP 401`/`403` zeigt,
über das Tampermonkey-Menü **"LSS Dashboard: API-Token setzen (optional)"**
den persönlichen Bearer-Token aus den Entwicklereinstellungen hinterlegen.

## Sicherheit

- Der Pairing-Token authentifiziert nur die lokale Verbindung Skript ↔ App
  (`127.0.0.1`) – er hat keine Bedeutung gegenüber leitstellenspiel.de selbst.
- Die Desktop-App bindet den Bridge-Server ausschließlich an `127.0.0.1`;
  er ist nie aus dem lokalen Netzwerk erreichbar.
- Das Skript sendet ausschließlich an den in Tampermonkey konfigurierten
  Port/Token und niemals an eine andere Adresse.
- Details: [`../SECURITY.md`](../SECURITY.md), Abschnitt "Tampermonkey-Bridge".

## Bekannte Anpassungspunkte

Wie beim Rest der App sind Endpunkt-Pfade (`/api/v2/vehicles`,
`/api/v2/missions`) und der DOM-Selektor für die Missionsliste unverifizierte
Platzhalter – gegen die tatsächliche API-Antwort/Markup abgleichen (siehe
`../ARCHITECTURE.md`, Abschnitt 5).
