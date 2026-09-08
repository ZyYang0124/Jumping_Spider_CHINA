-- 札记发布时间：直接发布模式下记录首次发布时刻（与 observations.published_at 对齐）。
ALTER TABLE posts ADD COLUMN published_at TEXT;
