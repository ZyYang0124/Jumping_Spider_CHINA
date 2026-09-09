// Field Studio 远程版：Cloudflare Workers + D1 + R2。
// 业务规则与本地 studio/src/server.ts 一一对应；差异仅在运行时适配：
//   - Express → Hono；better-sqlite3 → D1（全部异步）；sharp → 浏览器端派生图（editorjs.ts）
//   - 原图存 R2（永不覆盖，规则 20）；导出为 zip 包（GitHub 仍是唯一源码真源，规则 5）
import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { Env } from './db';
import { all, get, nextCounter, pad6, run } from './db';
import {
  audit,
  createSession,
  currentUser,
  deliverOtp,
  destroySession,
  findOrCreateUserByEmail,
  isInvited,
  issueOtp,
  sameOrigin,
  SESSION_COOKIE,
  secureCookies,
  verifyOtp,
  type StudioUser,
} from './auth';
import { articleUrl, mediaForObservation, mediaByPublicId, saveUpload, thumbUrl, type MediaRow } from './media';
import { parseExif } from './exif';
import { renderArticle } from './article';
import { buildResolvers } from './embeds';
import { buildExportZip } from './export';
import { esc, loginPage, mediaPage, noteEditorHtml, obsEditorHtml, page, STYLES, TAXA, homePage, draftsPage, relTime, type FeedItem } from './pages';
import { invitePage } from './invites';
import { OBS_EDITOR_SCRIPT, NOTE_EDITOR_SCRIPT, LOGIN_SCRIPT } from './editorjs';

const app = new Hono<{ Bindings: Env; Variables: { user: StudioUser } }>();

async function auth(c: any): Promise<StudioUser | null> {
  return currentUser(c.env, getCookie(c, SESSION_COOKIE));
}

// 受保护路径的认证中间件：未登录 → 302 登录页（中间件返回 Response 可短路）
const PUBLIC_PATHS = new Set(['/studio/login']);
function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.has(path) || path.startsWith('/studio/login/') || path.startsWith('/studio.css') || path.startsWith('/studio-editor.js') || path.startsWith('/studio-note-editor.js');
}
function deny(c: any): Response {
  // JSON API 返回 401，页面路径 302 到登录页
  return c.req.path.startsWith('/studio/api/')
    ? c.json({ error: '未登录' }, 401)
    : c.redirect('/studio/login');
}
app.use('/studio', async (c, next) => {
  if (isPublicPath(c.req.path)) return next();
  const user = await auth(c);
  if (!user) return deny(c);
  c.set('user', user);
  return next();
});
app.use('/studio/*', async (c, next) => {
  if (isPublicPath(c.req.path)) return next();
  const user = await auth(c);
  if (!user) return deny(c);
  c.set('user', user);
  return next();
});

function user(c: any): StudioUser {
  return c.get('user') as StudioUser;
}

function requireOwner(c: any): StudioUser | null {
  const u = user(c);
  if (u.role !== 'owner') {
    c.status(403);
    c.text('只有站长可以执行该操作。');
    return null;
  }
  return u;
}

function setSessionCookie(c: any, token: string): void {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: secureCookies(c.env),
    path: '/',
    maxAge: 14 * 24 * 3600,
  });
}

// ---------- 静态资源 ----------

app.get('/', (c) => c.redirect('/studio'));
app.get('/studio.css', (c) => c.body(STYLES, 200, { 'Content-Type': 'text/css; charset=utf-8' }));
app.get('/studio-editor.js', (c) => c.body(OBS_EDITOR_SCRIPT, 200, { 'Content-Type': 'text/javascript; charset=utf-8' }));
app.get('/studio-note-editor.js', (c) => c.body(NOTE_EDITOR_SCRIPT, 200, { 'Content-Type': 'text/javascript; charset=utf-8' }));
app.get('/studio-login.js', (c) => c.body(LOGIN_SCRIPT, 200, { 'Content-Type': 'text/javascript; charset=utf-8' }));

// ---------- R2 派生图（Studio 内部展示用；公开站仍由构建管线产出自己的派生图） ----------

app.get('/media/derivatives/*', async (c) => {
  const key = c.req.path.replace('/media/derivatives/', '');
  if (!/^[\w.-]+$/.test(key)) return c.text('Bad Request', 400);
  const obj = await c.env.MEDIA.get(`derivatives/${key}`);
  if (!obj) return c.text('Not Found', 404);
  const type = key.endsWith('.webp') ? 'image/webp' : key.endsWith('.avif') ? 'image/avif' : 'image/jpeg';
  return c.body(obj.body, 200, { 'Content-Type': type, 'Cache-Control': 'private, max-age=3600' });
});

