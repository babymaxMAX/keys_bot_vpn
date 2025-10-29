#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const [, , inputPath, baseArg] = process.argv;
if (!inputPath) {
  console.error('Usage: node scripts/generate-links.js <vless.txt> [baseUrl]');
  process.exit(1);
}
const baseUrl = (baseArg || 'https://keys-bot-vpn.onrender.com').replace(/\/$/, '');

function sanitizeId(s){return String(s||'').toLowerCase().replace(/[^a-z0-9-_]+/g,'-').replace(/^-+|-+$/g,'').slice(0,64)||'key'}
function uuidFrom(v){const m=/^vless:\/\/([0-9a-fA-F-]+)@/.exec(v);return m?m[1]:null}
function tagFrom(v){const i=v.indexOf('#');return i>=0?decodeURIComponent(v.slice(i+1)):null}

const src = fs.readFileSync(path.resolve(inputPath), 'utf8')
  .split(/\r?\n/).map(s=>s.trim()).filter(Boolean);

const used = new Set();
const lines = [];
for (const line of src) {
  if (!/^vless:\/\//.test(line)) continue;
  const t = tagFrom(line) || uuidFrom(line) || 'key';
  let id = sanitizeId(t); let n = 2; while (used.has(id)) { id = sanitizeId(t + (n===2?'-2':'-'+n)); n++; }
  used.add(id);
  lines.push(`${baseUrl}/k/${encodeURIComponent(id)}`);
}

const out = lines.join('\n');
fs.writeFileSync('links.txt', out + '\n');
console.log(out);
console.error(`\nGenerated ${lines.length} links. Saved to links.txt`);


