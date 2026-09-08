// Field Studio v1 — 内容创作系统
// 受邀邮箱 OTP + 观察编辑器（autosave/直接发布）+ 札记编辑器（Article Renderer）+ 媒体管理。
// 规则：无公开注册（§9/§11）；邮箱 OTP（§12）；伙伴直接发布（§13）；坐标全量精确公开（§7）。
import express from 'express';
import multer from 'multer';
import { readFileSync, writeFileSync, mkdirSync, unlinkSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb, migrate } from './db.js';
import {
  audit,
  createSession,
  currentUser,
  deliverOtp,
  destroySession,
  findOrCreateUserByEmail,
  isInvited,
  issueOtp,
  requireOwner,
  requireUser,
  sameOriginGuard,
  verifyOtp,
  type StudioUser,
} from './auth.js';
import { saveUploadedPhoto, validateUpload } from './media.js';
import { parseExif } from './exif.js';
import { renderArticle, type MediaRef } from './article.js';
import { observationEmbedResolver } from './embeds.js';
import { exportForStaticSite } from './export.js';
import type { Database } from 'better-sqlite3';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DERIVATIVES_DIR = join(ROOT, 'public', 'media', 'derivatives');
const PORT = Number(process.env.STUDIO_PORT ?? 4322);

migrate();
const db: Database = openDb();
const app = express();

app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.json({ limit: '4mb' }));
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 20, fileSize: 30 * 1024 * 1024 },
});

// ---------- 工具 ----------

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

const uploadHits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (uploadHits.get(ip) ?? []).filter((t) => now - t < 3600_000);
  hits.push(now);
  uploadHits.set(ip, hits);
  return hits.length > 30;
}

const STYLES = `
:root {
  --paper:#f7f5f0; --paper-deep:#efece4; --ink:#26221c; --muted:#6f675c; --faint:#948b7d;
  --line:#e0dacc; --accent:#566246; --terra:#a4552f;
  --serif: Georgia,"Times New Roman","Songti SC","Noto Serif SC",SimSun,serif;
  --sans: -apple-system,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;
  --motion-fast:160ms; --motion-normal:280ms; --ease-out:cubic-bezier(.22,1,.36,1);
}
* { box-sizing:border-box; }
body { margin:0; background:var(--paper); color:var(--ink); font:16px/1.75 var(--sans); -webkit-font-smoothing:antialiased; }
a { color:inherit; }
header { border-bottom:1px solid var(--line); padding:14px 24px; display:flex; justify-content:space-between; align-items:baseline; flex-wrap:wrap; gap:10px; }
header .brand { font-family:var(--serif); font-weight:700; letter-spacing:.06em; text-decoration:none; }
header nav a { color:var(--muted); margin-left:16px; font-size:14px; text-decoration:none; transition:color var(--motion-fast) ease; }
header nav a:hover { color:var(--terra); }
main { max-width:920px; margin:0 auto; padding:34px 24px 90px; }
h1 { font-family:var(--serif); font-weight:400; font-size:32px; margin:.2em 0 .5em; }
h2 { font-size:12.5px; letter-spacing:.28em; color:var(--faint); margin:40px 0 14px; font-weight:600; }
.hello { font-family:var(--serif); font-size:34px; line-height:1.5; margin:40px 0 8px; }
.hello-sub { color:var(--muted); margin:0 0 34px; }
.cards { display:grid; grid-template-columns:1fr 1fr; gap:18px; margin-bottom:44px; }
@media (max-width:700px) { .cards { grid-template-columns:1fr; } }
.big-card { border:1px solid var(--line); background:#fbfaf7; padding:26px 28px; text-decoration:none; display:block; transition:border-color var(--motion-fast) ease; }
.big-card:hover { border-color:var(--faint); }
.big-card .t { font-family:var(--serif); font-size:21px; margin-bottom:4px; }
.big-card .d { color:var(--muted); font-size:14px; }
table { border-collapse:collapse; width:100%; font-size:14px; }
td, th { text-align:left; padding:8px 10px; border-bottom:1px solid var(--line); vertical-align:top; }
th { color:var(--faint); font-weight:600; }
.card { border:1px solid var(--line); background:#fbfaf7; padding:22px 26px; margin-bottom:22px; }
label { display:block; font-size:12.5px; color:var(--muted); margin:14px 0 4px; }
input[type=text], input[type=email], input[type=date], input[type=number], select, textarea {
  width:100%; padding:9px 12px; border:1px solid var(--line); background:#fff; font:inherit; color:var(--ink);
}
textarea { min-height:110px; }
input:focus, select:focus, textarea:focus { outline:2px solid var(--accent); outline-offset:0; border-color:var(--accent); }
button, .btn { display:inline-block; background:var(--ink); color:var(--paper); border:none; padding:10px 22px; font:inherit; font-size:14px; cursor:pointer; letter-spacing:.06em; text-decoration:none; transition:opacity var(--motion-fast) ease; }
button:hover, .btn:hover { opacity:.85; }
.btn-quiet { background:none; border:1px solid var(--line); color:var(--muted); }
.btn-quiet:hover { background:none; color:var(--ink); border-color:var(--faint); }
.msg { border:1px solid var(--line); background:#fff; padding:12px 16px; margin:16px 0; font-size:14px; }
.msg.error { border-color:var(--terra); color:var(--terra); }
.grid2 { display:grid; grid-template-columns:1fr 1fr; gap:0 20px; }
.grid3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:0 16px; }
@media (max-width:700px) { .grid2, .grid3 { grid-template-columns:1fr; } }
.thumbs { display:flex; flex-wrap:wrap; gap:12px; }
.thumb { width:132px; }
.thumb .box { position:relative; aspect-ratio:4/3; overflow:hidden; background:var(--paper-deep); border:1px solid var(--line); }
.thumb img { width:100%; height:100%; object-fit:cover; display:block; }
.thumb .tools { display:flex; gap:4px; margin-top:4px; font-size:12px; }
.thumb .tools button { padding:2px 8px; font-size:12px; background:none; border:1px solid var(--line); color:var(--muted); cursor:pointer; }
.thumb .tools button.on { border-color:var(--accent); color:var(--accent); }
.status { font-size:12.5px; color:var(--faint); margin:8px 0; min-height:18px; }
.dropzone { border:1.5px dashed var(--line); background:#fff; padding:34px; text-align:center; color:var(--muted); cursor:pointer; }
.dropzone:hover { border-color:var(--faint); }
details { border-top:1px solid var(--line); padding:12px 0; }
details summary { cursor:pointer; color:var(--muted); font-size:14px; }
.step { border-top:1px solid var(--line); padding-top:18px; margin-top:18px; }
.step > .st { font-size:11.5px; letter-spacing:.3em; color:var(--faint); }
.row { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
/* ---- 文章预览（与公开站 Article Renderer 同一套布局语义） ---- */
.article-body { font-family:var(--serif); font-size:17px; line-height:1.9; }
.article-body h2 { font-family:var(--serif); font-size:24px; letter-spacing:.02em; color:var(--ink); margin:44px 0 14px; }
.article-body h3 { font-family:var(--serif); font-size:19px; color:var(--ink); margin:32px 0 10px; }
.article-body img { width:100%; height:auto; display:block; }
.article-body figure { margin:26px 0; }
.article-body figcaption { font:12.5px/1.6 var(--sans); color:var(--muted); margin-top:8px; }
.article-body .am-portrait { max-width:60%; margin-left:auto; margin-right:auto; }
.article-body .am-panorama { max-width:none; }
.article-media-group { display:grid; gap:12px; margin:26px 0; }
.amg-pair { grid-template-columns:1fr 1fr; }
.amg-triptych { grid-template-columns:1fr 1fr 1fr; }
.amg-grid4 { grid-template-columns:1fr 1fr; }
.amg-grid { grid-template-columns:1fr 1fr; }
.article-media-group .am { margin:0; }
.article-embed { border:1px solid var(--line); background:#fff; padding:14px 18px; margin:20px 0; font-family:var(--sans); font-size:14px; }
.article-embed.is-missing { color:var(--terra); }
.article-embed a { text-decoration:none; display:flex; gap:14px; align-items:center; }
.article-embed img { width:84px; height:84px; object-fit:cover; }
.embed-id { color:var(--faint); font-size:12px; display:block; }
`;

