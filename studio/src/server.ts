// Field Studio — 轻量私有后端：微信登录（受邀白名单）+ 观察投稿 + 观察博文。
// 规则 4/16：发布与状态转移只由服务端裁决；规则 9：无公开注册。
import express from 'express';
import multer from 'multer';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb, migrate } from './db.js';
import {
  audit,
  createSession,
  currentUser,
  destroySession,
  requireOwner,
  requireUser,
  sameOriginGuard,
  signPendingOpenid,
  verifyPendingOpenid,
  wechatConfigured,
  type StudioUser,
} from './auth.js';
import { nextObservationId, nextPostSlugSeq, saveUploadedPhoto, validateUpload } from './media.js';
import { exportForStaticSite } from './export.js';
import type { Database } from 'better-sqlite3';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = Number(process.env.STUDIO_PORT ?? 4322);

migrate();
const db: Database = openDb();
const app = express();

app.use(express.urlencoded({ extended: true, limit: '1mb' }));
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 20, fileSize: 30 * 1024 * 1024 },
});

// ---------- 小工具 ----------

const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function cookies(req: express.Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
app.use((req, _res, next) => {
  (req as express.Request & { cookies: Record<string, string> }).cookies = cookies(req);
  next();
});

// 上传限速：每 IP 每小时最多 12 次投稿请求
const uploadHits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (uploadHits.get(ip) ?? []).filter((t) => now - t < 3600_000);
  hits.push(now);
  uploadHits.set(ip, hits);
  return hits.length > 12;
}

const STYLES = `
  :root { --paper:#f7f5f0; --ink:#26221c; --muted:#6f675c; --faint:#948b7d; --line:#e0dacc; --accent:#566246; --terra:#a4552f; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--paper); color:var(--ink); font:16px/1.75 -apple-system,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif; }
  a { color:inherit; }
  header { border-bottom:1px solid var(--line); padding:14px 24px; display:flex; justify-content:space-between; align-items:baseline; flex-wrap:wrap; gap:10px; }
  header .brand { font-family:Georgia,"Songti SC",serif; font-weight:700; letter-spacing:.06em; }
  main { max-width:920px; margin:0 auto; padding:28px 24px 80px; }
  h1 { font-family:Georgia,"Songti SC",serif; font-weight:400; font-size:30px; margin:.2em 0 .6em; }
  h2 { font-size:13px; letter-spacing:.28em; color:var(--faint); margin:38px 0 14px; font-weight:600; }
  h2:first-of-type { margin-top:10px; }
  table { border-collapse:collapse; width:100%; font-size:14px; }
  td, th { text-align:left; padding:8px 10px; border-bottom:1px solid var(--line); vertical-align:top; }
  th { color:var(--faint); font-weight:600; }
  .card { border:1px solid var(--line); background:#fbfaf7; padding:20px 24px; margin-bottom:22px; }
  label { display:block; font-size:12.5px; color:var(--muted); margin:14px 0 4px; }
  input[type=text], input[type=password], input[type=date], input[type=number], select, textarea {
    width:100%; padding:9px 12px; border:1px solid var(--line); background:#fff; font:inherit; color:var(--ink);
  }
  textarea { min-height:120px; }
  input:focus, select:focus, textarea:focus { outline:2px solid var(--accent); outline-offset:0; border-color:var(--accent); }
  button, .btn { display:inline-block; background:var(--ink); color:var(--paper); border:none; padding:10px 22px; font:inherit; font-size:14px; cursor:pointer; letter-spacing:.06em; text-decoration:none; }
  button:hover, .btn:hover { background:#3d362e; }
  .btn-quiet { background:none; border:1px solid var(--line); color:var(--muted); }
  .btn-quiet:hover { background:none; color:var(--ink); border-color:var(--faint); }
  .msg { border:1px solid var(--line); background:#fff; padding:12px 16px; margin:16px 0; font-size:14px; }
  .msg.error { border-color:var(--terra); color:var(--terra); }
  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:0 20px; }
  @media (max-width:700px) { .grid2 { grid-template-columns:1fr; } }
  .thumbs img { width:96px; height:72px; object-fit:cover; margin:4px 6px 0 0; border:1px solid var(--line); }
  .status { display:inline-block; font-size:12px; border:1px solid var(--line); border-radius:999px; padding:1px 10px; color:var(--muted); }
  .step { border-top:1px solid var(--line); padding-top:18px; margin-top:18px; }
  .step > .st { font-size:11.5px; letter-spacing:.3em; color:var(--faint); }
  small { color:var(--faint); }
`;

app.get('/studio.css', (_req, res) => {
  res.type('text/css').send(STYLES);
});