// ---------- 登录（受邀邮箱 OTP） ----------

app.get('/studio/login', async (c) => {
  if (await auth(c)) return c.redirect('/studio');
  const q = c.req.query();
  void q;
  return c.html(loginPage({ devNotice: !c.env.RESEND_API_KEY }));
});

app.post('/studio/login/otp', async (c) => {
  if (!sameOrigin(c.req.raw)) return c.text('Forbidden', 403);
  const form = await c.req.parseBody();
  const email = String((form as any).email ?? '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return c.redirect('/studio/login');
  if (!(await isInvited(c.env, email))) {
    await audit(c.env, email, 'session', null, 'otp-denied-not-invited');
    if (c.req.header('X-Studio-Api') === '1') return c.json({ ok: false, error: 'invite', message: '该邮箱不在受邀名单中' });
    return c.redirect('/studio/login?error=invite');
  }
  let code: string;
  try {
    code = await issueOtp(c.env, email);
  } catch (err: any) {
    if (c.req.header('X-Studio-Api') === '1') return c.json({ ok: false, error: 'rate', message: err.message });
    return c.html(page('登录', `<div class="msg error">${esc(err.message)}</div><p><a href="/studio/login">返回</a></p>`));
  }
  const via = await deliverOtp(c.env, email, code);
  if (c.req.header('X-Studio-Api') === '1') return c.json({ ok: true, via });
  return c.redirect(`/studio/login?email=${encodeURIComponent(email)}`);
});

app.post('/studio/login/verify', async (c) => {
  if (!sameOrigin(c.req.raw)) return c.text('Forbidden', 403);
  const form = await c.req.parseBody();
  const email = String((form as any).email ?? '');
  const code = String((form as any).code ?? '');
  if (!(await verifyOtp(c.env, email, code))) {
    if (c.req.header('X-Studio-Api') === '1') return c.json({ ok: false, error: 'otp', message: '验证码无效或已过期' });
    return c.redirect('/studio/login?error=otp');
  }
  const user = await findOrCreateUserByEmail(c.env, email);
  await run(c.env.DB, 'UPDATE invitations SET claimed_by = ? WHERE lower(email) = lower(?) AND claimed_by IS NULL', user.id, email);
  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  await createSession(c.env, token, user.id);
  setSessionCookie(c, token);
  await audit(c.env, user.display_name, 'session', user.id, 'login-otp');
  if (c.req.header('X-Studio-Api') === '1') return c.json({ ok: true });
  return c.redirect('/studio');
});

app.get('/studio/logout', async (c) => {
  if (!sameOrigin(c.req.raw)) return c.text('Forbidden', 403);
  const token = getCookie(c, SESSION_COOKIE) ?? '';
  await destroySession(c.env, token);
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.redirect('/studio/login');
});

// ---------- 工作台（问候式） ----------

app.get('/studio', async (c) => {
  const u = user(c);
  const items = await recentItems(c.env, u.id, 8);
  return c.html(homePage(u, items));
});

async function recentItems(env: Env, userId: number, limit: number): Promise<FeedItem[]> {
  const obsDrafts = await all<any>(
    env.DB,
    `SELECT o.public_id, o.updated_at, i.display_identification
     FROM observations o
     LEFT JOIN identifications i ON i.observation_id = o.id AND i.is_current = 1
     WHERE o.created_by = ? AND o.status = 'draft' ORDER BY o.updated_at DESC LIMIT 20`,
    userId,
  );
  const obsPub = await all<any>(
    env.DB,
    `SELECT o.public_id, o.published_at, o.updated_at, i.display_identification
     FROM observations o
     LEFT JOIN identifications i ON i.observation_id = o.id AND i.is_current = 1
     WHERE o.created_by = ? AND o.status = 'published' ORDER BY o.published_at DESC LIMIT 20`,
    userId,
  );
  const noteDrafts = await all<any>(
    env.DB,
    "SELECT slug, title, updated_at FROM posts WHERE author_id = ? AND status = 'draft' ORDER BY updated_at DESC LIMIT 20",
    userId,
  );
  const notePub = await all<any>(
    env.DB,
    "SELECT slug, title, published_at, updated_at FROM posts WHERE author_id = ? AND status = 'published' ORDER BY published_at DESC LIMIT 20",
    userId,
  );
  const toTs = (v: unknown): number => {
    const raw = String(v ?? '');
    const t = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z').getTime();
    return Number.isNaN(t) ? 0 : t;
  };
  const items: FeedItem[] = [];
  for (const o of obsDrafts) items.push({ kind: 'obs', href: `/studio/observations/${o.public_id}/edit`, title: o.display_identification || o.public_id, status: 'draft', timeText: relTime(o.updated_at), ts: toTs(o.updated_at) });
  for (const o of obsPub) items.push({ kind: 'obs', href: `/studio/observations/${o.public_id}/edit`, title: o.display_identification || o.public_id, status: 'published', timeText: relTime(o.published_at || o.updated_at), ts: toTs(o.published_at || o.updated_at) });
  for (const n of noteDrafts) items.push({ kind: 'note', href: `/studio/notes/${n.slug}/edit`, title: n.title || '未命名札记', status: 'draft', timeText: relTime(n.updated_at), ts: toTs(n.updated_at) });
  for (const n of notePub) items.push({ kind: 'note', href: `/studio/notes/${n.slug}/edit`, title: n.title || '未命名札记', status: 'published', timeText: relTime(n.published_at || n.updated_at), ts: toTs(n.published_at || n.updated_at) });
  items.sort((a, b) => b.ts - a.ts);
  return items.slice(0, limit);
}

app.get('/studio/drafts', async (c) => {
  const u = user(c);
  const items = await recentItems(c.env, u.id, 50);
  return c.html(draftsPage(u, items.filter((i) => i.status === 'draft'), items.filter((i) => i.status === 'published')));
});

// ---------- 观察：JSON API ----------

app.post('/studio/api/observations', async (c) => {
  const u = user(c);
  if (!sameOrigin(c.req.raw)) return c.json({ error: 'Forbidden' }, 403);
  const year = new Date().getFullYear();
  const seq = await nextCounter(c.env.DB, `sfn-observation-${year}`);
  const publicId = `SFN-${year}-${pad6(seq)}`;
  await run(
    c.env.DB,
    `INSERT INTO observations (public_id, created_by, observer_name, observed_at, observed_at_precision, field_note, status, visibility)
     VALUES (?,?,?,?,?,?,?,?)`,
    publicId,
    u.id,
    u.display_name,
    new Date().toISOString().slice(0, 10),
    'day',
    '',
    'draft',
    'private',
  );
  await audit(c.env, u.display_name, 'observation', publicId, 'create-draft');
  return c.json({ public_id: publicId, edit_url: `/studio/observations/${publicId}/edit` });
});

const OBS_FIELDS = new Set([
  'observed_at', 'latitude', 'longitude', 'country_name', 'admin1', 'admin2',
  'locality', 'site_name', 'elevation_m', 'sex', 'life_stage', 'count', 'habitat',
  'microhabitat', 'behavior', 'plant', 'weather', 'field_note', 'trip_slug',
  'species_taxon_slug', 'species_evidence',
]);

async function upsertIdentification(env: Env, obsRowId: number, obsPublicId: string, slug: string, displayOverride: string | null, evidence: string, author: string): Promise<void> {
  const taxon = TAXA.find((t) => t.slug === slug);
  if (!taxon) throw new Error('未知的类群');
  const display =
    (displayOverride && displayOverride.trim()) ||
    (['species', 'subspecies'].includes(taxon.rank) ? taxon.scientific_name : `${taxon.scientific_name} sp.`);
  const prev = await get<{ display_identification: string; taxon_slug: string }>(
    env.DB,
    'SELECT display_identification, taxon_slug FROM identifications WHERE observation_id = ? AND is_current = 1',
    obsRowId,
  );
  const changed = !prev || prev.taxon_slug !== slug || prev.display_identification !== display;
  await run(env.DB, 'UPDATE identifications SET is_current = 0 WHERE observation_id = ?', obsRowId);
  await run(
    env.DB,
    `INSERT INTO identifications (observation_id, taxon_slug, display_identification, identified_by, identified_at, evidence, is_current)
     VALUES (?,?,?,?,?,?,1)`,
    obsRowId,
    slug,
    display,
    author,
    new Date().toISOString().slice(0, 10),
    evidence,
  );
  if (changed) {
    const cnt = await get<{ c: number }>(
      env.DB,
      "SELECT COUNT(*) AS c FROM revisions WHERE entity_type = 'identification' AND entity_id = ?",
      obsPublicId,
    );
    await run(
      env.DB,
      "INSERT INTO revisions (entity_type, entity_id, version, action, data_snapshot, author) VALUES ('identification', ?, ?, '修改物种鉴定', ?, ?)",
      obsPublicId,
      (cnt?.c ?? 0) + 1,
      JSON.stringify({ from: prev?.display_identification ?? null, to: display }),
      author,
    );
  }
}

app.patch('/studio/api/observations/:public_id', async (c) => {
  const u = user(c);
  if (!sameOrigin(c.req.raw)) return c.text('Forbidden', 403);
  const obs = await get<any>(c.env.DB, 'SELECT * FROM observations WHERE public_id = ?', c.req.param('public_id'));
  if (!obs) return c.text('未找到该观察。', 404);
  if (u.role !== 'owner' && obs.created_by !== u.id) return c.text('只能编辑自己的记录', 403);

  const b = (await c.req.json()) as Record<string, unknown>;
  // 客户端字段名 → 数据库列名（坐标在库中为 exact_*，公开政策为全量精确，无模糊列）
  const COLUMN_OF: Record<string, string> = { latitude: 'exact_latitude', longitude: 'exact_longitude' };
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(b)) {
    if (!OBS_FIELDS.has(k)) continue;
    if (k === 'species_taxon_slug' || k === 'species_evidence') continue; // 鉴定走 upsertIdentification，不是列
    sets.push(`${COLUMN_OF[k] ?? k} = ?`);
    vals.push(v === '' ? null : v);
  }
  if (sets.length) {
    sets.push("updated_at = datetime('now')");
    await run(c.env.DB, `UPDATE observations SET ${sets.join(', ')} WHERE id = ?`, ...vals, obs.id);
  }
  if (typeof b.species_taxon_slug === 'string' && b.species_taxon_slug) {
    await upsertIdentification(
      c.env,
      obs.id,
      obs.public_id,
      b.species_taxon_slug,
      null,
      typeof b.species_evidence === 'string' ? b.species_evidence : 'field',
      u.display_name,
    );
  }
  return c.json({ ok: true, saved_at: new Date().toISOString().slice(11, 19) });
});

