// 全站图片巡检：扫描 dist 所有 HTML，提取图片 URL（src/srcset），核对 dist 内文件存在
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DIST = resolve('dist');
const htmlFiles = [];
(function walk(dir) {
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, f.name);
    if (f.isDirectory()) walk(p);
    else if (f.name.endsWith('.html')) htmlFiles.push(p);
  }
})(DIST);

const urls = new Map();
for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  const rel = file.replace(DIST, '');
  for (const m of html.matchAll(/(?:src|href|srcset)="([^"]+)"/g)) {
    for (const part of m[1].split(',')) {
      const url = part.trim().split(/\s+/)[0];
      if (/^https?:/.test(url)) continue;
      if (/\.(avif|webp|jpe?g|png|svg)(\?|$)/i.test(url) || url.includes('/media/')) {
        if (!urls.has(url)) urls.set(url, []);
        urls.get(url).push(rel);
      }
    }
  }
  const og = html.match(/property="og:image" content="([^"]+)"/);
  if (og) {
    if (!urls.has(og[1])) urls.set(og[1], []);
    urls.get(og[1]).push(rel + ' (og)');
  }
}

let missing = 0;
let checked = 0;
for (const [url, pages] of urls) {
  const path = url.split('?')[0];
  const fsPath = join(DIST, decodeURIComponent(path));
  checked += 1;
  if (!existsSync(fsPath)) {
    missing += 1;
    console.log(`MISSING ${url}  <- ${pages[0]} (${pages.length} refs)`);
  }
}
console.log(`checked ${checked} image refs across ${htmlFiles.length} pages`);
console.log(missing === 0 ? 'ALL OK' : `MISSING ${missing}`);

let tiny = 0;
(function walkMedia(dir) {
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, f.name);
    if (f.isDirectory()) walkMedia(p);
    else {
      const size = statSync(p).size;
      if (size < 200) {
        tiny += 1;
        console.log(`TINY ${p.replace(DIST, '')} (${size}B)`);
      }
    }
  }
})(join(DIST, 'media', 'derivatives'));
console.log(tiny === 0 ? 'no tiny files' : `tiny files: ${tiny}`);