function page(title: string, body: string, user: StudioUser | null = null): string {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${esc(title)} · Field Studio</title><link rel="stylesheet" href="/studio.css"></head>
<body><header>
<a class="brand" href="/studio">Field Studio · 中国跳蛛观察志</a>
<nav>${user ? `${esc(user.display_name)}（${user.role === 'owner' ? '站长' : '受邀伙伴'}） · <a href="/studio/observations/new">新观察</a> · <a href="/studio/posts/new">新博文</a> · <a href="/studio/logout">退出</a>` : `<a href="/studio/login">登录</a>`}</nav>
</header><main>${body}</main></body></html>`;
}

// ---------- 登录 ----------

app.get('/studio/login', (req, res) => {
  const user = currentUser(db, req);
  if (user) return res.redirect('/studio');
  const error = String((req.query as Record<string, string>).error ?? '');
  const bind = String((req.query as Record<string, string>).bind ?? '');
  res.send(
    page(
      '登录',
      `<h1>登录 Field Studio</h1>
      ${error === 'wechat' ? '<div class="msg">微信登录尚未配置（缺少 WECHAT_APP_ID / WECHAT_SECRET / 回向域名），请使用邀请码登录。</div>' : ''}
      ${error === 'invite' ? '<div class="msg error">邀请码无效或已被使用。</div>' : ''}
      ${error === 'user' ? '<div class="msg error">用户名不在受邀名单中。</div>' : ''}
      <div class="card">
        <h2 style="margin-top:0">微信登录</h2>
        ${wechatConfigured()
          ? `<a class="btn" href="/studio/auth/wechat">使用微信扫码登录</a>`
          : '<p class="msg">未配置微信凭据（开发模式）。配置 WECHAT_APP_ID / WECHAT_SECRET / WECHAT_REDIRECT_ORIGIN 后可用。</p>'}
      </div>
      <div class="card">
        <h2 style="margin-top:0">邀请码登录（受邀伙伴）</h2>
        <form method="post" action="/studio/login/dev">
          <label>用户名（受邀名单内）</label>
          <input type="text" name="username" required />
          <label>邀请码</label>
          <input type="password" name="code" required />
          <div style="margin-top:18px"><button type="submit">登录</button></div>
        </form>
      </div>
      ${
        bind
          ? `<div class="card"><h2 style="margin-top:0">绑定微信账号</h2>
             <form method="post" action="/studio/auth/wechat/bind">
               <input type="hidden" name="bind" value="${esc(bind)}" />
               <label>显示名称</label><input type="text" name="display_name" required />
               <label>邀请码</label><input type="password" name="code" required />
               <div style="margin-top:18px"><button type="submit">绑定并登录</button></div>
             </form></div>`
          : ''
      }`,
      user,
    ),
  );
});

app.post('/studio/login/dev', (req, res) => {
  if (!sameOriginGuard(req, res)) return res.status(403).send('Forbidden');
  const { username, code } = req.body as Record<string, string>;
  const user = db.prepare('SELECT * FROM users WHERE dev_username = ?').get(String(username ?? '')) as
    | { id: number; display_name: string }
    | undefined;
  const invitation = code
    ? (db.prepare('SELECT * FROM invitations WHERE code = ?').get(String(code).trim()) as
        | { id: number; code: string; claimed_by: number | null }
        | undefined)
    : undefined;
  if (!user || !invitation) return res.redirect('/studio/login?error=invite');
  if (invitation.claimed_by && invitation.claimed_by !== user.id) {
    return res.redirect('/studio/login?error=invite');
  }
  if (!invitation.claimed_by) {
    db.prepare('UPDATE invitations SET claimed_by = ? WHERE id = ?').run(user.id, invitation.id);
    audit(db, user.display_name, 'invitation', invitation.code, 'claim');
  }
  createSession(db, res, user.id);
  audit(db, user.display_name, 'session', user.id, 'login-dev');
  res.redirect('/studio');
});

app.get('/studio/auth/wechat', (req, res) => {
  if (!wechatConfigured()) return res.redirect('/studio/login?error=wechat');
  const state = randomBytes(16).toString('hex');
  res.cookie('studio_oauth_state', state, { httpOnly: true, sameSite: 'lax', maxAge: 600_000 });
  const redirect = encodeURIComponent(`${process.env.WECHAT_REDIRECT_ORIGIN}/studio/auth/wechat/callback`);
  const url = `https://open.weixin.qq.com/connect/qrconnect?appid=${process.env.WECHAT_APP_ID}&redirect_uri=${redirect}&response_type=code&scope=snsapi_login&state=${state}#wechat_redirect`;
  res.redirect(url);
});

app.get('/studio/auth/wechat/callback', async (req, res) => {
  const q = req.query as Record<string, string>;
  const stateCookie = cookies(req).studio_oauth_state;
  if (!q.code || !q.state || q.state !== stateCookie) return res.redirect('/studio/login?error=wechat');
  try {
    const tokenUrl =
      `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${process.env.WECHAT_APP_ID}` +
      `&secret=${process.env.WECHAT_SECRET}&code=${encodeURIComponent(q.code)}&grant_type=authorization_code`;
    const tokenRes = (await (await fetch(tokenUrl)).json()) as { openid?: string; errcode?: number };
    if (!tokenRes.openid) return res.redirect('/studio/login?error=wechat');
    const openid = tokenRes.openid;
    const existing = db.prepare('SELECT * FROM users WHERE openid = ?').get(openid) as
      | { id: number; display_name: string }
      | undefined;
    if (existing) {
      createSession(db, res, existing.id);
      audit(db, existing.display_name, 'session', existing.id, 'login-wechat');
      return res.redirect('/studio');
    }
    // 新微信：进入邀请绑定流程（openid 经签名携带，防伪造）
    return res.redirect(`/studio/login?bind=${encodeURIComponent(signPendingOpenid(openid))}`);
  } catch {
    return res.redirect('/studio/login?error=wechat');
  }
});

