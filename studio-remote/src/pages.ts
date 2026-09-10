// 页面模板与视觉系统（UX Refresh）。
// 定位：野外记录本 + 写作桌 —— 不是 CMS / 后台。
// 与公开站同一套自然纸张语言：低饱和、安静、留白、图片优先。
import taxaJson from './taxa-data.json';
import tripsJson from './trips-data.json';
import type { StudioUser } from './auth';

export const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string));

export const TAXA = taxaJson as unknown as { slug: string; scientific_name: string; rank: string; chinese_name: string | null }[];
export const TRIPS = (tripsJson as any[]).map((t) => ({ slug: t.slug, title: t.title }));

export const SITE_URL = 'https://salticidnotes.cn';

// ---------- 时间（全部按北京时间显示；Workers 上 new Date() 是 UTC，须显式换算） ----------

/** 内联进 <script> 的 JSON：转义 <，防止内容里的 </script> 提前闭合标签 */
const jsonForScript = (v: unknown): string => JSON.stringify(v).replace(/</g, '\\u003c');

const TZ = 'Asia/Shanghai';
function shParts(d: Date): { y: number; m: number; d: number; hh: string; mm: string } {
  const f = new Intl.DateTimeFormat('zh-CN', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const p: Record<string, string> = {};
  for (const part of f.formatToParts(d)) p[part.type] = part.value;
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), hh: p.hour === '24' ? '00' : p.hour, mm: p.minute };
}

