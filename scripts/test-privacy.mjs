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
let textHits = 0;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// 1. 坐标政策（Studio SOP §7）：观察坐标全量精确公开，已无模糊化层级。
//    守卫对象改为「未发布观察的坐标」：草稿/私密记录的坐标同样不得出现在公开产物中。
const forbiddenCoords = new Set();
const publicObsIds = new Set(observations.filter((o) => o.status === 'published' && o.visibility === 'public').map((o) => o.id));
const studioLocations = (() => {
  try { return JSON.parse(readFileSync(resolve(ROOT, 'src/data/studio-locations.json'), 'utf-8')); }
  catch { return []; }
})();
const studioObs = (() => {
  try { return JSON.parse(readFileSync(resolve(ROOT, 'src/data/studio-observations.json'), 'utf-8')); }
  catch { return []; }
})();
const locationOwnerIsPrivate = (locId) => {
  const own = observations.find((o) => o.location_id === locId);
  if (own) return !publicObsIds.has(own.id);
  const sObs = studioObs.find((o) => o.location_id === locId);
  if (sObs) return !(sObs.status === 'published' && sObs.visibility === 'public');
  return false;
};
for (const l of [...locations, ...studioLocations]) {
  if (locationOwnerIsPrivate(l.id)) {
    if (l.latitude != null) forbiddenCoords.add(String(l.latitude));
    if (l.longitude != null) forbiddenCoords.add(String(l.longitude));
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

// 4. 公开产物中不得出现私有字段名（坐标已全量精确公开，exact_* 双轨列名随旧模型废除）
const forbiddenKeys = ['exact_latitude', 'exact_longitude', 'exif_json_private', 'location_visibility'];

const files = walk(DIST).filter((f) => ['.html', '.json', '.js', '.xml', '.txt'].includes(extname(f)));

// SSR 模式：dist/_worker.js/ 是服务端 Worker 包（在 Cloudflare 边缘执行，永不发送给浏览器），
// 其中包含数据库层的精确坐标与未发布记录属服务端设计（SOP §53 禁止的是到达客户端）。
// 其不可公开性由 dist/.assetsignore 保证 —— 见下方断言 7。
const isServerBundle = (f) => f.includes('_worker.js') || f.endsWith('.assetsignore');
const publicSurfaceFiles = files.filter((f) => !isServerBundle(f));

for (const f of publicSurfaceFiles) {
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


// 5. SSR Worker 包的不可公开性：dist/.assetsignore 必须存在且包含 _worker.js（Wrangler 安全检查依赖它）
const assetsignorePath = join(DIST, '.assetsignore');
if (!statSync(assetsignorePath).isFile()) {
  failures.push('缺少 dist/.assetsignore —— 服务端 _worker.js 可能被当作公开资产上传');
} else {
  const content = readFileSync(assetsignorePath, 'utf-8');
  const lines = content.split(/\r?\n/).map((l) => l.trim());
  if (!lines.includes('_worker.js')) {
    failures.push('dist/.assetsignore 未包含 _worker.js —— 服务端 Worker 包可能被公开上传');
  }
}

// 6. dist 中的媒体派生图必须已剥离 EXIF（含 GPS）
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
    `隐私测试通过：${publicSurfaceFiles.length} 个客户端可见文本产物未泄露精确坐标/未发布记录/非公开媒体；` +
      `${imageFiles.length} 张派生图均已剥离 EXIF；服务端 Worker 包未列入公开资产。`,
  );
}