app.post('/studio/auth/wechat/bind', (req, res) => {
  if (!sameOriginGuard(req, res)) return res.status(403).send('Forbidden');
  const { bind, code, display_name } = req.body as Record<string, string>;
  const openid = verifyPendingOpenid(String(bind ?? ''));
  const invitation = code
    ? (db.prepare('SELECT * FROM invitations WHERE code = ? AND claimed_by IS NULL').get(String(code).trim()) as
        | { id: number; label: string }
        | undefined)
    : undefined;
  if (!openid || !invitation || !display_name) return res.redirect('/studio/login?error=invite');
  const isOwner = process.env.OWNER_OPENID && process.env.OWNER_OPENID === openid;
  const info = db
    .prepare('INSERT INTO users (openid, display_name, role) VALUES (?, ?, ?)')
    .run(openid, String(display_name).slice(0, 40), isOwner ? 'owner' : 'contributor');
  db.prepare('UPDATE invitations SET claimed_by = ? WHERE id = ?').run(info.lastInsertRowid as number, invitation.id);
  createSession(db, res, info.lastInsertRowid as number);
  audit(db, String(display_name), 'user', info.lastInsertRowid as number, 'bind-wechat');
  res.redirect('/studio');
});

app.post('/studio/logout', (req, res) => {
  if (!sameOriginGuard(req, res)) return res.status(403).send('Forbidden');
  destroySession(db, req, res);
  res.redirect('/studio/login');
});

// ---------- 状态机（服务端唯一裁决） ----------

const TRANSITIONS: Record<string, Record<string, { to: string; ownerOnly?: boolean; needMessage?: boolean }>> = {
  draft: { submit: { to: 'submitted' } },
  submitted: { 'start-review': { to: 'review', ownerOnly: true } },
  review: {
    'request-revision': { to: 'revision_requested', ownerOnly: true, needMessage: true },
    approve: { to: 'approved', ownerOnly: true },
    reject: { to: 'rejected', ownerOnly: true },
  },
  revision_requested: { submit: { to: 'submitted' } },
  approved: { publish: { to: 'published', ownerOnly: true } },
  published: { archive: { to: 'archived', ownerOnly: true } },
};

type ObsRow = Record<string, unknown> & { id: number; public_id: string; status: string; created_by: number };

function getObsByPublicId(publicId: string): ObsRow | undefined {
  return db.prepare('SELECT * FROM observations WHERE public_id = ?').get(publicId) as ObsRow | undefined;
}

function canEdit(user: StudioUser, obs: ObsRow): boolean {
  if (user.role === 'owner') return true;
  return obs.created_by === user.id && ['draft', 'revision_requested'].includes(obs.status);
}

// ---------- 观察投稿 ----------

app.get('/studio', (req, res) => {
  const user = requireUser(db, req, res);
  if (!user) return;
  const mine = db
    .prepare('SELECT public_id, observer_name, observed_at, status, field_note FROM observations WHERE created_by = ? ORDER BY id DESC LIMIT 30')
    .all(user.id) as { public_id: string; observer_name: string; observed_at: string; status: string; field_note: string }[];
  const queue =
    user.role === 'owner'
      ? (db
          .prepare("SELECT public_id, observer_name, observed_at, status FROM observations WHERE status IN ('submitted','review','approved') ORDER BY id DESC")
          .all() as { public_id: string; observer_name: string; observed_at: string; status: string }[])
      : [];
  const myPosts = db
    .prepare('SELECT slug, title, status, created_at FROM posts WHERE author_id = ? ORDER BY id DESC')
    .all(user.id) as { slug: string; title: string; status: string; created_at: string }[];
  const statusZh: Record<string, string> = {
    draft: '草稿', submitted: '待审核', review: '审核中', revision_requested: '需修改',
    approved: '已通过', published: '已发布', rejected: '未通过', archived: '已归档',
  };
  res.send(
    page(
      '工作台',
      `<h1>工作台</h1>
      <div style="margin-bottom:26px"><a class="btn" href="/studio/observations/new">发布新观察</a>
      <a class="btn btn-quiet" href="/studio/posts/new">撰写观察博文</a></div>
      <h2>${user.role === 'owner' ? '待处理' : '我的观察'}</h2>
      ${
        user.role === 'owner'
          ? `<table><tr><th>编号</th><th>观察者</th><th>日期</th><th>状态</th><th></th></tr>
             ${queue.map((o) => `<tr><td>${o.public_id}</td><td>${esc(o.observer_name)}</td><td>${o.observed_at}</td><td><span class="status">${statusZh[o.status] ?? o.status}</span></td><td><a href="/studio/observations/${o.public_id}">处理 →</a></td></tr>`).join('') || '<tr><td colspan="5">没有待处理的投稿。</td></tr>'}
             </table>`
          : `<table><tr><th>编号</th><th>日期</th><th>状态</th><th></th></tr>
             ${mine.map((o) => `<tr><td>${o.public_id}</td><td>${o.observed_at}</td><td><span class="status">${statusZh[o.status] ?? o.status}</span></td><td><a href="/studio/observations/${o.public_id}">查看 →</a></td></tr>`).join('') || '<tr><td colspan="4">还没有观察记录。</td></tr>'}
             </table>`
      }
      <h2>我的博文</h2>
      <table><tr><th>标题</th><th>状态</th><th></th></tr>
      ${myPosts.map((p) => `<tr><td>${esc(p.title)}</td><td><span class="status">${statusZh[p.status] ?? p.status}</span></td><td>${p.slug ? `<a href="/studio/posts/${p.slug}">查看 →</a>` : '—'}</td></tr>`).join('') || '<tr><td colspan="3">还没有博文。</td></tr>'}
      </table>
      ${
        user.role === 'owner'
          ? `<h2>发布到静态站</h2>
             <p><small>将已发布的观察、影像与博文导出为静态站数据（src/data/studio-*.json），随后运行 npm run build 即可上线。</small></p>
             <form method="post" action="/studio/export"><button type="submit">导出到静态站</button></form>`
          : ''
      }`,
      user,
    ),
  );
});

