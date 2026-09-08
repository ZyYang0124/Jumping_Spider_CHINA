import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// 部署目标：Cloudflare Workers + Static Assets（GitHub 为源码真源，push 自动部署）
// 正式域名：https://salticidnotes.cn（SOP §6/§119）
export default defineConfig({
  site: 'https://salticidnotes.cn',
  output: 'server',
  adapter: cloudflare(),
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
  },
  // 导航连续性：hover 预取 + ClientRouter（Base.astro）
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover',
  },
});
