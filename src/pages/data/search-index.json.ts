export const prerender = true;

import { buildSearchIndex } from '../../lib/queries';

// 构建期生成公开搜索索引（只含公开安全字段，见 src/lib/queries.ts）
export const GET = () =>
  new Response(JSON.stringify(buildSearchIndex()), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