// ---------- 照片上传（浏览器端已生成派生图；按 original/width/height/variant 分组） ----------

interface UploadGroup {
  original: File | null;
  width: number;
  height: number;
  variants: { name: string; blob: Blob }[];
}

function groupUploads(fd: FormData): UploadGroup[] {
  const groups: UploadGroup[] = [];
  for (const [key, val] of fd.entries()) {
    if (key === 'original') {
      groups.push({ original: val as File, width: 0, height: 0, variants: [] });
    } else if (key === 'width') {
      groups[groups.length - 1].width = Number(val);
    } else if (key === 'height') {
      groups[groups.length - 1].height = Number(val);
    } else if (key === 'variant') {
      const f = val as File;
      groups[groups.length - 1].variants.push({ name: f.name, blob: f });
    }
  }
  return groups.filter((g) => g.original);
}

app.post('/studio/observations/:public_id/photos', async (c) => {
  const u = user(c);
  if (!sameOrigin(c.req.raw)) return c.text('Forbidden', 403);
  const obs = await get<any>(c.env.DB, 'SELECT id, public_id, created_by, status FROM observations WHERE public_id = ?', c.req.param('public_id'));
  if (!obs) return c.text('未找到该观察。', 404);
  if (u.role !== 'owner' && obs.created_by !== u.id) return c.text('只能管理自己的照片。', 403);
  const fd = await c.req.formData();
  const groups = groupUploads(fd);
  if (!groups.length) return c.text('没有照片。', 400);
  const base = await get<{ m: number }>(c.env.DB, 'SELECT COALESCE(MAX(sort_order), 0) AS m FROM media WHERE observation_id = ?', obs.id);
  let order = base?.m ?? 0;
  const added: string[] = [];
  for (const g of groups) {
    order += 1;
    let saved;
    try {
      saved = await saveUpload(
        c.env,
        u.display_name,
        { original: g.original!, width: g.width, height: g.height, variants: g.variants },
        { observationId: obs.id, noteSlug: null, publicVisibility: obs.status === 'published' },
      );
    } catch (err: any) {
      return c.text(err?.message ?? '照片保存失败', 400);
    }
    await run(
      c.env.DB,
      'UPDATE media SET sort_order = ?, is_cover = ? WHERE public_id = ?',
      order,
      order === 1 ? 1 : 0,
      saved.publicId,
    );
    added.push(saved.publicId);
  }
  await audit(c.env, u.display_name, 'media', obs.public_id, 'upload', { added });
  return c.json({ ok: true, added });
});