export function greetingWord(): string {
  const { hh } = shParts(new Date());
  const h = Number(hh);
  if (h < 5) return '夜深了';
  if (h < 11) return '早上好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

/** 相对时间：刚刚 / n 分钟前 / 今天 HH:MM / 昨天 / M月D日 / YYYY年M月D日 */
export function relTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  const now = new Date();
  const a = shParts(d), b = shParts(now);
  const diffMin = Math.round((now.getTime() - d.getTime()) / 60000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const sameDay = a.y === b.y && a.m === b.m && a.d === b.d;
  if (sameDay) return `今天 ${a.hh}:${a.mm}`;
  const yesterday = new Date(now.getTime() - 86400000);
  const yd = shParts(yesterday);
  if (a.y === yd.y && a.m === yd.m && a.d === yd.d) return `昨天 ${a.hh}:${a.mm}`;
  if (a.y === b.y) return `${a.m}月${a.d}日`;
  return `${a.y}年${a.m}月${a.d}日`;
}

// ---------- 视觉系统 ----------

export const STYLES = `
:root {
  --paper:#f7f5f0; --paper-deep:#efece4; --ink:#26221c; --muted:#6f675c; --faint:#988f80;
  --line:#e4ddcf; --line-soft:#ece7db; --accent:#566246; --terra:#a4552f;
  --serif: Georgia,"Times New Roman","Songti SC","Noto Serif SC",SimSun,serif;
  --sans: -apple-system,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;
  --fast:180ms; --normal:240ms; --ease:cubic-bezier(.22,1,.36,1);
  --w-note:720px;
}
* { box-sizing:border-box; }
[hidden] { display:none !important; }
html { -webkit-text-size-adjust:100%; }
body { margin:0; background:var(--paper); color:var(--ink); font:16px/1.75 var(--sans); -webkit-font-smoothing:antialiased; }
a { color:inherit; }
button { font:inherit; cursor:pointer; }
@media (prefers-reduced-motion: reduce) { * { transition:none !important; animation:none !important; } }

/* ---- 顶栏 shell ---- */
.shell {
  position:sticky; top:0; z-index:40; display:flex; align-items:center; gap:22px;
  padding:0 max(20px, calc(50vw - 480px)); height:56px;
  background:color-mix(in srgb, var(--paper) 88%, transparent); backdrop-filter:blur(8px);
  border-bottom:1px solid var(--line-soft);
}
.shell .brand { font-family:var(--serif); font-weight:700; font-size:17px; letter-spacing:.04em; text-decoration:none; display:flex; align-items:baseline; gap:8px; }
.shell .brand small { font-family:var(--sans); font-weight:400; font-size:11.5px; color:var(--faint); letter-spacing:.14em; }
.shell nav { display:flex; gap:4px; }
.shell nav a {
  text-decoration:none; color:var(--muted); font-size:14px; padding:5px 12px; border-radius:99px;
  transition:color var(--fast) ease, background var(--fast) ease;
}
.shell nav a:hover, .shell nav a.on { color:var(--ink); background:var(--paper-deep); }
.shell .right { margin-left:auto; display:flex; align-items:center; gap:14px; }
.shell .right .site { font-size:13px; color:var(--muted); text-decoration:none; }
.shell .right .site:hover { color:var(--ink); }
details.avatar { position:relative; }
details.avatar summary { list-style:none; cursor:pointer; display:flex; align-items:center; justify-content:center;
  width:32px; height:32px; border-radius:50%; background:var(--accent); color:#fff; font-size:14px; user-select:none; }
details.avatar summary::-webkit-details-marker { display:none; }
details.avatar .menu { position:absolute; right:0; top:40px; background:#fff; border:1px solid var(--line);
  border-radius:10px; padding:6px; min-width:150px; box-shadow:0 6px 24px rgba(38,34,28,.08); }
details.avatar .menu a, details.avatar .menu span { display:block; padding:8px 12px; font-size:14px; text-decoration:none; color:var(--ink); border-radius:8px; }
details.avatar .menu a:hover { background:var(--paper-deep); }
details.avatar .menu .who { color:var(--faint); font-size:12.5px; }

/* 编辑态顶栏：只留返回 + 状态 + 动作 */
.shell.editor-mode { gap:14px; }
.shell.editor-mode .back { text-decoration:none; color:var(--muted); font-size:14px; padding:5px 10px; border-radius:99px; transition:background var(--fast) ease, color var(--fast) ease; white-space:nowrap; }
.shell.editor-mode .back:hover { background:var(--paper-deep); color:var(--ink); }
#save-status { font-size:12.5px; color:var(--faint); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
#save-status.err { color:var(--terra); }
#save-status a { color:var(--accent); }
#bar-status a { color:var(--accent); }

/* ---- 通用元素 ---- */
main { min-height:calc(100vh - 56px); }
.wrap { max-width:960px; margin:0 auto; padding:40px 24px 120px; }
.wrap.narrow { max-width:var(--w-note); }
.kicker { font-size:11.5px; letter-spacing:.26em; color:var(--faint); font-weight:600; margin:44px 0 6px; }

button.primary, a.primary {
  display:inline-flex; align-items:center; justify-content:center; gap:6px;
  background:var(--ink); color:var(--paper); border:none; border-radius:99px;
  padding:10px 26px; font-size:14.5px; letter-spacing:.05em; text-decoration:none;
  transition:opacity var(--fast) ease, transform var(--fast) ease;
}
button.primary:hover, a.primary:hover { opacity:.86; }
button.primary:disabled { opacity:.45; cursor:default; }
button.ghost, a.ghost {
  display:inline-flex; align-items:center; gap:6px; background:none; border:none;
  color:var(--muted); font-size:14px; padding:8px 14px; border-radius:99px; text-decoration:none;
  transition:color var(--fast) ease, background var(--fast) ease;
}
button.ghost:hover, a.ghost:hover { color:var(--ink); background:var(--paper-deep); }

/* 字段：label + 值 + 轻边线，不做方框卡片 */
.field { margin:0 0 26px; }
.field > label { display:block; font-size:12.5px; color:var(--muted); letter-spacing:.06em; margin:0 0 6px; }
.field input[type=text], .field input[type=date], .field input[type=number], .field input[type=email],
.field input:not([type]), .field select, .field textarea {
  width:100%; border:none; border-bottom:1px solid var(--line); background:transparent;
  padding:7px 2px; font:inherit; color:var(--ink); border-radius:0;
  transition:border-color var(--fast) ease;
}
.field input:focus, .field select:focus, .field textarea:focus { outline:none; border-bottom-color:var(--accent); }
.field ::placeholder { color:var(--faint); }
.field .hint { display:block; font-size:12px; color:var(--faint); margin-top:5px; line-height:1.5; }
.field textarea { resize:vertical; min-height:84px; line-height:1.8; }
.row2 { display:grid; grid-template-columns:1fr 1fr; gap:0 26px; }
.row3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:0 22px; }
.field-error { color:var(--terra); font-size:13px; margin-top:8px; display:none; }
.field-error.show { display:block; }

/* ---- 登录页 ---- */
.login-page { min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:32px; }
.login-box { width:100%; max-width:360px; text-align:center; }
.login-brand { font-family:var(--serif); font-size:20px; letter-spacing:.08em; color:var(--muted); }
.login-brand b { display:block; font-size:44px; letter-spacing:.02em; color:var(--ink); margin:6px 0 10px; }
.login-tag { color:var(--muted); margin:0 0 44px; font-size:15px; }
.login-box input[type=email], .login-box input[type=text] {
  width:100%; border:none; border-bottom:1px solid var(--line); background:transparent;
  padding:10px 2px; font:inherit; text-align:center; color:var(--ink); border-radius:0;
}
.login-box input:focus { outline:none; border-bottom-color:var(--accent); }
.login-box ::placeholder { color:var(--faint); }
.login-box button.primary { width:100%; margin-top:26px; }
.login-foot { margin-top:34px; font-size:12.5px; color:var(--faint); letter-spacing:.1em; }
.login-err { color:var(--terra); font-size:13.5px; min-height:20px; margin:12px 0 0; }
.login-email-now { font-size:13px; color:var(--muted); margin:0 0 20px; }
.login-email-now a { color:var(--faint); }
.code-row { display:flex; gap:8px; justify-content:center; margin:6px 0 4px; }
.code-row input {
  width:46px; height:58px; text-align:center; font-size:24px; font-family:var(--serif);
  border:none; border-bottom:2px solid var(--line); background:transparent; color:var(--ink);
  border-radius:0; padding:0;
}
.code-row input:focus { outline:none; border-bottom-color:var(--accent); }
.resend { font-size:13px; color:var(--faint); margin:16px 0 0; }
.resend button { background:none; border:none; color:var(--muted); text-decoration:underline; text-underline-offset:3px; padding:0; font-size:13px; }
.resend button:disabled { color:var(--faint); text-decoration:none; cursor:default; }

/* ---- 首页 ---- */
.hello-wrap { margin:26px 0 34px; }
.hello-wrap h1 { font-family:var(--serif); font-weight:400; font-size:34px; margin:0 0 6px; }
.hello-wrap p { color:var(--muted); margin:0; }
.action-cards { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.action-card {
  border:1px solid var(--line); background:#fbfaf7; border-radius:14px; padding:22px 24px;
  text-decoration:none; display:block; transition:border-color var(--fast) ease, transform var(--fast) ease;
}
.action-card:hover { border-color:var(--faint); transform:translateY(-1px); }
.action-card .ic { font-size:20px; color:var(--accent); }
.action-card b { display:block; font-family:var(--serif); font-weight:400; font-size:19px; margin:8px 0 2px; }
.action-card span.sub { color:var(--muted); font-size:13.5px; }

.feed { list-style:none; margin:10px 0 0; padding:0; }
.feed li { border-bottom:1px solid var(--line-soft); }
.feed a { display:flex; align-items:baseline; gap:14px; padding:13px 4px; text-decoration:none; transition:background var(--fast) ease; }
.feed a:hover { background:rgba(0,0,0,.02); }
.feed .t { font-size:15.5px; flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.feed .meta { font-size:12.5px; color:var(--faint); white-space:nowrap; }
.feed .st-draft { color:var(--terra); }
.feed .st-pub { color:var(--accent); }
.all-link { display:inline-block; margin-top:14px; font-size:13.5px; color:var(--muted); text-decoration:none; }
.all-link:hover { color:var(--ink); }
.empty { color:var(--faint); font-size:14.5px; padding:18px 4px; }
.empty a { color:var(--accent); }
.home-foot { margin-top:64px; padding-top:18px; border-top:1px solid var(--line-soft); display:flex; gap:18px; }
.home-foot a { font-size:12.5px; color:var(--faint); text-decoration:none; }
.home-foot a:hover { color:var(--ink); }

/* ---- 观察编辑器 ---- */
.editor-main { max-width:760px; margin:0 auto; padding:34px 24px 130px; }
.editor-main h1 { font-family:var(--serif); font-weight:400; font-size:26px; margin:0 0 26px; }
.drop-big {
  border:1.5px dashed var(--line); border-radius:16px; background:#fbfaf7;
  padding:44px 20px; text-align:center; cursor:pointer; transition:border-color var(--fast) ease, background var(--fast) ease;
}
.drop-big:hover { border-color:var(--faint); background:#fff; }
.drop-big .plus { font-size:30px; color:var(--faint); display:block; line-height:1; }
.drop-big b { display:block; font-family:var(--serif); font-weight:400; font-size:18px; margin:10px 0 4px; }
.drop-big span { color:var(--faint); font-size:13.5px; }
.photo-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(108px, 1fr)); gap:10px; margin:14px 0 4px; }
.photo {
  position:relative; aspect-ratio:1; border-radius:10px; overflow:hidden; background:var(--paper-deep);
  cursor:pointer; border:1px solid var(--line-soft);
}
.photo img { width:100%; height:100%; object-fit:cover; display:block; }
.photo .badge {
  position:absolute; left:6px; top:6px; width:22px; height:22px; border-radius:50%;
  background:rgba(38,34,28,.72); color:#fff; font-size:11.5px; display:flex; align-items:center; justify-content:center;
}
.photo.cover .badge { background:var(--accent); }
.photo.uploading { opacity:.55; }
.photo-grid-add {
  aspect-ratio:1; border-radius:10px; border:1.5px dashed var(--line); background:none;
  color:var(--faint); font-size:22px; display:flex; align-items:center; justify-content:center; cursor:pointer;
  transition:border-color var(--fast) ease, color var(--fast) ease;
}
.photo-grid-add:hover { border-color:var(--faint); color:var(--ink); }
.photo-panel {
  border:1px solid var(--line); border-radius:14px; background:#fbfaf7; padding:18px 20px; margin:14px 0 6px;
}
.photo-panel .pp-head { display:flex; align-items:center; gap:10px; margin-bottom:10px; }
.photo-panel .pp-head img { width:52px; height:52px; object-fit:cover; border-radius:8px; }
.photo-panel .pp-head b { font-size:12.5px; color:var(--muted); font-weight:600; letter-spacing:.04em; }
.photo-panel .pp-actions { display:flex; gap:4px; margin-top:12px; flex-wrap:wrap; }

/* 物种选择 */
.species-wrap { position:relative; }
.species-pop {
  position:absolute; left:0; right:0; top:calc(100% + 6px); z-index:30; background:#fff;
  border:1px solid var(--line); border-radius:12px; box-shadow:0 10px 30px rgba(38,34,28,.10);
  max-height:290px; overflow:auto; padding:6px; display:none;
}
.species-pop.open { display:block; }
.species-pop .opt { padding:9px 12px; border-radius:8px; cursor:pointer; display:flex; flex-direction:column; gap:1px; }
.species-pop .opt:hover, .species-pop .opt.sel { background:var(--paper-deep); }
.species-pop .opt .cn { font-size:14.5px; }
.species-pop .opt .sn { font-size:12.5px; color:var(--faint); font-style:italic; }
.species-pop .none { padding:12px; color:var(--faint); font-size:13.5px; }
.chosen-taxa { display:flex; align-items:center; gap:10px; padding:4px 0; }
.chosen-taxa .cn { font-size:16px; }
.chosen-taxa .sn { font-style:italic; color:var(--muted); font-size:13.5px; }
.chosen-taxa button { background:none; border:none; color:var(--faint); font-size:12.5px; text-decoration:underline; text-underline-offset:3px; padding:0; }
.chosen-taxa button:hover { color:var(--ink); }

/* 坐标与地图 */
.coords-row { display:flex; align-items:baseline; gap:8px; flex-wrap:wrap; }
.coords-row .coord { flex:1; min-width:130px; display:flex; align-items:baseline; gap:4px; }
.coords-row .coord em { font-style:normal; color:var(--faint); font-size:13px; }
#map-box { margin-top:12px; border-radius:12px; overflow:hidden; border:1px solid var(--line); }
#map-box .map-inner { height:320px; }
#map-box .map-hint { font-size:12px; color:var(--faint); padding:8px 12px; background:#fbfaf7; border-top:1px solid var(--line-soft); }
#map-box.loading { display:flex; align-items:center; justify-content:center; height:200px; color:var(--faint); font-size:13.5px; }

/* 详细信息折叠 */
details.more { border-top:1px solid var(--line-soft); margin-top:8px; padding-top:6px; }
details.more summary { cursor:pointer; color:var(--muted); font-size:14px; padding:12px 0; list-style:none; }
details.more summary::-webkit-details-marker { display:none; }
details.more summary::before { content:'＋ '; color:var(--faint); }
details.more[open] summary::before { content:'－ '; }
details.more .grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:0 22px; margin-top:6px; }

/* 底部操作栏 */
.bottombar {
  position:fixed; left:0; right:0; bottom:0; z-index:40;
  display:flex; align-items:center; gap:12px;
  padding:10px max(20px, calc(50vw - 480px));
  background:color-mix(in srgb, var(--paper) 92%, transparent); backdrop-filter:blur(8px);
  border-top:1px solid var(--line-soft);
}
.bottombar .spacer { flex:1; }
.bottombar .pub-hint { font-size:12px; color:var(--faint); margin-right:auto; }

/* ---- 札记：写作模式 ---- */
.write-main { max-width:var(--w-note); margin:0 auto; padding:44px 24px 160px; }
.title-line, .subtitle-line {
  width:100%; border:none; background:transparent; font-family:var(--serif); color:var(--ink); padding:0;
}
.title-line { font-size:34px; font-weight:400; margin:0 0 2px; }
.subtitle-line { font-size:16px; color:var(--muted); margin-bottom:26px; }
.title-line:focus, .subtitle-line:focus { outline:none; }
.title-line::placeholder, .subtitle-line::placeholder, .body-line::placeholder { color:var(--faint); opacity:.7; }
.body-line {
  width:100%; min-height:52vh; border:none; background:transparent; font-family:var(--serif);
  font-size:17.5px; line-height:2; color:var(--ink); padding:0; resize:none;
}
.body-line:focus { outline:none; }
.fab-add {
  position:fixed; z-index:35; bottom:86px; left:50%; transform:translateX(min(330px, 42vw));
  width:40px; height:40px; border-radius:50%; border:1px solid var(--line); background:#fff;
  color:var(--muted); font-size:20px; line-height:1; box-shadow:0 4px 16px rgba(38,34,28,.08);
  transition:color var(--fast) ease, border-color var(--fast) ease;
}
.fab-add:hover { color:var(--ink); border-color:var(--faint); }
.block-menu {
  position:fixed; z-index:50; bottom:134px; left:50%; transform:translateX(min(330px, 42vw));
  background:#fff; border:1px solid var(--line); border-radius:12px; box-shadow:0 10px 30px rgba(38,34,28,.12);
  padding:6px; width:190px; display:none;
}
.block-menu.open { display:block; }
.block-menu button {
  display:block; width:100%; text-align:left; background:none; border:none; padding:9px 12px;
  font-size:14px; color:var(--ink); border-radius:8px;
}
.block-menu button:hover { background:var(--paper-deep); }
.block-menu .sep { border-top:1px solid var(--line-soft); margin:4px 0; }
/* 编辑 ⇄ 预览 切换 */
.seg { display:flex; background:var(--paper-deep); border-radius:99px; padding:3px; }
.seg button { border:none; background:none; padding:4px 14px; border-radius:99px; font-size:13px; color:var(--muted); transition:all var(--fast) ease; }
.seg button.on { background:#fff; color:var(--ink); }
.preview-pane { animation:fadein var(--normal) var(--ease); }
@keyframes fadein { from { opacity:0; } to { opacity:1; } }
/* 设置抽屉 */
.drawer-mask { position:fixed; inset:0; background:rgba(38,34,28,.18); z-index:60; opacity:0; pointer-events:none; transition:opacity var(--normal) var(--ease); }
.drawer { position:fixed; top:0; right:0; bottom:0; width:min(360px, 92vw); background:var(--paper); z-index:61;
  border-left:1px solid var(--line); padding:26px 26px 40px; overflow:auto;
  transform:translateX(100%); transition:transform var(--normal) var(--ease); }
body.drawer-open .drawer { transform:translateX(0); }
body.drawer-open .drawer-mask { opacity:1; pointer-events:auto; }
.drawer h3 { font-family:var(--serif); font-weight:400; font-size:19px; margin:0 0 20px; }
.drawer .ro { font-size:14px; color:var(--muted); padding:2px 0 14px; }
.drawer .ro b { display:block; font-size:12px; color:var(--faint); font-weight:600; letter-spacing:.08em; margin-bottom:3px; }

/* ---- 文章预览（与公开站 Article Renderer 同一套布局语义） ---- */
.article-body { font-family:var(--serif); font-size:17px; line-height:1.95; }
.article-body h2 { font-family:var(--serif); font-size:25px; letter-spacing:.02em; color:var(--ink); margin:46px 0 14px; }
.article-body h3 { font-family:var(--serif); font-size:19.5px; color:var(--ink); margin:34px 0 10px; }
.article-body p { margin:0 0 18px; }
.article-body img { width:100%; height:auto; display:block; border-radius:4px; }
.article-body figure { margin:26px 0; }
.article-body figcaption { font:12.5px/1.6 var(--sans); color:var(--muted); margin-top:8px; }
.article-body .am-portrait { max-width:62%; margin-left:auto; margin-right:auto; }
.article-body .am-panorama { max-width:none; }
.article-media-group { display:grid; gap:12px; margin:26px 0; }
.amg-pair { grid-template-columns:1fr 1fr; }
.amg-triptych { grid-template-columns:1fr 1fr 1fr; }
.amg-grid4 { grid-template-columns:1fr 1fr; }
.amg-grid { grid-template-columns:1fr 1fr; }
.article-media-group .am { margin:0; }
.article-embed { border:1px solid var(--line); background:#fff; padding:14px 18px; margin:22px 0; font-family:var(--sans); font-size:14px; border-radius:12px; }
.article-embed.is-missing { color:var(--terra); }
.article-embed a { text-decoration:none; display:flex; gap:14px; align-items:center; }
.article-embed img { width:84px; height:84px; object-fit:cover; border-radius:8px; }
.embed-id { color:var(--faint); font-size:12px; display:block; }
.article-body blockquote { margin:22px 0; padding:2px 0 2px 18px; border-left:2px solid var(--line); color:var(--muted); }
.article-body hr { border:none; border-top:1px solid var(--line-soft); margin:36px auto; width:120px; }

/* ---- 媒体页 ---- */
.media-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(140px, 1fr)); gap:12px; }
.media-grid a { text-decoration:none; display:block; }
.media-grid .ph { aspect-ratio:4/3; border-radius:10px; overflow:hidden; background:var(--paper-deep); border:1px solid var(--line-soft); }
.media-grid img { width:100%; height:100%; object-fit:cover; display:block; transition:transform var(--normal) var(--ease); }
.media-grid a:hover img { transform:scale(1.03); }
.media-grid .pid { font-size:11.5px; color:var(--faint); margin-top:5px; letter-spacing:.04em; }

/* ---- 邀请页 ---- */
.invite-table { width:100%; border-collapse:collapse; font-size:14px; }
.invite-table td { padding:10px 8px; border-bottom:1px solid var(--line-soft); }
.invite-table code { font-size:12px; color:var(--faint); }

/* ---- 移动端 ---- */
@media (max-width:720px) {
  .shell { gap:10px; padding:0 14px; }
  .shell nav a { padding:5px 9px; font-size:13.5px; }
  .shell .right .site { display:none; }
  .wrap { padding:26px 18px 100px; }
  .editor-main { padding:24px 18px 140px; }
  .write-main { padding:30px 20px 170px; }
  .action-cards { grid-template-columns:1fr; gap:10px; }
  .hello-wrap h1 { font-size:28px; }
  .row2, .row3, details.more .grid { grid-template-columns:1fr; gap:0; }
  .title-line { font-size:27px; }
  .bottombar { padding:10px 14px calc(10px + env(safe-area-inset-bottom)); }
  .bottombar button.primary { padding:11px 30px; }
  .code-row input { width:42px; height:52px; font-size:21px; }
  .fab-add { bottom:96px; transform:translateX(min(150px, 38vw)); }
  .block-menu { bottom:144px; transform:translateX(min(150px, 38vw)); }
  .shell.editor-mode .seg { margin-left:auto; }
  .shell.editor-mode .back span { display:none; }
}
@media (max-width:400px) {
  .shell nav a { padding:5px 7px; font-size:13px; }
  .code-row { gap:6px; } .code-row input { width:38px; height:50px; }
}
`;

// ---------- Shell ----------

export function page(
  title: string,
  body: string,
  user: StudioUser | null = null,
  opts: { editor?: boolean; actions?: string } = {},
): string {
  const initial = user ? user.display_name.slice(0, 1) : '';
  const head = opts.editor
    ? `<a class="back" href="/studio"><span>← </span>工作台</a><div id="save-status" aria-live="polite"></div><div class="right">${opts.actions ?? ''}</div>`
    : `<a class="brand" href="/studio">Studio<small>SALTICID NOTES</small></a>
  <nav>
    <a href="/studio/observations/new">记录</a>
    <a href="/studio/notes/new">札记</a>
    <a href="/studio/drafts">草稿</a>
    <a href="/studio/media">媒体</a>
    ${user?.role === 'owner' ? '<a href="/studio/invite">邀请</a>' : ''}
  </nav>
  <div class="right">
    <a class="site" href="${SITE_URL}" target="_blank" rel="noopener">Salticid Notes ↗</a>
    ${user ? `<details class="avatar"><summary>${esc(initial)}</summary><div class="menu"><span class="who">${esc(user.display_name)}</span><a href="/studio/logout">退出登录</a></div></details>` : ''}
  </div>`;
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<title>${esc(title)} · Studio</title><link rel="stylesheet" href="/studio.css"></head>
<body><header class="shell${opts.editor ? ' editor-mode' : ''}">${head}</header>${body}</body></html>`;
}

// ---------- 登录页（两步：邮箱 → 六位验证码） ----------

export function loginPage(opts: { devNotice: boolean }): string {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<title>登录 · Salticid Notes Studio</title><link rel="stylesheet" href="/studio.css"></head>
<body>
  <div class="login-page"><div class="login-box">
    <div class="login-brand">SALTICID NOTES<b>Studio</b></div>
    <p class="login-tag">把一次相遇留下来。</p>
    <div id="step-email">
      <input type="email" id="login-email" placeholder="邮箱地址" autocomplete="email" autofocus />
      <button class="primary" id="btn-send">发送验证码</button>
    </div>
    <div id="step-code" style="display:none">
      <p class="login-email-now">验证码已发送至 <b id="code-email"></b>　<a href="/studio/login">换个邮箱</a></p>
      <div class="code-row">${'<input type="text" inputmode="numeric" maxlength="1" autocomplete="one-time-code" />'.repeat(6)}</div>
      <p class="login-err" id="code-err"></p>
      <button class="primary" id="btn-verify">登录</button>
      <p class="resend"><button type="button" id="btn-resend" disabled>重新发送（<span id="resend-s">48</span>s）</button></p>
    </div>
    <p class="login-err" id="email-err"></p>
    ${opts.devNotice ? '<p class="login-foot">开发模式：验证码同时输出到 Worker 日志</p>' : ''}
    <p class="login-foot">仅供受邀伙伴使用 · 没有公开注册</p>
  </div></div>
  <script src="/studio-login.js"></script></body></html>`;
}

// ---------- 首页 / 草稿页 ----------

export interface FeedItem {
  kind: 'obs' | 'note';
  href: string;
  title: string;
  status: 'draft' | 'published';
  timeText: string;
  /** 排序键：源时间戳（毫秒） */
  ts: number;
}

function feedHtml(items: FeedItem[], emptyHtml: string): string {
  if (!items.length) return `<p class="empty">${emptyHtml}</p>`;
  return `<ul class="feed">${items
    .map(
      (it) => `<li><a href="${esc(it.href)}">
      <span class="t">${esc(it.title)}</span>
      <span class="meta">${it.kind === 'obs' ? '观察' : '札记'} · <span class="${it.status === 'draft' ? 'st-draft' : 'st-pub'}">${it.status === 'draft' ? '草稿' : '已发布'}</span> · ${esc(it.timeText)}</span>
    </a></li>`,
    )
    .join('')}</ul>`;
}

export function homePage(user: StudioUser, recent: FeedItem[]): string {
  return page('工作台', `
  <div class="wrap">
    <div class="hello-wrap">
      <h1>${greetingWord()}，${esc(user.display_name)}</h1>
      <p>今天想记录什么？</p>
    </div>
    <div class="action-cards">
      <a class="action-card" href="/studio/observations/new">
        <span class="ic">＋</span><b>记录一次相遇</b><span class="sub">照片、地点和观察</span>
      </a>
      <a class="action-card" href="/studio/notes/new">
        <span class="ic">✎</span><b>写一篇札记</b><span class="sub">调查、故事和思考</span>
      </a>
    </div>
    <h2 class="kicker">最近</h2>
    ${feedHtml(recent, '还没有记录。从上面两张卡片开始。')}
    <a class="all-link" href="/studio/drafts">全部草稿与发布 →</a>
    <div class="home-foot">
      ${user.role === 'owner' ? '<a href="/studio/export">导出备份（zip）</a><a href="#" id="btn-sync">同步到公开站</a><span id="sync-status"></span>' : ''}
    </div>
  </div>
  ${
    user.role === 'owner'
      ? `<script>
  (function () {
    var btn = document.getElementById('btn-sync');
    if (!btn) return;
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      var st = document.getElementById('sync-status');
      btn.style.pointerEvents = 'none';
      st.textContent = '同步中…';
      fetch('/studio/api/sync', { method: 'POST' })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          st.textContent = j.ok ? '已同步 ✓（公开站构建约 1-2 分钟后上线）' : '同步失败：' + (j.detail || '');
          btn.style.pointerEvents = '';
        })
        .catch(function () { st.textContent = '网络异常，请重试'; btn.style.pointerEvents = ''; });
    });
  })();
  </script>`
      : ''
  }`, user);
}