app.get('/studio.css', (_req, res) => res.type('text/css').send(STYLES));

// ---------- 编辑器客户端脚本（观察 / 札记） ----------
// 说明：客户端 JS 内不使用模板字符串，避免与外层 TS 模板字面量冲突。

const OBS_EDITOR_JS = `
(function () {
  var boot = window.__EDITOR_BOOT || {};
  function $(s) { return document.querySelector(s); }
  function $all(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }
  var statusEl = $('#save-status');
  var publicId = boot.publicId || null;
  var LS_KEY = 'sfn-obs-' + (boot.publicId || 'new');
  var saveTimer = null;
  var saving = false;

  function fields() {
    var o = {};
    $all('[data-field]').forEach(function (el) { o[el.getAttribute('data-field')] = el.value; });
    return o;
  }
  function taxonSlug() {
    var el = $('#species-search');
    if (!el) return '';
    var name = String(el.value || '').split('（')[0].trim();
    if (!name || name === 'Salticidae sp.') return '';
    var list = boot.taxa || [];
    for (var i = 0; i < list.length; i++) if (list[i].name === name) return list[i].slug;
    return '';
  }
  function setStatus(s) { if (statusEl) statusEl.textContent = s; }
  function lsSave() { try { localStorage.setItem(LS_KEY, JSON.stringify(fields())); } catch (e) {} }
  function lsClear() { try { localStorage.removeItem(LS_KEY); } catch (e) {} }

  function create() {
    return fetch('/studio/api/observations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j.public_id) {
          publicId = j.public_id;
          history.replaceState(null, '', '/studio/observations/' + publicId + '/edit');
        }
        return publicId;
      });
  }

  function saveNow() {
    if (saving) return Promise.resolve();
    saving = true;
    var ensure = publicId ? Promise.resolve(publicId) : create();
    return ensure.then(function (pid) {
      if (!pid) { saving = false; return; }
      var payload = fields();
      payload.species_taxon_slug = taxonSlug();
      return fetch('/studio/api/observations/' + pid, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (j.ok) { setStatus('已保存 ' + (j.saved_at || '')); lsClear(); }
          else setStatus('保存失败：' + (j.error || ''));
        })
        .catch(function () { setStatus('保存失败（网络）'); })
        .then(function () { saving = false; });
    });
  }

  function scheduleSave() {
    setStatus('正在保存…');
    lsSave();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 1500);
  }

  // 启动：填充已保存数据
  var d = boot.data || {};
  $all('[data-field]').forEach(function (el) {
    var k = el.getAttribute('data-field');
    var v = d[k];
    if (el.tagName === 'SELECT') { if (v) el.value = v; }
    else if (v !== null && v !== undefined && v !== '') el.value = v;
  });
  if (d.species_taxon_slug) {
    var hit = (boot.taxa || []).filter(function (t) { return t.slug === d.species_taxon_slug; })[0];
    if (hit) { var sp = $('#species-search'); if (sp) sp.value = hit.name; }
  }
  // 恢复未保存的本地草稿（仅新建页）
  if (!boot.publicId) {
    try {
      var saved = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
      if (saved) {
        Object.keys(saved).forEach(function (k) {
          var el = document.querySelector('[data-field="' + k + '"]');
          if (el && saved[k]) el.value = saved[k];
        });
        setStatus('已恢复上次未保存的内容');
      }
    } catch (e) {}
  }
  $all('[data-field]').forEach(function (el) { el.addEventListener('input', scheduleSave); });
  var sp = $('#species-search');
  if (sp) sp.addEventListener('input', scheduleSave);

  // 照片：选择 / 拖拽 / EXIF 预读 / 上传
  var dz = $('#dropzone'), pi = $('#photo-input'), grid = $('#photo-grid');
  function handleFiles(files) {
    files = Array.prototype.slice.call(files || []).filter(function (f) { return /image\\/(jpeg|png)/.test(f.type); });
    if (!files.length) return;
    var ensure = publicId ? Promise.resolve(publicId) : create();
    ensure.then(function (pid) {
      if (!pid) { setStatus('创建记录失败'); return; }
      var first = files[0];
      var fd0 = new FormData();
      fd0.append('photo', first);
      setStatus('读取 EXIF…');
      return fetch('/studio/api/exif-preview', { method: 'POST', body: fd0 })
        .then(function (r) { return r.json(); })
        .then(function (xj) {
          var x = xj.results && xj.results[0];
          if (x) {
            var dateEl = document.querySelector('[data-field="observed_at"]');
            if (x.date && dateEl && !dateEl.value) dateEl.value = x.date;
            if (x.gps) {
              var la = document.querySelector('[data-field="latitude"]');
              var lo = document.querySelector('[data-field="longitude"]');
              if (la && !la.value) la.value = x.gps.lat;
              if (lo && !lo.value) lo.value = x.gps.lng;
            }
          }
        })
        .catch(function () {})
        .then(function () {
          setStatus('上传照片（' + files.length + ' 张）…');
          var fd = new FormData();
          files.forEach(function (f) { fd.append('photos', f); });
          return fetch('/studio/observations/' + pid + '/photos', { method: 'POST', body: fd });
        })
        .then(function (r) {
          if (r.ok) { lsClear(); location.reload(); }
          else r.text().then(function (t) { setStatus('上传失败：' + t); });
        })
        .catch(function () { setStatus('上传失败（网络）'); });
    });
  }
  if (dz && pi) {
    dz.addEventListener('click', function () { pi.click(); });
    dz.addEventListener('dragover', function (e) { e.preventDefault(); });
    dz.addEventListener('drop', function (e) { e.preventDefault(); handleFiles(e.dataTransfer.files); });
    pi.addEventListener('change', function () { handleFiles(pi.files); pi.value = ''; });
  }

  // 已上传照片：封面 / 删除 / 图注 / 拖拽排序（事件委托）
  function orderPids() {
    return $all('#photo-grid .thumb').map(function (n) { return n.getAttribute('data-pid'); });
  }
  if (grid && publicId) {
    grid.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('button[data-act]') : null;
      if (!t) return;
      var pid = t.getAttribute('data-pid');
      if (t.getAttribute('data-act') === 'cover') {
        var rest = orderPids().filter(function (x) { return x !== pid; });
        fetch('/studio/api/observations/' + publicId + '/photos/order', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: [pid].concat(rest) }),
        }).then(function () { location.reload(); });
      } else if (t.getAttribute('data-act') === 'delete') {
        fetch('/studio/api/media/' + pid, { method: 'DELETE' }).then(function (r) {
          if (r.ok) { var n = grid.querySelector('.thumb[data-pid="' + pid + '"]'); if (n) n.remove(); setStatus('已删除 ' + pid); }
        });
      }
    });
    grid.addEventListener('change', function (e) {
      var el = e.target;
      if (!el.getAttribute || !el.getAttribute('data-caption-pid')) return;
      fetch('/studio/api/media/' + el.getAttribute('data-caption-pid') + '/caption', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption: el.value }),
      }).then(function (r) { if (r.ok) setStatus('图注已保存'); });
    });
    var dragPid = null;
    grid.addEventListener('dragstart', function (e) {
      var n = e.target.closest ? e.target.closest('.thumb') : null;
      if (n) { dragPid = n.getAttribute('data-pid'); e.dataTransfer.setData('text/plain', dragPid); }
    });
    grid.addEventListener('dragover', function (e) { e.preventDefault(); });
    grid.addEventListener('drop', function (e) {
      e.preventDefault();
      var n = e.target.closest ? e.target.closest('.thumb') : null;
      if (!n || !dragPid || n.getAttribute('data-pid') === dragPid) return;
      var moved = grid.querySelector('.thumb[data-pid="' + dragPid + '"]');
      grid.insertBefore(moved, n);
      dragPid = null;
      fetch('/studio/api/observations/' + publicId + '/photos/order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: orderPids() }),
      }).then(function (r) { if (r.ok) setStatus('顺序已保存'); });
    });
    $all('#photo-grid .thumb').forEach(function (n) { n.setAttribute('draggable', 'true'); });
  }

  // 发布 / 私密
  var bp = $('#btn-publish');
  if (bp) bp.addEventListener('click', function () {
    setStatus('保存并发布…');
    saveNow().then(function () {
      return fetch('/studio/api/observations/' + publicId + '/publish', { method: 'POST' }).then(function (r) { return r.json(); });
    }).then(function (j) {
      if (j && j.ok) { setStatus('已发布 ✓ 公开页：' + j.public_url + '（导出并构建后上线）'); lsClear(); }
      else setStatus('无法发布：' + ((j && j.error) || ''));
    });
  });
  var bv = $('#btn-private');
  if (bv) bv.addEventListener('click', function () {
    saveNow().then(function () {
      return fetch('/studio/api/observations/' + publicId + '/private', { method: 'POST' });
    }).then(function (r) { if (r.ok) setStatus('已设为私密（公开站不可见）'); });
  });
})();
`;

