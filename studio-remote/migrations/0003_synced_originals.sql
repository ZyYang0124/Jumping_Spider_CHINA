-- 发布自动同步（规则 5/7）：记录已提交到仓库的原图编号，
-- 之后同一编号永不重传（规则 19/20：编号永久、原图不可变）。
CREATE TABLE IF NOT EXISTS synced_originals (
  public_id TEXT PRIMARY KEY,
  synced_at TEXT NOT NULL DEFAULT (datetime('now'))
);
