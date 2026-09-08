// 媒体管线（Studio 上传侧）：上传校验 → 原图存档（不可变）→ sharp 派生
// （多宽度 × AVIF/WebP/JPEG + thumb/medium/large，剥离全部 EXIF）
// → 稳定编号 SFN-M-NNNNNN。与 scripts/process-media.mjs 同一口径（规则 2/3/20/21）。
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import type { Database } from 'better-sqlite3';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const ORIGINALS_DIR = join(ROOT, 'studio', 'storage', 'originals');
export const DERIVATIVES_DIR = join(ROOT, 'public', 'media', 'derivatives');
const MANIFEST_OUT = resolve(ROOT, 'src', 'data', 'generated', 'media-manifest.json');
const LEGACY_MANIFEST = join(DERIVATIVES_DIR, 'manifest.json');

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png']);
const MAX_SIZE = 30 * 1024 * 1024;
const WIDTHS = [480, 768, 1280, 1920];

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

function readManifest(): Record<string, { width: number; height: number; variants: number[] }> {
  try {
    return JSON.parse(readFileSync(MANIFEST_OUT, 'utf-8'));
  } catch {
    return {};
  }
}

function writeManifest(manifest: unknown): void {
  mkdirSync(dirname(MANIFEST_OUT), { recursive: true });
  writeFileSync(MANIFEST_OUT, JSON.stringify(manifest, null, 2));
  try {
    writeFileSync(LEGACY_MANIFEST, JSON.stringify(manifest, null, 2));
  } catch {}
}

/** 保存一张上传图：原图按字节存档（不修改），派生图重编码并剥离全部 EXIF */
export async function saveUploadedPhoto(
  db: Database,
  file: { buffer: Buffer; originalname: string },
): Promise<SavedMedia> {
  mkdirSync(ORIGINALS_DIR, { recursive: true });
  mkdirSync(DERIVATIVES_DIR, { recursive: true });
  mkdirSync(dirname(MANIFEST_OUT), { recursive: true });

  const publicId = nextMediaId(db);
  const fileStem = publicId; // 文件名只承载编号，不含学名/地名
  const originalPath = join(ORIGINALS_DIR, `${fileStem}${extOf(file.originalname)}`);

  // 原图按上传字节原样存档（不做任何修改）
  writeFileSync(originalPath, file.buffer);

  // 派生图：rotate 归一 + 重新编码，不保留任何元数据（EXIF/GPS 全部剥离）
  const pipeline = sharp(file.buffer).rotate();
  const meta = await pipeline.metadata();
  const intrinsicW = meta.width ?? 0;

  const widths = WIDTHS.filter((w) => w <= intrinsicW);
  if (widths.length === 0) widths.push(WIDTHS[0]);

  let dims = { width: intrinsicW, height: meta.height ?? 0 };
  for (const w of widths) {
    const info = await pipeline
      .clone()
      .resize({ width: w, withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toFile(join(DERIVATIVES_DIR, `${fileStem}-${w}.jpg`));
    if (w === widths[0]) dims = { width: info.width, height: info.height };
    const avif = await pipeline
      .clone()
      .resize({ width: w, withoutEnlargement: true })
      .avif({ quality: 45 })
      .toBuffer();
    writeFileSync(join(DERIVATIVES_DIR, `${fileStem}-${w}.avif`), avif);
    const webp = await pipeline
      .clone()
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: 72 })
      .toBuffer();
    writeFileSync(join(DERIVATIVES_DIR, `${fileStem}-${w}.webp`), webp);
  }

  // 兼容旧引用：thumb/medium/large JPG
  for (const [suffix, width] of [
    ['thumb', 400],
    ['medium', 1200],
    ['large', 2000],
  ] as const) {
    await pipeline
      .clone()
      .resize({ width, withoutEnlargement: true })
      .jpeg({ quality: suffix === 'thumb' ? 78 : 84, mozjpeg: true })
      .toFile(join(DERIVATIVES_DIR, `${fileStem}_${suffix}.jpg`));
  }

  const manifest = readManifest();
  manifest[fileStem] = {
    width: intrinsicW,
    height: meta.height ?? 0,
    variants: widths,
  };
  writeManifest(manifest);

  return { publicId, fileStem, width: dims.width, height: dims.height };
}

function extOf(name: string): string {
  const m = /\.(\.[a-z0-9]+)$/i.exec(name);
  return m ? m[1] : '.jpg';
}

export { nextObservationId, nextPostSlugSeq, ROOT };
