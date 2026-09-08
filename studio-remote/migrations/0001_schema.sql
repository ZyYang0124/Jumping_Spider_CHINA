-- Field Studio 远程版（D1）初始 schema。
-- 与本地 studio/ 同一套业务实体；坐标为单一精确模型（Studio SOP §7）。
-- media 相比本地版增加 variants（R2 派生图清单 JSON）与 orig_ext（原始扩展名）。

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dev_username TEXT UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'contributor')),
  email TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE invitations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  label TEXT,
  email TEXT,
  claimed_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE TABLE otp_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT UNIQUE,
  created_by INTEGER NOT NULL REFERENCES users(id),
  observer_name TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  observed_at_precision TEXT NOT NULL DEFAULT 'day',
  country_code TEXT,
  country_name TEXT,
  admin1 TEXT,
  admin2 TEXT,
  locality TEXT,
  site_name TEXT,
  exact_latitude REAL,
  exact_longitude REAL,
  elevation_m INTEGER,
  sex TEXT NOT NULL DEFAULT 'unknown',
  life_stage TEXT NOT NULL DEFAULT 'unknown',
  count INTEGER,
  habitat TEXT,
  microhabitat TEXT,
  behavior TEXT,
  plant TEXT,
  weather TEXT,
  field_note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  visibility TEXT NOT NULL DEFAULT 'private',
  trip_slug TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT UNIQUE,
  observation_id INTEGER REFERENCES observations(id),
  note_slug TEXT,
  file_stem TEXT NOT NULL,
  orig_ext TEXT NOT NULL DEFAULT '.jpg',
  variants TEXT NOT NULL DEFAULT '[]',
  view_type TEXT NOT NULL DEFAULT 'live_dorsal',
  caption TEXT,
  sort_order INTEGER NOT NULL DEFAULT 1,
  is_cover INTEGER NOT NULL DEFAULT 0,
  photographer_name TEXT,
  license TEXT NOT NULL DEFAULT 'all_rights_reserved',
  visibility TEXT NOT NULL DEFAULT 'private',
  width INTEGER,
  height INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE identifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  observation_id INTEGER NOT NULL REFERENCES observations(id),
  taxon_slug TEXT,
  display_identification TEXT NOT NULL,
  identified_by TEXT NOT NULL,
  identified_at TEXT NOT NULL,
  evidence TEXT NOT NULL DEFAULT 'tentative',
  remarks TEXT,
  is_current INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE,
  author_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  subtitle TEXT,
  body_md TEXT NOT NULL,
  cover_media_id INTEGER REFERENCES media(id),
  related_observation_public_ids TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft',
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  action TEXT NOT NULL,
  data_snapshot TEXT,
  author TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE counters (
  name TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);

CREATE INDEX idx_media_observation ON media(observation_id);
CREATE INDEX idx_identifications_observation ON identifications(observation_id);
CREATE INDEX idx_otp_email ON otp_codes(email);
CREATE INDEX idx_sessions_user ON sessions(user_id);
