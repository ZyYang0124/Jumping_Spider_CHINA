// 导出：将 studio 中 approved/published 的观察、媒体、博文写为静态站数据文件。
// 与手写数据分离（src/data/studio-*.json），绝不覆盖手工维护的内容；
// 隐私口径与静态管线一致：精确坐标不导出，location_visibility 决定公开层（规则 2）。
import { writeFileSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import type { Database } from 'better-sqlite3';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DATA_DIR = join(ROOT, 'src', 'data');

const ALLOWED_TAGS = [
  ...sanitizeHtml.defaults.allowedTags,
  'img', 'h1', 'h2', 'del', 'ins', 'figure', 'figcaption',
];
const sanitized = (md: string): string =>
  sanitizeHtml(marked.parse(md) as string, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ['src', 'alt', 'title', 'loading', 'width', 'height'],
      a: ['href', 'name', 'target', 'rel'],
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow' }),
    },
  });

export function exportForStaticSite(db: Database): { observations: number; media: number; posts: number } {
  // 仅 approved 之后（approved/published/archived 保留 approved 语义）且观察即将/已经公开的记录。
  // 注意：只有 owner 显式 publish 的内容才进入静态站（规则 4）。
  const observations = db
    .prepare("SELECT * FROM observations WHERE status = 'published' AND visibility = 'public' ORDER BY public_id")
    .all() as Record<string, unknown>[];

  const mediaOut: unknown[] = [];
  const identificationsOut: unknown[] = [];
  for (const o of observations) {
    const mediaRows = db
      .prepare('SELECT * FROM media WHERE observation_id = ? ORDER BY sort_order')
      .all(o.id as number) as Record<string, unknown>[];
    for (const m of mediaRows) {
      mediaOut.push({
        id: m.public_id, // 静态站内部键与稳定编号一致
        public_id: m.public_id,
        observation_id: `studio-${o.id}`, // 与观察记录的内部 id 一致
        source_original: `studio/storage/originals/${m.file_stem}.jpg`,
        view_type: m.view_type,
        caption: m.caption,
        sort_order: m.sort_order,
        is_cover: Boolean(m.is_cover),
        photographer_profile_id: null,
        photographer_name: m.photographer_name,
        license: m.license,
        visibility: 'public',
      });
    }
    const idn = db
      .prepare('SELECT * FROM identifications WHERE observation_id = ? AND is_current = 1 LIMIT 1')
      .get(o.id as number) as Record<string, unknown> | undefined;
    if (idn && idn.taxon_slug) {
      // 规则 6：只有引用了 taxon 记录的鉴定才导出为权威鉴定；
      // taxon_slug 映射回静态站 taxon 表的 id。
      const taxa = JSON.parse(readFileSync(join(DATA_DIR, 'taxa.json'), 'utf-8')) as {
        id: string;
        slug: string;
      }[];
      const taxon = taxa.find((t) => t.slug === idn.taxon_slug);
      if (!taxon) throw new Error(`未知 taxon slug：${idn.taxon_slug}`);
      identificationsOut.push({
        id: `studio-${idn.id}`,
        observation_id: `studio-${o.id}`,
        taxon_id: taxon.id,
        display_identification: idn.display_identification,
        identified_by_profile_id: null,
        identified_by_text: idn.identified_by,
        identified_at: idn.identified_at,
        evidence: idn.evidence,
        remarks: idn.remarks,
        is_current: true,
      });
    }
  }

  // 静态站观察记录结构：location 以私有源格式写出（含 exact_*），
  // 由静态隐私管线（src/lib/privacy.ts）在构建期统一脱敏——公开产物仍不含精确坐标。
  const observationsOut = observations.map((o) => ({
    id: `studio-${o.id}`,
    public_id: o.public_id,
    created_by: 'prof-zhiyong',
    observer: 'prof-zhiyong',
    observed_at: o.observed_at,
    observed_at_precision: o.observed_at_precision,
    location_id: `loc-studio-${o.id}`,
    sex: o.sex,
    life_stage: o.life_stage,
    habitat: o.habitat,
    microhabitat: o.microhabitat,
    behavior: o.behavior,
    field_note: o.field_note,
    status: o.status,
    visibility: o.visibility,
    trip_id: null,
  }));

  // 内联私有 location 记录（精确坐标只存在于私有源数据层，构建后不会出现在产物中）
  const locationsOut = observations.map((o) => ({
    id: `loc-studio-${o.id}`,
    country_code: o.country_code,
    country_name: o.country_name,
    admin1: o.admin1,
    admin2: o.admin2,
    locality: o.locality,
    site_name: o.site_name,
    exact_latitude: o.exact_latitude,
    exact_longitude: o.exact_longitude,
    public_latitude: o.public_latitude,
    public_longitude: o.public_longitude,
    coordinate_uncertainty_m: o.coordinate_uncertainty_m,
    elevation_m: o.elevation_m,
    location_visibility: o.location_visibility,
  }));

  const posts = db
    .prepare("SELECT * FROM posts WHERE status = 'published' ORDER BY created_at DESC")
    .all() as Record<string, unknown>[];
  const postsOut = posts.map((p) => {
    const cover = p.cover_media_id
      ? (db.prepare('SELECT public_id FROM media WHERE id = ?').get(p.cover_media_id as number) as { public_id: string } | undefined)
      : undefined;
    return {
      id: `studio-post-${p.id}`,
      slug: p.slug,
      title: p.title,
      author_name: '杨智勇',
      created_at: p.created_at,
      cover_media_public_id: cover?.public_id ?? null,
      related_observation_public_ids: JSON.parse(String(p.related_observation_public_ids ?? '[]')),
      body_md: p.body_md,
      body_html: sanitized(String(p.body_md)),
    };
  });

  writeJson(join(DATA_DIR, 'studio-observations.json'), observationsOut);
  writeJson(join(DATA_DIR, 'studio-locations.json'), locationsOut);
  writeJson(join(DATA_DIR, 'studio-media.json'), mediaOut);
  writeJson(join(DATA_DIR, 'studio-identifications.json'), identificationsOut);
  writeJson(join(DATA_DIR, 'studio-posts.json'), postsOut);

  return { observations: observationsOut.length, media: mediaOut.length, posts: postsOut.length };
}

function writeJson(path: string, data: unknown): void {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { openDb, migrate } = await import('./db.js');
  migrate();
  const db = openDb();
  console.log(exportForStaticSite(db));
  db.close();
}