app.post('/studio/api/media/:public_id/caption', async (c) => {
  const u = user(c);
  if (!sameOrigin(c.req.raw)) return c.text('Forbidden', 403);
  const m = await mediaByPublicId(c.env, c.req.param('public_id'));
  if (!m) return c.json({ error: '未找到' }, 404);
  const obs = m.observation_id ? await get<{ created_by: number }>(c.env.DB, 'SELECT created_by FROM observations WHERE id = ?', m.observation_id) : undefined;
  if (u.role !== 'owner' && (!obs || obs.created_by !== u.id)) return c.text('无权操作。', 403);
  const body = (await c.req.json()) as { caption?: string };
  await run(c.env.DB, 'UPDATE media SET caption = ? WHERE id = ?', String(body.caption ?? '').slice(0, 300), m.id);
  return c.json({ ok: true });
});

// 札记插图上传（不挂观察，note 引用）
app.post('/studio/api/media/upload', async (c) => {
  const u = user(c);
  if (!sameOrigin(c.req.raw)) return c.text('Forbidden', 403);
  const fd = await c.req.formData();
  const groups = groupUploads(fd);
  if (!groups.length) return c.json({ error: '没有文件' }, 400);
  let saved;
  try {
    saved = await saveUpload(c.env, u.display_name, {
      original: groups[0].original!,
      width: groups[0].width,
      height: groups[0].height,
      variants: groups[0].variants,
    }, { observationId: null, noteSlug: null, publicVisibility: false });
  } catch (err: any) {
    return c.json({ error: err?.message ?? '照片保存失败' }, 400);
  }
  await audit(c.env, u.display_name, 'media', saved.publicId, 'upload-note-image');
  return c.json({ ok: true, public_id: saved.publicId, url: thumbUrl({ ...(await mediaByPublicId(c.env, saved.publicId))! } as MediaRow) });
});

