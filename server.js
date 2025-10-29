import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const USERS_JSON = path.join(DATA_DIR, 'users.json'); // array of objects with fields like uuid/email/subId/id
const VLESS_TXT = path.join(DATA_DIR, 'vless.txt');   // plain vless:// lines
const KEYS_JSON = path.join(__dirname, 'keys.json');  // { keys: [{ slug, vless }] } (optional, legacy)
const GENERATOR_CFG = path.join(__dirname, 'generator.config.json');

function readJsonSafe(filePath, fallback = null) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    console.error(`Failed to read JSON ${filePath}:`, e.message);
    return fallback;
  }
}

function readTextLines(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf-8');
    return raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  } catch (e) {
    console.error(`Failed to read text ${filePath}:`, e.message);
    return [];
  }
}

function loadGeneratorConfig() {
  const env = (key, def) => process.env[key] && String(process.env[key]).trim() !== '' ? process.env[key] : def;
  const cfgFile = readJsonSafe(GENERATOR_CFG, {});
  return {
    host: env('VPN_HOST', cfgFile?.host ?? '84.200.87.247'),
    port: env('VPN_PORT', cfgFile?.port ?? '8443'),
    type: env('VPN_TYPE', cfgFile?.type ?? 'tcp'),
    security: env('VPN_SECURITY', cfgFile?.security ?? 'reality'),
    pbk: env('VPN_PBK', cfgFile?.pbk ?? 'FKZANuukwZa3GsnF146p81LyfoEtFp8pXi2unytjbiU'),
    sni: env('VPN_SNI', cfgFile?.sni ?? 'www.samsung.com'),
    fp: env('VPN_FP', cfgFile?.fp ?? 'chrome'),
    sid: env('VPN_SID', cfgFile?.sid ?? 'b4bb'),
    spx: env('VPN_SPX', cfgFile?.spx ?? '/'),
    flow: env('VPN_FLOW', cfgFile?.flow ?? 'xtls-rprx-vision'),
    tagPrefix: env('TAG_PREFIX', cfgFile?.tagPrefix ?? ''),
    slugPrefix: env('SLUG_PREFIX', cfgFile?.slugPrefix ?? ''),
  };
}

function sanitizeSlug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'key';
}

function shortHash(text) {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) - h) + text.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}

function parseUuidFromVless(vless) {
  // vless://<uuid>@host:port/...
  const m = /^vless:\/\/([0-9a-fA-F\-]+)@/.exec(vless);
  return m ? m[1] : null;
}

function parseTagFromVless(vless) {
  // try to extract fragment after #
  const idx = vless.indexOf('#');
  if (idx >= 0) return decodeURIComponent(vless.slice(idx + 1)).trim();
  return null;
}

function buildVlessFromTemplate(uuid, cfg, tag) {
  // vless://<uuid>@<host>:<port>/?type=...&security=...&pbk=...&fp=...&sni=...&sid=...&spx=...#<tag>
  const params = new URLSearchParams();
  if (cfg.type) params.set('type', cfg.type);
  if (cfg.security) params.set('security', cfg.security);
  if (cfg.pbk) params.set('pbk', cfg.pbk);
  if (cfg.fp) params.set('fp', cfg.fp);
  if (cfg.sni) params.set('sni', cfg.sni);
  if (cfg.sid) params.set('sid', cfg.sid);
  if (cfg.spx) params.set('spx', cfg.spx);
  if (cfg.flow) params.set('flow', cfg.flow);
  const qs = params.toString();
  const label = encodeURIComponent((cfg.tagPrefix || '') + (tag || uuid));
  return `vless://${uuid}@${cfg.host}:${cfg.port}/?${qs}#${label}`;
}

