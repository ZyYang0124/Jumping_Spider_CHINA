const { unzipSync } = require('fflate');
const fs = require('fs');
const path = require('path');
const zipPath = process.argv[1];
const ROOT = path.resolve(__dirname, '..');
const zip = unzipSync(new Uint8Array(fs.readFileSync(zipPath)));
console.log('包内:', Object.keys(zip).filter((k) => !k.startsWith('originals/')).join(', '), '| 原图:', Object.keys(zip).filter((k) => k.startsWith('originals/')).length);
for (const name of ['studio-observations.json', 'studio-locations.json', 'studio-media.json', 'studio-identifications.json', 'studio-posts.json']) {
  fs.writeFileSync(path.join(ROOT, 'src', 'data', name), Buffer.from(zip[name]));
}
// 仓库 media/originals 已有全部 7 张原图（同名），zip 里的原图仅作覆盖校验
let covered = 0;
for (const [k, v] of Object.entries(zip)) {
  if (k.startsWith('originals/')) {
    const dest = path.join(ROOT, 'media', k);
    if (fs.existsSync(dest)) covered += 1;
    fs.writeFileSync(dest, Buffer.from(v));
  }
}
console.log('原图覆盖（仓库已有同名）:', covered);
const posts = JSON.parse(new TextDecoder().decode(zip['studio-posts.json']));
for (const p of posts) {
  console.log('post:', p.slug, '|', p.title, '| amg-pair:', p.body_html.includes('amg-pair'), '| embed:', p.body_html.includes('embed-observation'), '| 未解析引用:', p.body_html.includes('media:SFN'));
}
