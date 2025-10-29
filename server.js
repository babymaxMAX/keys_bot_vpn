import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const APP_BASE_URL = process.env.APP_BASE_URL || null; // prefer dynamic per-request base

// Helpers to ingest keys from multiple sources (keys.json + vless.txt)
const DATA_DIR = path.join(__dirname, 'data');
const KEYS_PATH = path.join(DATA_DIR, 'keys.json');
const VLESS_PATH = path.join(DATA_DIR, 'vless.txt');

function readJsonSafe(p, fallback = []) {
  try {
    if (!fs.existsSync(p)) return fallback;
    return JSON.parse(fs.readFileSync(p, 'utf8')) || fallback;
  } catch (e) {
    console.error('Failed to read JSON', p, e.message);
    return fallback;
  }
}
function readLinesSafe(p) {
  try {
    if (!fs.existsSync(p)) return [];
    return fs.readFileSync(p, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  } catch (e) {
    console.error('Failed to read lines', p, e.message);
    return [];
  }
}
function sanitizeId(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'key';
}
function parseUuidFromVless(v) {
  const m = /^vless:\/\/([0-9a-fA-F-]+)@/.exec(v);
  return m ? m[1] : null;
}
function parseTagFromVless(v) {
  const i = v.indexOf('#');
  return i >= 0 ? decodeURIComponent(v.slice(i + 1)) : null;
}

// Build unified keys list
const keysJson = readJsonSafe(KEYS_PATH, []);
const vlessLines = readLinesSafe(VLESS_PATH);

const idToKey = new Map();
for (const k of keysJson) {
  if (k && k.id && (k.vless || k.sub)) idToKey.set(String(k.id), k);
}
vlessLines.forEach((line, idx) => {
  if (!line.startsWith('vless://')) return;
  const tag = parseTagFromVless(line) || parseUuidFromVless(line) || `line-${idx + 1}`;
  let id = sanitizeId(tag);
  let suffix = 1;
  while (idToKey.has(id)) { id = sanitizeId(tag + '-' + (++suffix)); }
  if (!idToKey.has(id)) idToKey.set(id, { id, vless: line, label: tag });
});

const keys = Array.from(idToKey.values());

// EJS views and static
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use('/public', express.static(path.join(__dirname, 'public')));

// Health
app.get('/health', (req, res) => res.status(200).send('ok'));

// Connect page (auto)
function getBaseUrl(req) {
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http');
  const host = req.get('host');
  return `${proto}://${host}`;
}

app.get('/k/:id', (req, res) => {
  const k = idToKey.get(req.params.id);
  if (!k) return res.status(404).send('Not found');
  res.render('connect', {
    id: k.id,
    vless: k.vless,
    configUrl: `${(APP_BASE_URL || getBaseUrl(req))}/c/${encodeURIComponent(k.id)}`,
    label: k.label || 'LsJ⚔️VPN'
  });
});

// Config target for deeplink
app.get('/c/:id', (req, res) => {
  const k = idToKey.get(req.params.id);
  if (!k) return res.status(404).send('Not found');
  res.setHeader('Cache-Control', 'no-store');
  // v2rayTun expects plain text (not HTML). Send raw line with trailing newline.
  const raw = k.sub || k.vless;
  res.type('text/plain').send((raw || '') + '\n');
});

// QR page
app.get('/qr/:id', (req, res) => {
  const k = idToKey.get(req.params.id);
  if (!k) return res.status(404).send('Not found');
  const payload = k.sub || `${(APP_BASE_URL || getBaseUrl(req))}/k/${encodeURIComponent(k.id)}`;
  res.render('qr', { id: k.id, payload, label: k.label || 'LsJ⚔️VPN' });
});

// Optional: list ids for sanity
app.get('/', (req, res) => {
  const sample = keys.slice(0, 50);
  const list = sample.map(k => `<li><a href="/k/${encodeURIComponent(k.id)}">${k.id}</a></li>`).join('');
  res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>LsJ⚔️VPN — Multi</title></head><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:20px"><h1>Keys</h1><ul>${list}</ul><p>Health: <a href="/health">/health</a></p></body></html>`);
});

// Back-compat health route for Render settings
app.get('/healthz', (req, res) => res.status(200).send('ok'));

app.listen(PORT, () => {
  console.log('Listening on :' + PORT);
});


