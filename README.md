# Hat Raffle 🎩

Gewinnspiel für den Messestand: Besucher scannen ihren Ausweis mit einem Barcode-/QR-Scanner.
Ist die Teilnehmernummer eine **Primzahl**, gewinnt die Person einen roten Hut – mit Konfetti
und fliegenden Hüten. Jeder Ausweis kann nur einmal teilnehmen.

Läuft komplett im Browser (Angular), optional mit einem kleinen Node-Backend, das alle
gescannten Codes speichert.

## Features

- **Kiosk-Ansicht** (`/#/`) im Red-Hat-Look (Red Hat Display/Text, #EE0000, Schwarz/Weiß)
- **Barcode-Scanner als Tastatur**: schnelle Eingabe + Enter wird als Scan erkannt, normales Tippen wird ignoriert
- **Duplikaterkennung**: bereits gescannte Ausweise werden nicht erneut gezählt, es erscheint ein Hinweis
- **Gewinnanimation**: Hut fliegt ein, Konfetti in Red-Hat-Farben, Hüte regnen vom Himmel
- **Idle-/Attract-Modus**: nach X Sekunden ohne Scan läuft eine Animation, die Besucher an den Stand lockt
- **Hut-Kontingent**: optional begrenzte Anzahl Hüte, danach „alle Hüte vergeben“
- **Config-Seite** (`/#/config`, wie bei [bashbrawl](https://github.com/jggoebel/bashbrawl)):
  Backend-URL, API-Key, Stationsname, Gewinnregel, Hut-Anzahl, Timings, Sprache (DE/EN),
  Healthcheck, Scanner-Test, Liste aller erfassten Codes, CSV-Export
- **Backend** ohne Abhängigkeiten (`server/server.mjs`): speichert alle Scans als JSON-Datei

## Schnellstart am Stand (ein Laptop)

```bash
npm ci
npm run start:booth          # baut das Frontend und startet das Backend auf Port 3000
```

Dann <http://localhost:3000> im Browser (Vollbild: F11) öffnen, auf `/#/config` gehen,
**„Diesen Server verwenden“** klicken und speichern. Ab jetzt landet jeder Scan in
`server/data/scans.json`.

Ohne Backend (`local`) werden die Scans nur im Local Storage des Browsers gespeichert.

## Entwicklung

```bash
npm start                    # Angular Dev-Server auf http://localhost:4200
npm run server               # Backend auf http://localhost:3000
npm test                     # Frontend-Tests (Vitest)
npm run test:server          # Backend-Tests (node:test)
```

Zum Testen ohne Scanner: normales Tippen wird bewusst ignoriert. In der Config den Wert
*Scanner: max. Pause zwischen Zeichen* vorübergehend auf z. B. `1000` ms setzen, dann kann man
einen Code im Kiosk eintippen und mit Enter abschicken.

## Gewinnregel

| Regel | Beschreibung |
| --- | --- |
| `counter` (Standard) | Die n-te Person gewinnt, wenn n eine Primzahl ist (2., 3., 5., 7., 11., …). |
| `code` | Alle Ziffern des gescannten Codes werden als Zahl gelesen und auf Primzahl geprüft. |

Im Backend-Modus vergibt der Server die Teilnehmernummern, dadurch funktionieren auch
mehrere Stationen mit einem gemeinsamen Zähler.

## Backend

Konfiguration über Umgebungsvariablen:

| Variable | Standard | Beschreibung |
| --- | --- | --- |
| `PORT` | `3000` | Port |
| `DATA_FILE` | `server/data/scans.json` | Datei mit allen Scans |
| `API_KEY` | – | Wenn gesetzt, muss jede `/api`-Anfrage den Header `X-Api-Key` mitschicken |
| `CORS_ORIGIN` | `*` | Erlaubter Origin |
| `STATIC_DIR` | `dist/hat-raffle/browser` | Liefert das gebaute Frontend mit aus |

### API

| Methode | Pfad | Beschreibung |
| --- | --- | --- |
| `GET` | `/healthz` | Healthcheck |
| `POST` | `/api/scans` | Body `{ code, rule, hatsTotal, station }` → `201 { status: "new", record, soldOut }` bzw. `200 { status: "duplicate", record }` |
| `GET` | `/api/scans` | Alle Scans `{ scans, total, winners }` |
| `GET` | `/api/scans.csv` | CSV-Export |
| `GET` | `/api/stats` | `{ total, winners }` |

Ein Datensatz sieht so aus:

```json
{ "code": "BADGE-0002", "number": 2, "winner": true, "station": "booth-1", "timestamp": "2026-10-25T09:12:00.000Z" }
```

### Docker

```bash
docker build -t hat-raffle .
docker run -p 3000:3000 -v $(pwd)/data:/data -e API_KEY=geheim hat-raffle
```

## Hinweise für die Messe

- Browser im Kiosk-Modus starten, z. B. `chromium --kiosk http://localhost:3000`.
- Der Scanner muss als USB-Tastatur (HID) konfiguriert sein und mit **Enter** (oder Tab) abschließen.
  Bei Tastaturlayout-Problemen (z/y, Sonderzeichen) das Layout des Scanners auf Deutsch stellen.
- Ausweis-Codes können personenbezogene Daten enthalten – Datenschutzhinweis am Stand aushängen
  und `scans.json` nach der Messe/Gewinnauswertung löschen.
- Der rote Hut ist eine eigene Zeichnung, kein offizielles Red-Hat-Logo.
