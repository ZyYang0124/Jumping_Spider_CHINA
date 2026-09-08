-- Salticid Notes 迁移（SOP §33/§144/§145/§18-20）：
-- 1) 状态机迁移为 draft/published/private/archived（§26/§144）
-- 2) 全球地理字段（§145）
-- 3) 邮箱 OTP（§18-20）：users/invitations 增加邮箱，新建 otp_codes
-- 4) SFN 编号计数器（§32/§56；与已公开 CSFN-* 长期共存）

UPDATE observations SET status = 'draft' WHERE status IN ('submitted', 'review', 'revision_requested', 'rejected');
UPDATE observations SET status = 'draft' WHERE status = 'approved';

ALTER TABLE observations ADD COLUMN country_code TEXT NOT NULL DEFAULT 'CN';
ALTER TABLE observations ADD COLUMN country_name TEXT NOT NULL DEFAULT '中国';
ALTER TABLE observations ADD COLUMN admin1 TEXT;
ALTER TABLE observations ADD COLUMN admin2 TEXT;
ALTER TABLE observations ADD COLUMN site_name TEXT;

UPDATE observations SET admin1 = state_province, admin2 = county WHERE admin1 IS NULL;

ALTER TABLE users ADD COLUMN email TEXT;
CREATE UNIQUE INDEX idx_users_email ON users(email);
UPDATE users SET email = 'yangzy0124@gmail.com' WHERE dev_username = 'zhiyong';
UPDATE users SET email = 'li.tao@example.com' WHERE dev_username = 'taoli';

ALTER TABLE invitations ADD COLUMN email TEXT;
UPDATE invitations SET email = 'li.tao@example.com' WHERE code = 'FIELD-2026-INVITE';
UPDATE invitations SET email = 'yangzy0124@gmail.com' WHERE code = 'FIELD-2026-OWNER';

CREATE TABLE otp_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_otp_email ON otp_codes(email);

INSERT INTO counters (name, value) VALUES ('sfn-media', 0);
INSERT INTO counters (name, value) VALUES ('sfn-observation-2026', 0);