app.get('/studio-editor.js', (_req, res) => res.type('text/javascript').send(OBS_EDITOR_JS));

const NOTE_EDITOR_JS = `
(function () {
  function $(s) { return document.querySelector(s); }
  var statusEl = $('#save-status');
  var title = $('#n-title'), sub = $('#n-subtitle'), body = $('#n-body');
  var slug = ($('#n-slug') && $('#n-slug').value) || null;
  var LS_KEY = 'sfn-note-' + (slug || 'new');
  var timer = null;

  function setStatus(s) { statusEl.textContent = s; }
  function payload() { return { title: title.value, subtitle: sub.value, body_md: body.value }; }
  function lsSave() { try { localStorage.setItem(LS_KEY, JSON.stringify(payload())); } catch (e) {} }
  function lsClear() { try { localStorage.removeItem(LS_KEY); } catch (e) {} }

  function create() {
    return fetch('/studio/api/notes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload()),
    })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j.slug) {
          slug = j.slug;
          $('#n-slug').value = slug;
          history.replaceState(null, '', '/studio/notes/' + slug + '/edit');
        }
        return slug;
      });
  }
  function saveNow() {
    var ensure = slug ? Promise.resolve(slug) : create();
    return ensure.then(function (s) {
      if (!s) { setStatus('创建失败'); return; }
      return fetch('/studio/api/notes/' + s, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload()),
      })
        .then(function (r) { return r.json(); })
        .then(function (j) { if (j.ok) { setStatus('已保存 ' + (j.saved_at || '')); lsClear(); } else setStatus('保存失败'); });
    });
  }
  function schedule() { setStatus('正在保存…'); lsSave(); clearTimeout(timer); timer = setTimeout(saveNow, 1500); }

  if (!slug) {
    try {
      var saved = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
      if (saved) {
        title.value = saved.title || ''; sub.value = saved.subtitle || ''; body.value = saved.body || '';
        setStatus('已恢复上次未保存的内容');
      }
    } catch (e) {}
  }
  [title, sub, body].forEach(function (el) { el.addEventListener('input', schedule); });

  // 工具栏：包裹选区或行首插入
  Array.prototype.slice.call(document.querySelectorAll('[data-md]')).forEach(function (btn) {
    btn.addEventListener('click', function () {
      var md = btn.getAttribute('data-md');
      var st = body.selectionStart, en = body.selectionEnd;
      var sel = body.value.slice(st, en);
      var ins;
      if (md === '**' || md === '*') ins = md + (sel || '文字') + md;
      else if (md === '---') ins = '\\n\\n---\\n\\n';
      else ins = md + sel;
      body.value = body.value.slice(0, st) + ins + body.value.slice(en);
      body.focus();
      body.selectionStart = body.selectionEnd = st + ins.length;
      schedule();
    });
  });

  function insertAt(text) {
    var st = body.selectionStart;
    body.value = body.value.slice(0, st) + text + body.value.slice(body.selectionEnd);
    body.focus();
    body.selectionStart = body.selectionEnd = st + text.length;
    schedule();
  }

  var imgBtn = $('#btn-note-image'), imgInput = $('#note-image-input');
  if (imgBtn) imgBtn.addEventListener('click', function () { imgInput.click(); });
  if (imgInput) imgInput.addEventListener('change', function () {
    var f = imgInput.files[0];
    if (!f) return;
    setStatus('上传图片…');
    var fd = new FormData();
    fd.append('photo', f);
    fetch('/studio/api/media/upload', { method: 'POST', body: fd })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j.ok) {
          var cap = window.prompt('图注（可留空）', '') || '';
          insertAt('\\n\\n![' + cap + '](media:' + j.public_id + ')\\n\\n');
          setStatus('已插入 ' + j.public_id);
        } else setStatus('上传失败：' + (j.error || ''));
      });
    imgInput.value = '';
  });
  var obsBtn = $('#btn-note-obs');
  if (obsBtn) obsBtn.addEventListener('click', function () {
    var id = window.prompt('观察编号（如 SFN-2026-000001）', '');
    if (id && id.trim()) insertAt('\\n\\n{{observation:' + id.trim() + '}}\\n\\n');
  });
  var tripBtn = $('#btn-note-trip');
  if (tripBtn) tripBtn.addEventListener('click', function () {
    var s = window.prompt('调查 slug（见公开站 /trips/…）', '');
    if (s && s.trim()) insertAt('\\n\\n{{trip:' + s.trim() + '}}\\n\\n');
  });

  var pvBtn = $('#btn-preview');
  if (pvBtn) pvBtn.addEventListener('click', function () {
    setStatus('生成预览…');
    fetch('/studio/api/notes/preview', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body_md: body.value }),
    })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var pv = $('#note-preview');
        pv.innerHTML = '<div class="article-body">' + j.html + '</div>';
        pv.style.display = 'block';
        pv.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setStatus('预览已生成');
      });
  });

  var pubBtn = $('#btn-publish-note');
  if (pubBtn) pubBtn.addEventListener('click', function () {
    setStatus('保存并发布…');
    saveNow().then(function () {
      return fetch('/studio/api/notes/' + slug + '/publish', { method: 'POST' }).then(function (r) { return r.json(); });
    }).then(function (j) {
      if (j && j.ok) { setStatus('已发布 ✓ 公开页：' + j.public_url + '（导出并构建后上线）'); lsClear(); }
      else setStatus('无法发布：' + ((j && j.error) || ''));
    });
  });
})();
`;

app.get('/studio-note-editor.js', (_req, res) => res.type('text/javascript').send(NOTE_EDITOR_JS));

