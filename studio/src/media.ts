// 媒体管线：上传校验 → 原图保存（不可变）→ sharp 派生（thumb/medium/large，剥离全部 EXIF）
// → 稳定编号 CSFN-M-NNNNNN。与静态站管线同一口径（规则 2/3、prompt.md §16/§17）。
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import type { Database } from 'better-sqlite3';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const ORIGINALS_DIR = join(ROOT, 'studio', 'storage', 'originals');
export const DERIVATIVES_DIR = join(ROOT, 'public', 'media', 'derivatives');
const MANIFEST_PATH = join(DERIVATIVES_DIR, 'manifest.json');

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png']);
const MAX_SIZE = 30 * 1024 * 1024;

export function validateUpload(file: { mimetype: string; size: number }): string | null {
  if (!ALLOWED_MIME.has(file.mimetype)) return '仅支持 JPG / PNG 图片。';
  if (file.size > MAX_SIZE) return '单张图片不能超过 30MB。';
  return null;
}

function nextMediaId(db: Database): string {
  // SFN-M-NNNNNN（SOP §56）；历史 CSFN-M-* 已公开编号不受影响（§33 共存）
  const row = db.prepare("SELECT value FROM counters WHERE name = 'sfn-media'").get() as { value: number };
  const next = row.value + 1;
  db.prepare("UPDATE counters SET value = ? WHERE name = 'sfn-media'").run(next);
  return `SFN-M-${String(next).padStart(6, '0')}`;
}

function nextObservationId(db: Database, year: number): string {
  const name = `sfn-observation-${year}`;
  const row = db.prepare('SELECT value FROM counters WHERE name = ?').get(name) as { value: number } | undefined;
  if (!row) {
    db.prepare('INSERT INTO counters (name, value) VALUES (?, 0)').run(name);
    return `SFN-${year}-000001`;
  }
  const next = row.value + 1;
  db.prepare('UPDATE counters SET value = ? WHERE name = ?').run(next, name);
  return `SFN-${year}-${String(next).padStart(6, '0')}`;
}

function nextPostSlugSeq(db: Database): number {
  const row = db.prepare("SELECT value FROM counters WHERE name = 'post'").get() as { value: number };
  const next = row.value + 1;
  db.prepare("UPDATE counters SET value = ? WHERE name = 'post'").run(next);
  return next;
}

export interface SavedMedia {
  publicId: string;
  fileStem: string;
  width: number;
  height: number;
}

/** 保存一张上传图：原图不动地存档，派生图重编码并剥离全部 EXIF */
export async function saveUploadedPhoto(
  db: Database,
  file: { buffer: Buffer; originalname: string },
): Promise<SavedMedia> {
  mkdirSync(ORIGINALS_DIR, { recursive: true });
  mkdirSync(DERIVATIVES_DIR, { recursive: true });

  const publicId = nextMediaId(db);
  const fileStem = publicId; // 文件名只承载编号，不含学名/地名（规则 7 同源原则）
  const originalPath = join(ORIGINALS_DIR, `${fileStem}${extOf(file.originalname)}`);

  // 原图按上传字节原样存档（不做任何修改）
  writeFileSync(originalPath, file.buffer);

  // 派生图：rotate 归一 + 重新编码，不保留任何元数据（EXIF/GPS 全部剥离）
  const pipeline = sharp(file.buffer).rotate();
  const meta = await pipeline.metadata();
  const sizes: [string, number][] = [
    ['thumb', 400],
    ['medium', 1200],
    ['large', 2000],
  ];
  let dims = { width: meta.width ?? 0, height: meta.height ?? 0 };
  for (const [suffix, width] of sizes) {
    const info = await pipeline
      .clone()
      .resize({ width, withoutEnlargement: true })
      .jpeg({ quality: suffix === 'thumb' ? 78 : 84, mozjpeg: true })
      .toFile(join(DERIVATIVES_DIR, `${fileStem}_${suffix}.jpg`));
    if (suffix === 'medium') dims = { width: info.width, height: info.height };
  }
  updateManifest(fileStem, dims.width, dims.height);
  return { publicId, fileStem, width: dims.width, height: dims.height };
}

function updateManifest(stem: string, width: number, height: number): void {
  let manifest: Record<string, { width: number; height: number }> = {};
  try {
    manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
  } catch {
    /* 首次生成 */
  }
  manifest[stem] = { width, height };
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

function extOf(name: string): string {
  const m = /\.(\.[a-z0-9]+)$/i.exec(name);
  return m ? m[1] : '.jpg';
}

export { nextObservationId, nextPostSlugSeq, ROOT };