app.delete('/studio/api/media/:public_id', async (c) => {
  const u = user(c);
  if (!sameOrigin(c.req.raw)) return c.text('Forbidden', 403);
  const m = await mediaByPublicId(c.env, c.req.param('public_id'));
  if (!m) return c.json({ error: '未找到' }, 404);
  const obs = m.observation_id ? await get<{ created_by: number }>(c.env.DB, 'SELECT created_by FROM observations WHERE id = ?', m.observation_id) : undefined;
  if (u.role !== 'owner' && (!obs || obs.created_by !== u.id)) return c.text('无权操作。', 403);
  await run(c.env.DB, 'DELETE FROM media WHERE id = ?', m.id);
  // R2 派生图保留（编号已用掉不再复用，规则 19）；原图永不删除（规则 20）
  await audit(c.env, u.display_name, 'media', m.public_id, 'delete');
  return c.json({ ok: true });
});

app.post('/studio/api/observations/:public_id/photos/order', async (c) => {
  const u = user(c);
  if (!sameOrigin(c.req.raw)) return c.text('Forbidden', 403);
  const obs = await get<any>(c.env.DB, 'SELECT id, created_by, public_id FROM observations WHERE public_id = ?', c.req.param('public_id'));
  if (!obs) return c.json({ error: '未找到' }, 404);
  if (u.role !== 'owner' && obs.created_by !== u.id) return c.text('无权操作。', 403);
  const body = (await c.req.json()) as { order?: string[] };
  const order = body.order ?? [];
  for (let i = 0; i < order.length; i++) {
    await run(c.env.DB, 'UPDATE media SET sort_order = ?, is_cover = ? WHERE public_id = ? AND observation_id = ?', i + 1, i === 0 ? 1 : 0, order[i], obs.id);
  }
  await audit(c.env, u.display_name, 'media', obs.public_id, 'reorder');
  return c.json({ ok: true });
});