app.get('/studio/observations/new', (req, res) => {
  const user = requireUser(db, req, res);
  if (!user) return;
  const taxa = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'taxa.json'), 'utf-8')) as {
    id: string;
    slug: string;
    scientific_name: string;
    rank: string;
  }[];
  const taxonOptions = taxa
    .filter((t) => ['species', 'genus', 'tribe', 'family'].includes(t.rank))
    .map((t) => `<option value="${t.slug}">${esc(t.scientific_name)}（${t.rank}）</option>`)
    .join('');
  res.send(
    page(
      '发布新观察',
      `<h1>发布新观察</h1>
      <form method="post" action="/studio/observations" enctype="multipart/form-data">
        <div class="step"><div class="st">STEP 1 · 照 片</div>
          <label>照片（可多选，JPG/PNG，按上传顺序排列）</label>
          <input type="file" name="photos" multiple accept="image/jpeg,image/png" required />
          <label>图片说明（每行一条，与照片顺序对应，可留空）</label>
          <textarea name="photo_captions" placeholder="第一行对应第一张照片…"></textarea>
          <label>授权</label>
          <select name="license">
            <option value="all_rights_reserved">版权所有（默认）</option>
            <option value="cc_by_4_0">CC BY 4.0</option>
            <option value="cc_by_nc_4_0">CC BY-NC 4.0</option>
          </select>
        </div>
        <div class="step"><div class="st">STEP 2 · 时 间 与 地 点</div>
          <label>观察日期（若留空，将尝试读取照片 EXIF 拍摄日期作为建议）</label>
          <input type="date" name="observed_at" />
          <div class="grid2">
            <div><label>省份 *</label><input type="text" name="state_province" required placeholder="广东省" /></div>
            <div><label>市 / 县</label><input type="text" name="county" placeholder="龙门县" /></div>
          </div>
          <label>地点描述</label>
          <input type="text" name="locality" placeholder="南昆山林缘灌丛" />
          <div class="grid2">
            <div><label>海拔（米，可留空）</label><input type="number" name="elevation_m" min="0" max="9000" /></div>
            <div><label>位置公开级别 *</label>
              <select name="location_visibility">
                <option value="locality_only" selected>仅公开地名（默认，推荐）</option>
                <option value="blurred">坐标模糊化（需填公开坐标）</option>
                <option value="exact">精确坐标公开（仅限城市常见种 / 公共绿地）</option>
                <option value="hidden">完全保密</option>
              </select>
            </div>
          </div>
          <div class="grid2">
            <div><label>公开纬度（仅 exact / blurred 需要）</label><input type="text" name="public_latitude" placeholder="23.66" /></div>
            <div><label>公开经度</label><input type="text" name="public_longitude" placeholder="113.92" /></div>
          </div>
          <label>精确坐标（选填；仅站长内部留存，绝不公开）</label>
          <div class="grid2">
            <div><input type="text" name="exact_latitude" placeholder="纬度" /></div>
            <div><input type="text" name="exact_longitude" placeholder="经度" /></div>
          </div>
        </div>
        <div class="step"><div class="st">STEP 3 · 你 看 到 了 什 么</div>
          <label>初步印象（选填；只是建议，最终鉴定由站长完成）</label>
          <select name="taxon_slug"><option value="">—— 暂时不做初步判断 ——</option>${taxonOptions}</select>
          <div class="grid2">
            <div><label>性别</label><select name="sex"><option value="unknown">不明</option><option value="male">雄性</option><option value="female">雌性</option><option value="mixed">雌雄同记</option></select></div>
            <div><label>龄期</label><select name="life_stage"><option value="unknown">未知</option><option value="adult">成体</option><option value="subadult">亚成体</option><option value="juvenile">幼体</option></select></div>
          </div>
          <label>生境</label><input type="text" name="habitat" placeholder="低山常绿阔叶林林缘" />
          <label>小生境</label><input type="text" name="microhabitat" placeholder="叶片上表面" />
          <label>行为</label><input type="text" name="behavior" placeholder="游猎 / 求偶 / 静栖…" />
        </div>
        <div class="step"><div class="st">STEP 4 · 野 外 笔 记</div>
          <label>笔记 *（在哪儿、在做什么、有什么特别——不必是论文）</label>
          <textarea name="field_note" required></textarea>
        </div>
        <div class="step"><div class="st">STEP 5 · 确 认 并 提 交</div>
          <label><input type="checkbox" name="agree" value="1" required style="width:auto;margin-right:8px">
          我拥有或获授权上传这些照片；允许网站展示照片与观察信息；版权仍归摄影者；敏感情形下地点可能被泛化或隐藏；提交后由站长审核，不保证发布。</label>
          <label>提交为</label>
          <select name="submit_mode"><option value="draft">保存为草稿</option><option value="submitted">提交审核</option></select>
          <div style="margin-top:20px"><button type="submit">保存</button></div>
        </div>
      </form>`,
      user,
    ),
  );
});