function page(title: string, body: string, user: StudioUser | null = null): string {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${esc(title)} · Field Studio</title><link rel="stylesheet" href="/studio.css"></head>
<body><header>
<a class="brand" href="/studio">Field Studio · 跳蛛观察志</a>
<nav>${user ? `${esc(user.display_name)} · <a href="/studio/observations/new">记录相遇</a> · <a href="/studio/notes/new">写札记</a> · <a href="/studio/media">影像</a> · <a href="/studio">工作台</a> · <a href="/studio/logout">退出</a>` : `<a href="/studio/login">登录</a>`}</nav>
</header><main>${body}</main></body></html>`;
}

// ---------- 登录（受邀邮箱 OTP） ----------

app.get('/studio/login', (req, res) => {
  if (currentUser(db, req)) return res.redirect('/studio');
  const error = String((req.query as Record<string, string>).error ?? '');
  const email = String((req.query as Record<string, string>).email ?? '');
  const devNotice = process.env.SMTP_HOST ? '' : '<p class="msg">开发模式：未配置 SMTP，验证码输出到服务器控制台。</p>';
  res.send(page('登录', `<h1>登录 Field Studio</h1>
    <p><small>仅供受邀伙伴使用 · 没有公开注册</small></p>
    ${error === 'otp' ? '<div class="msg error">验证码无效或已过期，请重新发送。</div>' : ''}
    ${error === 'invite' ? '<div class="msg error">该邮箱不在受邀名单中。</div>' : ''}
    ${email
      ? `<div class="card"><h2 style="margin-top:0">输入验证码</h2>
        <p><small>验证码已发送至 ${esc(email)}（10 分钟内有效）</small></p>
        <form method="post" action="/studio/login/verify"><input type="hidden" name="email" value="${esc(email)}" />
        <label>6 位验证码</label><input type="text" name="code" required maxlength="6" inputmode="numeric" autocomplete="one-time-code" />
        <div style="margin-top:16px"><button type="submit">登录</button></div></form>
        <p style="margin-top:12px"><a href="/studio/login">重新发送 →</a></p></div>`
      : `<div class="card"><h2 style="margin-top:0">邮箱登录</h2>${devNotice}
        <form method="post" action="/studio/login/otp"><label>邮箱（受邀时登记的邮箱）</label>
        <input type="email" name="email" required /><div style="margin-top:16px"><button type="submit">发送验证码</button></div></form></div>`}`));
});

app.post('/studio/login/otp', async (req, res) => {
  if (!sameOriginGuard(req, res)) return res.status(403).send('Forbidden');
  const email = String((req.body as Record<string, string>).email ?? '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.redirect('/studio/login');
  if (!isInvited(db, email)) {
    audit(db, email, 'session', null, 'otp-denied-not-invited');
    return res.redirect('/studio/login?error=invite');
  }
  const code = issueOtp(db, email);
  await deliverOtp(email, code);
  res.redirect(`/studio/login?email=${encodeURIComponent(email)}`);
});

app.post('/studio/login/verify', (req, res) => {
  if (!sameOriginGuard(req, res)) return res.status(403).send('Forbidden');
  const { email, code } = req.body as Record<string, string>;
  if (!verifyOtp(db, String(email ?? ''), String(code ?? ''))) return res.redirect('/studio/login?error=otp');
  const user = findOrCreateUserByEmail(db, String(email));
  db.prepare('UPDATE invitations SET claimed_by = ? WHERE lower(email) = lower(?) AND claimed_by IS NULL').run(user.id, String(email));
  createSession(db, res, user.id);
  audit(db, user.display_name, 'session', user.id, 'login-otp');
  res.redirect('/studio');
});

app.post('/studio/logout', (req, res) => {
  if (!sameOriginGuard(req, res)) return res.status(403).send('Forbidden');
  destroySession(db, req, res);
  res.redirect('/studio/login');
});

// ---------- 编号与鉴定辅助 ----------

function nextObservationId(db: Database, year: number): string {
  const name = `sfn-observation-${year}`;
  const row = db.prepare('SELECT value FROM counters WHERE name = ?').get(name) as { value: number } | undefined;
  if (!row) {
    db.prepare('INSERT INTO counters (name, value) VALUES (?, 0)').run(name);
    return `SFN-${year}-000001`;
  }
  const next = row.value + 1;
  db.prepare('UPDATE counters SET value = ? WHERE name = ?').run(next, name);
  return `SFN-${year}-${String(next).padStart(6, '0')}`;
}

function nextPostSlugSeq(db: Database): number {
  const row = db.prepare("SELECT value FROM counters WHERE name = 'post'").get() as { value: number };
  const next = row.value + 1;
  db.prepare("UPDATE counters SET value = ? WHERE name = 'post'").run(next);
  return next;
}

function upsertIdentification(db: Database, obsRowId: number, obsPublicId: string, slug: string, displayOverride: string | null, evidence: string, author: string): void {
  const taxa = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'taxa.json'), 'utf-8')) as {
    slug: string; scientific_name: string; rank: string;
  }[];
  const taxon = taxa.find((t) => t.slug === slug);
  if (!taxon) throw new Error('未知的类群');
  const display =
    (displayOverride && displayOverride.trim()) ||
    (['species', 'subspecies'].includes(taxon.rank) ? taxon.scientific_name : `${taxon.scientific_name} sp.`);
  const prev = db
    .prepare('SELECT display_identification, taxon_slug FROM identifications WHERE observation_id = ? AND is_current = 1')
    .get(obsRowId) as { display_identification: string; taxon_slug: string } | undefined;
  const changed = !prev || prev.taxon_slug !== slug || prev.display_identification !== display;
  db.prepare('UPDATE identifications SET is_current = 0 WHERE observation_id = ?').run(obsRowId);
  db.prepare(
    `INSERT INTO identifications (observation_id, taxon_slug, display_identification, identified_by, identified_at, evidence, is_current)
     VALUES (?,?,?,?,?,?,1)`,
  ).run(obsRowId, slug, display, author, new Date().toISOString().slice(0, 10), evidence);
  if (changed) {
    const version = (db.prepare("SELECT COUNT(*) c FROM revisions WHERE entity_type = 'identification' AND entity_id = ?").get(obsPublicId) as { c: number }).c + 1;
    db.prepare("INSERT INTO revisions (entity_type, entity_id, version, action, data_snapshot, author) VALUES ('identification', ?, ?, '修改物种鉴定', ?, ?)")
      .run(obsPublicId, version, JSON.stringify({ from: prev?.display_identification ?? null, to: display }), author);
  }
}

// ---------- 工作台（问候式） ----------

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return '夜深了';
  if (h < 11) return '早上好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

app.get('/studio', (req, res) => {
  const user = requireUser(db, req, res);
  if (!user) return;
  const drafts = db
    .prepare("SELECT public_id, updated_at FROM observations WHERE created_by = ? AND status = 'draft' ORDER BY updated_at DESC LIMIT 5")
    .all(user.id) as { public_id: string; updated_at: string }[];
  const published = db
    .prepare("SELECT public_id, observed_at, published_at FROM observations WHERE created_by = ? AND status = 'published' ORDER BY published_at DESC LIMIT 5")
    .all(user.id) as { public_id: string; observed_at: string; published_at: string }[];
  const noteDrafts = db
    .prepare("SELECT slug, title, updated_at FROM posts WHERE author_id = ? AND status = 'draft' ORDER BY updated_at DESC LIMIT 5")
    .all(user.id) as { slug: string; title: string; updated_at: string }[];
  const notePub = db
    .prepare("SELECT slug, title, published_at FROM posts WHERE author_id = ? AND status = 'published' ORDER BY published_at DESC LIMIT 5")
    .all(user.id) as { slug: string; title: string; published_at: string }[];
  res.send(page('工作台', `
    <div class="hello">${greeting()}，${esc(user.display_name)}</div>
    <p class="hello-sub">今天想记录什么？</p>
    <div class="cards">
      <a class="big-card" href="/studio/observations/new">
        <div class="t">＋ 记录一次相遇</div><div class="d">一只蜘蛛，一段相遇</div>
      </a>
      <a class="big-card" href="/studio/notes/new">
        <div class="t">✎ 写一篇札记</div><div class="d">调查、故事与思考</div>
      </a>
    </div>
    <h2>最近草稿</h2>
    <table><tr><th>条目</th><th>时间</th></tr>
      ${drafts.map((d) => `<tr><td><a href="/studio/observations/${d.public_id}/edit">${d.public_id}</a></td><td>${d.updated_at}</td></tr>`).join('')}
      ${noteDrafts.map((n) => `<tr><td><a href="/studio/notes/${n.slug}/edit">${esc(n.title)}</a>（札记草稿）</td><td>${n.updated_at}</td></tr>`).join('')}
      ${drafts.length + noteDrafts.length === 0 ? '<tr><td>暂无草稿。</td></tr>' : ''}
    </table>
    <h2>最近发布</h2>
    <table><tr><th>条目</th><th>时间</th></tr>
      ${published.map((r) => `<tr><td><a href="/studio/observations/${r.public_id}/edit">${r.public_id}</a></td><td>${r.published_at ?? '—'}</td></tr>`).join('')}
      ${notePub.map((n) => `<tr><td><a href="/studio/notes/${n.slug}/edit">${esc(n.title)}</a>（札记）</td><td>${n.published_at}</td></tr>`).join('')}
      ${published.length + notePub.length === 0 ? '<tr><td>暂无发布记录。</td></tr>' : ''}
    </table>
    ${user.role === 'owner' ? '<h2>发布到公开站</h2><p><small>导出已发布内容为静态站数据，随后 npm run build 上线。</small></p><form method="post" action="/studio/export"><button type="submit">导出到静态站</button></form>' : ''}
  `, user));
});

// ---------- 观察：JSON API（autosave / 照片 / 发布） ----------

app.post('/studio/api/observations', (req, res) => {
  const user = requireUser(db, req, res);
  if (!user) return res.status(401).json({ error: '未登录' });
  if (!sameOriginGuard(req, res)) return res.status(403).json({ error: 'Forbidden' });
  const year = new Date().getFullYear();
  const publicId = nextObservationId(db, year);
  db.prepare(
    `INSERT INTO observations (public_id, created_by, observer_name, observed_at, observed_at_precision,
     state_province, country_name, location_visibility, field_note, status, visibility)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(publicId, user.id, user.display_name, new Date().toISOString().slice(0, 10), 'day', '待填写', '中国', 'exact', '', 'draft', 'private');
  audit(db, user.display_name, 'observation', publicId, 'create-draft');
  res.json({ public_id: publicId, edit_url: `/studio/observations/${publicId}/edit` });
});

