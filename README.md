# 🚒 LSS Dashboard

> Desktop-Dashboard-Erweiterung für das Browsergame [Leitstellenspiel](https://www.leitstellenspiel.de/) —
> Fahrzeug-Status, Einsatz-Monitoring und AAO-Alarmierungsvorschläge auf einen Blick.

[![Lizenz: MIT](https://img.shields.io/badge/Lizenz-MIT-yellow.svg)](./LICENSE)
[![Repo-Struktur](https://img.shields.io/badge/Branches-main%20%7C%20dashboard%20%7C%20tampermonkey-blue)](#-repository-struktur)

---

## 📋 Über dieses Projekt

**LSS Dashboard** ist eine Desktop-Anwendung, die Spielern von Leitstellenspiel
eine übersichtliche, moderne Zusatzoberfläche für ihre Leitstelle bietet: Wie
viele Fahrzeuge sind frei, welche Einsätze sind offen, und welche Fahrzeugtypen
fehlen noch für eine vollständige Alarmierung? Alles in einem aufgeräumten
Dark-Mode-Dashboard statt in mehreren Browser-Tabs.

Dieser `main`-Branch dient als zentrale Übersicht und Lizenz-/Dokumentationsbasis
des Repositories. Die eigentliche Anwendung wird in zwei spezialisierten Branches
entwickelt (siehe unten).

## 🌳 Repository-Struktur

Das Projekt ist bewusst in drei Branches aufgeteilt:

| Branch | Inhalt |
|---|---|
| [`main`](https://github.com/Hudnur111/LSS-Dashboard-/tree/main) | Dieser Branch – Projektübersicht, Lizenz, zentrale Dokumentation. |
| [`dashboard`](https://github.com/Hudnur111/LSS-Dashboard-/tree/dashboard) | Die vollständige Electron-Desktop-App: Dashboard-UI, Demo-Modus, System-Tray, native Benachrichtigungen, Autostart, CSV-Export. Verbindung zum Spiel über einen persönlichen API-Token. |
| [`tampermonkey`](https://github.com/Hudnur111/LSS-Dashboard-/tree/tampermonkey) | Baut auf `dashboard` auf und ergänzt eine Tampermonkey-Bridge: liest die Spieldaten direkt aus dem normalen, bereits eingeloggten Browser – ganz ohne API-Token. |

👉 Zum Ausprobieren direkt in den [`dashboard`-Branch](https://github.com/Hudnur111/LSS-Dashboard-/tree/dashboard)
wechseln und der dortigen `README.md` folgen (Einsteiger:innen-Anleitung per Doppelklick-Start inklusive).

## ✨ Funktionsüberblick

- 🚗 **Fahrzeug-Status**: Übersicht aller Fahrzeuge inkl. FMS-Status, Suche und sortierbare Tabelle
- 🚨 **Einsatz-Monitoring**: offene Einsätze auf einen Blick, mit Live-Badge in der Navigation
- 🧭 **AAO-Alarmierungsvorschläge**: regelbasierter Abgleich freier Fahrzeuge gegen benötigte Fahrzeugtypen je Einsatzart (rein empfehlend, keine Automatisierung)
- 🧪 **Demo-Modus**: sofort nutzbare Beispieldaten vor der ersten echten Verbindung
- 🖥️ **Desktop-Integration**: System-Tray, native Benachrichtigungen, Autostart mit Windows, CSV-Berichtsexport
- 🔌 **Zwei Verbindungswege**: klassischer API-Token (`dashboard`-Branch) oder Tampermonkey-Bridge ohne Token (`tampermonkey`-Branch)

Architektur- und Sicherheitskonzept sind ausführlich in den jeweiligen Branches
dokumentiert (`ARCHITECTURE.md`, `SECURITY.md` im Ordner `desktop-app/`).

## 🤝 Mitwirken

Ideen, Vorschläge oder Bugs gefunden? Ein Issue oder Pull Request ist immer
willkommen.

## 🙏 Mitwirkende & Entstehung

Dieses Projekt entstand als Zusammenarbeit zwischen menschlicher und
KI-gestützter Arbeit:

- **~60 % Eigenanteil** – Idee, Konzept, Umsetzung, Produktentscheidungen, Ausrichtung
  und Review durch [Hudnur111](https://github.com/Hudnur111).
- **~40 % KI-Anteil** – Umsetzung, Architektur-Vorschläge und Dokumentation
  mit Unterstützung von [Claude](https://claude.com/) (Anthropic).

## 📄 Lizenz

Dieses Projekt steht unter der [MIT-Lizenz](./LICENSE).

---

> Made with ❤️ by Hudnur111