app.post('/studio/observations', upload.array('photos', 20), async (req, res) => {
  const user = requireUser(db, req, res);
  if (!user) return;
  if (!sameOriginGuard(req, res)) return res.status(403).send('Forbidden');
  if (rateLimited(req.ip ?? 'unknown')) return res.status(429).send('上传过于频繁，请稍后再试。');

  const b = req.body as Record<string, string>;
  const files = (req.files as Express.Multer.File[]) ?? [];
  if (files.length === 0) return res.status(400).send('至少需要一张照片。');
  for (const f of files) {
    const err = validateUpload(f);
    if (err) return res.status(400).send(err);
  }
  if (b.agree !== '1') return res.status(400).send('需要确认投稿条款。');

  // EXIF 拍摄日期仅作为建议：用户留空日期时才采用；GPS 从不读取（规则 2 / prompt.md §17）
  let observedAt = (b.observed_at ?? '').trim();
  let exifSuggested: string | null = null;
  if (!observedAt && files.length > 0) {
    try {
      const meta = await (await import('sharp')).default(files[0].buffer).metadata();
      const raw = meta.exif ? String((meta.exif as Buffer).toString('latin1')) : '';
      const m = /(\d{4})[:\-](\d{2})[:\-](\d{2})/.exec(raw);
      if (m) exifSuggested = `${m[1]}-${m[2]}-${m[3]}`;
      if (exifSuggested) observedAt = exifSuggested;
    } catch {
      /* 无 EXIF 日期则必须手填 */
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(observedAt)) return res.status(400).send('无法确定观察日期，请手动填写。');

  const visibility = ['exact', 'blurred', 'locality_only', 'hidden'].includes(String(b.location_visibility))
    ? String(b.location_visibility)
    : 'locality_only';
  const num = (v: string | undefined): number | null => {
    const n = Number(v);
    return Number.isFinite(n) && v ? n : null;
  };
  let exactLat = num(b.exact_latitude);
  let exactLng = num(b.exact_longitude);
  let publicLat = num(b.public_latitude);
  let publicLng = num(b.public_longitude);
  if (visibility === 'exact') {
    if (exactLat == null || exactLng == null) return res.status(400).send('exact 级别需要精确坐标。');
    publicLat = exactLat;
    publicLng = exactLng;
  } else if (visibility === 'blurred') {
    if (publicLat == null || publicLng == null) return res.status(400).send('blurred 级别需要公开（模糊化）坐标。');
  } else {
    publicLat = null;
    publicLng = null;
  }

  const year = Number(observedAt.slice(0, 4));
  const publicId = nextObservationId(db, year);
  const status = b.submit_mode === 'submitted' ? 'submitted' : 'draft';

  const info = db
    .prepare(
      `INSERT INTO observations
       (public_id, created_by, observer_name, observed_at, observed_at_precision, state_province, county, locality,
        exact_latitude, exact_longitude, public_latitude, public_longitude, coordinate_uncertainty_m, elevation_m,
        location_visibility, sex, life_stage, habitat, microhabitat, behavior, contributor_guess, field_note,
        status, visibility)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      publicId, user.id, user.display_name, observedAt, 'day',
      String(b.state_province ?? '').trim(), b.county ?? null, b.locality ?? null,
      exactLat, exactLng, publicLat, publicLng,
      visibility === 'blurred' ? 3000 : visibility === 'exact' ? 50 : null,
      num(b.elevation_m), visibility,
      b.sex ?? 'unknown', b.life_stage ?? 'unknown', b.habitat ?? null, b.microhabitat ?? null,
      b.behavior ?? null, b.taxon_slug ? String(b.taxon_slug) : null,
      String(b.field_note ?? '').trim(), status, 'private',
    );
  const obsId = info.lastInsertRowid as number;

  const captions = String(b.photo_captions ?? '').split('\n').map((s) => s.trim());
  let order = 0;
  for (const file of files) {
    order += 1;
    const saved = await saveUploadedPhoto(db, file);
    db.prepare(
      `INSERT INTO media (public_id, observation_id, file_stem, view_type, caption, sort_order, is_cover,
       photographer_name, license, visibility, width, height)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      saved.publicId, obsId, saved.fileStem, order === 1 ? 'live_dorsal' : 'other',
      captions[order - 1] ?? null, order, order === 1 ? 1 : 0,
      user.display_name, b.license ?? 'all_rights_reserved', 'private', saved.width, saved.height,
    );
  }

  audit(db, user.display_name, 'observation', publicId, status === 'submitted' ? 'create-submit' : 'create-draft', {
    exifSuggested,
    photos: files.length,
  });
  res.redirect(`/studio/observations/${publicId}`);
});

