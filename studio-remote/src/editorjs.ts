// 编辑器客户端脚本（远程版）：与本地版同一交互，照片上传改为
// 浏览器端 canvas 生成多格式派生图（Workers 无 sharp），原图 + 派生图成对提交。
// 注意：客户端代码不使用模板字符串，避免与外层 TS 模板字面量冲突。

const UPLOAD_LIB = `
window.__sfnPrepareUpload = async function (file) {
  if (!window.createImageBitmap || !window.OffscreenCanvas) throw new Error('浏览器不支持本地图片处理，请改用现代浏览器');
  var bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  var widths = [480, 768, 1280, 1920].filter(function (w) { return w <= bmp.width; });
  if (!widths.length) widths = [480];
  var variants = [];
  for (var i = 0; i < widths.length; i++) {
    var w = widths[i];
    var c = new OffscreenCanvas(w, Math.max(1, Math.round(bmp.height * w / bmp.width)));
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    variants.push({ name: w + '.jpg', blob: await c.convertToBlob({ type: 'image/jpeg', quality: 0.82 }) });
    try { variants.push({ name: w + '.webp', blob: await c.convertToBlob({ type: 'image/webp', quality: 0.72 }) }); } catch (e) {}
    try { variants.push({ name: w + '.avif', blob: await c.convertToBlob({ type: 'image/avif', quality: 0.45 }) }); } catch (e) {}
  }
  return { original: file, width: bmp.width, height: bmp.height, variants: variants };
};
window.__sfnAppendUpload = function (fd, prepared) {
  fd.append('original', prepared.original, prepared.original.name);
  fd.append('width', String(prepared.width));
  fd.append('height', String(prepared.height));
  prepared.variants.forEach(function (v) { fd.append('variant', v.blob, v.name); });
};
`;

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
  var sp2 = $('#species-search');
  if (sp2) sp2.addEventListener('input', scheduleSave);

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
        .then(async function () {
          setStatus('准备照片（' + files.length + ' 张）…');
          var fd = new FormData();
          for (var i = 0; i < files.length; i++) {
            var prepared = await window.__sfnPrepareUpload(files[i]);
            window.__sfnAppendUpload(fd, prepared);
          }
          setStatus('上传照片（' + files.length + ' 张）…');
          return fetch('/studio/observations/' + pid + '/photos', { method: 'POST', body: fd });
        })
        .then(function (r) {
          if (r && r.ok) { lsClear(); location.reload(); }
          else if (r) r.text().then(function (t) { setStatus('上传失败：' + t); });
        })
        .catch(function (e) { setStatus('上传失败：' + (e && e.message ? e.message : '网络')); });
    });
  }
  if (dz && pi) {
    dz.addEventListener('click', function () { pi.click(); });
    dz.addEventListener('dragover', function (e) { e.preventDefault(); });
    dz.addEventListener('drop', function (e) { e.preventDefault(); handleFiles(e.dataTransfer.files); });
    pi.addEventListener('change', function () { handleFiles(pi.files); pi.value = ''; });
  }

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
    setStatus('准备图片…');
    window.__sfnPrepareUpload(f).then(function (prepared) {
      setStatus('上传图片…');
      var fd = new FormData();
      window.__sfnAppendUpload(fd, prepared);
      return fetch('/studio/api/media/upload', { method: 'POST', body: fd });
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (res.ok && res.j.ok) {
          var cap = window.prompt('图注（可留空）', '') || '';
          insertAt('\\n\\n![' + cap + '](media:' + res.j.public_id + ')\\n\\n');
          setStatus('已插入 ' + res.j.public_id);
        } else setStatus('上传失败：' + ((res.j && res.j.error) || ''));
      }).catch(function (e) { setStatus('上传失败：' + (e && e.message ? e.message : '网络')); });
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

export const OBS_EDITOR_SCRIPT = UPLOAD_LIB + OBS_EDITOR_JS;
export const NOTE_EDITOR_SCRIPT = UPLOAD_LIB + NOTE_EDITOR_JS;
