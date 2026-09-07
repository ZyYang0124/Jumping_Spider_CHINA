-- Field Studio 初始 schema（prompt.md §9 核心模型的个人规模实现）
-- 规则 1：任何 schema 变更必须以新的版本化迁移文件记录，禁止修改本文件。

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  openid TEXT UNIQUE,
  dev_username TEXT UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'contributor')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE invitations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  label TEXT,
  claimed_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE TABLE observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT UNIQUE,
  created_by INTEGER NOT NULL REFERENCES users(id),
  observer_name TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  observed_at_precision TEXT NOT NULL DEFAULT 'day',
  country TEXT NOT NULL DEFAULT '中国',
  state_province TEXT NOT NULL,
  city TEXT,
  county TEXT,
  locality TEXT,
  exact_latitude REAL,
  exact_longitude REAL,
  public_latitude REAL,
  public_longitude REAL,
  coordinate_uncertainty_m INTEGER,
  elevation_m INTEGER,
  location_visibility TEXT NOT NULL DEFAULT 'locality_only',
  sex TEXT NOT NULL DEFAULT 'unknown',
  life_stage TEXT NOT NULL DEFAULT 'unknown',
  habitat TEXT,
  microhabitat TEXT,
  behavior TEXT,
  contributor_guess TEXT,
  field_note TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  visibility TEXT NOT NULL DEFAULT 'private',
  trip_slug TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT UNIQUE,
  observation_id INTEGER NOT NULL REFERENCES observations(id),
  file_stem TEXT NOT NULL,
  view_type TEXT NOT NULL DEFAULT 'other',
  caption TEXT,
  sort_order INTEGER NOT NULL DEFAULT 1,
  is_cover INTEGER NOT NULL DEFAULT 0,
  photographer_name TEXT NOT NULL,
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
  body_md TEXT NOT NULL,
  cover_media_id INTEGER REFERENCES media(id),
  related_observation_public_ids TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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
CREATE INDEX idx_observations_status ON observations(status);