function loadKeysUnified() {
  const cfg = loadGeneratorConfig();
  const map = new Map();

  // 1) users.json (array of objects with uuid/email/subId/id)
  const users = readJsonSafe(USERS_JSON, []);
  if (Array.isArray(users)) {
    for (const u of users) {
      const uuid = String(u.uuid || '').trim();
      if (!uuid) continue;
      const baseSlug = u.email || u.subId || (u.id != null ? `id-${u.id}` : uuid);
      const slug = (cfg.slugPrefix || '') + sanitizeSlug(baseSlug);
      const tag = u.email || u.subId || slug;
      const vless = buildVlessFromTemplate(uuid, cfg, tag);
      if (!map.has(slug)) map.set(slug, vless);
    }
  } else if (users && Array.isArray(users.data)) {
    for (const u of users.data) {
      const uuid = String(u.uuid || '').trim();
      if (!uuid) continue;
      const baseSlug = u.email || u.subId || (u.id != null ? `id-${u.id}` : uuid);
      const slug = (cfg.slugPrefix || '') + sanitizeSlug(baseSlug);
      const tag = u.email || u.subId || slug;
      const vless = buildVlessFromTemplate(uuid, cfg, tag);
      if (!map.has(slug)) map.set(slug, vless);
    }
  }

  // 2) vless.txt (raw lines)
  const lines = readTextLines(VLESS_TXT);
  lines.forEach((line, idx) => {
    if (!line.startsWith('vless://')) return;
    const tag = parseTagFromVless(line);
    const uuid = parseUuidFromVless(line);
    let slugCandidate = tag || uuid || `line-${idx + 1}`;
    const slug = (cfg.slugPrefix || '') + sanitizeSlug(slugCandidate);
    if (!map.has(slug)) map.set(slug, line);
  });

  // 3) keys.json legacy
  const legacy = readJsonSafe(KEYS_JSON, null);
  if (legacy && Array.isArray(legacy.keys)) {
    for (const item of legacy.keys) {
      if (!item || !item.slug || !item.vless) continue;
      const slug = (cfg.slugPrefix || '') + sanitizeSlug(item.slug);
      const vless = String(item.vless);
      if (!map.has(slug)) map.set(slug, vless);
    }
  }

  // If nothing loaded, make example
  if (map.size === 0) {
    const exampleUuid = 'e4392413-7142-4a95-a934-f084649b45e7';
    const slug = (cfg.slugPrefix || '') + 'example';
    const vless = buildVlessFromTemplate(exampleUuid, cfg, 'example');
    map.set(slug, vless);
  }

  return map;
}

let slugToVless = loadKeysUnified();

const app = express();
app.disable('x-powered-by');
app.use(morgan('tiny'));
app.use(compression());
// Relax security headers to ensure inline scripts and CDN QR library work on mobile clients
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);

function notFound(res, slug) {
  res
    .status(404)
    .type('html')
    .send(`<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Не найдено</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:40px}
.card{max-width:720px;margin:0 auto;background:#111827;border:1px solid #1f2937;border-radius:16px;padding:24px}
a{color:#93c5fd;text-decoration:none}
a:hover{text-decoration:underline}
</style></head>
<body><div class="card">
<h2>Ключ для “${slug}” не найден</h2>
<p>Добавьте запись в <code>data/users.json</code> (uuid/email/...) или <code>data/vless.txt</code>,
либо <code>keys.json</code>, затем перезапустите сервис.</p>
<p><a href="/">На главную</a></p>
</div></body></html>`);
}