// 发布（§42 校验：日期 + 坐标 + 至少一张照片；物种允许 Unknown → Salticidae sp.）
app.post('/studio/api/observations/:public_id/publish', async (c) => {
  const u = user(c);
  if (!sameOrigin(c.req.raw)) return c.text('Forbidden', 403);
  const obs = await get<any>(c.env.DB, 'SELECT * FROM observations WHERE public_id = ?', c.req.param('public_id'));
  if (!obs) return c.json({ error: '未找到' }, 404);
  if (u.role !== 'owner' && obs.created_by !== u.id) return c.text('只能发布自己的记录。', 403);
  const problems: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(obs.observed_at ?? ''))) problems.push('缺少观察日期');
  if (obs.exact_latitude == null || obs.exact_longitude == null) problems.push('缺少坐标（纬度/经度）');
  const photoCount = await get<{ c: number }>(c.env.DB, 'SELECT COUNT(*) AS c FROM media WHERE observation_id = ?', obs.id);
  if ((photoCount?.c ?? 0) === 0) problems.push('至少需要一张照片');
  if (problems.length) return c.json({ error: problems.join('；') }, 400);

  await run(
    c.env.DB,
    "UPDATE observations SET status = 'published', visibility = 'public', published_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
    obs.id,
  );
  await run(c.env.DB, "UPDATE media SET visibility = 'public' WHERE observation_id = ?", obs.id);
  const idn = await get(c.env.DB, 'SELECT id FROM identifications WHERE observation_id = ? AND is_current = 1', obs.id);
  if (!idn) {
    await run(
      c.env.DB,
      `INSERT INTO identifications (observation_id, taxon_slug, display_identification, identified_by, identified_at, evidence, is_current)
       VALUES (?, 'salticidae', 'Salticidae sp.', ?, date('now'), 'field', 1)`,
      obs.id,
      u.display_name,
    );
  }
  const cnt = await get<{ c: number }>(c.env.DB, "SELECT COUNT(*) AS c FROM revisions WHERE entity_type = 'observation' AND entity_id = ?", obs.public_id);
  await run(
    c.env.DB,
    "INSERT INTO revisions (entity_type, entity_id, version, action, data_snapshot, author) VALUES ('observation', ?, ?, '发布', ?, ?)",
    obs.public_id,
    (cnt?.c ?? 0) + 1,
    JSON.stringify({ at: new Date().toISOString() }),
    u.display_name,
  );
  await audit(c.env, u.display_name, 'observation', obs.public_id, 'publish');
  return c.json({ ok: true, public_url: `/observations/${obs.public_id}/` });
});

app.post('/studio/api/observations/:public_id/private', async (c) => {
  const u = user(c);
  if (!sameOrigin(c.req.raw)) return c.text('Forbidden', 403);
  const obs = await get<any>(c.env.DB, 'SELECT id, created_by, public_id FROM observations WHERE public_id = ?', c.req.param('public_id'));
  if (!obs) return c.json({ error: '未找到' }, 404);
  if (u.role !== 'owner' && obs.created_by !== u.id) return c.text('只能操作自己的记录。', 403);
  await run(c.env.DB, "UPDATE observations SET status = 'private', visibility = 'private' WHERE id = ?", obs.id);
  await run(c.env.DB, "UPDATE media SET visibility = 'private' WHERE observation_id = ?", obs.id);
  await audit(c.env, u.display_name, 'observation', obs.public_id, 'set-private');
  return c.json({ ok: true });
});

// ---------- EXIF 预读 ----------

app.post('/studio/api/exif-preview', async (c) => {
  const u = user(c);
  const fd = await c.req.formData();
  const file = fd.get('photo');
  if (!(file instanceof File)) return c.json({ error: 'no photo' }, 400);
  const s = await parseExif(await file.arrayBuffer());
  return c.json({ results: [{ filename: file.name, date: s.date ?? null, gps: s.gps ?? null, camera: s.camera ?? null }] });
});

// ---------- 札记 ----------

app.post('/studio/api/notes', async (c) => {
  const u = user(c);
  if (!sameOrigin(c.req.raw)) return c.text('Forbidden', 403);
  const seq = await nextCounter(c.env.DB, 'post');
  const body = (await c.req.json()) as Record<string, string>;
  const slug = `note-${String(seq).padStart(3, '0')}`;
  await run(c.env.DB, 'INSERT INTO posts (slug, author_id, title, subtitle, body_md, status) VALUES (?,?,?,?,?,?)', slug, u.id, String(body.title ?? '未命名札记').slice(0, 160), body.subtitle ?? null, String(body.body_md ?? ''), 'draft');
  await audit(c.env, u.display_name, 'post', slug, 'create-draft');
  return c.json({ ok: true, slug, edit_url: `/studio/notes/${slug}/edit` });
});

app.patch('/studio/api/notes/:slug', async (c) => {
  const u = user(c);
  if (!sameOrigin(c.req.raw)) return c.text('Forbidden', 403);
  const post = await get<any>(c.env.DB, 'SELECT * FROM posts WHERE slug = ?', c.req.param('slug'));
  if (!post) return c.json({ error: '未找到' }, 404);
  if (u.role !== 'owner' && post.author_id !== u.id) return c.json({ error: '只能编辑自己的札记' }, 403);
  const body = (await c.req.json()) as Record<string, string>;
  await run(
    c.env.DB,
    "UPDATE posts SET title = ?, subtitle = ?, body_md = ?, updated_at = datetime('now') WHERE id = ?",
    String(body.title ?? '').slice(0, 160),
    body.subtitle ?? null,
    String(body.body_md ?? ''),
    post.id,
  );
  return c.json({ ok: true, saved_at: new Date().toISOString().slice(11, 19) });
});

