#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const __dirname = path.resolve();
const TOOLS_DIR = path.join(__dirname, 'tools');
const IN_DIR = path.join(TOOLS_DIR, 'inbox');
const OUT_DIR = path.join(TOOLS_DIR, 'outbox');
const CFG_PATH = path.join(TOOLS_DIR, 'config.json');

if (!fs.existsSync(IN_DIR)) fs.mkdirSync(IN_DIR, { recursive: true });
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

let cfg = { baseUrl: 'https://keys-bot-vpn.onrender.com', outputExtension: '.links.txt' };
try { cfg = { ...cfg, ...JSON.parse(fs.readFileSync(CFG_PATH, 'utf8')) }; } catch {}

function sanitizeId(s){ return String(s||'').toLowerCase().replace(/[^a-z0-9-_]+/g,'-').replace(/^-+|-+$/g,'').slice(0,64)||'key'; }
function uuidFrom(v){ const m=/^vless:\/\/([0-9a-fA-F-]+)@/.exec(v); return m?m[1]:null; }
function tagFrom(v){ const i=v.indexOf('#'); return i>=0?decodeURIComponent(v.slice(i+1)):null; }

function processFile(srcPath){
  const name = path.basename(srcPath).replace(/\.[^/.]+$/, '');
  const base = (cfg.baseUrl || '').replace(/\/$/, '');
  const used = new Set();
  const lines = fs.readFileSync(srcPath, 'utf8').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const outLinks = [];
  for (const line of lines) {
    if (!/^vless:\/\//.test(line)) continue;
    const t = tagFrom(line) || uuidFrom(line) || 'key';
    let id = sanitizeId(t); let n=2; while(used.has(id)) { id = sanitizeId(t + (n===2?'-2':'-'+n)); n++; }
    used.add(id);
    outLinks.push(`${base}/k/${encodeURIComponent(id)}`);
  }
  const outPath = path.join(OUT_DIR, name + (cfg.outputExtension || '.links.txt'));
  fs.writeFileSync(outPath, outLinks.join('\n') + '\n');
  console.log(`Processed ${srcPath} -> ${outPath} (${outLinks.length} links)`);
}

const entries = fs.readdirSync(IN_DIR).filter(f => f.toLowerCase().endsWith('.txt'));
if (entries.length === 0) {
  console.log('Place .txt files with VLESS lines into tools/inbox and rerun.');
  process.exit(0);
}
for (const f of entries) processFile(path.join(IN_DIR, f));


