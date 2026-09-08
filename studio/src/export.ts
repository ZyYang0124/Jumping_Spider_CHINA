// 导出：将 studio 中已发布的观察、媒体、札记写为静态站数据文件。
// 与手写数据分离（src/data/studio-*.json），绝不覆盖手工维护的内容；
// 坐标口径与静态管线一致（Studio SOP §7）：观察坐标全量精确公开（单一坐标模型）。
import { writeFileSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Database } from 'better-sqlite3';
import { renderArticle } from './article.js';
import { observationEmbedResolver } from './embeds.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DATA_DIR = join(ROOT, 'src', 'data');

export function exportForStaticSite(db: Database): { observations: number; media: number; posts: number } {
  // 札记正文与 Studio 预览共用 Article Renderer，media: 编号解析为公开派生图路径
  const renderPost = (md: string): string =>
    renderArticle(md, {
      mediaRef: (id) => {
        const m = db.prepare('SELECT file_stem, width, height, caption FROM media WHERE public_id = ?').get(id) as
          | { file_stem: string; width: number | null; height: number | null; caption: string | null }
          | undefined;
        if (!m) return null;
        // _medium 为管线对每张公开图必产的档位（1200px）
        return {
          url: `/media/derivatives/${m.file_stem}_medium.jpg`,
          ratio: m.width && m.height ? m.width / m.height : 1.5,
          caption: m.caption,
        };
      },
      embed: observationEmbedResolver(db),
    });
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
        source_original: `media/originals/${m.file_stem}.jpg`,
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

  // 静态站观察记录结构：location 使用单一坐标模型（latitude/longitude 即公开坐标）。
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
    trip_id: o.trip_slug || null,
  }));

  const locationsOut = observations.map((o) => ({
    id: `loc-studio-${o.id}`,
    country_code: o.country_code ?? '',
    country_name: o.country_name ?? '',
    admin1: o.admin1 ?? '',
    admin2: o.admin2,
    locality: o.locality,
    site_name: o.site_name,
    latitude: o.exact_latitude,
    longitude: o.exact_longitude,
    elevation_m: o.elevation_m,
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
      body_html: renderPost(String(p.body_md)),
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
