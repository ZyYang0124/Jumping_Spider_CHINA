// 构建期文章渲染器（手写札记用）：Studio renderArticle 的公开站子集。
// 支持：## / ### 小节、段落（**粗体**）、> 引用、- 列表、--- 分隔线、
// ![图注](media:编号) 图片引用（连续多张自动成图组）。输出与 Studio 文章相同的结构类名。
import type { PublicMedia } from './privacy';

export function renderBodyMd(md: string, resolveMedia: (publicId: string) => PublicMedia | null): string {
  const blocks = md.split(/\n{2,}/);
  const out: string[] = [];
  const inline = (t: string) => esc(t).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  for (const raw of blocks) {
    const block = raw.trim();
    if (!block) continue;
    if (block === '---') {
      out.push('<hr />');
      continue;
    }
    if (block.startsWith('## ')) {
      out.push(`<h2>${esc(block.slice(3).trim())}</h2>`);
      continue;
    }
    if (block.startsWith('### ')) {
      out.push(`<h3>${esc(block.slice(4).trim())}</h3>`);
      continue;
    }
    if (block.split('\n').every((l) => l.startsWith('> '))) {
      out.push(`<blockquote>${block.split('\n').map((l) => `<p>${inline(l.slice(2))}</p>`).join('')}</blockquote>`);
      continue;
    }
    if (block.split('\n').every((l) => l.startsWith('- '))) {
      out.push(`<ul>${block.split('\n').map((l) => `<li>${inline(l.slice(2))}</li>`).join('')}</ul>`);
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
    out.push(`<p>${inline(block).replace(/\n/g, '<br />')}</p>`);
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
      if (!section.startsWith('<h2')) return section;
      const mediaMatch = section.match(/<div class="article-media">[\s\S]*?<\/div>/);
      if (!mediaMatch || mediaMatch[0].includes('article-media-group')) return section;
      const headEnd = section.indexOf('</h2>');
      if (headEnd < 0) return section;
      const head = section.slice(0, headEnd + 5);
      const body = section.slice(headEnd + 5).replace(mediaMatch[0], '').trim();
      if (!/^<p>[\s\S]*$/.test(body) || (body.match(/<p>/g) ?? []).length > 2) return section;
      return (
        head +
        '<div class="duo"><div class="duo-media">' + mediaMatch[0] + '</div>' +
        '<div class="duo-text">' + body + '</div></div>'
      );
    })
    .join('');
}
