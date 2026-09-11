// 从生产 D1 读取已发布札记，本地用同一 Article Renderer 渲染 body_html，
// 生成 src/data/studio-posts.json（导出 zip 的 fflate 解析问题绕行方案）。
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { renderArticle } from '../src/article.js';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..', '..');
const DATA = path.join(ROOT, 'src', 'data');

function d1(sql) {
  const out = execSync(`npx wrangler d1 execute salticid-studio --remote --json --command ${JSON.stringify(sql)}`, {
    cwd: path.join(ROOT, 'studio-remote'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
  });
  return JSON.parse(out)[0].results ?? [];
}

const posts = d1("SELECT * FROM posts WHERE status = 'published' ORDER BY created_at DESC");
const media = JSON.parse(readFileSync(path.join(DATA, 'studio-media.json'), 'utf8'));
const mediaById = Object.fromEntries(media.map((m) => [m.public_id, m]));
const manifest = JSON.parse(readFileSync(path.join(DATA, 'generated', 'media-manifest.json'), 'utf8'));

function articleUrl(m) {
  const widths = JSON.parse(m.variants ?? '[]').filter((v) => v.endsWith('.jpg')).map((v) => parseInt(v, 10)).sort((a, b) => a - b);
  if (!widths.length) return `/media/derivatives/${m.public_id}-480.jpg`;
  const fit = widths.filter((w) => w <= 1280);
  const w = (fit.length ? fit : widths).at(-1);
  return `/media/derivatives/${m.public_id}-${w}.jpg`;
}

const postsOut = posts.map((p) => {
  const html = renderArticle(String(p.body_md ?? ''), {
    mediaRef: (id) => {
      const m = mediaById[id];
      if (!m) return null;
      const dims = manifest[id] || {};
      return {
        url: articleUrl(m),
        ratio: dims.width && dims.height ? dims.width / dims.height : 1.5,
        caption: m.caption,
      };
    },
    embed: (kind, key) => {
      if (kind !== 'observation') return null;
      const obs = JSON.parse(readFileSync(path.join(DATA, 'studio-observations.json'), 'utf8')).find((o) => o.public_id === key);
      if (!obs) return null;
      const loc = JSON.parse(readFileSync(path.join(DATA, 'studio-locations.json'), 'utf8')).find((l) => l.id === obs.location_id);
      const idn = JSON.parse(readFileSync(path.join(DATA, 'studio-identifications.json'), 'utf8')).find((i) => i.observation_id === obs.id && i.is_current);
      const cover = media.find((m) => m.observation_id === obs.id && m.is_cover) || media.find((m) => m.observation_id === obs.id);
      return `<div class="article-embed embed-observation"><a href="${obs.public_id === undefined ? '#' : `/observations/${obs.public_id}/`}">
        <img src="${cover ? articleUrl(cover) : ''}" alt="" loading="lazy" />
        <div class="embed-body"><span class="embed-id">${obs.public_id}</span>
        <strong>${idn ? idn.display_identification : 'Salticidae sp.'}</strong>
        <span>${[loc?.admin1, loc?.locality].filter(Boolean).join(' · ') || '地点待补充'} · ${String(obs.observed_at ?? '').slice(0, 10)}</span></div></a></div>`;
    },
  });
  return {
    id: `studio-post-${p.id}`,
    slug: p.slug,
    title: p.title,
    subtitle: p.subtitle,
    author_name: '咩咩',
    created_at: p.created_at,
    published_at: p.published_at,
    cover_media_public_id: null,
    related_observation_public_ids: [],
    body_md: p.body_md,
    body_html: html,
  };
});

writeFileSync(path.join(DATA, 'studio-posts.json'), JSON.stringify(postsOut, null, 2) + '\n');
for (const p of postsOut) {
  console.log('post:', p.slug, '|', p.title, '| amg-pair:', p.body_html.includes('amg-pair'), '| embed:', p.body_html.includes('embed-observation'), '| 未解析:', p.body_html.includes('media:SFN'), '| htmlLen:', p.body_html.length);
}
