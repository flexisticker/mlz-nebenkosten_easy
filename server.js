// Vermieter-Portal: kleiner lokaler Server ohne externe Abhängigkeiten.
// Speichert alle Daten in DATA_DIR (im Docker-Container /data, auf dem Rechner ./daten).
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT || 8080);
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'daten'));
const DB_FILE = path.join(DATA_DIR, 'portal.json');
const DOC_DIR = path.join(DATA_DIR, 'dokumente');
const BACKUP_DIR = path.join(DATA_DIR, 'sicherungen');
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_JSON = 5 * 1024 * 1024;      // 5 MB
const MAX_UPLOAD = 50 * 1024 * 1024;   // 50 MB pro Dokument

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

for (const d of [DATA_DIR, DOC_DIR, BACKUP_DIR]) fs.mkdirSync(d, { recursive: true });

// ---------- Datenbank (eine JSON-Datei, atomar geschrieben) ----------

async function leseDaten() {
  try {
    return JSON.parse(await fsp.readFile(DB_FILE, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
}

let schreibKette = Promise.resolve();
function schreibeDaten(daten) {
  // Schreibvorgänge nacheinander ausführen, damit sich nichts überschneidet.
  schreibKette = schreibKette.then(async () => {
    await tagesSicherung();
    const tmp = DB_FILE + '.tmp';
    await fsp.writeFile(tmp, JSON.stringify(daten, null, 2));
    await fsp.rename(tmp, DB_FILE);
  });
  return schreibKette;
}

// Einmal pro Tag vor der ersten Änderung eine Kopie ablegen (die letzten 30 bleiben).
async function tagesSicherung() {
  if (!fs.existsSync(DB_FILE)) return;
  const tag = new Date().toISOString().slice(0, 10);
  const ziel = path.join(BACKUP_DIR, `portal-${tag}.json`);
  if (fs.existsSync(ziel)) return;
  await fsp.copyFile(DB_FILE, ziel);
  const alle = (await fsp.readdir(BACKUP_DIR)).filter(f => /^portal-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  for (const alt of alle.slice(0, Math.max(0, alle.length - 30))) await fsp.unlink(path.join(BACKUP_DIR, alt));
}

// ---------- Dokumente (PDFs usw.) ----------

const DOC_INDEX = path.join(DOC_DIR, 'index.json');

async function leseDokIndex() {
  try { return JSON.parse(await fsp.readFile(DOC_INDEX, 'utf8')); } catch { return []; }
}
async function schreibeDokIndex(liste) {
  const tmp = DOC_INDEX + '.tmp';
  await fsp.writeFile(tmp, JSON.stringify(liste, null, 2));
  await fsp.rename(tmp, DOC_INDEX);
}

const sauber = s => String(s || '').replace(/[\u0000-\u001f\\/:*?"<>|]/g, '_').slice(0, 200);

// ---------- HTTP-Hilfen ----------

function sende(res, status, body, typ = 'application/json; charset=utf-8', extra = {}) {
  const daten = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': typ, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra });
  res.end(daten);
}
const fehler = (res, status, text) => sende(res, status, { fehler: text });

function leseBody(req, max) {
  return new Promise((resolve, reject) => {
    const teile = [];
    let laenge = 0;
    req.on('data', c => {
      laenge += c.length;
      if (laenge > max) { reject(Object.assign(new Error('Datei zu groß'), { status: 413 })); req.destroy(); return; }
      teile.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(teile)));
    req.on('error', reject);
  });
}

async function statisch(req, res, pfad) {
  if (pfad === '/') pfad = '/index.html';
  const datei = path.normalize(path.join(PUBLIC_DIR, pfad));
  if (!datei.startsWith(PUBLIC_DIR + path.sep)) return fehler(res, 403, 'Nicht erlaubt');
  try {
    const inhalt = await fsp.readFile(datei);
    sende(res, 200, inhalt, MIME[path.extname(datei).toLowerCase()] || 'application/octet-stream');
  } catch {
    fehler(res, 404, 'Nicht gefunden');
  }
}

// ---------- Routen ----------

async function api(req, res, url) {
  const p = url.pathname;

  if (p === '/api/daten' && req.method === 'GET') {
    return sende(res, 200, (await leseDaten()) ?? {});
  }
  if (p === '/api/daten' && req.method === 'PUT') {
    const body = await leseBody(req, MAX_JSON);
    let daten;
    try { daten = JSON.parse(body.toString('utf8')); } catch { return fehler(res, 400, 'Ungültige Daten'); }
    if (!daten || typeof daten !== 'object' || Array.isArray(daten)) return fehler(res, 400, 'Ungültige Daten');
    await schreibeDaten(daten);
    return sende(res, 200, { ok: true });
  }

  if (p === '/api/dokumente' && req.method === 'GET') {
    return sende(res, 200, await leseDokIndex());
  }
  if (p === '/api/dokumente' && req.method === 'POST') {
    const name = sauber(url.searchParams.get('name')) || 'dokument.pdf';
    const body = await leseBody(req, MAX_UPLOAD);
    if (!body.length) return fehler(res, 400, 'Leere Datei');
    const id = crypto.randomUUID();
    const endung = (path.extname(name) || '.pdf').toLowerCase().replace(/[^.a-z0-9]/g, '');
    await fsp.writeFile(path.join(DOC_DIR, id + endung), body);
    const eintrag = {
      id,
      datei: id + endung,
      name,
      titel: sauber(url.searchParams.get('titel')) || name.replace(/\.[^.]+$/, ''),
      jahr: sauber(url.searchParams.get('jahr')),
      kategorie: sauber(url.searchParams.get('kategorie')) || 'Sonstiges',
      groesse: body.length,
      hochgeladen: new Date().toISOString(),
    };
    const liste = await leseDokIndex();
    liste.push(eintrag);
    await schreibeDokIndex(liste);
    return sende(res, 201, eintrag);
  }

  const m = p.match(/^\/api\/dokumente\/([0-9a-f-]{36})$/);
  if (m) {
    const liste = await leseDokIndex();
    const eintrag = liste.find(d => d.id === m[1]);
    if (!eintrag) return fehler(res, 404, 'Dokument nicht gefunden');
    if (req.method === 'GET') {
      const inhalt = await fsp.readFile(path.join(DOC_DIR, eintrag.datei));
      const herunterladen = url.searchParams.has('download');
      return sende(res, 200, inhalt, MIME[path.extname(eintrag.datei)] || 'application/octet-stream', {
        'Content-Disposition': `${herunterladen ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(eintrag.name)}`,
      });
    }
    if (req.method === 'PATCH') {
      const neu = JSON.parse((await leseBody(req, MAX_JSON)).toString('utf8') || '{}');
      for (const k of ['titel', 'jahr', 'kategorie']) if (k in neu) eintrag[k] = sauber(neu[k]);
      await schreibeDokIndex(liste);
      return sende(res, 200, eintrag);
    }
    if (req.method === 'DELETE') {
      await fsp.unlink(path.join(DOC_DIR, eintrag.datei)).catch(() => {});
      await schreibeDokIndex(liste.filter(d => d.id !== eintrag.id));
      return sende(res, 200, { ok: true });
    }
  }

  if (p === '/api/status') return sende(res, 200, { ok: true });

  return fehler(res, 404, 'Unbekannte Anfrage');
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return fehler(res, 405, 'Nicht erlaubt');
    return await statisch(req, res, decodeURIComponent(url.pathname));
  } catch (e) {
    console.error(e);
    fehler(res, e.status || 500, e.status ? e.message : 'Interner Fehler');
  }
});

server.listen(PORT, () => {
  console.log(`Vermieter-Portal läuft auf http://localhost:${PORT} (Daten in ${DATA_DIR})`);
});

const ende = () => server.close(() => process.exit(0));
process.on('SIGTERM', ende);
process.on('SIGINT', ende);
