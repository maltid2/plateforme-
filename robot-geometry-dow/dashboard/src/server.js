#!/usr/bin/env node
'use strict';

// Tableau de bord + rapport quotidien du robot Geometry Dow. Zéro dépendance.
//
//   node src/server.js                     lit les fichiers de l'EA (voir GD_DATA_DIR)
//   node src/server.js --demo              données de démonstration (backtest simulé)
//
// Variables d'environnement :
//   GD_DATA_DIR        dossier des fichiers de l'EA
//                      (défaut Windows : %APPDATA%\MetaQuotes\Terminal\Common\Files\GeometryDow)
//   GD_PORT            port HTTP (défaut 8787)
//   GD_HOST            interface d'écoute (défaut 127.0.0.1 = accessible seulement depuis la machine)
//   GD_PASSWORD        mot de passe du tableau de bord (obligatoire si GD_HOST n'est pas local)
//   GD_REPORT_TIME     heure de Paris du rapport quotidien (défaut : or 18:30, Dow 23:15 — après la dernière session)
//   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID   facultatif : envoi du rapport sur Telegram

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { readJson, readEvents, buildTrades, parisMs } = require('./journal');
const { buildReport, reportText, equitySeries, summarize } = require('./report');

const argv = process.argv.slice(2);
const env = process.env;
const PUBLIC = path.join(__dirname, '..', 'public');

function defaultDataDir() {
  if (env.APPDATA) return path.join(env.APPDATA, 'MetaQuotes', 'Terminal', 'Common', 'Files', 'GeometryDow');
  return path.join(__dirname, '..', 'data');
}

let DATA = env.GD_DATA_DIR || defaultDataDir();
if (argv.includes('--demo')) {
  DATA = path.join(__dirname, '..', 'demo-data');
  require('./demo').generate(DATA);
}
const REPORTS = path.join(DATA, 'reports');
const NOTES = path.join(DATA, 'notes.json');
const PORT = Number(env.GD_PORT || 8787);
const HOST = env.GD_HOST || '127.0.0.1';
const PASSWORD = env.GD_PASSWORD || '';
// Heure du rapport : après la dernière session du marché tradé (lu dans state.json).
function reportTime() {
  if (env.GD_REPORT_TIME) return env.GD_REPORT_TIME;
  const st = readJson(path.join(DATA, 'state.json'));
  return st && st.params && st.params.market === 'dow' ? '23:15' : '18:30';
}

if (!['127.0.0.1', 'localhost', '::1'].includes(HOST) && !PASSWORD) {
  console.error('GD_HOST expose le tableau de bord sur le réseau : définissez GD_PASSWORD.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Données
// ---------------------------------------------------------------------------

function loadState() {
  const file = path.join(DATA, 'state.json');
  const state = readJson(file);
  let ageSeconds = null;
  try {
    ageSeconds = Math.round((Date.now() - fs.statSync(file).mtimeMs) / 1000);
  } catch {
    // pas encore de fichier
  }
  return { state, ageSeconds };
}

function offsetOf(state) {
  return state && Number.isFinite(state.offset) ? state.offset : 1;
}

function loadNotes() {
  return readJson(NOTES, {});
}

function writeFileAtomic(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, file);
}

function generateReport(day) {
  const { state } = loadState();
  const report = buildReport(readEvents(DATA), day, {
    offset: offsetOf(state),
    params: (state && state.params) || {},
    note: loadNotes()[day] || '',
  });
  writeFileAtomic(path.join(REPORTS, `${day}.json`), JSON.stringify(report, null, 2));
  writeFileAtomic(path.join(REPORTS, `${day}.txt`), `${reportText(report)}\n`);
  return report;
}

function listReports() {
  let files = [];
  try {
    files = fs.readdirSync(REPORTS).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f));
  } catch {
    return [];
  }
  return files.sort().reverse().map((f) => {
    const r = readJson(path.join(REPORTS, f), {});
    return { day: f.slice(0, 10), trades: r.summary?.trades ?? 0, profit: r.summary?.profit ?? 0, r: r.summary?.r ?? 0 };
  });
}

function dashboardPayload() {
  const { state, ageSeconds } = loadState();
  const offset = offsetOf(state);
  const events = readEvents(DATA);
  const { trades } = buildTrades(events);
  const nowParis = state ? parisMs(state.t, offset) : Date.now();
  const today = new Date(nowParis).toISOString().slice(0, 10);
  const todays = trades.filter((t) => new Date(parisMs(t.openT, offset)).toISOString().slice(0, 10) === today);
  return {
    state,
    ageSeconds,
    today,
    todaySummary: summarize(todays),
    total: summarize(trades),
    equity: equitySeries(events, offset),
    trades: trades.slice(-30).reverse().map((t) => ({
      ...t,
      openParis: parisMs(t.openT, offset),
      closeParis: parisMs(t.closeT, offset),
      trails: undefined,
    })),
    reportTime: reportTime(),
  };
}