export function draftsPage(user: StudioUser, drafts: FeedItem[], published: FeedItem[]): string {
  return page('草稿', `
  <div class="wrap">
    <div class="hello-wrap"><h1>草稿</h1><p>没写完的都在这里。</p></div>
    <h2 class="kicker">草稿</h2>
    ${feedHtml(drafts, '还没有草稿。<a href="/studio/observations/new">记录第一次相遇</a> 或 <a href="/studio/notes/new">写一篇札记</a>。')}
    <h2 class="kicker">已发布</h2>
    ${feedHtml(published, '还没有发布过。')}
  </div>`, user);
}

// ---------- 媒体页 ----------

export function mediaPage(
  rows: { public_id: string; thumb: string; obs_public_id: string | null }[],
  owner: boolean,
  counts: { observations: number; posts: number },
  user: StudioUser,
): string {
  return page('媒体', `
  <div class="wrap">
    <div class="hello-wrap"><h1>媒体</h1><p>已发布的影像，按编号倒序。点击打开所属观察。</p></div>
    ${
      rows.length
        ? `<div class="media-grid">${rows
            .map(
              (m) => `<a href="${m.obs_public_id ? `/studio/observations/${m.obs_public_id}/edit` : '#'}">
        <div class="ph"><img src="${esc(m.thumb)}" alt="${esc(m.public_id)}" loading="lazy" /></div>
        <div class="pid">${esc(m.public_id)}</div></a>`,
            )
            .join('')}</div>`
        : '<p class="empty">还没有已发布的影像。</p>'
    }
    ${
      owner
        ? `<div class="home-foot"><a href="/studio/export">导出备份（zip）· 当前观察 ${counts.observations} 条 · 札记 ${counts.posts} 篇</a></div>`
        : ''
    }
  </div>`, user);
}

