// 嵌入与媒体引用解析（D1 版）。renderArticle 的回调是同步的，
// 所以先从 Markdown 收集引用编号、批量预取，再返回同步闭包。
import { all, get, type Env, type Row } from './db';
import { articleUrl, type MediaRow } from './media';
import { observationEmbedHtml } from './article';

export interface RenderResolvers {
  mediaRef: (id: string) => { url: string; ratio: number; caption: string | null } | null;
  embed: (kind: string, key: string) => string | null;
}

const MEDIA_REF_RE = /!\[[^\]]*\]\(media:([^)]+)\)/g;
const EMBED_RE = /\{\{(observation|species|trip|place):([^}]+)\}\}/g;

async function prefetch(env: Env, bodyMd: string): Promise<{
  mediaById: Map<string, MediaRow>;
  obsById: Map<string, Row>;
}> {
  const mediaIds = new Set<string>();
  const obsIds = new Set<string>();
  for (const m of bodyMd.matchAll(MEDIA_REF_RE)) mediaIds.add(m[1].trim());
  for (const e of bodyMd.matchAll(EMBED_RE)) if (e[1] === 'observation') obsIds.add(e[2].trim());

  const mediaById = new Map<string, MediaRow>();
  for (const id of mediaIds) {
    const row = await get<MediaRow>(env.DB, 'SELECT * FROM media WHERE public_id = ?', id);
    if (row) mediaById.set(id, row);
  }

  const obsById = new Map<string, Row>();
  for (const id of obsIds) {
    const obs = await get<Row>(
      env.DB,
      `SELECT o.public_id, o.observed_at, o.admin1, o.locality,
              i.display_identification
       FROM observations o
       LEFT JOIN identifications i ON i.observation_id = o.id AND i.is_current = 1
       WHERE o.public_id = ?`,
      id,
    );
    if (obs) {
      const cover = await get<MediaRow>(
        env.DB,
        'SELECT * FROM media WHERE observation_id = (SELECT id FROM observations WHERE public_id = ?) AND is_cover = 1',
        id,
      );
      obsById.set(id, { ...obs, cover });
    }
  }
  return { mediaById, obsById };
}

/** 预取并返回同步解析器（与本地 studio 预览、导出共用同一渲染语义） */
export async function buildResolvers(env: Env, bodyMd: string): Promise<RenderResolvers> {
  const { mediaById, obsById } = await prefetch(env, bodyMd);
  return {
    mediaRef: (id) => {
      const m = mediaById.get(id);
      if (!m) return null;
      return {
        url: articleUrl(m),
        ratio: m.width && m.height ? m.width / m.height : 1.5,
        caption: m.caption,
      };
    },
    embed: (kind, key) => {
      if (kind !== 'observation') return null;
      const obs = obsById.get(key);
      if (!obs) return null;
      const cover = obs.cover as MediaRow | undefined;
      return observationEmbedHtml({
        public_id: obs.public_id,
        url: cover ? articleUrl(cover) : '/studio.css',
        title: obs.public_id,
        taxon: obs.display_identification ?? 'Salticidae sp.',
        place: [obs.admin1, obs.locality].filter(Boolean).join(' · ') || '地点待补充',
        date: String(obs.observed_at ?? '').slice(0, 10),
      });
    },
  };
}

/** 供导出与预览共用：批量渲染多篇正文（每篇独立预取） */
export async function renderBody(env: Env, bodyMd: string): Promise<string> {
  const { renderArticle } = await import('./article');
  const resolvers = await buildResolvers(env, bodyMd);
  return renderArticle(bodyMd, resolvers);
}

export { all };
