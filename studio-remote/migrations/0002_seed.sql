-- 种子数据：站长与受邀贡献者占位、编号计数器。
-- 规则 11：受邀制，禁止公众注册。登录白名单 = OWNER_EMAIL 环境变量 + invitations.email。
-- 其他协作者：站长用 wrangler d1 execute 向 invitations 插入 email 行即可。

INSERT INTO users (id, dev_username, display_name, role) VALUES
  (1, 'zhiyong', '杨智勇', 'owner'),
  (2, 'taoli', '李涛', 'contributor');

INSERT INTO invitations (code, label) VALUES
  ('FIELD-2026-INVITE', '开发模式邀请码（本地验证用）'),
  ('FIELD-2026-OWNER', '站长开发模式邀请码');

-- media=35：静态站已有 CSFN-M-000001…000035，编号一经分配永不变（规则 19）
INSERT INTO counters (name, value) VALUES
  ('media', 35),
  ('sfn-media', 0),
  ('sfn-observation-2026', 0),
  ('post', 0);
