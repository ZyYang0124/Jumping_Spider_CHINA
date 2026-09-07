// 公开数据安全测试（prompt.md §42 / §51）：
// 构建完成后运行，直接扫描 dist 产物，验证访客拿不到任何不该拿的东西。

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(ROOT, 'dist');

const locations = JSON.parse(readFileSync(resolve(ROOT, 'src/data/locations.json'), 'utf-8'));
const observations = JSON.parse(readFileSync(resolve(ROOT, 'src/data/observations.json'), 'utf-8'));
const media = JSON.parse(readFileSync(resolve(ROOT, 'src/data/media.json'), 'utf-8'));

const failures = [];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// 1. 模糊化/仅地名/隐藏 记录的精确坐标不得出现在任何产物中
const forbiddenCoords = new Set();
for (const l of locations) {
  if (l.location_visibility !== 'exact') {
    if (l.exact_latitude != null) forbiddenCoords.add(String(l.exact_latitude));
    if (l.exact_longitude != null) forbiddenCoords.add(String(l.exact_longitude));
  }
}

// 2. 草稿与投稿记录不得出现
const forbiddenIds = observations
  .filter((o) => o.status !== 'published')
  .map((o) => o.public_id);

// 3. 非公开媒体不得出现（内部 id 与稳定公开编号都要查）
const forbiddenMedia = media
  .filter((m) => m.visibility !== 'public')
  .flatMap((m) => [m.id, m.public_id].filter(Boolean));

// 4. 公开产物中不得出现私有字段名
const forbiddenKeys = ['exact_latitude', 'exact_longitude', 'exif_json_private'];

const files = walk(DIST).filter((f) => ['.html', '.json', '.js', '.xml', '.txt'].includes(extname(f)));
let textHits = 0;
for (const f of files) {
  const text = readFileSync(f, 'utf-8');
  for (const c of forbiddenCoords) {
    if (text.includes(c)) {
      failures.push(`精确坐标泄露：${c} 出现在 ${f}`);
      textHits += 1;
    }
  }
  for (const id of forbiddenIds) {
    if (text.includes(id)) {
      failures.push(`未发布记录泄露：${id} 出现在 ${f}`);
      textHits += 1;
    }
  }
  for (const id of forbiddenMedia) {
    if (text.includes(id)) {
      failures.push(`非公开媒体泄露：${id} 出现在 ${f}`);
      textHits += 1;
    }
  }
  for (const k of forbiddenKeys) {
    if (text.includes(k)) {
      failures.push(`私有字段名泄露：${k} 出现在 ${f}`);
      textHits += 1;
    }
  }
}
void textHits;

// 5. dist 中的媒体派生图必须已剥离 EXIF（含 GPS）
const imageFiles = walk(join(DIST, 'media')).filter((f) => extname(f) === '.jpg');
for (const f of imageFiles) {
  const meta = await sharp(f).metadata();
  if (meta.exif) {
    failures.push(`派生图含 EXIF：${f}`);
  }
}

// 6. 非公开媒体的派生图文件不得存在于 dist
const distMediaFiles = walk(join(DIST, 'media')).map((f) => f.split(/[\\/]/).pop());
for (const id of forbiddenMedia) {
  if (distMediaFiles.some((n) => n.startsWith(id))) {
    failures.push(`非公开媒体的派生图存在于 dist：${id}`);
  }
}

if (failures.length > 0) {
  console.error(`\n隐私测试失败（${failures.length} 项）：`);
  for (const msg of failures) console.error(` - ${msg}`);
  process.exit(1);
} else {
  console.log(
    `隐私测试通过：${files.length} 个文本产物未泄露精确坐标/未发布记录/非公开媒体；` +
      `${imageFiles.length} 张派生图均已剥离 EXIF。`,
  );
}
