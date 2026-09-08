// 修正 E2E GPS 演示记录的中文（Git Bash curl 以 GBK 发送导致乱码）
import Database from 'better-sqlite3';

const db = new Database('data/studio.db');
db.pragma('journal_mode = WAL');

db.prepare(
  "UPDATE observations SET field_note = ?, locality = ? WHERE public_id = 'CSFN-2026-000004'",
).run(
  '【开发验证样例】用于验证「照片 EXIF 自动读取拍摄日期与 GPS 精确坐标 → 确认公开 → 发布」全流程的演示记录，并非真实科学观察。坐标来自测试图片的 EXIF，位置为虚构。',
  '开发验证样例地点（虚构）',
);

db.prepare("UPDATE media SET caption = ? WHERE public_id = 'CSFN-M-000039'").run(
  'EXIF GPS 端到端验证样例（虚构坐标：广东佛山测试点）',
);

db.prepare(
  "UPDATE identifications SET remarks = ? WHERE observation_id = (SELECT id FROM observations WHERE public_id = 'CSFN-2026-000004')",
).run('开发验证记录，鉴定仅为流程演示');

console.log('已修复 GPS 演示记录的中文文本');
db.close();
