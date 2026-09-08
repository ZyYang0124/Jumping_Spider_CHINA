-- Salticid Notes Studio v1（SOP §11/§15/§42）
-- 1) 观察补充字段（数量/天气/植物/发布时间）
-- 2) revisions 版本历史（§15：数据层预留，UI 简单列表）
-- 3) media 重建：observation_id 可空 + note_slug（札记图片挂靠）
-- 4) posts 副标题

ALTER TABLE observations ADD COLUMN count INTEGER;
ALTER TABLE observations ADD COLUMN weather TEXT;
ALTER TABLE observations ADD COLUMN plant TEXT;
ALTER TABLE observations ADD COLUMN published_at TEXT;

ALTER TABLE posts ADD COLUMN subtitle TEXT;

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
CREATE INDEX idx_revisions_entity ON revisions(entity_type, entity_id);

-- media 重建：允许图片挂靠札记（note_slug）或无主（图库素材）
CREATE TABLE media_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT UNIQUE,
  observation_id INTEGER REFERENCES observations(id),
  note_slug TEXT,
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
INSERT INTO media_new (id, public_id, observation_id, file_stem, view_type, caption, sort_order, is_cover, photographer_name, license, visibility, width, height, created_at)
SELECT id, public_id, observation_id, file_stem, view_type, caption, sort_order, is_cover, photographer_name, license, visibility, width, height, created_at FROM media;
DROP TABLE media;
ALTER TABLE media_new RENAME TO media;
CREATE INDEX idx_media_observation ON media(observation_id);
CREATE INDEX idx_media_note ON media(note_slug);
