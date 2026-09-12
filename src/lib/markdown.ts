// 构建期文章渲染器（手写野外笔记用）：Studio renderArticle 的公开站子集。
// 支持：## 小节标题、段落、![图注](media:编号) 图片引用。输出与 Studio 文章相同的结构类名，
// 由 story-body 样式统一呈现（§Post Detail）。
import type { PublicMedia } from './privacy';

export function renderBodyMd(md: string, resolveMedia: (publicId: string) => PublicMedia | null): string {
  const blocks = md.split(/\n{2,}/);
  const out: string[] = [];
  for (const raw of blocks) {
    const block = raw.trim();
    if (!block) continue;
    if (block.startsWith('## ')) {
      const title = block.slice(3).trim();
      out.push(`<h2>${esc(title)}</h2>`);
      continue;
    }
    // 图片块（可连续多张 → 图组）
    const imgs = [...block.matchAll(/!\[([^\]]*)\]\(media:([^)\s]+)\)/g)];
    if (imgs.length && imgs.length === block.match(/!\[/g)?.length) {
      const figures = imgs
        .map((m) => {
          const media = resolveMedia(m[2].trim());
          if (!media) return '';
          const cap = m[1].trim();
          const credit = media.photographer ? ` · © ${media.photographer}` : '';
          return `<figure><img src="${media.medium}" alt="${esc(cap || media.public_id)}" loading="lazy" width="${media.width}" height="${media.height}" /><figcaption>${esc(cap)}${credit}</figcaption></figure>`;
        })
        .join('');
      if (figures) {
        out.push(imgs.length > 1 ? `<div class="article-media-group amg-pair">${figures}</div>` : `<div class="article-media">${figures}</div>`);
      }
      continue;
    }
    out.push(`<p>${esc(block).replace(/\n/g, '<br />')}</p>`);
  }
  return out.join('\n');
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}
