// 认证：受邀邮箱 OTP（SOP §18-20）+ 会话 + 审计。
// 规则 9/11：无公开注册，陌生邮箱无权进入；规则 12：不用微信或密码。
// OTP 投递：配置 SMTP 时经 nodemailer 发送；开发模式输出到服务器控制台。
import { randomBytes, randomInt, createHmac, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import type { Database } from 'better-sqlite3';

const SESSION_SECRET =
  process.env.STUDIO_SESSION_SECRET ?? 'dev-only-secret-do-not-use-in-production';
const SESSION_DAYS = 14;

export interface StudioUser {
  id: number;
  email: string | null;
  openid: string | null;
  dev_username: string | null;
  display_name: string;
  role: 'owner' | 'contributor';
}

/** 邀请白名单：邮箱必须在 invitations 中（未认领或属于本人） */
export function isInvited(db: Database, email: string): boolean {
  const row = db
    .prepare('SELECT claimed_by FROM invitations WHERE lower(email) = lower(?)')
    .get(email.toLowerCase()) as { claimed_by: number | null } | undefined;
  if (!row) return false;
  if (row.claimed_by == null) return true;
  const user = db.prepare('SELECT email FROM users WHERE id = ?').get(row.claimed_by) as
    | { email: string | null }
    | undefined;
  return user?.email?.toLowerCase() === email.toLowerCase();
}

export function issueOtp(db: Database, email: string): string {
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  // expires_at 由 SQLite 生成（datetime 格式），与查询里的 datetime('now') 比较口径一致
  db.prepare("INSERT INTO otp_codes (email, code, expires_at) VALUES (?, ?, datetime('now', '+10 minutes'))").run(
    email.toLowerCase(),
    code,
  );
  return code;
}

/** 投递 OTP：SMTP 优先，开发模式输出到控制台 */
export async function deliverOtp(email: string, code: string): Promise<'smtp' | 'console'> {
  const host = process.env.SMTP_HOST;
  if (host) {
    try {
      const nodemailer = await import('nodemailer');
      const transport = nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT ?? 465),
        secure: (process.env.SMTP_SECURE ?? 'true') === 'true',
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      });
      await transport.sendMail({
        from: process.env.SMTP_FROM ?? 'Salticid Notes <no-reply@salticidnotes.cn>',
        to: email,
        subject: 'Salticid Notes｜跳蛛观察志 · 登录验证码',
        text: `你的登录验证码：\n\n${code}\n\n如果不是你本人操作，请忽略此邮件。`,
      });
      return 'smtp';
    } catch (err) {
      console.error('SMTP 发送失败，回退到控制台输出：', err);
    }
  }
  console.log(`[Field Studio][开发模式] ${email} 的登录验证码：${code}`);
  return 'console';
}

export function verifyOtp(db: Database, email: string, code: string): boolean {
  const row = db
    .prepare(
      "SELECT id, code FROM otp_codes WHERE lower(email) = lower(?) AND used = 0 AND expires_at > datetime('now') ORDER BY id DESC",
    )
    .get(email.toLowerCase()) as { id: number; code: string } | undefined;
  if (!row) return false;
  const a = Buffer.from(String(code));
  const b = Buffer.from(row.code);
  const ok = a.length === b.length && timingSafeEqual(a, b);
  if (ok) db.prepare('UPDATE otp_codes SET used = 1 WHERE id = ?').run(row.id);
  return ok;
}

export function findOrCreateUserByEmail(
  db: Database,
  email: string,
): { id: number; display_name: string } {
  const existing = db.prepare('SELECT id, display_name FROM users WHERE lower(email) = lower(?)').get(email.toLowerCase()) as
    | { id: number; display_name: string }
    | undefined;
  if (existing) return existing;
  const isOwner = process.env.OWNER_EMAIL && email.toLowerCase() === process.env.OWNER_EMAIL.toLowerCase();
  const displayName = isOwner ? '杨智勇' : email.split('@')[0];
  const info = db
    .prepare('INSERT INTO users (email, display_name, role) VALUES (?, ?, ?)')
    .run(email.toLowerCase(), displayName, isOwner ? 'owner' : 'contributor');
  const invited = db
    .prepare('UPDATE invitations SET claimed_by = ? WHERE lower(email) = lower(?)')
    .run(info.lastInsertRowid as number, email.toLowerCase());
  void invited;
  return { id: info.lastInsertRowid as number, display_name: displayName };
}

/** 短期签名 token（预留：绑定/确认类操作） */
export function signPending(value: string): string {
  const payload = `${value}|${Date.now()}`;
  const sig = createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}|${sig}`).toString('base64url');
}

export function verifyPending(token: string): string | null {
  try {
    const [value, ts, sig] = Buffer.from(token, 'base64url').toString('utf8').split('|');
    const expected = createHmac('sha256', SESSION_SECRET).update(`${value}|${ts}`).digest('hex');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    if (Date.now() - Number(ts) > 10 * 60 * 1000) return null;
    return value;
  } catch {
    return null;
  }
}

export function createSession(db: Database, res: Response, userId: number): void {
  const token = randomBytes(32).toString('hex');
  // 同 issueOtp：由 SQLite 生成 datetime 格式，保证过期比较口径一致
  db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+14 days'))").run(token, userId);
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
      `SELECT u.id, u.openid, u.dev_username, u.email, u.display_name, u.role
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
