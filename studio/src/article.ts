// 文章渲染器（Studio v1 §31-34）：Markdown → 带布局语义的 HTML。
// 写作时只管插入图片和文字；版面由内容自身推导——图片方向决定宽度层级，
// 连续图片数量决定组合方式。公开站点与 Studio 预览共用本模块，保证所见即所得。

import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

export interface MediaRef {
  url: string;
  /** 宽高比 width / height；决定 portrait / standard / panorama 层级 */
  ratio: number;
  caption: string | null;
}

export interface RenderContext {
  mediaRef: (id: string) => MediaRef | null;
  /** {{observation:...}} 等嵌入的解析器；返回 HTML 或 null（未找到时渲染占位） */
  embed?: (kind: string, key: string) => string | null;
}

const IMG_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;
const EMBED_RE = /\{\{(observation|species|trip|place):([^}]+)\}\}/g;

/** 宽度层级（§31）：竖幅收窄、横幅加宽，标准图保持阅读栏宽 */
function orientationOf(ratio: number): 'portrait' | 'standard' | 'panorama' {
  if (ratio <= 0.87) return 'portrait';
  if (ratio >= 1.8) return 'panorama';
  return 'standard';
}

function figureHtml(ref: MediaRef, alt: string): string {
  const cls = `am am-${orientationOf(ref.ratio)}`;
  const cap = ref.caption ?? (alt.trim() ? alt : null);
  return (
    `<figure class="${cls}"><img src="${sanitizeHtml(ref.url)}" alt="${sanitizeHtml(alt)}" loading="lazy" />` +
    (cap ? `<figcaption>${sanitizeHtml(cap, { allowedTags: [], allowedAttributes: {} })}</figcaption>` : '') +
    `</figure>`
  );
}

function groupLayout(n: number): string {
  if (n === 2) return 'amg-pair';
  if (n === 3) return 'amg-triptych';
  if (n === 4) return 'amg-grid4';
  return 'amg-grid';
}

/** 把一段只含图片的 Markdown 解析为 MediaRef 列表；不是纯图片段则返回 null */
function parseMediaParagraph(text: string, ctx: RenderContext): MediaRef[] | null {
  const refs: MediaRef[] = [];
  let match: RegExpExecArray | null;
  IMG_RE.lastIndex = 0;
  let consumed = 0;
  while ((match = IMG_RE.exec(text)) !== null) {
    consumed += match[0].length;
    const href = match[2].trim();
    if (!href.startsWith('media:')) return null; // 外链图片按普通 Markdown 处理
    const ref = ctx.mediaRef(href.slice('media:'.length).trim());
    if (ref) refs.push(ref);
  }
  if (refs.length === 0) return null;
  const rest = text.replace(IMG_RE, '').trim();
  if (rest.length > 0) return null; // 图片与文字混排 → 普通段落
  void consumed;
  return refs;
}

function renderInline(text: string, ctx: RenderContext): string {
  // 先把嵌入替换为哨兵，避免嵌入 HTML 被 Markdown 二次处理
  const embeds: string[] = [];
  const withSentinels = text.replace(EMBED_RE, (_m, kind: string, key: string) => {
    const html = ctx.embed?.(kind, key.trim()) ?? null;
    const out =
      html ??
      `<div class="article-embed is-missing">未找到${kind === 'observation' ? '观察' : kind === 'species' ? '物种' : kind === 'trip' ? '调查' : '地点'}：${sanitizeHtml(key.trim(), { allowedTags: [], allowedAttributes: {} })}</div>`;
    embeds.push(out);
    return `\u0000E${embeds.length - 1}\u0000`;
  });
  let html = marked.parseInline(withSentinels) as string;
  html = html.replace(/\u0000E(\d+)\u0000/g, (_m, i: string) => embeds[Number(i)] ?? '');
  return html;
}