const OBS_FIELDS = new Set([
  'observed_at', 'latitude', 'longitude', 'country_name', 'admin1', 'admin2',
  'locality', 'site_name', 'elevation_m', 'sex', 'life_stage', 'count', 'habitat',
  'microhabitat', 'behavior', 'plant', 'weather', 'field_note', 'trip_slug',
  'species_taxon_slug', 'species_evidence',
]);

app.patch('/studio/api/observations/:public_id', (req, res) => {
  const user = requireUser(db, req, res);
  if (!user) return res.status(401).json({ error: '未登录' });
  if (!sameOriginGuard(req, res)) return res.status(403).send('Forbidden');
  const obs = db.prepare('SELECT * FROM observations WHERE public_id = ?').get(req.params.public_id) as
    | Record<string, any> & { id: number; created_by: number }
    | undefined;
  if (!obs) return res.status(404).send('未找到该观察。');
  if (user.role !== 'owner' && obs.created_by !== user.id) return res.status(403).send('只能编辑自己的记录');

  const b = req.body as Record<string, unknown>;
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
    db.prepare(`UPDATE observations SET ${sets.join(', ')} WHERE id = ?`).run(...vals, obs.id);
  }
  if (typeof b.species_taxon_slug === 'string' && b.species_taxon_slug) {
    upsertIdentification(db, obs.id, obs.public_id, b.species_taxon_slug, null, typeof b.species_evidence === 'string' ? b.species_evidence : 'field', user.display_name);
  }
  res.json({ ok: true, saved_at: new Date().toISOString().slice(11, 19) });
});

