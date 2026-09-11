-- 伙伴自助公开资料（§26/§29）：每位受邀账号可编辑自己的公开名之外的
-- 头衔、简介与代表照片；照片为 R2 媒体编号（随导出进入主站档案）。
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  title TEXT,
  bio TEXT,
  photo_media_id INTEGER,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
