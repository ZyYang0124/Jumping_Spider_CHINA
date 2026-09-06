import { defineConfig } from 'astro/config';

// 部署目标：GitHub Pages 项目站点
// https://zyyang0124.github.io/Jumping_Spider_CHINA/
export default defineConfig({
  site: 'https://zyyang0124.github.io',
  base: '/Jumping_Spider_CHINA',
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
  },
});