/** 渲染一篇 Markdown 札记为带布局类的 HTML（输出已消毒）。 */
export function renderArticle(bodyMd: string, ctx: RenderContext): string {
  const tokens = marked.lexer(bodyMd ?? '');
  const blocks: string[] = [];
  let mediaRun: MediaRef[] = [];

  const flushMedia = () => {
    if (mediaRun.length === 0) return;
    if (mediaRun.length === 1) {
      blocks.push(`<div class="article-media">${figureHtml(mediaRun[0], '')}</div>`);
    } else {
      blocks.push(
        `<div class="article-media-group ${groupLayout(mediaRun.length)}">${mediaRun
          .map((r) => figureHtml(r, ''))
          .join('')}</div>`,
      );
    }
    mediaRun = [];
  };

  for (const token of tokens) {
    if (token.type === 'space') continue; // 空行不打断连续图片组合
    if (token.type === 'paragraph') {
      const refs = parseMediaParagraph(token.raw, ctx);
      if (refs && refs.length > 0) {
        mediaRun.push(...refs);
        continue;
      }
      flushMedia();
      // 纯嵌入段落直接输出块级卡片，不包 <p>
      const embedOnly = token.text.replace(EMBED_RE, '').trim().length === 0 && EMBED_RE.test(token.text);
      EMBED_RE.lastIndex = 0;
      blocks.push(embedOnly ? renderInline(token.text, ctx) : `<p>${renderInline(token.text, ctx)}</p>`);
      continue;
    }
    flushMedia();
    if (token.type === 'heading') {
      const level = Math.min(token.depth, 4);
      blocks.push(
        `<h${level}>${renderInline(token.text, ctx)}</h${level}>`,
      );
    } else if (token.type === 'blockquote') {
      const inner = token.tokens
        ?.map((t: any) => (t.type === 'paragraph' ? `<p>${renderInline(t.text, ctx)}</p>` : ''))
        .join('');
      blocks.push(`<blockquote>${inner}</blockquote>`);
    } else if (token.type === 'code') {
      blocks.push(`<pre><code>${sanitizeHtml(token.text, { allowedTags: [], allowedAttributes: {} })}</code></pre>`);
    } else if (token.type === 'hr') {
      blocks.push('<hr />');
    } else if (token.type === 'list') {
      const tag = token.ordered ? 'ol' : 'ul';
      const items = (token.items ?? [])
        .map((li: any) => {
          const paras = (li.tokens ?? [])
            .map((t: any) => (t.type === 'text' ? renderInline(t.text, ctx) : ''))
            .join('');
          return `<li>${paras}</li>`;
        })
        .join('');
      blocks.push(`<${tag}>${items}</${tag}>`);
    } else if (token.type === 'html') {
      // 作者手写 HTML：消毒后原样保留
      blocks.push(
        sanitizeHtml(token.raw, {
          allowedTags: ['p', 'br', 'strong', 'em', 'a', 'img', 'figure', 'figcaption', 'blockquote', 'div', 'span'],
          allowedAttributes: {
            a: ['href', 'title'],
            img: ['src', 'alt'],
            '*': ['class'],
          },
        }),
      );
    } else if (token.type === 'space') {
      // 忽略空块
    } else {
      // 其余块型交给 marked 默认渲染再消毒
      blocks.push(
        sanitizeHtml((marked as any).parser([token]), {
          allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'figure', 'figcaption', 'h1', 'h2']),
          allowedAttributes: { a: ['href', 'title'], img: ['src', 'alt'], '*': ['class'] },
        }),
      );
    }
  }
  flushMedia();
  return blocks.join('\n');
}

/** 嵌入渲染所需的最小上下文；由调用方（server / 导出脚本）提供数据查询。 */
export function observationEmbedHtml(input: {
  public_id: string;
  url: string;
  title: string;
  taxon: string;
  place: string;
  date: string;
}): string {
  return `<div class="article-embed embed-observation"><a href="${sanitizeHtml(input.url)}">
    <img src="${sanitizeHtml(input.url)}" alt="" loading="lazy" />
    <div class="embed-body"><span class="embed-id">${sanitizeHtml(input.public_id, { allowedTags: [], allowedAttributes: {} })}</span>
    <strong>${sanitizeHtml(input.taxon, { allowedTags: [], allowedAttributes: {} })}</strong>
    <span>${sanitizeHtml(`${input.place} · ${input.date}`, { allowedTags: [], allowedAttributes: {} })}</span></div></a></div>`;
}