// ---------- 观察编辑器 ----------

export interface ObsPhoto {
  public_id: string;
  thumb: string;
  caption: string | null;
  photographer_name: string | null;
  is_cover: number;
}

export interface ObsBootMeta {
  status: string;
  hasUnpublished: boolean;
  photoMeta: { public_id: string; caption: string | null; photographer_name: string | null }[];
}

export function obsEditorHtml(
  publicId: string | null,
  data: Record<string, any>,
  photos: ObsPhoto[],
  meta: ObsBootMeta,
): string {
  const tripOptions = [
    '<option value="">—— 不关联 ——</option>',
    ...TRIPS.map((t) => `<option value="${esc(t.slug)}">${esc(t.title)}</option>`),
  ].join('');
  const photoGrid = photos
    .map(
      (p, i) => `<div class="photo${p.is_cover ? ' cover' : ''}" data-pid="${p.public_id}">
      <img src="${esc(p.thumb)}" alt="" loading="lazy" />
      <span class="badge">${p.is_cover ? '★' : i + 1}</span>
    </div>`,
    )
    .join('\n');
  const published = meta.status === 'published';
  const actions = '';
  return page(publicId ? `编辑 ${publicId}` : '记录一次相遇', `
  <main class="editor-main">
    <h1>${publicId ? esc(publicId) : '记录一次相遇'}</h1>

    <section class="field">
      <label>照片</label>
      <div id="drop-big" class="drop-big"${photos.length ? ' hidden' : ''}>
        <span class="plus">＋</span>
        <b>添加照片</b>
        <span>拍照 · 从相册选择 · 可多选</span>
      </div>
      <div class="photo-grid" id="photo-grid">${photoGrid}</div>
      <button type="button" class="photo-grid-add" id="photo-add"${photos.length ? '' : ' hidden'} aria-label="添加照片">＋</button>
      <div class="photo-panel" id="photo-panel" hidden></div>
      <div class="field-error" id="photo-err"></div>
      <input type="file" id="photo-camera" accept="image/jpeg,image/png" capture="environment" multiple hidden />
      <input type="file" id="photo-library" accept="image/jpeg,image/png" multiple hidden />
    </section>

    <section class="field">
      <label>物种</label>
      <div class="species-wrap" id="species-wrap">
        <input id="species-search" placeholder="搜索物种（学名 / 中文名），允许留空" autocomplete="off" />
        <div class="species-pop" id="species-pop"></div>
      </div>
      <div class="hint">不确定就留空，发布会记为 Salticidae sp.（跳蛛科未定种）</div>
    </section>

    <section class="field">
      <label>时间</label>
      <input type="date" data-field="observed_at" />
      <span class="hint" id="exif-hint">拍摄时间来自照片 EXIF</span>
    </section>

    <section class="field">
      <label>地点</label>
      <div class="coords-row">
        <span class="coord"><input data-field="latitude" inputmode="decimal" placeholder="21.927381" /><em>N</em></span>
        <span class="coord"><input data-field="longitude" inputmode="decimal" placeholder="101.256742" /><em>E</em></span>
        <button type="button" class="ghost" id="btn-map">在地图上调整</button>
      </div>
      <span class="hint">支持粘贴「21.927381, 101.256742」自动填入 · 精确坐标将随观察公开</span>
      <div id="map-box" hidden></div>
      <div class="row2" style="margin-top:16px">
        <div class="field"><input data-field="admin1" placeholder="省 / 州（云南 · 西双版纳…）" /></div>
        <div class="field"><input data-field="admin2" placeholder="市 / 县" /></div>
      </div>
      <div class="row2">
        <div class="field"><input data-field="locality" placeholder="乡镇 · 村 / 具体位置" /></div>
        <div class="field"><input data-field="site_name" placeholder="具体地点名（沟谷雨林林缘）" /></div>
      </div>
    </section>

    <section class="field">
      <label>观察到……</label>
      <textarea data-field="field_note" rows="3" placeholder="它在哪里、在做什么、有什么特别——一句话就够，写多了更好。"></textarea>
      <span class="hint" id="exif-cam"></span>
    </section>

    <details class="more">
      <summary>添加详细信息</summary>
      <div class="grid">
        <div class="field"><label>性别</label><select data-field="sex"><option value="unknown">未知</option><option value="male">雄性</option><option value="female">雌性</option></select></div>
        <div class="field"><label>生命阶段</label><select data-field="life_stage"><option value="unknown">未知</option><option value="adult">成体</option><option value="subadult">亚成体</option><option value="juvenile">幼体</option></select></div>
        <div class="field"><label>数量</label><input type="number" data-field="count" min="1" /></div>
        <div class="field"><label>海拔（米）</label><input type="number" data-field="elevation_m" /></div>
        <div class="field"><label>微生境</label><input data-field="microhabitat" placeholder="叶片上表面" /></div>
        <div class="field"><label>所在植物</label><input data-field="plant" /></div>
        <div class="field"><label>天气</label><input data-field="weather" placeholder="雨后 / 晴…" /></div>
        <div class="field"><label>国家</label><input data-field="country_name" /></div>
        <div class="field"><label>关联调查</label><select data-field="trip_slug">${tripOptions}</select></div>
      </div>
    </details>
  </main>

  <div class="bottombar">
    <span id="bar-status" style="font-size:12.5px;color:var(--faint)"></span>
    <span class="spacer"></span>
    <button type="button" class="ghost" id="btn-savedraft">保存草稿</button>
    <button type="button" class="primary" id="btn-publish">${published ? '更新' : '发布'}</button>
  </div>

  <script>
    window.__EDITOR_BOOT = {
      publicId: ${jsonForScript(publicId)},
      status: ${jsonForScript(meta.status)},
      hasUnpublished: ${jsonForScript(meta.hasUnpublished)},
      photoMeta: ${jsonForScript(meta.photoMeta)},
      taxa: ${jsonForScript(TAXA.map((t) => ({ slug: t.slug, name: t.scientific_name, cn: t.chinese_name, rank: t.rank })))},
      data: ${jsonForScript({
        observed_at: data.observed_at ?? '',
        latitude: data.latitude ?? '',
        longitude: data.longitude ?? '',
        country_name: data.country_name ?? '中国',
        admin1: data.admin1 ?? '',
        admin2: data.admin2 ?? '',
        locality: data.locality ?? '',
        site_name: data.site_name ?? '',
        elevation_m: data.elevation_m ?? '',
        sex: data.sex ?? 'unknown',
        life_stage: data.life_stage ?? 'unknown',
        count: data.count ?? '',
        habitat: data.habitat ?? '',
        microhabitat: data.microhabitat ?? '',
        behavior: data.behavior ?? '',
        plant: data.plant ?? '',
        weather: data.weather ?? '',
        trip_slug: data.trip_slug ?? '',
        field_note: data.field_note ?? '',
        species_taxon_slug: data.species_taxon_slug ?? '',
      })},
    };
  </script>
  <script src="/studio-editor.js"></script>`, null, { editor: true, actions });
}