app.post('/studio/api/notes/:slug/publish', async (c) => {
  const u = user(c);
  if (!sameOrigin(c.req.raw)) return c.text('Forbidden', 403);
  const post = await get<any>(c.env.DB, 'SELECT * FROM posts WHERE slug = ?', c.req.param('slug'));
  if (!post) return c.json({ error: '未找到' }, 404);
  if (u.role !== 'owner' && post.author_id !== u.id) return c.json({ error: '只能发布自己的札记' }, 403);
  if (!String(post.title ?? '').trim() || !String(post.body_md ?? '').trim()) {
    return c.json({ error: '发布前至少需要标题与正文' }, 400);
  }
  await run(c.env.DB, "UPDATE posts SET status = 'published', published_at = datetime('now'), updated_at = datetime('now') WHERE id = ?", post.id);
  const cnt = await get<{ c: number }>(c.env.DB, "SELECT COUNT(*) AS c FROM revisions WHERE entity_type = 'post' AND entity_id = ?", post.slug);
  await run(c.env.DB, "INSERT INTO revisions (entity_type, entity_id, version, action, author) VALUES ('post', ?, ?, '发布札记', ?)", post.slug, (cnt?.c ?? 0) + 1, u.display_name);
  await audit(c.env, u.display_name, 'post', post.slug, 'publish');
  return c.json({ ok: true, public_url: `/posts/${post.slug}/` });
});

// 预览：真实 Article Renderer（与公开站导出共用）
app.post('/studio/api/notes/preview', async (c) => {
  const u = user(c);
  const body = (await c.req.json()) as { body_md?: string };
  const resolvers = await buildResolvers(c.env, String(body.body_md ?? ''));
  const html = renderArticle(String(body.body_md ?? ''), resolvers);
  return c.json({ html });
});

// ---------- 观察编辑器页面 ----------

app.get('/studio/observations/new', async (c) => {
  user(c);
  return c.html(obsEditorHtml(null, {}, [], { status: 'draft', hasUnpublished: false, photoMeta: [] }));
});

app.get('/studio/observations/:public_id/edit', async (c) => {
  const u = user(c);
  const obs = await get<any>(c.env.DB, 'SELECT * FROM observations WHERE public_id = ?', c.req.param('public_id'));
  if (!obs) return c.text('未找到该观察。', 404);
  if (u.role !== 'owner' && obs.created_by !== u.id) return c.text('只能编辑自己的记录。', 403);
  const photos = await mediaForObservation(c.env, obs.id);
  const idn = await get<{ taxon_slug: string }>(c.env.DB, 'SELECT taxon_slug FROM identifications WHERE observation_id = ? AND is_current = 1', obs.id);
  const data = {
    ...obs,
    observed_at: String(obs.observed_at ?? '').slice(0, 10),
    latitude: obs.exact_latitude ?? '',
    longitude: obs.exact_longitude ?? '',
    species_taxon_slug: idn?.taxon_slug ?? '',
  };
  const grid = photos.map((p) => ({
    public_id: p.public_id, thumb: thumbUrl(p), caption: p.caption,
    photographer_name: p.photographer_name, is_cover: p.is_cover,
  }));
  const bootMeta = {
    status: obs.status,
    hasUnpublished: obs.status === 'published' && String(obs.updated_at ?? '') > String(obs.published_at ?? ''),
    photoMeta: grid.map((g) => ({ public_id: g.public_id, caption: g.caption, photographer_name: g.photographer_name })),
  };
  return c.html(obsEditorHtml(obs.public_id, data, grid, bootMeta));
});

// ---------- 札记编辑器页面 ----------

app.get('/studio/notes/new', async (c) => {
  const u = user(c);
  return c.html(noteEditorHtml('', { title: '', subtitle: '', body_md: '', status: 'draft', author_name: u.display_name, related: '' }));
});

