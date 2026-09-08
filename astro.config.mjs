import { defineConfig } from 'astro/config';

// 部署目标：GitHub Pages 项目站点
// https://zyyang0124.github.io/Salticid_Notes/
export default defineConfig({
  site: 'https://zyyang0124.github.io',
  base: '/Salticid_Notes',
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
  },
});