// ---------- 札记编辑器（写作模式） ----------

export function noteEditorHtml(slug: string | null, data: Record<string, any>): string {
  const published = data.status === 'published';
  const actions = `
    <div class="seg" id="note-seg"><button type="button" class="on" data-view="edit">写作</button><button type="button" data-view="preview">预览</button></div>
    <button type="button" class="ghost" id="btn-settings">设置</button>`;
  return page(slug ? `编辑：${data.title ?? slug}` : '写一篇札记', `
  <main class="write-main">
    <div id="pane-edit">
      <input id="n-title" class="title-line" placeholder="标题" value="${esc(data.title ?? '')}" autocomplete="off" />
      <input id="n-subtitle" class="subtitle-line" placeholder="副标题（可选）" value="${esc(data.subtitle ?? '')}" autocomplete="off" />
      <textarea id="n-body" class="body-line" placeholder="从这里开始写……">${esc(data.body_md ?? '')}</textarea>
    </div>
    <div id="pane-preview" class="article-body preview-pane" hidden></div>
  </main>

  <button type="button" class="fab-add" id="fab-add" title="插入（也可用 / 呼出）">＋</button>
  <div class="block-menu" id="block-menu">
    <button type="button" data-ins="## ">小节标题 H2</button>
    <button type="button" data-ins="### ">小标题 H3</button>
    <button type="button" data-ins="&gt; ">引用</button>
    <button type="button" data-ins="- ">列表</button>
    <div class="sep"></div>
    <button type="button" data-ins="__IMAGE__">图片…</button>
    <button type="button" data-ins="__OBS__">观察卡片…</button>
    <button type="button" data-ins="__TRIP__">调查链接…</button>
    <div class="sep"></div>
    <button type="button" data-ins="---">分隔线</button>
  </div>

  <div class="drawer-mask" id="drawer-mask"></div>
  <aside class="drawer" id="drawer">
    <h3>文章设置</h3>
    <div class="ro"><b>链接</b><span>${slug ? esc(`/posts/${slug}/`) : '发布后生成'}</span></div>
    <div class="ro"><b>作者</b><span>${esc(data.author_name ?? '')}</span></div>
    <div class="field"><label>关联观察（编号，逗号分隔）</label><input id="n-related" placeholder="SFN-2026-000001, …" value="${esc(data.related ?? '')}" /></div>
  </aside>

  <div class="bottombar">
    <span id="bar-status" style="font-size:12.5px;color:var(--faint)"></span>
    <span class="spacer"></span>
    <button type="button" class="ghost" id="btn-preview2">预 览</button>
    <button type="button" class="primary" id="btn-publish-note">${published ? '更新' : '发布'}</button>
  </div>

  <input type="hidden" id="n-slug" value="${esc(slug ?? '')}" />
  <script>
    window.__NOTE_BOOT = {
      slug: ${jsonForScript(slug ?? null)},
      bodyMd: ${jsonForScript(data.body_md ?? '')},
      status: ${jsonForScript(data.status ?? 'draft')},
    };
  </script>
  <script src="/studio-note-editor.js"></script>`, null, { editor: true, actions });
}
