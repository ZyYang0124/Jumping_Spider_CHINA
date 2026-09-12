-- WSC（World Spider Catalog）校验缓存与变动记录（§正式种名校验）
CREATE TABLE IF NOT EXISTS wsc_cache (
  name TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  exists_wsc INTEGER NOT NULL,
  status TEXT,
  checked_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS wsc_findings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  detail TEXT NOT NULL,
  resolved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