app.get('/studio/observations/:publicId', (req, res) => {
  const user = requireUser(db, req, res);
  if (!user) return;
  const obs = getObsByPublicId(req.params.publicId);
  if (!obs) return res.status(404).send('未找到该观察。');
  if (user.role !== 'owner' && obs.created_by !== user.id) return res.status(403).send('无权查看该记录。');
  const mediaRows = db.prepare('SELECT * FROM media WHERE observation_id = ? ORDER BY sort_order').all(obs.id) as Record<string, unknown>[];
  const idnRows = db.prepare('SELECT * FROM identifications WHERE observation_id = ? ORDER BY id').all(obs.id) as Record<string, unknown>[];
  const currentIdn = idnRows.find((i) => i.is_current);
  const taxa = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'taxa.json'), 'utf-8')) as {
    slug: string;
    scientific_name: string;
    rank: string;
  }[];
  const statusZh: Record<string, string> = {
    draft: '草稿', submitted: '待审核', review: '审核中', revision_requested: '需修改',
    approved: '已通过', published: '已发布', rejected: '未通过', archived: '已归档',
  };
  const actions = TRANSITIONS[obs.status] ?? {};
  const actionButtons = Object.entries(actions)
    .filter(([, t]) => !t.ownerOnly || user.role === 'owner')
    .map(
      ([action, t]) => `<form method="post" action="/studio/observations/${obs.public_id}/action" style="display:inline;margin-right:8px">
        <input type="hidden" name="action" value="${action}" />
        ${t.needMessage ? '<input type="text" name="message" placeholder="修改意见（必填）" required style="width:220px;margin-right:8px">' : ''}
        <button type="submit">${action}</button>
      </form>`,
    )
    .join('');

  const taxonOptions = taxa
    .map((t) => `<option value="${t.slug}">${esc(t.scientific_name)}（${t.rank}）</option>`)
    .join('');

  res.send(
    page(
      obs.public_id,
      `<h1>${obs.public_id} <span class="status">${statusZh[obs.status] ?? obs.status}</span></h1>
      <p><small>${obs.observed_at} · ${esc(String(obs.state_province))}${obs.county ? ` ${esc(String(obs.county))}` : ''} · 观察 ${esc(String(obs.observer_name))} · 位置级别 ${esc(String(obs.location_visibility))}</small></p>
      ${obs.status === 'revision_requested' ? '<div class="msg">站长请求修改——请更新内容后重新提交。</div>' : ''}
      <div class="thumbs">${mediaRows.map((m) => `<img src="/media/derivatives/${m.file_stem}_thumb.jpg" alt="">`).join('')}</div>
      <h2>野 外 笔 记</h2>
      <div class="card">${esc(String(obs.field_note))}</div>
      <div class="grid2">
        <div class="card"><h2 style="margin-top:0">元 数 据</h2>
          <table>
            <tr><th>生境</th><td>${esc(obs.habitat) || '—'}</td></tr>
            <tr><th>小生境</th><td>${esc(obs.microhabitat) || '—'}</td></tr>
            <tr><th>行为</th><td>${esc(obs.behavior) || '—'}</td></tr>
            <tr><th>性别 / 龄期</th><td>${esc(obs.sex)} / ${esc(obs.life_stage)}</td></tr>
            <tr><th>初步印象</th><td>${esc(obs.contributor_guess) || '—'}</td></tr>
            <tr><th>海拔</th><td>${obs.elevation_m ? `${obs.elevation_m} m` : '—'}</td></tr>
          </table>
        </div>
        <div class="card"><h2 style="margin-top:0">鉴 定</h2>
          ${
            currentIdn
              ? `<p><em>${esc(String(currentIdn.display_identification))}</em><br>
                 <small>${esc(String(currentIdn.evidence))} · ${esc(String(currentIdn.identified_by))} · ${esc(String(currentIdn.identified_at))}</small></p>`
              : '<p><small>暂无权威鉴定。投稿者的初步印象仅供参考。</small></p>'
          }
          ${
            user.role === 'owner'
              ? `<form method="post" action="/studio/observations/${obs.public_id}/identify">
                 <label>权威鉴定（引用类群记录）</label>
                 <select name="taxon_slug">${taxonOptions}</select>
                 <label>展示文本（默认与类群一致，可用 cf. 等表述）</label>
                 <input type="text" name="display" placeholder="留空则自动生成" />
                 <label>证据等级</label>
                 <select name="evidence">
                   <option value="tentative">暂定参考</option><option value="photo_based">照片鉴定</option>
                   <option value="specimen_examined">标本检视</option><option value="genitalia_confirmed">外生殖器确认</option>
                   <option value="molecularly_supported">分子数据支持</option>
                 </select>
                 <label>备注</label><input type="text" name="remarks" />
                 <div style="margin-top:12px"><button type="submit">记录鉴定</button></div>
               </form>`
              : ''
          }
          ${
            idnRows.length > 1
              ? `<h2 style="margin-top:18px">鉴定历史</h2><ul>${idnRows
                  .map(
                    (i) =>
                      `<li><small>${esc(String(i.identified_at))} · ${esc(String(i.display_identification))}（${esc(String(i.evidence))}）${Number(i.is_current) ? ' ← 当前' : ''}</small></li>`,
                  )
                  .join('')}</ul>`
              : ''
          }
        </div>
      </div>
      <h2>操 作</h2>
      <div>${actionButtons || '<small>当前状态没有可执行的操作。</small>'}</div>`,
      user,
    ),
  );
});