// 照片上传（追加到观察）
app.post('/studio/observations/:public_id/photos', upload.array('photos', 20), async (req, res) => {
  const user = requireUser(db, req, res);
  if (!user) return res.status(401).send('未登录');
  if (!sameOriginGuard(req, res)) return res.status(403).send('Forbidden');
  if (rateLimited(req.ip ?? 'x')) return res.status(429).send('上传过于频繁，请稍后再试。');
  const obs = db.prepare('SELECT id, public_id, created_by, status FROM observations WHERE public_id = ?').get(req.params.public_id) as
    | { id: number; public_id: string; created_by: number; status: string }
    | undefined;
  if (!obs) return res.status(404).send('未找到该观察。');
  if (user.role !== 'owner' && obs.created_by !== user.id) return res.status(403).send('只能管理自己的照片。');
  const files = (req.files as Express.Multer.File[]) ?? [];
  if (!files.length) return res.status(400).send('没有照片。');
  const base = db.prepare('SELECT COALESCE(MAX(sort_order), 0) m FROM media WHERE observation_id = ?').get(obs.id) as { m: number };
  let order = base.m;
  const captions = String((req.body as Record<string, string>).captions ?? '').split('\n').map((x) => x.trim());
  const added: string[] = [];
  for (const file of files) {
    const err = validateUpload(file);
    if (err) return res.status(400).send(err);
    order += 1;
    const saved = await saveUploadedPhoto(db, file);
    db.prepare(
      `INSERT INTO media (public_id, observation_id, file_stem, view_type, caption, sort_order, is_cover,
       photographer_name, license, visibility, width, height)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      saved.publicId, obs.id, saved.fileStem, 'live_dorsal', captions[order - 1] ?? null, order,
      order === 1 ? 1 : 0, user.display_name, 'all_rights_reserved',
      obs.status === 'published' ? 'public' : 'private', saved.width, saved.height,
    );
    added.push(saved.publicId);
  }
  audit(db, user.display_name, 'media', obs.public_id, 'upload', { added });
  res.json({ ok: true, added });
});

app.post('/studio/api/media/:public_id/caption', (req, res) => {
  const user = requireUser(db, req, res);
  if (!user) return res.status(401).json({ error: '未登录' });
  if (!sameOriginGuard(req, res)) return res.status(403).send('Forbidden');
  const m = db.prepare('SELECT * FROM media WHERE public_id = ?').get(req.params.public_id) as
    | Record<string, any> & { id: number; observation_id: number | null }
    | undefined;
  if (!m) return res.status(404).json({ error: '未找到' });
  const obs = m.observation_id
    ? (db.prepare('SELECT created_by FROM observations WHERE id = ?').get(m.observation_id) as { created_by: number })
    : undefined;
  if (user.role !== 'owner' && (!obs || obs.created_by !== user.id)) return res.status(403).send('无权操作。');
  db.prepare('UPDATE media SET caption = ? WHERE id = ?').run(String((req.body as Record<string, string>).caption ?? '').slice(0, 300), m.id);
  res.json({ ok: true });
});

// 札记插图上传（不挂观察，note 引用）
app.post('/studio/api/media/upload', upload.single('photo'), async (req, res) => {
  const user = requireUser(db, req, res);
  if (!user) return res.status(401).json({ error: '未登录' });
  if (!sameOriginGuard(req, res)) return res.status(403).send('Forbidden');
  if (rateLimited(req.ip ?? 'x')) return res.status(429).json({ error: '上传过于频繁' });
  const file = req.file as Express.Multer.File | undefined;
  if (!file) return res.status(400).json({ error: '没有文件' });
  const err = validateUpload(file);
  if (err) return res.status(400).json({ error: err });
  const saved = await saveUploadedPhoto(db, file);
  audit(db, user.display_name, 'media', saved.publicId, 'upload-note-image');
  res.json({ ok: true, public_id: saved.publicId, url: `/media/derivatives/${saved.fileStem}-1280.jpg` });
});

app.delete('/studio/api/media/:public_id', (req, res) => {
  const user = requireUser(db, req, res);
  if (!user) return res.status(401).json({ error: '未登录' });
  if (!sameOriginGuard(req, res)) return res.status(403).send('Forbidden');
  const m = db.prepare('SELECT * FROM media WHERE public_id = ?').get(req.params.public_id) as
    | Record<string, any> & { id: number; observation_id: number | null; file_stem: string }
    | undefined;
  if (!m) return res.status(404).json({ error: '未找到' });
  const obs = m.observation_id
    ? (db.prepare('SELECT created_by, public_id FROM observations WHERE id = ?').get(m.observation_id) as { created_by: number; public_id: string })
    : undefined;
  if (user.role !== 'owner' && (!obs || obs.created_by !== user.id)) return res.status(403).send('无权操作。');
  db.prepare('DELETE FROM media WHERE id = ?').run(m.id);
  try {
    for (const suffix of ['thumb', 'medium', 'large']) unlinkSync(join(DERIVATIVES_DIR, `${m.file_stem}_${suffix}.jpg`));
    for (const f of readdirSync(DERIVATIVES_DIR)) {
      if (f.startsWith(m.file_stem + '-')) unlinkSync(join(DERIVATIVES_DIR, f));
    }
  } catch {}
  audit(db, user.display_name, 'media', m.public_id, 'delete');
  res.json({ ok: true });
});

// 照片排序（拖拽或按钮提交顺序）
app.post('/studio/api/observations/:public_id/photos/order', (req, res) => {
  const user = requireUser(db, req, res);
  if (!user) return res.status(401).json({ error: '未登录' });
  if (!sameOriginGuard(req, res)) return res.status(403).send('Forbidden');
  const obs = db.prepare('SELECT id, created_by, public_id FROM observations WHERE public_id = ?').get(req.params.public_id) as
    | { id: number; created_by: number; public_id: string }
    | undefined;
  if (!obs) return res.status(404).json({ error: '未找到' });
  if (user.role !== 'owner' && obs.created_by !== user.id) return res.status(403).send('无权操作。');
  const order = (req.body as { order?: string[] }).order ?? [];
  order.forEach((pid, i) => {
    db.prepare('UPDATE media SET sort_order = ?, is_cover = ? WHERE public_id = ? AND observation_id = ?').run(i + 1, i === 0 ? 1 : 0, pid, obs.id);
  });
  audit(db, user.display_name, 'media', obs.public_id, 'reorder');
  res.json({ ok: true });
});

// 发布（§42 校验：日期 + 坐标 + 至少一张照片；物种允许 Unknown → Salticidae sp.）
app.post('/studio/api/observations/:public_id/publish', (req, res) => {
  const user = requireUser(db, req, res);
  if (!user) return res.status(401).json({ error: '未登录' });
  if (!sameOriginGuard(req, res)) return res.status(403).send('Forbidden');
  const obs = db.prepare('SELECT * FROM observations WHERE public_id = ?').get(req.params.public_id) as
    | Record<string, any> & { id: number; created_by: number; public_id: string }
    | undefined;
  if (!obs) return res.status(404).json({ error: '未找到' });
  if (user.role !== 'owner' && obs.created_by !== user.id) return res.status(403).send('只能发布自己的记录。');
  const problems: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(obs.observed_at ?? ''))) problems.push('缺少观察日期');
  if (obs.exact_latitude == null || obs.exact_longitude == null) problems.push('缺少坐标（纬度/经度）');
  const photoCount = db.prepare('SELECT COUNT(*) c FROM media WHERE observation_id = ?').get(obs.id) as { c: number };
  if (photoCount.c === 0) problems.push('至少需要一张照片');
  if (problems.length) return res.status(400).json({ error: problems.join('；') });

  db.prepare(
    "UPDATE observations SET status = 'published', visibility = 'public', published_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
  ).run(obs.id);
  db.prepare("UPDATE media SET visibility = 'public' WHERE observation_id = ?").run(obs.id);
  const idn = db.prepare('SELECT id FROM identifications WHERE observation_id = ? AND is_current = 1').get(obs.id);
  if (!idn) {
    db.prepare(
      `INSERT INTO identifications (observation_id, taxon_slug, display_identification, identified_by, identified_at, evidence, is_current)
       VALUES (?, 'salticidae', 'Salticidae sp.', ?, date('now'), 'field', 1)`,
    ).run(obs.id, user.display_name);
  }
  const version = (db.prepare("SELECT COUNT(*) c FROM revisions WHERE entity_type = 'observation' AND entity_id = ?").get(obs.public_id) as { c: number }).c + 1;
  db.prepare("INSERT INTO revisions (entity_type, entity_id, version, action, data_snapshot, author) VALUES ('observation', ?, ?, '发布', ?, ?)")
    .run(obs.public_id, version, JSON.stringify({ at: new Date().toISOString() }), user.display_name);
  audit(db, user.display_name, 'observation', obs.public_id, 'publish');
  res.json({ ok: true, public_url: `/observations/${obs.public_id}/` });
});

app.post('/studio/api/observations/:public_id/private', (req, res) => {
  const user = requireUser(db, req, res);
  if (!user) return res.status(401).json({ error: '未登录' });
  if (!sameOriginGuard(req, res)) return res.status(403).send('Forbidden');
  const obs = db.prepare('SELECT id, created_by, public_id FROM observations WHERE public_id = ?').get(req.params.public_id) as
    | { id: number; created_by: number; public_id: string }
    | undefined;
  if (!obs) return res.status(404).json({ error: '未找到' });
  if (user.role !== 'owner' && obs.created_by !== user.id) return res.status(403).send('只能操作自己的记录。');
  db.prepare("UPDATE observations SET status = 'private', visibility = 'private' WHERE id = ?").run(obs.id);
  db.prepare("UPDATE media SET visibility = 'private' WHERE observation_id = ?").run(obs.id);
  audit(db, user.display_name, 'observation', obs.public_id, 'set-private');
  res.json({ ok: true });
});

// ---------- EXIF 预读 ----------

app.post('/studio/api/exif-preview', upload.single('photo'), async (req, res) => {
  const user = requireUser(db, req, res);
  if (!user) return res.status(401).json({ error: '未登录' });
  const file = req.file as Express.Multer.File | undefined;
  if (!file) return res.status(400).json({ error: 'no photo' });
  const s = await parseExif(file.buffer);
  res.json({ results: [{ filename: file.originalname, date: s.date ?? null, gps: s.gps ?? null }] });
});

// ---------- 札记 ----------

app.post('/studio/api/notes', (req, res) => {
  const user = requireUser(db, req, res);
  if (!user) return res.status(401).json({ error: '未登录' });
  if (!sameOriginGuard(req, res)) return res.status(403).send('Forbidden');
  const seq = nextPostSlugSeq(db);
  const b = req.body as Record<string, string>;
  const slug = `note-${String(seq).padStart(3, '0')}`;
  db.prepare('INSERT INTO posts (slug, author_id, title, subtitle, body_md, status) VALUES (?,?,?,?,?,?)').run(
    slug, user.id, String(b.title ?? '未命名札记').slice(0, 160), b.subtitle ?? null, String(b.body_md ?? ''), 'draft',
  );
  audit(db, user.display_name, 'post', slug, 'create-draft');
  res.json({ ok: true, slug, edit_url: `/studio/notes/${slug}/edit` });
});

app.patch('/studio/api/notes/:slug', (req, res) => {
  const user = requireUser(db, req, res);
  if (!user) return res.status(401).json({ error: '未登录' });
  if (!sameOriginGuard(req, res)) return res.status(403).send('Forbidden');
  const post = db.prepare('SELECT * FROM posts WHERE slug = ?').get(req.params.slug) as
    | { id: number; author_id: number }
    | undefined;
  if (!post) return res.status(404).json({ error: '未找到' });
  if (user.role !== 'owner' && post.author_id !== user.id) return res.status(403).json({ error: '只能编辑自己的札记' });
  const b = req.body as Record<string, string>;
  db.prepare("UPDATE posts SET title = ?, subtitle = ?, body_md = ?, updated_at = datetime('now') WHERE id = ?").run(
    String(b.title ?? '').slice(0, 160), b.subtitle ?? null, String(b.body_md ?? ''), post.id,
  );
  res.json({ ok: true, saved_at: new Date().toISOString().slice(11, 19) });
});

app.post('/studio/api/notes/:slug/publish', (req, res) => {
  const user = requireUser(db, req, res);
  if (!user) return res.status(401).json({ error: '未登录' });
  if (!sameOriginGuard(req, res)) return res.status(403).send('Forbidden');
  const post = db.prepare('SELECT * FROM posts WHERE slug = ?').get(req.params.slug) as
    | Record<string, any> & { id: number; slug: string }
    | undefined;
  if (!post) return res.status(404).json({ error: '未找到' });
  if (user.role !== 'owner' && post.author_id !== user.id) return res.status(403).json({ error: '只能发布自己的札记' });
  if (!String(post.title ?? '').trim() || !String(post.body_md ?? '').trim()) {
    return res.status(400).json({ error: '发布前至少需要标题与正文' });
  }
  db.prepare("UPDATE posts SET status = 'published', published_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(post.id);
  const version = (db.prepare("SELECT COUNT(*) c FROM revisions WHERE entity_type = 'post' AND entity_id = ?").get(post.slug) as { c: number }).c + 1;
  db.prepare("INSERT INTO revisions (entity_type, entity_id, version, action, author) VALUES ('post', ?, ?, '发布札记', ?)")
    .run(post.slug, version, user.display_name);
  audit(db, user.display_name, 'post', post.slug, 'publish');
  res.json({ ok: true, public_url: `/posts/${post.slug}/` });
});

// 预览：真实 Article Renderer
app.post('/studio/api/notes/preview', (req, res) => {
  const user = requireUser(db, req, res);
  if (!user) return res.status(401).json({ error: '未登录' });
  const html = renderArticle(String((req.body as Record<string, string>).body_md ?? ''), {
    mediaRef: mediaRefResolver,
    embed: observationEmbedResolver(db),
  });
  res.type('application/json').json({ html });
});

function mediaRefResolver(id: string): { url: string; ratio: number; caption: string | null } | null {
  const m = db.prepare('SELECT * FROM media WHERE public_id = ?').get(id) as
    | Record<string, any> & { file_stem: string; width: number | null; height: number | null; caption: string | null }
    | undefined;
  if (!m) return null;
  const ratio = m.width && m.height ? m.width / m.height : 1.5;
  return {
    url: `/media/derivatives/${m.file_stem}-1280.jpg`,
    ratio,
    caption: m.caption,
  };
}

// ---------- 编辑器页面 ----------

const TAXA = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'taxa.json'), 'utf-8')) as {
  slug: string; scientific_name: string; rank: string; chinese_name: string | null;
}[];

function taxonOptions(): string {
  return [
    '<option value="">未鉴定（记为 Salticidae sp.）</option>',
    ...TAXA.map((t) => `<option value="${t.slug}">${esc(t.scientific_name)}${t.chinese_name ? `（${esc(t.chinese_name)}）` : ''}</option>`),
  ].join('');
}

app.get('/studio/observations/new', (req, res) => {
  const user = requireUser(db, req, res);
  if (!user) return;
  res.send(page('记录一次相遇', obsEditorHtml(null, {}, []), user));
});

app.get('/studio/observations/:public_id/edit', (req, res) => {
  const user = requireUser(db, req, res);
  if (!user) return;
  const obs = db.prepare('SELECT * FROM observations WHERE public_id = ?').get(req.params.public_id) as
    | Record<string, any>
    | undefined;
  if (!obs) return res.status(404).send('未找到该观察。');
  if (user.role !== 'owner' && obs.created_by !== user.id) return res.status(403).send('只能编辑自己的记录。');
  const photos = db.prepare('SELECT * FROM media WHERE observation_id = ? ORDER BY sort_order').all(obs.id) as Record<string, any>[];
  const idn = db.prepare('SELECT taxon_slug FROM identifications WHERE observation_id = ? AND is_current = 1').get(obs.id) as
    | { taxon_slug: string }
    | undefined;
  const data = {
    ...obs,
    observed_at: String(obs.observed_at ?? '').slice(0, 10),
    latitude: obs.exact_latitude ?? '',
    longitude: obs.exact_longitude ?? '',
    species_taxon_slug: idn?.taxon_slug ?? '',
  };
  res.send(page(`编辑 ${obs.public_id}`, obsEditorHtml(obs.public_id, data, photos), user));
});

function obsEditorHtml(publicId: string | null, data: Record<string, any>, photos: Record<string, any>[]): string {
  // datalist 选项值显示「学名（中文名）」，客户端剥壳后映射回 slug（见 boot.taxa）
  const taxonOptions = [
    '<option value=" Salticidae sp.（未鉴定）"></option>',
    ...TAXA.map((t) => `<option value="${esc(t.scientific_name)}${t.chinese_name ? `（${esc(t.chinese_name)}）` : ''}"></option>`),
  ].join('');
  const TRIPS = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'trips.json'), 'utf-8')) as { slug: string; title: string }[];
  const tripOptions = [
    '<option value="">—— 不关联 ——</option>',
    ...TRIPS.map((t) => `<option value="${t.slug}">${esc(t.title)}</option>`),
  ].join('');
  const photoGrid = photos
    .map(
      (p) => `
      <div class="thumb" data-pid="${p.public_id}">
        <div class="box"><img src="/media/derivatives/${p.file_stem}_thumb.jpg" alt="" loading="lazy" /></div>
        <div class="tools">
          <button type="button" data-act="cover" data-pid="${p.public_id}" class="${p.is_cover ? 'on' : ''}">封面</button>
          <button type="button" data-act="delete" data-pid="${p.public_id}">删除</button>
        </div>
        <input type="text" placeholder="图注…" value="${esc(p.caption)}" data-caption-pid="${p.public_id}" />
      </div>`,
    )
    .join('');
  return `
  <h1>${publicId ? `编辑 ${publicId}` : '记录一次相遇'}</h1>
  <div class="status" id="save-status"></div>

  <label>照片 *（JPG/PNG，可多选；上传后可拖拽排序、设封面、加图注）</label>
  <div class="dropzone" id="dropzone">拖入照片，或点击选择（可多选）</div>
  <input type="file" id="photo-input" multiple accept="image/jpeg,image/png" style="display:none" />
  <div class="thumbs" id="photo-grid">${photoGrid}</div>

  <div class="step"><div class="st">物 种 与 时 间</div>
    <div class="grid2">
      <div><label>物种（可输入学名 / 中文名筛选；允许未鉴定）</label>
        <input type="text" id="species-search" list="species-list" placeholder="Siler / 翠蛛 / …" autocomplete="off" />
        <datalist id="species-list">${taxonOptions}</datalist>
      </div>
      <div><label>观察日期 *</label><input type="date" id="observed-at" data-field="observed_at" /></div>
    </div>
    <small style="color:var(--faint)">选择照片后自动读取 EXIF 拍摄时间与 GPS（可修改）。</small>
  </div>

  <div class="step"><div class="st">坐 标 与 地 点</div>
    <div class="grid3">
      <div><label>纬度 *（十进制度，6 位小数）</label><input type="text" id="latitude" data-field="latitude" placeholder="21.927381" /></div>
      <div><label>经度 *</label><input type="text" id="longitude" data-field="longitude" placeholder="101.256742" /></div>
      <div><label>海拔（米）</label><input type="number" data-field="elevation_m" /></div>
    </div>
    <div class="grid3">
      <div><label>国家 *</label><input type="text" data-field="country_name" value="中国" /></div>
      <div><label>一级行政区 *（省 / 州…）</label><input type="text" data-field="admin1" placeholder="云南省" /></div>
      <div><label>二级行政区</label><input type="text" data-field="admin2" placeholder="西双版纳傣族自治州" /></div>
    </div>
    <div class="grid2">
      <div><label>地点（县 / 镇 / 具体位置）</label><input type="text" data-field="locality" placeholder="勐腊县 · 勐仑镇" /></div>
      <div><label>具体地点名</label><input type="text" data-field="site_name" placeholder="沟谷雨林林缘" /></div>
    </div>
  </div>

  <div class="step"><div class="st">野 外 笔 记</div>
    <textarea data-field="field_note" placeholder="它在哪里、在做什么、有什么特别——不必是论文。（快速记录可留空）"></textarea>
  </div>

  <details>
    <summary>＋ 添加详细信息（可选）</summary>
    <div class="grid3">
      <div><label>性别</label><select data-field="sex"><option value="unknown">未知</option><option value="male">雄性</option><option value="female">雌性</option></select></div>
      <div><label>生命阶段</label><select data-field="life_stage"><option value="unknown">未知</option><option value="adult">成体</option><option value="subadult">亚成体</option><option value="juvenile">幼体</option></select></div>
      <div><label>数量</label><input type="number" data-field="count" min="1" /></div>
    </div>
    <div class="grid3">
      <div><label>微生境</label><input type="text" data-field="microhabitat" placeholder="叶片上表面" /></div>
      <div><label>行为</label><input type="text" data-field="behavior" placeholder="游猎 / 求偶…" /></div>
      <div><label>所在植物</label><input type="text" data-field="plant" /></div>
    </div>
    <div class="grid2">
      <div><label>天气</label><input type="text" data-field="weather" placeholder="雨后 / 晴…" /></div>
      <div><label>所属调查</label><select data-field="trip_slug">${tripOptions}</select></div>
    </div>
  </details>

  <div class="row" style="margin-top:26px">
    <button type="button" id="btn-publish">发 布</button>
    <button type="button" id="btn-private" class="btn-quiet">设为私密</button>
    <a class="btn-quiet" href="/studio">返回</a>
  </div>
  <script src="/studio-editor.js"></script>
  <script>
    window.__EDITOR_BOOT = {
      publicId: ${JSON.stringify(publicId)},
      mode: ${JSON.stringify(publicId ? 'edit' : 'new')},
      taxa: ${JSON.stringify(TAXA.map((t) => ({ slug: t.slug, name: t.scientific_name })))},
      data: ${JSON.stringify({
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
  </script>`;
}

// ---------- 札记编辑器页面 ----------

app.get('/studio/notes/new', (req, res) => {
  const user = requireUser(db, req, res);
  if (!user) return;
  res.send(page('写一篇札记', noteEditorHtml('', { title: '', subtitle: '', body_md: '' }), user));
});

app.get('/studio/notes/:slug/edit', (req, res) => {
  const user = requireUser(db, req, res);
  if (!user) return;
  const post = db.prepare('SELECT * FROM posts WHERE slug = ?').get(req.params.slug) as Record<string, any> | undefined;
  if (!post) return res.status(404).send('未找到该札记。');
  if (user.role !== 'owner' && post.author_id !== user.id) return res.status(403).send('只能编辑自己的札记。');
  res.send(page(`编辑：${post.title}`, noteEditorHtml(post.slug, post), user));
});

function noteEditorHtml(slug: string | null, data: Record<string, any>): string {
  return `
  <div class="row" style="justify-content:space-between">
    <h1 style="margin:0">写一篇札记</h1>
    <div class="row">
      <button type="button" id="btn-preview" class="btn-quiet">预 览</button>
      <button type="button" id="btn-publish-note">发 布</button>
    </div>
  </div>
  <div class="status" id="save-status"></div>
  <label>标题 *</label><input type="text" id="n-title" value="${esc(data.title ?? '')}" />
  <label>副标题（可选）</label><input type="text" id="n-subtitle" value="${esc(data.subtitle ?? '')}" />
  <label>正文（工具栏插入标记；图片按钮上传后自动插入引用）</label>
  <div class="row" style="margin:6px 0">
    <button type="button" class="btn-quiet" data-md="## ">H2</button>
    <button type="button" class="btn-quiet" data-md="### ">H3</button>
    <button type="button" class="btn-quiet" data-md="**">粗体</button>
    <button type="button" class="btn-quiet" data-md="*">斜体</button>
    <button type="button" class="btn-quiet" data-md="> ">引用</button>
    <button type="button" class="btn-quiet" data-md="- ">列表</button>
    <button type="button" class="btn-quiet" data-md="---">分隔线</button>
    <button type="button" class="btn-quiet" id="btn-note-image">插入图片</button>
    <button type="button" class="btn-quiet" id="btn-note-obs">插入观察</button>
    <button type="button" class="btn-quiet" id="btn-note-trip">插入调查</button>
    <input type="file" id="note-image-input" accept="image/jpeg,image/png" style="display:none" />
  </div>
  <textarea id="n-body" style="min-height:420px">${esc(data.body_md ?? '')}</textarea>
  <div id="note-preview" class="card" style="display:none"></div>
  <input type="hidden" id="n-slug" value="${esc(slug ?? '')}" />
  <script src="/studio-note-editor.js"></script>`;
}

// ---------- 媒体管理 ----------

app.get('/studio/media', (req, res) => {
  const user = requireUser(db, req, res);
  if (!user) return;
  const rows = db
    .prepare(`SELECT m.*, o.public_id AS obs_public_id FROM media m
              LEFT JOIN observations o ON o.id = m.observation_id
              WHERE m.visibility = 'public' ORDER BY m.id DESC LIMIT 200`)
    .all() as Record<string, any>[];
  res.send(page('影像', `
    <h1>影像</h1>
    <p><small>已公开影像 ${rows.length} 张（按编号倒序）。编号可单独引用；点击观察编号可打开所属记录。</small></p>
    <div class="thumbs">
      ${rows.map((m) => `
        <div class="thumb">
          <div class="box"><img src="/media/derivatives/${m.file_stem}_thumb.jpg" alt="" loading="lazy" /></div>
          <div class="tools"><span>${m.public_id}</span></div>
          <div style="font-size:12px;color:var(--faint)">${m.obs_public_id ? `<a href="/studio/observations/${m.obs_public_id}/edit">${m.obs_public_id}</a>` : '未关联'}</div>
        </div>`).join('')}
    </div>`, user));
});

// ---------- EXIF 预读 ----------

app.post('/studio/api/exif-preview', upload.single('photo'), async (req, res) => {
  const user = requireUser(db, req, res);
  if (!user) return res.status(401).json({ error: '未登录' });
  const file = req.file as Express.Multer.File | undefined;
  if (!file) return res.status(400).json({ error: 'no photo' });
  const s = await parseExif(file.buffer);
  res.json({ results: [{ filename: file.originalname, date: s.date ?? null, gps: s.gps ?? null }] });
});

// ---------- 导出 ----------

app.post('/studio/export', (req, res) => {
  const user = requireOwner(db, req, res);
  if (!user) return;
  if (!sameOriginGuard(req, res)) return res.status(403).send('Forbidden');
  const result = exportForStaticSite(db);
  audit(db, user.display_name, 'export', null, 'export-static', result);
  res.send(
    page('导出完成', `
      <h1>导出完成</h1>
      <div class="msg">已写入 src/data/studio-*.json：观察 ${result.observations} 条 · 媒体 ${result.media} 条 · 博文 ${result.posts} 篇。</div>
      <p><small>下一步：项目根目录运行 <code>npm run build && npm run test:privacy</code>，确认后提交部署。</small></p>
      <a class="btn" href="/studio">返回工作台</a>`, user),
  );
});

// ---------- 404 ----------

app.use((_req, res) => res.status(404).send('Not Found'));

app.listen(PORT, () => {
  console.log(`Field Studio v1 运行于 http://localhost:${PORT}/studio`);
  console.log(`OTP 邮件投递：${process.env.SMTP_HOST ? 'SMTP' : '开发模式（服务器控制台）'}`);
});

