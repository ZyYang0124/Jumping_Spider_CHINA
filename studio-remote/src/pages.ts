// 页面模板：与本地 studio/src/server.ts 保持同一套视觉与文案（单一事实源：本地版）。
// 差异点：缩略图 URL 由 media.variants 计算（thumbUrl），导出为 zip 下载链接。
import taxaJson from './taxa-data.json';
import tripsJson from './trips-data.json';
import type { StudioUser } from './auth';

export const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string));

export const TAXA = taxaJson as unknown as { slug: string; scientific_name: string; rank: string; chinese_name: string | null }[];
export const TRIPS = (tripsJson as any[]).map((t) => ({ slug: t.slug, title: t.title }));

export const STYLES = `
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

export function page(title: string, body: string, user: StudioUser | null = null): string {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${esc(title)} · Field Studio</title><link rel="stylesheet" href="/studio.css"></head>
<body><header>
<a class="brand" href="/studio">Field Studio · 跳蛛观察志</a>
<nav>${user ? `${esc(user.display_name)} · <a href="/studio/observations/new">记录相遇</a> · <a href="/studio/notes/new">写札记</a> · <a href="/studio/media">影像</a> · <a href="/studio">工作台</a> · <a href="/studio/logout">退出</a>` : `<a href="/studio/login">登录</a>`}</nav>
</header><main>${body}</main></body></html>`;
}

export function loginPage(opts: { error?: string; email?: string; devNotice: boolean }): string {
  const { error, email, devNotice } = opts;
  return `<h1>登录 Field Studio</h1>
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
    : `<div class="card"><h2 style="margin-top:0">邮箱登录</h2>${devNotice ? '<p class="msg">开发模式：未配置邮件服务，验证码输出到 Worker 日志（wrangler tail）。</p>' : ''}
      <form method="post" action="/studio/login/otp"><label>邮箱（受邀时登记的邮箱）</label>
      <input type="email" name="email" required /><div style="margin-top:16px"><button type="submit">发送验证码</button></div></form></div>`}`;
}

export function greetingWord(): string {
  const h = new Date().getHours();
  if (h < 5) return '夜深了';
  if (h < 11) return '早上好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

export function obsEditorHtml(publicId: string | null, data: Record<string, any>, photos: { public_id: string; thumb: string; caption: string | null; is_cover: number }[]): string {
  const taxonOptions = [
    '<option value=" Salticidae sp.（未鉴定）"></option>',
    ...TAXA.map((t) => `<option value="${esc(t.scientific_name)}${t.chinese_name ? `（${esc(t.chinese_name)}）` : ''}"></option>`),
  ].join('');
  const tripOptions = [
    '<option value="">—— 不关联 ——</option>',
    ...TRIPS.map((t) => `<option value="${esc(t.slug)}">${esc(t.title)}</option>`),
  ].join('');
  const photoGrid = photos
    .map(
      (p) => `
      <div class="thumb" data-pid="${p.public_id}">
        <div class="box"><img src="${esc(p.thumb)}" alt="" loading="lazy" /></div>
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
      <div><label>国家 *</label><input type="text" data-field="country_name" /></div>
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
        country_name: data.country_name ?? '',
        admin1: data.admin1 ?? '',
        admin2: data.admin2 ?? '',
        locality: data.locality ?? '',
        site_name: data.site_name ?? '',
        elevation_m: data.elevation_m ?? '',
        sex: data.sex ?? 'unknown',
        life_stage: data.life_stage ?? 'unknown',
        count: data.count ?? '',
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

export function noteEditorHtml(slug: string | null, data: Record<string, any>): string {
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

export function mediaPage(rows: { public_id: string; thumb: string; obs_public_id: string | null }[], owner: boolean, exportInfo: { observations: number; posts: number }): string {
  return `
    <h1>影像</h1>
    <p><small>已公开影像 ${rows.length} 张（按编号倒序）。编号可单独引用；点击观察编号可打开所属记录。</small></p>
    <div class="thumbs">
      ${rows.map((m) => `
        <div class="thumb">
          <div class="box"><img src="${esc(m.thumb)}" alt="" loading="lazy" /></div>
          <div class="tools"><span>${m.public_id}</span></div>
          <div style="font-size:12px;color:var(--faint)">${m.obs_public_id ? `<a href="/studio/observations/${m.obs_public_id}/edit">${m.obs_public_id}</a>` : '未关联'}</div>
        </div>`).join('')}
    </div>
    ${owner ? `<h2>发布到公开站</h2>
    <p><small>下载导出包（含 studio-*.json 与新增原图），解压进仓库后本地构建发布。
    当前已发布：观察 ${exportInfo.observations} 条 · 札记 ${exportInfo.posts} 篇。</small></p>
    <a class="btn" href="/studio/export">下载导出包（zip）</a>` : ''}`;
}
