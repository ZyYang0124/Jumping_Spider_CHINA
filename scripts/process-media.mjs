// 媒体派生脚本：从 media/originals/ 生成 Web 派生图（thumb 400 / medium 1200 / large 2000）。
// 铁律（DEVELOPMENT.md 规则 3、prompt.md §16/§17）：
//   - 原图只读，永不修改；
//   - 派生图一律重新编码并剥离 EXIF（含 GPS），公开输出不携带拍摄位置信息。
// 产物：media/derivatives/{media_id}_{thumb|medium|large}.jpg + manifest.json（宽高）。

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// 生成到 public/ 下，Astro 构建时会原样拷贝进 dist（原图永不出现在公开输出）
const DERIV_DIR = resolve(ROOT, 'public/media/derivatives');

const SIZES = [
  { suffix: 'thumb', width: 400 },
  { suffix: 'medium', width: 1200 },
  { suffix: 'large', width: 2000 },
];

async function main() {
  const media = JSON.parse(readFileSync(resolve(ROOT, 'src/data/media.json'), 'utf-8'));
  const observations = JSON.parse(readFileSync(resolve(ROOT, 'src/data/observations.json'), 'utf-8'));
  mkdirSync(DERIV_DIR, { recursive: true });

  // 只为「已发布且公开」观察的公开媒体生成派生图：
  // 非公开媒体的任何衍生文件都不允许出现在公开输出目录（prompt.md §42）。
  const publishedObs = new Set(
    observations.filter((o) => o.status === 'published' && o.visibility === 'public').map((o) => o.id),
  );
  const publicMedia = media.filter((m) => m.visibility === 'public' && publishedObs.has(m.observation_id));

  const manifest = {};
  let count = 0;

  for (const m of publicMedia) {
    const src = resolve(ROOT, m.source_original);
    // 重新编码 + 旋转归一 + 剥离全部元数据（不调用 keepMetadata/withMetadata）
    const pipeline = sharp(src).rotate();
    const meta = await pipeline.metadata();

    for (const { suffix, width } of SIZES) {
      const out = resolve(DERIV_DIR, `${m.id}_${suffix}.jpg`);
      const info = await pipeline
        .clone()
        .resize({ width, withoutEnlargement: true })
        .jpeg({ quality: suffix === 'thumb' ? 78 : 84, mozjpeg: true })
        .toFile(out);
      count += 1;
      if (suffix === 'medium' || !manifest[m.id]) {
        manifest[m.id] = { width: info.width, height: info.height };
      }
    }

    const finalMeta = await sharp(resolve(DERIV_DIR, `${m.id}_thumb.jpg`)).metadata();
    if (finalMeta.exif) {
      throw new Error(`派生图 ${m.id} 仍含 EXIF——隐私检查失败`);
    }
    void meta;
  }

  writeFileSync(resolve(DERIV_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(
    `已生成 ${count} 张脱敏派生图（${Object.keys(manifest).length}/${media.length} 个媒体，其余为非公开记录）。原图未做任何修改。`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
