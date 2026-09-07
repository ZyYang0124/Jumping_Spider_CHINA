-- 种子数据：站长与受邀贡献者（邀请制，规则 9：无公开注册）
-- 媒体计数器从 36 起：静态站已有 CSFN-M-000001…000035，编号一经分配永不变。
-- 观察计数器按年归零：CSFN-2026-000001 起。

INSERT INTO users (id, dev_username, display_name, role) VALUES
  (1, 'zhiyong', '杨智勇', 'owner'),
  (2, 'taoli', '李涛', 'contributor');

INSERT INTO invitations (code, label) VALUES
  ('FIELD-2026-INVITE', '开发模式邀请码（本地验证用）'),
  ('FIELD-2026-OWNER', '站长开发模式邀请码');

INSERT INTO counters (name, value) VALUES
  ('media', 35),
  ('observation-2026', 0),
  ('post', 0);
