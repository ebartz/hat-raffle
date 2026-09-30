# Hat Raffle 🎩

Gewinnspiel für den Messestand: Das Standpersonal scannt den Ausweis der Besucher mit einem
Barcode-/QR-Scanner. Ist die Teilnehmernummer eine **Primzahl** (oder wird die Person per
**Zufall** gezogen), gewinnt sie einen roten Hut – mit Konfetti und fliegenden Hüten. Jeder
Ausweis kann nur einmal teilnehmen.

Läuft komplett im Browser (Angular), optional mit einem kleinen Node-Backend, über das sich
beliebig viele Scan-Stationen (Laptops mit USB-Handscanner, Handys und Tablets mit Kamera)
einen Zähler, die Einstellungen und die Ergebnisse teilen.

## Features

- **Kiosk-Ansicht** (`/#/`) im Red-Hat-Look (Red Hat Display/Text, #EE0000, Schwarz/Weiß)
- **Barcode-Scanner als Tastatur**: schnelle Eingabe + Enter wird als Scan erkannt, normales Tippen wird ignoriert
- **Kamera-Scan auf Handy/Tablet**: iPhone, iPad und Android werden erkannt und scannen QR- und
  Barcodes direkt mit der Rückkamera (manuelle Eingabe als Fallback). Dort entfällt die Idle-Animation.
- **Mehrere Stationen**: das Backend vergibt die Teilnehmernummern zentral (nie doppelt), verteilt
  Config-Änderungen sofort an alle Stationen und zeigt Ergebnisse live auf allen großen Bildschirmen
- **Duplikaterkennung**: bereits gescannte Ausweise werden nicht erneut gezählt, es erscheint ein Hinweis
- **Gewinnanimation**: Hut fliegt ein, Konfetti in Red-Hat-Farben, Hüte regnen vom Himmel
- **Idle-/Attract-Modus**: nach X Sekunden ohne Scan läuft eine Animation, die Besucher an den Stand lockt;
  Überschriften, Unterzeile und Button-Text sind in der Config anpassbar
- **Hut-Kontingent**: optional begrenzte Anzahl Hüte, danach „alle Hüte vergeben“
- **Config-Seite** (`/#/config`, wie bei [bashbrawl](https://github.com/jggoebel/bashbrawl)):
  - _Dieses Gerät_: Backend-URL, API-Key, Stationsname, Scan-Methode (automatisch/USB/Kamera)
  - _Gewinnspiel_ (im Backend gespeichert, für alle Stationen gleich): Gewinnregel, Hut-Anzahl,
    Timings, Sprache (DE/EN), Idle-Texte, Ergebnisse anderer Stationen anzeigen, PIN/Passwort
  - Healthcheck, Scanner-Test, Liste aller erfassten Codes (auch als QR-Code), CSV-Export
- **PIN/Passwort für die Config**: einmal gesetzt, wird sie bei jedem Öffnen der Config verlangt
  (mit Backend auf allen Stationen; gespeichert als scrypt-Hash, 5 Fehlversuche → 30 s Sperre)
- **Backend** ohne Abhängigkeiten (`server/server.mjs`): speichert Scans und Config als JSON-Dateien

## Schnellstart am Stand (ein Laptop)

```bash
npm ci
npm run start:booth          # baut das Frontend und startet das Backend auf Port 3000
```

Dann <http://localhost:3000> im Browser (Vollbild: F11) öffnen. Wird die App vom Backend
ausgeliefert, verbindet sie sich beim ersten Start automatisch damit. Ab jetzt landet jeder Scan
in `server/data/scans.json`, die Einstellungen in `server/data/config.json`.

Ohne Backend (`local`, z. B. beim Dev-Server) werden die Scans nur im Local Storage des Browsers
gespeichert.

## Mehrere Stationen und Handys

1. Backend auf einem Laptop im Stand-WLAN starten – **mit HTTPS**, denn Browser erlauben die
   Kamera nur über HTTPS (Ausnahme: `localhost`):

   ```bash
   # einmalig ein Zertifikat erzeugen (IP des Laptops eintragen)
   openssl req -x509 -newkey rsa:2048 -nodes -days 60 -keyout server/data/key.pem \
     -out server/data/cert.pem -subj "/CN=hat-raffle" \
     -addext "subjectAltName=IP:192.168.1.20,DNS:localhost"

   npm run build
   TLS_CERT=server/data/cert.pem TLS_KEY=server/data/key.pem npm run server
   ```

   Mit [mkcert](https://github.com/FiloSottile/mkcert) erzeugte Zertifikate vermeiden die
   Browser-Warnung, wenn die mkcert-CA auf den Geräten installiert ist. Sonst die Warnung einmal
   bestätigen („Details → Website besuchen“ bzw. „Erweitert → Weiter“).

2. Auf jedem Gerät `https://192.168.1.20:3000` öffnen. Die App verbindet sich automatisch mit dem
   Backend. In der Config einen eindeutigen **Stationsnamen** vergeben.
3. Laptops/PCs nutzen den USB-Handscanner und zeigen die Idle-Animation. Handys und Tablets
   öffnen direkt die Kamera. Die Scan-Methode lässt sich pro Gerät in der Config überschreiben.
4. Gewinnt jemand an einer Station, erscheint das Ergebnis mit Konfetti auch auf allen großen
   Bildschirmen (mit dem Namen der Station). Abschaltbar über _Ergebnisse aller Stationen anzeigen_.
5. Einstellungen, die auf einer Station gespeichert werden, übernehmen alle anderen sofort.

Die Teilnehmernummern werden ausschließlich im Backend vergeben: Node verarbeitet die Anfragen
nacheinander, Nummer und Speicherung passieren ohne Unterbrechung. So bekommt auch bei
gleichzeitigen Scans an mehreren Stationen niemand dieselbe Nummer (siehe Test
_many stations at once never get the same number_). Es darf daher nur **eine** Backend-Instanz
laufen.

## Entwicklung

```bash
npm start                    # Angular Dev-Server auf http://localhost:4200
npm run server               # Backend auf http://localhost:3000
npm test                     # Frontend-Tests (Vitest)
npm run test:server          # Backend-Tests (node:test)
```

Zum Testen ohne Scanner: normales Tippen wird bewusst ignoriert. In der Config den Wert
_Scanner: max. Pause zwischen Zeichen_ vorübergehend auf z. B. `1000` ms setzen, dann kann man
einen Code im Kiosk eintippen und mit Enter abschicken.

## Gewinnregel

| Regel                | Beschreibung                                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `counter` (Standard) | Die n-te Person gewinnt, wenn n eine Primzahl ist (2., 3., 5., 7., 11., …).                                                           |
| `code`               | Alle Ziffern des gescannten Codes werden als Zahl gelesen und auf Primzahl geprüft.                                                   |
| `random`             | Zufall: In jedem Block von 100 Scans (1–100, 101–200, …) werden genau _Hüte pro 100 Scans_ Gewinner an zufälligen Positionen gezogen. |

Im Backend-Modus vergibt der Server die Teilnehmernummern, dadurch funktionieren auch
mehrere Stationen mit einem gemeinsamen Zähler.

## Backend

Konfiguration über Umgebungsvariablen:

| Variable              | Standard                         | Beschreibung                                                                                |
| --------------------- | -------------------------------- | ------------------------------------------------------------------------------------------- |
| `PORT`                | `3000`                           | Port                                                                                        |
| `DATA_FILE`           | `server/data/scans.json`         | Datei mit allen Scans                                                                       |
| `CONFIG_FILE`         | neben `DATA_FILE`: `config.json` | Geteilte Einstellungen und PIN-Hash                                                         |
| `API_KEY`             | –                                | Wenn gesetzt, muss jede `/api`-Anfrage den Header `X-Api-Key` (Events: `?key=`) mitschicken |
| `CORS_ORIGIN`         | `*`                              | Erlaubter Origin                                                                            |
| `STATIC_DIR`          | `dist/hat-raffle/browser`        | Liefert das gebaute Frontend mit aus                                                        |
| `TLS_CERT`, `TLS_KEY` | –                                | Pfade zu Zertifikat und Schlüssel (PEM) – schaltet HTTPS ein                                |

### API

| Methode | Pfad                 | Beschreibung                                                                                                                                                                    |
| ------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`   | `/healthz`           | Healthcheck `{ status: "ok", app: "hat-raffle" }`                                                                                                                               |
| `POST`  | `/api/scans`         | Body `{ code, station, clientId }` → `201 { status: "new", record, soldOut }` bzw. `200 { status: "duplicate", record }`. Die Gewinnregel kommt immer aus der geteilten Config. |
| `GET`   | `/api/stats`         | `{ total, winners }`                                                                                                                                                            |
| `GET`   | `/api/config`        | Geteilte Einstellungen inkl. `pinSet` (ohne PIN)                                                                                                                                |
| `PUT`   | `/api/config` 🔒     | Body `{ config, newPin? }` (`newPin: null` entfernt die PIN)                                                                                                                    |
| `POST`  | `/api/config/unlock` | Body `{ pin }` → `200` oder `403`, nach 5 Fehlversuchen `429`                                                                                                                   |
| `GET`   | `/api/events`        | Server-Sent Events: `hello` (Config + Zähler), `scan` (neuer Scan ohne Code), `config`                                                                                          |
| `GET`   | `/api/scans` 🔒      | Alle Scans `{ scans, total, winners }`                                                                                                                                          |
| `GET`   | `/api/scans.csv` 🔒  | CSV-Export (PIN auch als `?pin=`)                                                                                                                                               |

🔒 = benötigt den Header `X-Config-Pin`, sobald eine PIN gesetzt ist. Scannen und die Anzeige
funktionieren ohne PIN.

Ein Datensatz sieht so aus:

```json
{
  "code": "BADGE-0002",
  "number": 2,
  "winner": true,
  "station": "booth-1",
  "timestamp": "2026-10-25T09:12:00.000Z"
}
```

### Docker

Es gibt drei Images:

| Datei                 | Inhalt                                                                                    |
| --------------------- | ----------------------------------------------------------------------------------------- |
| `server/Dockerfile`   | nur das **Backend** (API, geteilte Config, Live-Events), Port 3000                        |
| `Dockerfile.frontend` | nur das **Frontend** (nginx), leitet `/api` und `/healthz` an das Backend weiter, Port 80 |
| `Dockerfile`          | alles in einem: das Backend liefert auch das Frontend aus, Port 3000                      |

**Backend und Frontend getrennt (docker compose):**

```bash
docker compose up -d --build        # Frontend: http://<host>:8080, Backend: Port 3000
```

Alle Stationen öffnen `http://<host>:8080`. Das Frontend verbindet sich über den nginx-Proxy
automatisch mit dem Backend. Scans und Config liegen im Volume `raffle-data`. Einen API-Key
setzt man über eine `.env`-Datei neben der `docker-compose.yml` (`API_KEY=geheim`).

**Nur das Backend:**

```bash
docker build -t hat-raffle-backend server
docker run -d -p 3000:3000 -v raffle-data:/data hat-raffle-backend
```

Das Frontend (egal wo es läuft) dann in der Config auf `http://<host>:3000` zeigen lassen.

**Alles in einem Container:**

```bash
docker build -t hat-raffle .
docker run -p 3000:3000 -v $(pwd)/data:/data -e API_KEY=geheim hat-raffle
```

Für die Handy-Kamera wird HTTPS benötigt: entweder `TLS_CERT`/`TLS_KEY` am Backend setzen
(Zertifikate per Volume einbinden) oder einen Reverse-Proxy mit TLS vor das Frontend stellen.

## Hinweise für die Messe

- Browser im Kiosk-Modus starten, z. B. `chromium --kiosk http://localhost:3000`.
- Handys: Display-Sperre für die Messe verlängern und die Seite zum Home-Bildschirm hinzufügen.
- Der Scanner muss als USB-Tastatur (HID) konfiguriert sein und mit **Enter** (oder Tab) abschließen.
  Bei Tastaturlayout-Problemen (z/y, Sonderzeichen) das Layout des Scanners auf Deutsch stellen.
- Ausweis-Codes können personenbezogene Daten enthalten – Datenschutzhinweis am Stand aushängen
  und `scans.json` nach der Messe/Gewinnauswertung löschen. Die Live-Events an die Stationen
  enthalten keine Codes, nur Nummer, Station und Ergebnis.
- Die lokale PIN (ohne Backend) liegt nur im Browser und schützt vor versehentlichen Änderungen,
  nicht vor jemandem mit Zugriff auf die Entwicklertools.
- Der rote Hut ist eine eigene Zeichnung, kein offizielles Red-Hat-Logo.