function htmlConnectPage({ slug, vless }) {
  const safeVless = JSON.stringify(vless);
  const safeSlug = JSON.stringify(slug);
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>LsJ⚔️VPN — ${slug}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:linear-gradient(135deg,#1a1a1a 0%,#2d2d2d 50%,#1a1a1a 100%);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;position:relative}
.container{background:rgba(26,26,26,0.95);backdrop-filter:blur(20px);border-radius:25px;box-shadow:0 25px 50px rgba(0,0,0,0.5);overflow:hidden;max-width:420px;width:100%;position:relative;border:2px solid rgba(255,215,0,0.3)}
.header{background:linear-gradient(135deg,#1a1a1a 0%,#2d2d2d 100%);color:#FFD700;padding:30px 20px;text-align:center;border-bottom:2px solid rgba(255,215,0,0.3)}
.logo{font-size:32px;margin-bottom:8px}
.service-name{font-size:26px;font-weight:bold;color:#FFD700}
.service-description{color:#FFD700;opacity:.9;font-weight:bold}
.content{padding:24px 18px}
.status-card{background:rgba(45,45,45,0.9);border-radius:18px;padding:18px;margin-bottom:18px;border-left:5px solid #FFD700;color:#e0e0e0;font-size:14px}
.connect-button{background:linear-gradient(135deg,#FFD700 0%,#FFA500 100%);color:#1a1a1a;border:none;border-radius:18px;padding:18px 26px;font-size:18px;font-weight:bold;width:100%;cursor:pointer;transition:all .3s ease;margin-bottom:12px;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 25px rgba(255,215,0,0.3)}
.connect-button:hover{transform:translateY(-2px)}
.copy-button{background:linear-gradient(135deg,#2d2d2d 0%,#1a1a1a 100%);color:#FFD700;border:2px solid rgba(255,215,0,0.3);border-radius:14px;padding:14px 18px;font-size:14px;font-weight:bold;width:100%;cursor:pointer;transition:all .3s ease;margin-bottom:12px}
.telegram-link{background:linear-gradient(135deg,#2d2d2d 0%,#1a1a1a 100%);color:#FFD700;text-decoration:none;border-radius:14px;padding:14px 18px;font-size:16px;font-weight:bold;display:flex;align-items:center;justify-content:center;border:2px solid rgba(255,215,0,0.3)}
.copy-notification{position:fixed;top:20px;right:20px;background:linear-gradient(135deg,#FFD700 0%,#FFA500 100%);color:#1a1a1a;padding:14px 18px;border-radius:12px;font-weight:bold;transform:translateX(400px);transition:all .3s ease;z-index:1000;box-shadow:0 10px 30px rgba(255,215,0,0.3);border:2px solid rgba(255,215,0,0.3)}
.copy-notification.show{transform:translateX(0)}
.loading-spinner{display:inline-block;width:18px;height:18px;border:3px solid rgba(26,26,26,.3);border-radius:50%;border-top-color:#1a1a1a;animation:spin 1s ease-in-out infinite;margin-right:8px}
@keyframes spin{to{transform:rotate(360deg)}}
.notice-bar{position:fixed;top:0;left:0;right:0;background:linear-gradient(135deg,#FFD700 0%,#FFA500 100%);color:#1a1a1a;font-weight:bold;text-align:center;padding:10px 12px;z-index:9999;border-bottom:2px solid rgba(255,215,0,0.6)}
</style>
<meta name="format-detection" content="telephone=no,email=no,address=no">
</head>
<body>
  <div class="notice-bar">уникальный ключ: ${slug}</div>
  <div class="container" style="margin-top:48px">
    <div class="header">
      <div class="logo">⚔️</div>
      <div class="service-name">LsJ⚔️VPN</div>
      <div class="service-description">Comrades | Key: ${slug}</div>
    </div>
    <div class="content">
      <div class="status-card">🟢 Сервер активен · Нажмите «Подключиться к VPN» — приложение откроется автоматически</div>
      <button class="connect-button" id="connectBtn" onclick="connectVPN()">🚀 Подключиться к VPN</button>
      <button class="copy-button" onclick="copyV2RayLink()">📋 Скопировать ссылку</button>
      <a class="telegram-link" href="/u/${encodeURIComponent(slug)}/qr">📷 QR-код</a>
      <div id="deviceInfo" style="margin-top:14px;color:#e0e0e0;font-size:13px;opacity:.9"></div>
    </div>
  </div>
  <div class="copy-notification" id="copyNotification">Ссылка скопирована!</div>

<script>
  const slug = ${safeSlug};
  const originalKey = ${safeVless};

  function configFileUrlAbs() {
    return new URL('config.html', window.location.href).toString();
  }
  function deeplinkUrl() {
    const cfg = configFileUrlAbs();
    return 'https://deeplink.website/?url=' + encodeURIComponent(cfg);
  }

  function showNotification(message = 'Ссылка скопирована!') {
    const el = document.getElementById('copyNotification');
    el.textContent = message;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 3500);
  }

  function copyToClipboard(text) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    } else { fallbackCopy(text); }
  }
  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
  }

  function connectVPN() {
    const btn = document.getElementById('connectBtn');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<span class="loading-spinner"></span>Подключение...';
    btn.disabled = true;

    let attempts = 0;
    const maxAttempts = 4; // 3 deeplink + 1 vless://

    function attempt() {
      attempts++;
      try {
        if (attempts === 1) {
          window.location.href = deeplinkUrl();
        } else if (attempts === 2) {
          const a = document.createElement('a');
          a.href = deeplinkUrl();
          a.style.display = 'none';
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
        } else if (attempts === 3) {
          window.open(deeplinkUrl(), '_blank');
        } else {
          window.location.href = originalKey; // прямая vless://
        }
      } catch (e) {}

      if (attempts >= maxAttempts) {
        setTimeout(() => {
          fetch('config.html').then(r => r.text()).then(copyToClipboard).catch(() => copyToClipboard(originalKey));
          showNotification('Ключ скопирован! Если приложение не открылось — вставьте вручную.');
          btn.innerHTML = originalHtml; btn.disabled = false;
        }, 1000);
      } else {
        setTimeout(attempt, 200);
      }
    }
    setTimeout(attempt, 100);
  }

  function copyV2RayLink() {
    copyToClipboard(originalKey);
    showNotification('VLESS ключ скопирован!');
  }

  function detectDevice() {
    const ua = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isAndroid = /Android/.test(ua);
    const el = document.getElementById('deviceInfo');
    if (!el) return;
    if (isIOS) {
      el.innerHTML = '📱 iOS: Нажмите «Подключиться к VPN». Если не открылось — используйте «Скопировать ссылку».\n';
    } else if (isAndroid) {
      el.innerHTML = '🤖 Android: Нажмите «Подключиться к VPN». Если не открылось — используйте «Скопировать ссылку».\n';
    } else {
      el.innerHTML = '💻 Desktop: Нажмите «Скопировать ссылку» и вставьте в приложение-клиент вручную.';
    }
  }

  window.addEventListener('load', () => {
    try { detectDevice(); } catch(e) {}
    const params = new URLSearchParams(location.search);
    if (params.get('auto') === 'true') {
      setTimeout(connectVPN, 600);
    }
  });
</script>
</body>
</html>`;
}

function htmlDirectPage({ slug }) {
  return `<!DOCTYPE html>
<html lang="ру"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Автоподключение — ${slug}</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);margin:0;padding:20px;min-height:100vh;display:flex;align-items:center;justify-content:center}
.card{background:white;border-radius:16px;padding:32px;max-width:420px;width:100%;box-shadow:0 20px 40px rgba(0,0,0,.1);text-align:center}
.btn{display:inline-block;margin-top:14px;background:#28a745;color:white;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700}
</style></head>
<body>
<div class="card">
  <div style="font-size:40px">⚔️</div>
  <h2>Открываем приложение...</h2>
  <p id="status">Подготовка к подключению</p>
  <a class="btn" id="fallback" style="display:none" href="/u/${encodeURIComponent(slug)}/">Открыть вручную</a>
</div>
<script>
  const cfg = new URL('config.html', window.location.href).toString();
  const deeplink = 'https://deeplink.website/?url=' + encodeURIComponent(cfg);
  let attempts = 0, maxAttempts = 4;
  function attempt(){
    attempts++;
    try{
      if(attempts===1){ location.href = deeplink; }
      else if(attempts===2){ const a=document.createElement('a'); a.href=deeplink; a.style.display='none'; document.body.appendChild(a); a.click(); a.remove(); }
      else if(attempts===3){ window.open(deeplink,'_blank'); }
      else{ document.getElementById('fallback').style.display='inline-block'; }
    }catch(e){}
    if(attempts<maxAttempts) setTimeout(attempt, 200);
  }
  setTimeout(attempt, 100);
</script>
</body></html>`;
}

function htmlQrPage({ slug, vless }) {
  const safeVless = JSON.stringify(vless);
  return `<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>QR — ${slug}</title>
<script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:linear-gradient(135deg,#2c3e50 0%,#34495e 100%);min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0}
.card{background:white;border-radius:18px;box-shadow:0 20px 40px rgba(0,0,0,.2);padding:28px;max-width:420px;width:100%;text-align:center}
#qrcode{margin:0 auto}
.btn{display:inline-block;margin-top:16px;background:#28a745;color:white;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700}
</style></head>
<body>
<div class="card">
  <h2>QR для ${slug}</h2>
  <div id="qrcode"></div>
  <a class="btn" href="/u/${encodeURIComponent(slug)}/">Назад</a>
</div>
<script>
  const text = ${safeVless};
  QRCode.toCanvas(document.getElementById('qrcode'), text, {width:220, margin:2}, function(err){ if(err) console.error(err); });
</script>
</body></html>`;
}

function htmlHome(slugs) {
  const items = slugs.slice(0, 50).map(s => `<li><a href="/u/${encodeURIComponent(s)}/">${s}</a></li>`).join('');
  const more = slugs.length > 50 ? `<p>… и ещё ${slugs.length - 50} (см. <a href="/list">/list</a>)</p>` : '';
  return `<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>LsJ⚔️VPN — Multi</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:40px}
.card{max-width:900px;margin:0 auto;background:#111827;border:1px solid #1f2937;border-radius:16px;padding:24px}
a{color:#93c5fd;text-decoration:none}a:hover{text-decoration:underline}
code{background:#1f2937;padding:2px 6px;border-radius:6px}
ul{columns:2;gap:24px}
</style></head>
<body>
<div class="card">
  <h1>LsJ⚔️VPN — Multi</h1>
  <p>Уникальные ссылки для каждого ключа: <code>/u/&lt;slug&gt;/</code></p>
  <p>Примеры:</p>
  <ul>${items || '<li>Добавьте записи в data/users.json или data/vless.txt</li>'}</ul>
  ${more}
  <hr style="border-color:#1f2937;margin:18px 0">
  <p>API: <a href="/list">/list</a> · Health: <a href="/healthz">/healthz</a></p>
</div>
</body></html>`;
}

// Health
app.get('/healthz', (req, res) => res.type('text/plain').send('ok'));

// List slugs
app.get('/list', (req, res) => {
  res.json({ slugs: Array.from(slugToVless.keys()).sort() });
});

// Home
app.get('/', (req, res) => {
  res.type('html').send(htmlHome(Array.from(slugToVless.keys()).sort()));
});

// Connect page
app.get('/u/:slug/', (req, res) => {
  const slug = req.params.slug;
  const vless = slugToVless.get(slug);
  if (!vless) return notFound(res, slug);
  res.type('html').send(htmlConnectPage({ slug, vless }));
});

// Raw config for deeplink
app.get('/u/:slug/config.html', (req, res) => {
  const slug = req.params.slug;
  const vless = slugToVless.get(slug);
  if (!vless) return notFound(res, slug);
  res.type('text/plain').send(vless + '\n');
});

// Direct auto page
app.get('/u/:slug/direct', (req, res) => {
  const slug = req.params.slug;
  if (!slugToVless.has(slug)) return notFound(res, slug);
  res.type('html').send(htmlDirectPage({ slug }));
});

// QR page
app.get('/u/:slug/qr', (req, res) => {
  const slug = req.params.slug;
  const vless = slugToVless.get(slug);
  if (!vless) return notFound(res, slug);
  res.type('html').send(htmlQrPage({ slug, vless }));
});

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Listening on :' + PORT);
});


