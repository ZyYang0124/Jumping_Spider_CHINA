
window.__sfnPrepareUpload = async function (file) {
  if (!window.createImageBitmap || !window.OffscreenCanvas) throw new Error('浏览器不支持本地图片处理，请改用现代浏览器');
  var bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  // 只生成 jpg 档：主站发布会从原图统一重新生成全部格式，
  // Studio 自身只用 -480.jpg 缩略图；浏览器端 AVIF/WebP 编码极慢且无人消费，纯属拖慢上传
  var widths = [480, 768, 1280, 1920].filter(function (w) { return w <= bmp.width; });
  if (!widths.length) widths = [480];
  var variants = [];
  for (var i = 0; i < widths.length; i++) {
    var w = widths[i];
    var c = new OffscreenCanvas(w, Math.max(1, Math.round(bmp.height * w / bmp.width)));
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    variants.push({ name: w + '.jpg', blob: await c.convertToBlob({ type: 'image/jpeg', quality: 0.82 }) });
  }
  return { original: file, width: bmp.width, height: bmp.height, variants: variants };
};
window.__sfnAppendUpload = function (fd, prepared) {
  fd.append('original', prepared.original, prepared.original.name);
  fd.append('width', String(prepared.width));
  fd.append('height', String(prepared.height));
  prepared.variants.forEach(function (v) { fd.append('variant', v.blob, v.name); });
};
window.__sfnFetch = function (url, opts, timeoutMs) {
  var ctrl = new AbortController();
  var t = setTimeout(function () { ctrl.abort(); }, timeoutMs || 90000);
  return fetch(url, Object.assign({}, opts, { signal: ctrl.signal })).finally(function () { clearTimeout(t); });
};

