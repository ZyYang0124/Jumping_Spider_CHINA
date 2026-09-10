// 认证：受邀邮箱 OTP（SOP §18-20）+ 会话 + 审计。D1 异步版。
// 规则 9/11：无公开注册；规则 12：邮箱 OTP，不用微信或密码。
import { get, run, type Env, type Row } from './db';

export interface StudioUser {
  id: number;
  email: string | null;
  dev_username: string | null;
  display_name: string;
  role: 'owner' | 'contributor';
}

const SESSION_COOKIE = 'studio_session';

/** 随机十六进制串（Workers 无 node:crypto 的 randomBytes 同步 API） */
export function randomHex(bytes: number): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function sixDigitCode(): string {
  return String(new Uint32Array(crypto.getRandomValues(new Uint32Array(1)))[0] % 1_000_000).padStart(6, '0');
}

/** 登录白名单：OWNER_EMAIL 直通；其余必须在 invitations.email 中且未被他认领 */
export async function isInvited(env: Env, email: string): Promise<boolean> {
  const e = email.toLowerCase();
  if (env.OWNER_EMAIL && e === env.OWNER_EMAIL.toLowerCase()) return true;
  const inv = await get<Row>(env.DB, 'SELECT claimed_by FROM invitations WHERE lower(email) = ?', e);
  if (!inv) return false;
  if (inv.claimed_by == null) return true;
  const u = await get<{ email: string | null }>(env.DB, 'SELECT email FROM users WHERE id = ?', inv.claimed_by);
  return u?.email?.toLowerCase() === e;
}

export async function issueOtp(env: Env, email: string): Promise<string> {
  // 简易限流：同邮箱 10 分钟内最多 5 次
  const recent = await get<{ c: number }>(
    env.DB,
    "SELECT COUNT(*) AS c FROM otp_codes WHERE lower(email) = ? AND created_at > datetime('now', '-10 minutes')",
    email.toLowerCase(),
  );
  if ((recent?.c ?? 0) >= 5) throw new Error('验证码请求过于频繁，请十分钟后再试');
  const code = sixDigitCode();
  // expires_at 由 SQLite 生成（datetime 格式），与 verifyOtp 的 datetime('now') 比较口径一致
  await run(env.DB, "INSERT INTO otp_codes (email, code, expires_at) VALUES (?, ?, datetime('now', '+10 minutes'))", email.toLowerCase(), code);
  return code;
}

export async function verifyOtp(env: Env, email: string, code: string): Promise<boolean> {
  const row = await get<{ id: number; code: string }>(
    env.DB,
    "SELECT id, code FROM otp_codes WHERE lower(email) = ? AND used = 0 AND expires_at > datetime('now') ORDER BY id DESC",
    email.toLowerCase(),
  );
  if (!row || row.code !== String(code).trim()) return false;
  await run(env.DB, 'UPDATE otp_codes SET used = 1 WHERE id = ?', row.id);
  return true;
}

export async function findOrCreateUserByEmail(env: Env, email: string): Promise<{ id: number; display_name: string }> {
  const e = email.toLowerCase();
  const existing = await get<{ id: number; display_name: string }>(
    env.DB,
    'SELECT id, display_name FROM users WHERE lower(email) = ?',
    e,
  );
  if (existing) return existing;
  const isOwner = !!env.OWNER_EMAIL && e === env.OWNER_EMAIL.toLowerCase();
  const displayName = isOwner ? '站长' : e.split('@')[0];
  const info = await env.DB.prepare('INSERT INTO users (email, display_name, role) VALUES (?, ?, ?)')
    .bind(e, displayName, isOwner ? 'owner' : 'contributor')
    .run();
  const id = await get<{ id: number }>(env.DB, 'SELECT last_insert_rowid() AS id');
  await run(env.DB, 'UPDATE invitations SET claimed_by = ? WHERE lower(email) = ?', id!.id, e);
  return { id: id!.id, display_name: displayName };
}

export async function deliverOtp(env: Env, email: string, code: string): Promise<'resend' | 'console'> {
  if (env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: env.MAIL_FROM ?? 'Salticid Notes <no-reply@salticidnotes.cn>',
          to: email,
          subject: 'Salticid Notes｜跳蛛观察志 · 登录验证码',
          text: `你的登录验证码：\n\n${code}\n\n如果不是你本人操作，请忽略此邮件。`,
        }),
      });
      if (res.ok) return 'resend';
      console.error('Resend 发送失败', res.status, await res.text());
    } catch (err) {
      console.error('Resend 异常，回退控制台输出：', err);
    }
  }
  console.log(`[Field Studio][开发模式] ${email} 的登录验证码：${code}`);
  return 'console';
}

export async function createSession(env: Env, token: string, userId: number): Promise<void> {
  // 同 issueOtp：由 SQLite 生成 datetime 格式，保证过期比较口径一致
  await run(env.DB, "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+14 days'))", token, userId);
}

export async function destroySession(env: Env, token: string): Promise<void> {
  if (token) await run(env.DB, 'DELETE FROM sessions WHERE token = ?', token);
}

export async function currentUser(env: Env, token: string | undefined): Promise<StudioUser | null> {
  if (!token) return null;
  return (
    (await get<StudioUser>(
      env.DB,
      `SELECT u.id, u.dev_username, u.email, u.display_name, u.role
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > datetime('now')`,
      token,
    )) ?? null
  );
}

export function secureCookies(env: Env): boolean {
  return env.ENVIRONMENT === 'production';
}

export { SESSION_COOKIE };

/** POST 防护：Origin/Referer 同源校验（SameSite 之外的纵深防御） */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin') ?? req.headers.get('referer') ?? '';
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(req.url).host;
  } catch {
    return false;
  }
}

export async function audit(env: Env, actor: string, entityType: string, entityId: string | number | null, action: string, detail?: unknown): Promise<void> {
  await run(
    env.DB,
    'INSERT INTO audit_logs (actor, entity_type, entity_id, action, detail) VALUES (?, ?, ?, ?, ?)',
    actor,
    entityType,
    entityId == null ? null : String(entityId),
    action,
    detail ? JSON.stringify(detail) : null,
  );
}
