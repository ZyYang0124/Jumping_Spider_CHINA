// 嵌入解析：{{observation:SFN-...}} → 卡片 HTML。Studio 预览与静态导出共用，保证所见即所得。
import type { Database } from 'better-sqlite3';
import { observationEmbedHtml } from './article.js';

export function observationEmbedResolver(db: Database): (kind: string, key: string) => string | null {
  return (kind, key) => {
    if (kind !== 'observation') return null;
    const obs = db
      .prepare(
        `SELECT o.public_id, o.observed_at, o.exact_latitude, o.exact_longitude, o.admin1, o.locality,
                i.display_identification, m.file_stem
         FROM observations o
         LEFT JOIN identifications i ON i.observation_id = o.id AND i.is_current = 1
         LEFT JOIN media m ON m.observation_id = o.id AND m.sort_order = 1
         WHERE o.public_id = ?`,
      )
      .get(key) as Record<string, any> | undefined;
    if (!obs) return null;
    return observationEmbedHtml({
      public_id: obs.public_id,
      url: obs.file_stem ? `/media/derivatives/${obs.file_stem}_thumb.jpg` : '/studio.css',
      title: obs.public_id,
      taxon: obs.display_identification ?? 'Salticidae sp.',
      place: [obs.admin1, obs.locality].filter(Boolean).join(' · ') || '地点待补充',
      date: String(obs.observed_at ?? '').slice(0, 10),
    });
  };
}
