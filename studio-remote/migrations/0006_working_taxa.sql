-- 工作编号（§21-§24）：cf. / aff. / sp. 等未定名类群是合法鉴定目标。
-- 与静态 taxa-data.json 并列；导出为 studio-taxa.json 并入公开站类群表。
CREATE TABLE IF NOT EXISTS working_taxa (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  scientific_name TEXT NOT NULL,
  rank TEXT NOT NULL DEFAULT 'species',
  authorship TEXT,
  chinese_name TEXT,
  status TEXT NOT NULL DEFAULT 'working',
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
