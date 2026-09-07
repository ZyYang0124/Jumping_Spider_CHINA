// 认证：微信 OAuth（凭据走环境变量）+ 受邀白名单 + 开发模式登录 + 会话。
// 规则 9：无公开注册；规则 16：一切鉴权在服务端。
import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import type { Database } from 'better-sqlite3';
import { migrate } from './db.js';

const SESSION_SECRET =
  process.env.STUDIO_SESSION_SECRET ?? 'dev-only-secret-do-not-use-in-production';
const SESSION_DAYS = 14;

export interface StudioUser {
  id: number;
  openid: string | null;
  dev_username: string | null;
  display_name: string;
  role: 'owner' | 'contributor';
}

export function wechatConfigured(): boolean {
  return Boolean(process.env.WECHAT_APP_ID && process.env.WECHAT_SECRET && process.env.WECHAT_REDIRECT_ORIGIN);
}

/** 短期签名 token：微信回调后携带 openid 回到绑定页（防止表单伪造 openid） */
export function signPendingOpenid(openid: string): string {
  const payload = `${openid}|${Date.now()}`;
  const sig = createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}|${sig}`).toString('base64url');
}

export function verifyPendingOpenid(token: string): string | null {
  try {
    const [openid, ts, sig] = Buffer.from(token, 'base64url').toString('utf8').split('|');
    const expected = createHmac('sha256', SESSION_SECRET).update(`${openid}|${ts}`).digest('hex');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    if (Date.now() - Number(ts) > 10 * 60 * 1000) return null;
    return openid;
  } catch {
    return null;
  }
}

export function createSession(db: Database, res: Response, userId: number): void {
  const token = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expires);
  res.cookie('studio_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_DAYS * 24 * 3600 * 1000,
  });
}

export function destroySession(db: Database, req: Request, res: Response): void {
  const token = (req.cookies as Record<string, string>).studio_session;
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.clearCookie('studio_session');
}

export function currentUser(db: Database, req: Request): StudioUser | null {
  const token = (req.cookies as Record<string, string>).studio_session;
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.id, u.openid, u.dev_username, u.display_name, u.role
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > datetime('now')`,
    )
    .get(token) as StudioUser | undefined;
  return row ?? null;
}

export function requireUser(db: Database, req: Request, res: Response): StudioUser | null {
  const user = currentUser(db, req);
  if (!user) {
    res.redirect('/studio/login');
    return null;
  }
  return user;
}

export function requireOwner(db: Database, req: Request, res: Response): StudioUser | null {
  const user = requireUser(db, req, res);
  if (!user) return null;
  if (user.role !== 'owner') {
    res.status(403).send('只有站长可以执行该操作。');
    return null;
  }
  return user;
}

/** POST 防护：校验 Origin/Referer 同源（SameSite=Lax 之外的纵深防御） */
export function sameOriginGuard(req: Request, res: Response): boolean {
  const host = req.headers.host ?? '';
  const origin = req.headers.origin ?? req.headers.referer ?? '';
  if (!origin) return true;
  try {
    return new URL(String(origin)).host === host;
  } catch {
    return false;
  }
}

export function audit(
  db: Database,
  actor: string,
  entityType: string,
  entityId: string | number | null,
  action: string,
  detail?: unknown,
): void {
  db.prepare('INSERT INTO audit_logs (actor, entity_type, entity_id, action, detail) VALUES (?, ?, ?, ?, ?)')
    .run(actor, entityType, entityId == null ? null : String(entityId), action, detail ? JSON.stringify(detail) : null);
}

export { migrate };