// ---------------------------------------------------------------------------
// Rapport automatique
// ---------------------------------------------------------------------------

function parisNow() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23',
  }).formatToParts(new Date()).map((p) => [p.type, p.value]));
  return { day: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}`, weekday: parts.weekday };
}

function sendTelegram(text) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chat = env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return Promise.resolve(false);
  const body = JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true });
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${token}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 15000,
    }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => req.destroy());
    req.end(body);
  });
}

async function scheduler() {
  const now = parisNow();
  if (now.weekday === 'Sat' || now.weekday === 'Sun') return;
  if (now.time < reportTime()) return;
  if (fs.existsSync(path.join(REPORTS, `${now.day}.json`))) return;
  const report = generateReport(now.day);
  const sent = await sendTelegram(reportText(report));
  console.log(`[${now.day} ${now.time}] rapport quotidien généré${sent ? ' et envoyé sur Telegram' : ''}`);
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'; style-src 'self'; img-src 'self' data:",
};

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', ...SECURITY_HEADERS });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function authorized(req) {
  if (!PASSWORD) return true;
  const m = /^Basic (.+)$/.exec(req.headers.authorization || '');
  if (!m) return false;
  const pass = Buffer.from(m[1], 'base64').toString().split(':').slice(1).join(':');
  const a = crypto.createHash('sha256').update(pass).digest();
  const b = crypto.createHash('sha256').update(PASSWORD).digest();
  return crypto.timingSafeEqual(a, b);
}

function readBody(req, limit = 10000) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > limit) {
        reject(new Error('trop gros'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

async function handle(req, res) {
  if (!authorized(req)) {
    res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Geometry Dow"', ...SECURITY_HEADERS });
    return res.end('Authentification requise');
  }
  const url = new URL(req.url, 'http://localhost');
  const parts = url.pathname.split('/').filter(Boolean);

  if (req.method === 'GET' && url.pathname === '/api/dashboard') return send(res, 200, dashboardPayload());
  if (req.method === 'GET' && url.pathname === '/api/reports') return send(res, 200, listReports());

  if (parts[0] === 'api' && parts[1] === 'reports' && parts[2]) {
    const day = parts[2];
    if (!DAY_RE.test(day)) return send(res, 400, { error: 'date invalide' });
    if (req.method === 'GET' && parts.length === 3) {
      const r = readJson(path.join(REPORTS, `${day}.json`));
      return r ? send(res, 200, r) : send(res, 404, { error: 'pas de rapport pour ce jour' });
    }
    if (req.method === 'POST' && parts[3] === 'generate') return send(res, 200, generateReport(day));
    if (req.method === 'POST' && parts[3] === 'note') {
      let text;
      try {
        text = String(JSON.parse(await readBody(req)).text || '').slice(0, 5000);
      } catch {
        return send(res, 400, { error: 'JSON invalide' });
      }
      const notes = loadNotes();
      if (text.trim()) notes[day] = text;
      else delete notes[day];
      writeFileAtomic(NOTES, JSON.stringify(notes, null, 2));
      return send(res, 200, generateReport(day));
    }
  }

  if (req.method === 'GET' && !url.pathname.startsWith('/api/')) {
    const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const file = path.resolve(PUBLIC, rel);
    if (!file.startsWith(PUBLIC + path.sep) || !MIME[path.extname(file)]) return send(res, 404, 'Introuvable', 'text/plain');
    try {
      return send(res, 200, fs.readFileSync(file), MIME[path.extname(file)]);
    } catch {
      return send(res, 404, 'Introuvable', 'text/plain');
    }
  }
  return send(res, 404, { error: 'introuvable' });
}

if (require.main === module) {
  const server = http.createServer((req, res) => {
    handle(req, res).catch((e) => {
      console.error(e);
      send(res, 500, { error: 'erreur interne' });
    });
  });
  server.listen(PORT, HOST, () => {
    console.log(`Tableau de bord Geometry Dow : http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
    console.log(`Données lues dans : ${DATA}`);
    console.log(`Rapport quotidien : ${reportTime()} (heure de Paris), du lundi au vendredi${env.TELEGRAM_BOT_TOKEN ? ', envoi Telegram activé' : ''}`);
  });
  scheduler();
  setInterval(() => scheduler().catch(console.error), 60000);
}

module.exports = { handle, generateReport, dashboardPayload };
