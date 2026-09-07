// 修复 E2E 演示数据：Git Bash curl 以 GBK 发送中文导致乱码，这里用 UTF-8 重写。
// 仅影响开发验证样例记录；真实浏览器表单始终以 UTF-8 提交，不受影响。
import Database from 'better-sqlite3';

const db = new Database('data/studio.db');
db.pragma('journal_mode = WAL');

db.prepare(
  "UPDATE observations SET field_note = ?, locality = ? WHERE public_id = 'CSFN-2026-000001'",
).run(
  '【开发验证样例】这是一条用于验证「投稿 → 审核 → 鉴定 → 发布 → 导出」全流程的演示记录，并非真实科学观察。地点为虚构的城市绿地；精确坐标仅用于确认隐私管线不会将其带入任何公开产物。',
  '开发验证绿地（示例数据）',
);

db.prepare("UPDATE media SET caption = ? WHERE public_id = 'CSFN-M-000036'").run(
  '雨后叶面上的灰褐色个体（开发验证样例）',
);

db.prepare("UPDATE posts SET title = ?, body_md = ? WHERE slug = 'e2e-pipeline-test'").run(
  '投稿流程第一次端到端验证',
  `## 第一条验证博文

这是一篇**开发验证博文**，用于确认 Field Studio 的撰写、审核、发布与导出链路。

流程包括：受邀伙伴登录 → 上传照片发布观察 → 站长审核鉴定 → 发布 → 导出到静态站。以后的观察博文都会走这条通道。`,
);

db.prepare(
  "UPDATE identifications SET remarks = ? WHERE observation_id = (SELECT id FROM observations WHERE public_id = 'CSFN-2026-000001')",
).run('开发验证记录，仅科级鉴定');

console.log('已修复演示数据的中文文本');
db.close();