(function () {
  function $(s) { return document.querySelector(s); }
  var statusEl = $('#save-status'), barStatus = $('#bar-status');
  var title = $('#n-title'), sub = $('#n-subtitle'), body = $('#n-body');
  var slugEl = $('#n-slug');
  var slug = slugEl.value || null;
  var published = (window.__NOTE_BOOT && window.__NOTE_BOOT.status) === 'published';
  var LS_KEY = 'sfn-note-' + (slug || 'new');
  var timer = null, saving = false, previewing = false, dirty = false;
  var saveChain = Promise.resolve(), saveQueued = false;

  function readJson(r) {
    return r.text().then(function (t) {
      try { return JSON.parse(t); } catch (e) { return { ok: false, error: '服务异常（' + r.status + '）' }; }
    });
  }

  function setStatus(html, err) {
    if (statusEl) { statusEl.innerHTML = html; statusEl.className = err ? 'err' : ''; }
    if (barStatus) { barStatus.innerHTML = html; barStatus.style.color = err ? 'var(--terra)' : 'var(--faint)'; }
  }
  function setPubBtn() {
    var btn = $('#btn-publish-note');
    if (published && !dirty) { btn.textContent = '已发布 ✓'; btn.disabled = true; }
    else { btn.textContent = published ? '保存修改' : '发布'; btn.disabled = false; }
  }
  function payload() { return { title: title.value, subtitle: sub.value, body_md: body.value }; }
  // 发布时刻的内容快照：之后的保存若与快照一致，不再误报「有未发布修改」
  var lastPublishedSnapshot = null;
  function snapshotNow() {
    var p = payload();
    p.related_observation_public_ids = ($('#n-related') && $('#n-related').value) || '';
    return JSON.stringify(p);
  }
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
          slugEl.value = slug;
          history.replaceState(null, '', '/studio/notes/' + slug + '/edit');
        }
        return slug;
      });
  }
  function saveNow(silent, explicit) {
    if (saving) { saveQueued = true; return saveChain; } // 已有保存 in-flight：登记尾随保存，避免发布与保存竞态
    saving = true;
    var ensure = slug ? Promise.resolve(slug) : create();
    saveChain = ensure.then(function (s) {
      if (!s) { setStatus('创建失败', true); saving = false; return; }
      var p = payload();
      p.related_observation_public_ids = ($('#n-related') && $('#n-related').value) || '';
      if (explicit) p.explicit = true;
      var snap = JSON.stringify(p);
      return fetch('/studio/api/notes/' + s, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p),
      })
        .then(readJson)
        .then(function (j) {
          if (j.ok) {
            if (published && snap !== lastPublishedSnapshot) { dirty = true; setStatus('已保存 · 主站未同步，点「保存修改」更新'); }
            else if (!published) setStatus('已保存 ' + (j.saved_at || ''));
            lsClear();
          } else setStatus('保存失败：' + (j.error || ''), true);
          setPubBtn();
        })
        .catch(function () { setStatus('暂时离线，内容留在本机', true); });
    }).then(function () {
      saving = false;
      if (saveQueued) { saveQueued = false; return saveNow(silent); }
    });
    return saveChain;
  }
  function schedule() {
    dirty = true;
    if (published) setStatus('有未发布修改');
    else setStatus('正在保存…');
    setPubBtn();
    lsSave();
    clearTimeout(timer);
    timer = setTimeout(function () { saveNow(true); }, 1400);
  }
  [title, sub, body].forEach(function (el) { el.addEventListener('input', schedule); });
  var relInput = $('#n-related');
  if (relInput) relInput.addEventListener('change', schedule);
  setPubBtn();

  // ---- 块菜单（＋ / /） ----
  var fab = $('#fab-add'), menu = $('#block-menu');
  function toggleMenu(force) {
    var open = force !== undefined ? force : !menu.classList.contains('open');
    menu.classList.toggle('open', open);
    if (open) {
      var firstBtn = menu.querySelector('button');
      if (firstBtn) firstBtn.focus();
    }
  }
  fab.addEventListener('click', function () { toggleMenu(); });
  document.addEventListener('click', function (e) {
    if (!menu.contains(e.target) && e.target !== fab) toggleMenu(false);
  });
  function insertBlock(text) {
    var at = body.selectionStart;
    var before = body.value.slice(0, at), after = body.value.slice(body.selectionEnd);
    var pad = before && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : '';
    var ins = pad + text + '\n\n';
    body.value = before + ins + after;
    var pos = (before + ins).length;
    body.focus();
    body.selectionStart = body.selectionEnd = pos;
    schedule();
    if (text === '__IMAGE__') insertImage();
    if (text === '__OBS__') insertAsk('观察编号（如 SFN-2026-000001）', 'observation');
    if (text === '__TRIP__') insertAsk('调查 slug（见公开站 /trips/…）', 'trip');
  }
  function insertAsk(promptText, kind) {
    var v = window.prompt(promptText, '');
    if (!v || !v.trim()) return;
    var tag = '{{' + kind + ':' + v.trim() + '}}\n\n';
    var at = body.selectionStart;
    body.value = body.value.slice(0, at) + tag + body.value.slice(at);
    schedule();
  }
  function insertImage() {
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/jpeg,image/png';
    inp.addEventListener('change', function () {
      var f = inp.files[0];
      if (!f) return;
      setStatus('正在处理图片…');
      window.__sfnPrepareUpload(f).then(function (prepared) {
        var fd = new FormData();
        window.__sfnAppendUpload(fd, prepared);
        return window.__sfnFetch('/studio/api/media/upload', { method: 'POST', body: fd }).then(function (r) { return r.json(); });
      }).then(function (j) {
        if (!j.ok) { setStatus(j.error ? '图片上传失败：' + j.error : '图片上传失败', true); return; }
        var cap = window.prompt('图注（可留空）', '') || '';
        var ref = '\n![' + cap + '](media:' + j.public_id + ')\n\n';
        body.value += ref;
        setStatus('已插入 ' + j.public_id);
        schedule();
      }).catch(function () { setStatus('图片上传失败', true); });
    });
    inp.click();
  }
  Array.prototype.slice.call(menu.querySelectorAll('button')).forEach(function (btn) {
    btn.addEventListener('click', function () {
      toggleMenu(false);
      var ins = btn.getAttribute('data-ins');
      // 哨兵项直接唤起对应流程，不把字面量插进正文
      if (ins === '__IMAGE__') { insertImage(); return; }
      if (ins === '__OBS__') { insertAsk('观察编号（如 SFN-2026-000001）', 'observation'); return; }
      if (ins === '__TRIP__') { insertAsk('调查 slug（见公开站 /trips/…）', 'trip'); return; }
      insertBlock(ins.replace(/&gt;/g, '>'));
    });
  });
  // 行首 "/" 呼出
  body.addEventListener('input', function () {
    var upto = body.value.slice(0, body.selectionStart);
    if (/(^|\n)\/$/.test(upto)) {
      body.value = body.value.slice(0, body.selectionStart - 1) + body.value.slice(body.selectionStart);
      toggleMenu(true);
    }
  });

  // ---- 格式工具栏：不懂 markdown 也能排版 ----
  var nbt = $('#nb-toolbar');
  function surround(before, after, placeholder) {
    var s = body.selectionStart, e = body.selectionEnd;
    var sel = body.value.slice(s, e) || placeholder;
    body.value = body.value.slice(0, s) + before + sel + after + body.value.slice(e);
    body.focus();
    body.selectionStart = s + before.length;
    body.selectionEnd = s + before.length + sel.length;
    schedule(); schedulePreview();
  }
  function prefixLines(prefix) {
    var s = body.selectionStart, e = body.selectionEnd;
    var start = body.value.lastIndexOf('
', s - 1) + 1;
    var end = body.value.indexOf('
', e); if (end < 0) end = body.value.length;
    var lines = body.value.slice(start, end).split('
');
    var all = lines.length && lines.every(function (l) { return l.startsWith(prefix); });
    var out = lines.map(function (l) { return all ? l.slice(prefix.length) : prefix + l; }).join('
');
    body.value = body.value.slice(0, start) + out + body.value.slice(end);
    body.focus();
    body.selectionStart = start; body.selectionEnd = start + out.length;
    schedule(); schedulePreview();
  }
  if (nbt) {
    nbt.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cmd]');
      if (!b) return;
      e.preventDefault();
      var c = b.getAttribute('data-cmd');
      if (c === 'h2') prefixLines('## ');
      else if (c === 'h3') prefixLines('### ');
      else if (c === 'quote') prefixLines('> ');
      else if (c === 'ul') prefixLines('- ');
      else if (c === 'bold') surround('**', '**', '加粗文字');
      else if (c === 'hr') insertBlock('---');
      else if (c === 'image') insertBlock('__IMAGE__');
      else if (c === 'obs') insertBlock('__OBS__');
    });
  }

  // ---- 编辑 ⇄ 预览（宽屏左写右排 · 边写边排版）----
  var paneEdit = $('#pane-edit'), panePrev = $('#pane-preview');
  var pvTitle = panePrev.querySelector('.pv-title'), pvSub = panePrev.querySelector('.pv-sub'), pvBody = panePrev.querySelector('.pv-body');
  var seg = $('#note-seg');
  var splitQuery = window.matchMedia('(min-width:1100px)');
  var previewTimer = null, previewSeq = 0;

  function renderPreview() {
    var seq = ++previewSeq;
    return fetch('/studio/api/notes/preview', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body_md: body.value }),
    })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (seq !== previewSeq) return; // 过期响应丢弃
        pvTitle.textContent = title.value || '（无标题）';
        pvSub.textContent = sub.value || '';
        pvSub.style.display = sub.value ? '' : 'none';
        pvBody.innerHTML = j.html || '<p style="color:var(--faint)">（正文为空）</p>';
      })
      .catch(function () { setStatus('预览生成失败（网络）', true); });
  }
  function schedulePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(renderPreview, 450);
  }
  // 输入即排版（防抖 450ms）
  body.addEventListener('input', schedulePreview);
  title.addEventListener('input', schedulePreview);
  sub.addEventListener('input', schedulePreview);
  // 滚动同步：编辑栏滚动比例映射到排版栏
  body.addEventListener('scroll', function () {
    if (!splitQuery.matches) return;
    var max = body.scrollHeight - body.clientHeight;
    if (max <= 0) return;
    panePrev.scrollTop = (panePrev.scrollHeight - panePrev.clientHeight) * (body.scrollTop / max);
  });

  function setView(v) {
    Array.prototype.slice.call(seg.querySelectorAll('button')).forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-view') === v);
    });
    if (splitQuery.matches) {
      // 宽屏分栏：双栏常驻，切换器不可见，永远不隐藏编辑栏
      paneEdit.hidden = false;
      panePrev.hidden = false;
      fab.style.display = 'none';
      renderPreview();
      previewing = true;
      return;
    }
    if (v === 'preview') {
      setStatus('正在生成预览…');
      renderPreview().then(function () {
        paneEdit.hidden = true;
        panePrev.hidden = false;
        fab.style.display = 'none';
        setStatus('预览 · 由 Article Engine 自动排版');
        window.scrollTo(0, 0);
      });
      previewing = true;
    } else {
      previewing = false;
      panePrev.hidden = true;
      paneEdit.hidden = false;
      fab.style.display = '';
    }
  }
  function escHtml(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  Array.prototype.slice.call(seg.querySelectorAll('button')).forEach(function (b) {
    b.addEventListener('click', function () { setView(b.getAttribute('data-view')); });
  });
  $('#btn-preview2').addEventListener('click', function () {
    setView(previewing ? 'edit' : 'preview');
  });
  // 初始与宽度跨越时同步视图
  splitQuery.addEventListener('change', function () { setView(splitQuery.matches ? 'preview' : 'edit'); });
  if (splitQuery.matches) { panePrev.hidden = false; fab.style.display = 'none'; renderPreview(); previewing = true; }

  // ---- 设置抽屉 ----
  $('#btn-settings').addEventListener('click', function () { document.body.classList.add('drawer-open'); });
  $('#drawer-mask').addEventListener('click', function () { document.body.classList.remove('drawer-open'); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { document.body.classList.remove('drawer-open'); toggleMenu(false); }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') $('#btn-publish-note').click();
  });

  // ---- 发布 ----
  $('#btn-publish-note').addEventListener('click', function () {
    var btn = $('#btn-publish-note');
    btn.disabled = true;
    if (published) {
      // 保存修改：显式保存已发布札记并同步主站（§6/§29）
      setStatus('正在保存…');
      saveNow(true, true).then(function () {
        return fetch('/studio/api/sync', { method: 'POST' }).then(readJson).catch(function () { return { ok: false, detail: '网络异常' }; });
      }).then(function (r) {
        btn.disabled = false;
        if (r && r.ok) { dirty = false; setPubBtn(); setStatus('已保存 · 主站更新中'); }
        else setStatus('主站同步失败：' + ((r && r.detail) || '请用工作台「同步到公开站」重试'), true);
      });
      return;
    }
    setStatus('正在发布…');
    saveNow(true).then(function () {
      if (!slug) { btn.disabled = false; setStatus('保存失败，无法发布', true); return; }
      return fetch('/studio/api/notes/' + slug + '/publish', { method: 'POST' }).then(readJson);
    }).then(function (j) {
      if (!j) return; // 保存失败分支已处理
      btn.disabled = false;
      if (j && j.ok) {
        published = true; dirty = false;
        lastPublishedSnapshot = snapshotNow();
        setPubBtn();
        var syncNote = j.sync === 'queued' ? ' · 公开站自动同步中' : '';
        setStatus('已发布 ✓ <a href="' + escHtml(j.public_url || '') + '" target="_blank" rel="noopener">查看 →</a>' + syncNote);
        lsClear();
      } else setStatus('无法发布：' + ((j && j.error) || ''), true);
    }).catch(function () { btn.disabled = false; setStatus('发布失败（网络），请重试', true); });
  });
})();
