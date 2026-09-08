// SSR 保留路由：健康检查。
// 它保证 Cloudflare Workers 服务端包（dist/_worker.js）持续生成，
// 为未来的 auth / API / 提交接口保留服务端能力（SOP §12）。
export const GET = () =>
  new Response(JSON.stringify({ status: 'ok', service: 'salticid-notes' }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
