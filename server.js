import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const APP_BASE_URL = process.env.APP_BASE_URL || null; // prefer dynamic per-request base

// Load keys.json (array)
const KEYS_PATH = path.join(__dirname, 'data', 'keys.json');
let keys = [];
try {
  keys = JSON.parse(fs.readFileSync(KEYS_PATH, 'utf8')) || [];
} catch (e) {
  console.error('Failed to read data/keys.json:', e.message);
  keys = [];
}
const idToKey = new Map(keys.map(k => [String(k.id), k]));

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
  res.render('config', {
    id: k.id,
    raw: k.sub || k.vless
  });
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
  const list = keys.map(k => `<li><a href="/k/${encodeURIComponent(k.id)}">${k.id}</a></li>`).join('');
  res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>LsJ⚔️VPN — Multi</title></head><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:20px"><h1>Keys</h1><ul>${list}</ul><p>Health: <a href="/health">/health</a></p></body></html>`);
});

// Back-compat health route for Render settings
app.get('/healthz', (req, res) => res.status(200).send('ok'));

app.listen(PORT, () => {
  console.log('Listening on :' + PORT);
});


