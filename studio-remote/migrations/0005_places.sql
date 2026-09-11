-- Place 实体化（§14-§20）：地点成为一级实体，观察引用 place_id；
-- 观察自身的经纬度/海拔保留（同一地点内的微点位）。merged_into_id 支持合并与跳转。
CREATE TABLE IF NOT EXISTS places (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  country TEXT,
  admin1 TEXT,
  admin2 TEXT,
  locality TEXT,
  site_name TEXT,
  latitude REAL,
  longitude REAL,
  elevation_m INTEGER,
  description TEXT,
  cover_media_id INTEGER,
  merged_into_id INTEGER REFERENCES places(id),
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
ALTER TABLE observations ADD COLUMN place_id INTEGER REFERENCES places(id);
CREATE INDEX IF NOT EXISTS idx_observations_place ON observations(place_id);
