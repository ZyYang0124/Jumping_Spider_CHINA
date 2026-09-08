// 迁移执行器：按文件名顺序应用 studio/migrations/*.sql（规则 1：migration-first）。
// 迁移期间临时关闭外键强制（表重建需要），结束后做 foreign_key_check 校验。
import { readFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const DB_PATH = process.env.STUDIO_DB ?? join(ROOT, 'data', 'studio.db');

export function openDb(): Database.Database {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  return db;
}

export function migrate(): void {
  const db = openDb();
  db.pragma('foreign_keys = OFF');
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')))");
  const applied = new Set(
    (db.prepare('SELECT name FROM schema_migrations').all() as { name: string }[]).map((r) => r.name),
  );
  const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../migrations');
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.sql')).sort() : [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(dir, file), 'utf-8');
    db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(file);
    })();
    console.log(`已应用迁移：${file}`);
  }
  const violations = db.pragma('foreign_key_check') as unknown[];
  if (violations.length) {
    throw new Error(`迁移后外键校验失败：${JSON.stringify(violations).slice(0, 400)}`);
  }
  db.pragma('foreign_keys = ON');
  db.close();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  migrate();
}
