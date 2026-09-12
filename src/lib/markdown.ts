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


/**
 * 左图右文小节布局（参考自然史故事页）：机器生成的文章结构可预测——
 * 小节 = <h2> + 单个 .article-media + 段落时，包装为 duo 网格（桌面图左文右，窄屏堆叠）。
 * 仅对简单小节启用；图组/复杂小节保持全宽原样。
 */
export function applyDuoLayout(html: string): string {
  return html
    .split(/(?=<h2)/)
    .map((section) => {
      if (!section.startsWith("<h2")) return section;
      const mediaMatch = section.match(/<div class="article-media">[\s\S]*?<\/div>/);
      if (!mediaMatch || mediaMatch[0].includes("article-media-group")) return section;
      const headEnd = section.indexOf("</h2>");
      if (headEnd < 0) return section;
      const head = section.slice(0, headEnd + 5);
      const body = section.slice(headEnd + 5).replace(mediaMatch[0], "").trim();
      if (!/^<p>[\s\S]*$/.test(body) || (body.match(/<p>/g) ?? []).length > 2) return section;
      return (
        head +
        '<div class="duo"><div class="duo-media">' + mediaMatch[0] + "</div>" +
        '<div class="duo-text">' + body + "</div></div>"
      );
    })
    .join("");
}