app.get('/studio/notes/:slug/edit', async (c) => {
  const u = user(c);
  const post = await get<any>(c.env.DB, 'SELECT * FROM posts WHERE slug = ?', c.req.param('slug'));
  if (!post) return c.text('未找到该札记。', 404);
  if (u.role !== 'owner' && post.author_id !== u.id) return c.text('只能编辑自己的札记。', 403);
  return c.html(noteEditorHtml(post.slug, {
    ...post,
    author_name: u.display_name,
    related: String(post.related_observation_public_ids ?? '[]').replace(/[\[\]"]/g, ''),
  }));
});

// ---------- 媒体管理 ----------

app.get('/studio/media', async (c) => {
  const u = user(c);
  const rows = await all<MediaRow & { obs_public_id: string | null }>(
    c.env.DB,
    `SELECT m.*, o.public_id AS obs_public_id FROM media m
     LEFT JOIN observations o ON o.id = m.observation_id
     WHERE m.visibility = 'public' ORDER BY m.id DESC LIMIT 200`,
  );
  const obsCount = await get<{ c: number }>(c.env.DB, "SELECT COUNT(*) AS c FROM observations WHERE status = 'published'");
  const postCount = await get<{ c: number }>(c.env.DB, "SELECT COUNT(*) AS c FROM posts WHERE status = 'published'");
  return c.html(
    mediaPage(
      rows.map((m) => ({ public_id: m.public_id, thumb: thumbUrl(m), obs_public_id: m.obs_public_id })),
      u.role === 'owner',
      { observations: obsCount?.c ?? 0, posts: postCount?.c ?? 0 },
      u,
    ),
  );
});

// 照片元信息（图注 / 摄影者）
app.patch('/studio/api/media/:public_id', async (c) => {
  const u = user(c);
  if (!sameOrigin(c.req.raw)) return c.text('Forbidden', 403);
  const m = await mediaByPublicId(c.env, c.req.param('public_id'));
  if (!m) return c.json({ error: '未找到' }, 404);
  const obs = m.observation_id ? await get<{ created_by: number }>(c.env.DB, 'SELECT created_by FROM observations WHERE id = ?', m.observation_id) : undefined;
  if (u.role !== 'owner' && (!obs || obs.created_by !== u.id)) return c.text('无权操作。', 403);
  const body = (await c.req.json()) as { caption?: string; photographer_name?: string };
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (typeof body.caption === 'string') { sets.push('caption = ?'); vals.push(body.caption.slice(0, 300)); }
  if (typeof body.photographer_name === 'string') { sets.push('photographer_name = ?'); vals.push(body.photographer_name.slice(0, 80)); }
  if (sets.length) await run(c.env.DB, `UPDATE media SET ${sets.join(', ')} WHERE id = ?`, ...vals, m.id);
  return c.json({ ok: true });
});

// ---------- 邀请伙伴（规则 11：仅站长可邀请） ----------

app.get('/studio/invite', async (c) => {
  const u = user(c);
  if (u.role !== 'owner') return c.text('只有站长可以管理邀请。', 403);
  const rows = await all<any>(
    c.env.DB,
    'SELECT code, label, email, claimed_by FROM invitations ORDER BY id DESC',
  );
  return c.html(page('邀请伙伴', invitePage(rows, c.req.query('ok') ? '已加入受邀名单 ✓' : null), u));
});

app.post('/studio/invite', async (c) => {
  const u = user(c);
  if (u.role !== 'owner') return c.text('只有站长可以管理邀请。', 403);
  if (!sameOrigin(c.req.raw)) return c.text('Forbidden', 403);
  const form = await c.req.parseBody();
  const label = String((form as any).label ?? '').trim().slice(0, 40);
  const email = String((form as any).email ?? '').trim().toLowerCase();
  const fail = async (msg: string) => {
    const rows = await all<any>(c.env.DB, 'SELECT code, label, email, claimed_by FROM invitations ORDER BY id DESC');
    return c.html(page('邀请伙伴', invitePage(rows, msg), u));
  };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail('邮箱格式不正确。');
  const dup = await get(c.env.DB, 'SELECT id FROM invitations WHERE lower(email) = ?', email);
  if (dup) return fail('该邮箱已在受邀名单中。');
  const code = `INV-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
  await run(c.env.DB, 'INSERT INTO invitations (code, label, email) VALUES (?, ?, ?)', code, label || null, email);
  await audit(c.env, u.display_name, 'invitation', email, 'invite', { label });
  return c.redirect('/studio/invite?ok=1');
});

// ---------- 导出（zip：JSON + 新增原图） ----------

app.get('/studio/export', async (c) => {
  const u = requireOwner(c);
  if (!u) return;
  const zip = await buildExportZip(c.env);
  await audit(c.env, u.display_name, 'export', null, 'export-zip');
  const date = new Date().toISOString().slice(0, 10);
  return c.body(zip as unknown as ArrayBuffer, 200, {
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="studio-export-${date}.zip"`,
  });
});

// ---------- 404 ----------

app.notFound((c) => c.text('Not Found', 404));

export default app;