app.post('/studio/observations/:publicId/action', (req, res) => {
  const user = requireUser(db, req, res);
  if (!user) return;
  if (!sameOriginGuard(req, res)) return res.status(403).send('Forbidden');
  const obs = getObsByPublicId(req.params.publicId);
  if (!obs) return res.status(404).send('未找到该观察。');
  const action = String((req.body as Record<string, string>).action ?? '');
  const message = String((req.body as Record<string, string>).message ?? '').trim();
  const transition = (TRANSITIONS[obs.status] ?? {})[action];
  if (!transition) return res.status(400).send(`当前状态（${obs.status}）不允许该操作。`);
  const isAuthor = obs.created_by === user.id;
  if (transition.ownerOnly && user.role !== 'owner') return res.status(403).send('只有站长可以执行该操作。');
  if (!transition.ownerOnly && !isAuthor && user.role !== 'owner') return res.status(403).send('只能操作自己的记录。');
  if (transition.needMessage && !message) return res.status(400).send('该操作必须附上说明。');

  db.prepare('UPDATE observations SET status = ?, updated_at = datetime(\'now\') WHERE id = ?').run(transition.to, obs.id);
  if (transition.to === 'published') {
    // 发布 = 进入公开站：观察与全部媒体转为 public（导出与静态隐私管线都以此为闸门）
    db.prepare("UPDATE observations SET visibility = 'public' WHERE id = ?").run(obs.id);
    db.prepare("UPDATE media SET visibility = 'public' WHERE observation_id = ?").run(obs.id);
  }
  audit(db, user.display_name, 'observation', obs.public_id, `${obs.status}→${transition.to}`, message || undefined);
  res.redirect(`/studio/observations/${obs.public_id}`);
});

app.post('/studio/observations/:publicId/identify', (req, res) => {
  const user = requireOwner(db, req, res);
  if (!user) return;
  if (!sameOriginGuard(req, res)) return res.status(403).send('Forbidden');
  const obs = getObsByPublicId(req.params.publicId);
  if (!obs) return res.status(404).send('未找到该观察。');
  const b = req.body as Record<string, string>;
  const taxa = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'taxa.json'), 'utf-8')) as {
    slug: string;
    scientific_name: string;
    rank: string;
  }[];
  const taxon = taxa.find((t) => t.slug === b.taxon_slug);
  if (!taxon) return res.status(400).send('未知的类群。');
  const display = (b.display ?? '').trim() || (['species', 'subspecies'].includes(taxon.rank) ? taxon.scientific_name : `${taxon.scientific_name} sp.`);
  db.prepare('UPDATE identifications SET is_current = 0 WHERE observation_id = ?').run(obs.id);
  db.prepare(
    `INSERT INTO identifications (observation_id, taxon_slug, display_identification, identified_by, identified_at, evidence, remarks, is_current)
     VALUES (?,?,?,?,?,?,?,1)`,
  ).run(obs.id, taxon.slug, display, user.display_name, new Date().toISOString().slice(0, 10), b.evidence ?? 'tentative', b.remarks ?? null);
  audit(db, user.display_name, 'identification', obs.public_id, 'identify', { display, evidence: b.evidence });
  res.redirect(`/studio/observations/${obs.public_id}`);
});

// ---------- 观察博文 ----------

