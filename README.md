# Vermieter-Portal (mlz-nebenkosten_easy)

Ein kleines Programm für private Vermieter mit einer oder wenigen Wohnungen. Es läuft auf deinem eigenen Rechner in Docker und speichert alle Daten nur dort.

**Was es kann**

- **Nebenkostenabrechnung**: Kosten aus der Abrechnung der Hausverwaltung eintragen, umlagefähige Posten ankreuzen, Guthaben oder Nachzahlung ausrechnen und als PDF drucken. Jedes Jahr mit „Neues Jahr anlegen“ fortführen.
- **Dokumente**: PDFs (Abrechnung der Hausverwaltung, Heizkosten, Grundsteuer, eigene Abrechnungen …) hochladen und nach Jahr ablegen.
- **Mietvertrag**: Muster-Mietvertrag mit deinen Daten ausfüllen und drucken.
- **Mieterhöhung & Briefe**: Mieterhöhung nach § 558 BGB, neue Nebenkosten-Vorauszahlung nach § 560 BGB oder ein freies Schreiben. Fristen und Kappungsgrenze werden geprüft. Versand per E-Mail oder als Ausdruck.
- **Übersicht**: aktuelle Miete, letztes Abrechnungsergebnis, Fristen und Verlauf.

## Deine Daten bleiben bei dir

Alle Eingaben und Dokumente liegen im Ordner `daten/` neben dieser Anleitung:

```
daten/
├── portal.json        ← die Datenbank (alle Eingaben)
├── dokumente/         ← hochgeladene PDFs
└── sicherungen/       ← automatische Tageskopien der Datenbank (30 Tage)
```

Der Ordner `daten/` und alle `.json`- und `.pdf`-Dateien sind in `.gitignore` eingetragen. Sie landen also nie auf GitHub. Im Code stehen nur erfundene Beispieldaten.

## Starten

Voraussetzung: [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/Mac) oder Docker mit Compose (Linux, NAS).

```bash
git clone https://github.com/flexisticker/mlz-nebenkosten_easy.git
cd mlz-nebenkosten_easy
docker compose up -d --build
```

Dann im Browser öffnen: **http://localhost:8080**

Stoppen mit `docker compose down`. Die Daten bleiben dabei erhalten.

Das Portal ist nur auf diesem Rechner erreichbar. Wenn du es im Heimnetz (z. B. auf einem NAS) von anderen Geräten aus öffnen willst, ändere in `docker-compose.yml` die Zeile `"127.0.0.1:8080:8080"` in `"8080:8080"`. Ins Internet sollte es nicht freigegeben werden, denn es gibt keine Anmeldung.

### Unraid

GitHub baut bei jeder Änderung automatisch ein fertiges Image (`ghcr.io/flexisticker/mlz-nebenkosten-easy:latest`). Für Unraid gibt es eine Vorlage, siehe [docs/INSTALLATION-UNRAID.md](docs/INSTALLATION-UNRAID.md).

### Ohne Docker

Mit installiertem Node.js (ab Version 20) geht es auch direkt: `node server.js`. Die Daten landen dann ebenfalls in `daten/`.

## Vorhandene Daten übernehmen

1. Beim ersten Start auf **„Meine Datensicherung (.json) importieren“** klicken und die Sicherungsdatei der alten Version wählen (z. B. `nebenkosten-daten-2025.json`). Später geht das auch unter **Datensicherung → Sicherung importieren**.
2. Unter **Stammdaten** die neuen Felder ergänzen: Kaltmiete, E-Mail-Adressen, Mietbeginn, Bankverbindung.
3. Unter **Nebenkosten** die Einleitung prüfen. Die alte Version hatte den Namen der Hausverwaltung fest im Text, jetzt steht er in einem eigenen Feld.
4. Unter **Dokumente** die PDFs hochladen (Jahr und Art auswählen, dann Dateien hineinziehen).

## Aktualisieren

```bash
git pull
docker compose up -d --build
```

## Sichern

- Unter **Datensicherung** kannst du jederzeit eine `.json`-Datei herunterladen.
- Am besten zusätzlich den ganzen Ordner `daten/` regelmäßig auf einen USB-Stick oder ein NAS kopieren. Darin sind auch die Dokumente.

## Rechtlicher Hinweis

Mietvertrag und Schreiben sind Muster ohne Gewähr und ersetzen keine Rechtsberatung. Lass sie vor der ersten Verwendung prüfen, zum Beispiel von Haus & Grund.

## Technik

- `server.js`: kleiner Node.js-Server ohne zusätzliche Pakete. Liefert die Oberfläche aus und speichert die Daten.
- `public/`: Oberfläche (HTML, CSS, JavaScript).
- `Dockerfile`, `docker-compose.yml`: Container für den Betrieb.
