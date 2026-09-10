// 导出：把已发布内容打成一个 zip（JSON + 原图 + 说明），由站长解压进仓库再构建发布。
// 设计：远程 Studio 不持有 GitHub 凭据（v1）；GitHub 仍是唯一源码真源（规则 5）。
import { zipSync, strToU8 } from 'fflate';
import { all, get, type Env } from './db';
import { renderBody } from './embeds';
import taxaJson from './taxa-data.json';

const README = `Salticid Notes · Field Studio 导出包

内容：
  studio-observations.json     → src/data/studio-observations.json
  studio-locations.json        → src/data/studio-locations.json
  studio-media.json            → src/data/studio-media.json
  studio-identifications.json  → src/data/studio-identifications.json
  studio-posts.json            → src/data/studio-posts.json
  originals/                   → media/originals/（新增编号的原图，已存在的编号直接覆盖同名新文件即可）

步骤：
  1. 把上述文件放入仓库对应位置；
  2. npm run build && npm run test:privacy（必须通过）；
  3. git commit && git push —— Cloudflare 自动构建上线。

坐标口径（Studio SOP §7）：观察坐标全量精确公开；未发布记录不会出现在导出中。
`;

export interface ExportData {
  observationsJson: string;
  locationsJson: string;
  mediaJson: string;
  identificationsJson: string;
  postsJson: string;
  /** key 形如 originals/SFN-M-000001.jpg */
  originals: Record<string, Uint8Array>;
}

export async function collectExport(env: Env): Promise<ExportData> {
  const observations = await all(env.DB, "SELECT * FROM observations WHERE status = 'published' AND visibility = 'public' ORDER BY public_id");

  const mediaOut: unknown[] = [];
  const identificationsOut: unknown[] = [];
  const originalFiles: Record<string, Uint8Array> = {};
  const exportedMediaIds = new Set<string>();

  for (const o of observations) {
    const mediaRows = await all<any>(env.DB, 'SELECT * FROM media WHERE observation_id = ? ORDER BY sort_order', o.id);
    for (const m of mediaRows) {
      exportedMediaIds.add(m.public_id);
      mediaOut.push({
        id: m.public_id,
        public_id: m.public_id,
        observation_id: `studio-${o.id}`,
        source_original: `media/originals/${m.public_id}${m.orig_ext}`,
        view_type: m.view_type,
        caption: m.caption,
        sort_order: m.sort_order,
        is_cover: Boolean(m.is_cover),
        photographer_profile_id: null,
        photographer_name: m.photographer_name,
        license: m.license,
        visibility: 'public',
      });
      const obj = await env.MEDIA.get(`originals/${m.public_id}${m.orig_ext}`);
      if (obj) originalFiles[`originals/${m.public_id}${m.orig_ext}`] = new Uint8Array(await obj.arrayBuffer());
    }
    const idn = await get<any>(env.DB, 'SELECT * FROM identifications WHERE observation_id = ? AND is_current = 1 LIMIT 1', o.id);
    if (idn && idn.taxon_slug) {
      // 规则 6：只有引用 taxon 记录的鉴定才是权威鉴定；slug 映射回静态站 taxon 表 id
      const taxon = (taxaJson as { id: string; slug: string }[]).find((t) => t.slug === idn.taxon_slug);
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

  // 静态站隐私管线（src/lib/privacy.ts）从 taxon_slug 解析权威类群；这里直接给出 slug 列
  const observationsOut = observations.map((o: any) => ({
    id: `studio-${o.id}`,
    public_id: o.public_id,
    created_by: 'prof-zhiyong',
    observer: 'prof-zhiyong',
    observed_at: o.observed_at,
    observed_at_precision: o.observed_at_precision,
    location_id: `loc-studio-${o.id}`,
    sex: o.sex,
    life_stage: o.life_stage,
    count: o.count,
    habitat: o.habitat,
    microhabitat: o.microhabitat,
    behavior: o.behavior,
    plant: o.plant,
    weather: o.weather,
    field_note: o.field_note,
    status: o.status,
    visibility: o.visibility,
    trip_id: o.trip_slug || null,
  }));

  const locationsOut = observations.map((o: any) => ({
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

  const posts = await all<any>(env.DB, "SELECT * FROM posts WHERE status = 'published' ORDER BY created_at DESC");
  const postsOut = [];
  for (const p of posts) {
    const bodyMd = String(p.body_md ?? '');
    // 札记独立插图（不挂观察）：出现在已发布正文的 media: 引用也要随包导出，
    // observation_id 置 null（公开站 store 校验允许；仅服务札记正文，不出现在观察页）
    for (const ref of bodyMd.matchAll(/!\[[^\]]*\]\(media:([^)\s]+)\)/g)) {
      const pid = ref[1].trim();
      if (exportedMediaIds.has(pid)) continue;
      const m = await get<any>(env.DB, 'SELECT * FROM media WHERE public_id = ?', pid);
      if (!m) continue;
      mediaOut.push({
        id: m.public_id,
        public_id: m.public_id,
        observation_id: null,
        source_original: `media/originals/${m.public_id}${m.orig_ext}`,
        view_type: m.view_type,
        caption: m.caption,
        sort_order: 1,
        is_cover: false,
        photographer_profile_id: null,
        photographer_name: m.photographer_name,
        license: m.license,
        visibility: 'public',
      });
      exportedMediaIds.add(pid);
      const obj = await env.MEDIA.get(`originals/${m.public_id}${m.orig_ext}`);
      if (obj) originalFiles[`originals/${m.public_id}${m.orig_ext}`] = new Uint8Array(await obj.arrayBuffer());
    }
    // 封面：posts.cover_media_id → 媒体稳定编号（公开站 postCover 依赖此字段）
    const coverRow = p.cover_media_id
      ? await get<{ public_id: string }>(env.DB, 'SELECT public_id FROM media WHERE id = ?', p.cover_media_id)
      : undefined;
    postsOut.push({
      id: `studio-post-${p.id}`,
      slug: p.slug,
      title: p.title,
      subtitle: p.subtitle,
      author_name: '站长',
      created_at: p.created_at,
      published_at: p.published_at,
      cover_media_public_id: coverRow?.public_id ?? null,
      related_observation_public_ids: JSON.parse(String(p.related_observation_public_ids ?? '[]')) as string[],
      body_md: bodyMd,
      body_html: await renderBody(env, bodyMd),
    });
  }

  const j = (v: unknown) => JSON.stringify(v, null, 2) + '\n';
  return {
    observationsJson: j(observationsOut),
    locationsJson: j(locationsOut),
    mediaJson: j(mediaOut),
    identificationsJson: j(identificationsOut),
    postsJson: j(postsOut),
    originals: originalFiles,
  };
}

/** 打包为 zip 下载（手动导出备份用） */
export async function buildExportZip(env: Env): Promise<Uint8Array> {
  const data = await collectExport(env);
  const u8 = (s: string) => strToU8(s);
  return zipSync({
    'README.txt': strToU8(README),
    'studio-observations.json': u8(data.observationsJson),
    'studio-locations.json': u8(data.locationsJson),
    'studio-media.json': u8(data.mediaJson),
    'studio-identifications.json': u8(data.identificationsJson),
    'studio-posts.json': u8(data.postsJson),
    ...Object.fromEntries(Object.entries(data.originals).map(([k, v]) => [k, v])),
  });
}