app.get('/studio/posts/new', (req, res) => {
  const user = requireUser(db, req, res);
  if (!user) return;
  res.send(
    page(
      '撰写观察博文',
      `<h1>撰写观察博文</h1>
      <form method="post" action="/studio/posts">
        <label>标题 *</label><input type="text" name="title" required />
        <label>Slug（留空自动生成）</label><input type="text" name="slug" placeholder="nankunshan-may-2023" />
        <label>封面媒体编号（选填，如 CSFN-M-000001）</label><input type="text" name="cover" />
        <label>关联观察（逗号分隔的观察编号，选填）</label><input type="text" name="related" placeholder="CSFN-2023-000001, CSFN-2023-000002" />
        <label>正文（Markdown）*</label>
        <textarea name="body_md" style="min-height:260px" required></textarea>
        <div style="margin-top:16px"><button type="submit">保存草稿</button></div>
      </form>`,
      user,
    ),
  );
});

app.post('/studio/posts', (req, res) => {
  const user = requireUser(db, req, res);
  if (!user) return;
  if (!sameOriginGuard(req, res)) return res.status(403).send('Forbidden');
  const b = req.body as Record<string, string>;
  if (!b.title?.trim() || !b.body_md?.trim()) return res.status(400).send('标题与正文必填。');
  const seq = nextPostSlugSeq(db);
  const slug =
    b.slug && /^[a-z0-9][a-z0-9-]{1,60}$/.test(b.slug)
      ? b.slug
      : `post-${String(seq).padStart(3, '0')}`;
  const cover = b.cover?.trim() ? (db.prepare('SELECT id FROM media WHERE public_id = ?').get(b.cover.trim()) as { id: number } | undefined) : undefined;
  const related = JSON.stringify(
    (b.related ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => /^CSFN-\d{4}-\d{6}$/.test(s)),
  );
  db.prepare(
    'INSERT INTO posts (slug, author_id, title, body_md, cover_media_id, related_observation_public_ids, status) VALUES (?,?,?,?,?,?,?)',
  ).run(slug, user.id, b.title.trim(), b.body_md, cover?.id ?? null, related, 'draft');
  audit(db, user.display_name, 'post', slug, 'create-draft');
  res.redirect('/studio');
});

app.get('/studio/posts/:slug', (req, res) => {
  const user = requireUser(db, req, res);
  if (!user) return;
  const post = db.prepare('SELECT * FROM posts WHERE slug = ?').get(req.params.slug) as Record<string, unknown> | undefined;
  if (!post) return res.status(404).send('未找到该博文。');
  if (user.role !== 'owner' && post.author_id !== user.id) return res.status(403).send('无权查看。');
  const statusZh: Record<string, string> = { draft: '草稿', submitted: '待审核', review: '审核中', approved: '已通过', published: '已发布', rejected: '未通过', archived: '已归档' };
  res.send(
    page(
      String(post.title),
      `<h1>${esc(String(post.title))} <span class="status">${statusZh[String(post.status)] ?? ''}</span></h1>
      <div class="card"><pre style="white-space:pre-wrap;font:inherit;margin:0">${esc(String(post.body_md))}</pre></div>
      ${
        user.role === 'owner' && post.status === 'draft'
          ? `<form method="post" action="/studio/posts/${post.slug}/action"><input type="hidden" name="action" value="publish"><button type="submit">发布到静态站</button></form>`
          : `<small>发布由站长在导出流程中完成。</small>`
      }`,
      user,
    ),
  );
});

app.post('/studio/posts/:slug/action', (req, res) => {
  const user = requireOwner(db, req, res);
  if (!user) return;
  if (!sameOriginGuard(req, res)) return res.status(403).send('Forbidden');
  const post = db.prepare('SELECT * FROM posts WHERE slug = ?').get(req.params.slug) as Record<string, unknown> | undefined;
  if (!post) return res.status(404).send('未找到该博文。');
  const action = String((req.body as Record<string, string>).action ?? '');
  if (action !== 'publish') return res.status(400).send('未知操作。');
  if (post.status !== 'draft') return res.status(400).send('仅草稿可发布。');
  db.prepare("UPDATE posts SET status = 'published', updated_at = datetime('now') WHERE id = ?").run(post.id as number);
  audit(db, user.display_name, 'post', String(post.slug), 'publish');
  res.redirect('/studio');
});

// ---------- 导出 ----------

app.post('/studio/export', (req, res) => {
  const user = requireOwner(db, req, res);
  if (!user) return;
  if (!sameOriginGuard(req, res)) return res.status(403).send('Forbidden');
  const result = exportForStaticSite(db);
  audit(db, user.display_name, 'export', null, 'export-static', result);
  res.send(
    page(
      '导出完成',
      `<h1>导出完成</h1>
      <div class="msg">已写入 src/data/studio-*.json：观察 ${result.observations} 条 · 媒体 ${result.media} 条 · 博文 ${result.posts} 篇。</div>
      <p><small>下一步：在项目根目录运行 <code>npm run build && npm run test:privacy</code>，确认后提交并部署到 GitHub Pages。</small></p>
      <a class="btn" href="/studio">返回工作台</a>`,
      user,
    ),
  );
});

app.use((req, res) => {
  res.status(404).send('Not Found');
});

app.listen(PORT, () => {
  console.log(`Field Studio 运行于 http://localhost:${PORT}/studio`);
  console.log(`微信登录：${wechatConfigured() ? '已配置' : '未配置（使用邀请码开发模式登录）'}`);
});
