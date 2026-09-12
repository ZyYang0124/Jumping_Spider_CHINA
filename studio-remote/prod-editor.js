
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
  var boot = window.__EDITOR_BOOT || {};
  function $(s) { return document.querySelector(s); }
  function $all(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }
  var statusEl = $('#save-status'), barStatus = $('#bar-status');
  var publicId = boot.publicId || null;
  var status = boot.status || 'draft'; // draft | published | private | archived（发布=立即公开，§1）
  var LS_KEY = 'sfn-obs-' + (boot.publicId || 'new');
  var saveTimer = null, saving = false, offline = false;
  var saveChain = Promise.resolve(), saveQueued = false;
  var photos = $all('#photo-grid .photo').map(function (n) { return n.getAttribute('data-pid'); });
  // 发布时刻的内容快照：之后的保存若与快照一致，不再提示「主站未同步」
  var lastPublishedSnapshot = null;
  function snapshotNow() {
    var p = fields();
    p.species_taxon_slug = taxonSlug();
    return JSON.stringify(p);
  }
  function isPublished() { return status === 'published'; }

  function readJson(r) {
    return r.text().then(function (t) {
      try { return JSON.parse(t); } catch (e) { return { ok: false, error: '服务异常（' + r.status + '）' }; }
    });
  }
  function setStatus(s, err, isHtml) {
    if (statusEl) { if (isHtml) { statusEl.innerHTML = s; } else { statusEl.textContent = s; } statusEl.className = err ? 'err' : ''; }
    if (barStatus) { if (isHtml) { barStatus.innerHTML = s; } else { barStatus.textContent = s; } barStatus.style.color = err ? 'var(--terra)' : 'var(--faint)'; }
  }
  // 操作区状态机（§3/§6）：draft=[保存草稿][发布]；published=[保存修改][⋯]；
  // private=[保存][发布]；archived=[恢复为草稿][保存]
  function updateActions() {
    var pub = $('#btn-publish'), draft = $('#btn-savedraft'), more = $('#btn-more'), hint = $('#pub-hint');
    if (!pub) return;
    if (status === 'published') {
      pub.textContent = '保存修改'; pub.disabled = false;
      draft.hidden = true; if (more) more.hidden = false;
      if (hint) hint.hidden = true;
    } else if (status === 'private') {
      pub.textContent = '发布'; pub.disabled = false;
      draft.textContent = '保存'; draft.hidden = false;
      if (more) more.hidden = true;
      if (hint) hint.hidden = true;
    } else if (status === 'archived') {
      pub.textContent = '恢复为草稿'; pub.disabled = false;
      draft.textContent = '保存'; draft.hidden = false;
      if (more) more.hidden = true;
      if (hint) hint.hidden = true;
    } else {
      pub.textContent = '发布'; pub.disabled = false;
      draft.textContent = '保存草稿'; draft.hidden = false;
      if (more) more.hidden = true;
      if (hint) hint.hidden = false;
    }
  }
  function postAction(act) {
    var m = $('#status-menu');
    if (m) m.hidden = true;
    return fetch('/studio/api/observations/' + publicId + '/' + act, { method: 'POST' })
      .then(readJson)
      .then(function (j) {
        if (j && j.ok) location.reload();
        else setStatus('操作失败：' + ((j && j.error) || ''), true);
      })
      .catch(function () { setStatus('网络异常，请重试', true); });
  }
  function fields() {
    var o = {};
    $all('[data-field]').forEach(function (el) { o[el.getAttribute('data-field')] = el.value; });
    return o;
  }
  function taxonSlug() {
    var w = window.__chosenSlug;
    return w || '';
  }
  // 发布时刻的字段快照：之后的保存若与快照一致，不再误报「有未发布修改」
  var lastPublishedSnapshot = null;
  function snapshotNow() {
    var p = fields();
    p.species_taxon_slug = taxonSlug();
    return JSON.stringify(p);
  }
  function lsSave() { try { localStorage.setItem(LS_KEY, JSON.stringify(fields())); } catch (e) {} }
  function lsClear() { try { localStorage.removeItem(LS_KEY); } catch (e) {} }

  function create() {
    // 失败必须可见：会话过期/网络错误不能静默成「点了没反应」
    return window.__sfnFetch('/studio/api/observations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    }).then(function (r) {
      return r.json().catch(function () { throw new Error('服务返回异常（' + r.status + '）'); }).then(function (j) {
        if (r.status === 401 || j.error === '未登录') throw new Error('登录已过期，请刷新页面重新登录');
        if (!r.ok || !j.public_id) throw new Error('创建记录失败（' + r.status + (j.error ? '：' + j.error : '') + '）');
        publicId = j.public_id;
        history.replaceState(null, '', '/studio/observations/' + publicId + '/edit');
        $('h1').textContent = publicId;
        return publicId;
      });
    });
  }

  function saveNow(silent, explicit) {
    if (saving) { saveQueued = true; return saveChain; } // 已有保存 in-flight：登记尾随保存，避免发布与保存竞态
    saving = true;
    var ensure = publicId ? Promise.resolve(publicId) : create();
    saveChain = ensure.then(function (pid) {
      if (!pid) { saving = false; return; }
      var payload = fields();
      payload.species_taxon_slug = taxonSlug();
      payload.place_id = placeId;
      if (explicit) payload.explicit = true;
      var snap = JSON.stringify(payload);
      return fetch('/studio/api/observations/' + pid, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
        .then(readJson)
        .then(function (j) {
          if (j.ok) {
            offline = false;
            if (isPublished()) {
              // 已发布记录：内容与主站快照不一致时，提醒点「保存修改」同步主站
              if (snap !== lastPublishedSnapshot) setStatus('已保存 · 主站未同步，点「保存修改」更新');
              else setStatus('已保存 ' + (j.saved_at || ''));
            } else setStatus('已保存 ' + (j.saved_at || ''));
            lsClear();
          } else setStatus('保存失败：' + (j.error || ''), true);
        })
        .catch(function () {
          offline = true;
          setStatus('暂时离线，更改已留在本机，恢复后重试', true);
        });
    }).then(function () {
      saving = false;
      if (saveQueued) { saveQueued = false; return saveNow(silent, explicit); }
    });
    return saveChain;
  }
  function scheduleSave() {
    setStatus('正在保存…');
    lsSave();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { saveNow(true); }, 1200);
  }

  // ---- 启动填充 ----
  var d = boot.data || {};
  $all('[data-field]').forEach(function (el) {
    var k = el.getAttribute('data-field');
    var v = d[k];
    if (el.tagName === 'SELECT') { if (v) el.value = v; }
    else if (v !== null && v !== undefined && v !== '') el.value = v;
  });
  if (!boot.publicId && !$('[data-field="observed_at"]').value) {
    $('[data-field="observed_at"]').value = new Date().toISOString().slice(0, 10);
  }
  // 国家不预填：由地图选点/EXIF 的逆地理编码按坐标填写（避免非中国记录被静默标成中国）
  window.__chosenSlug = d.species_taxon_slug || '';
  // renderChosen 延迟到物种选择器变量初始化之后调用（见下方 spInput 声明后）
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
  updateActions();
  $all('[data-field]').forEach(function (el) { el.addEventListener('input', scheduleSave); });

  // ---- 物种选择器 ----
  var spInput = $('#species-search'), pop = $('#species-pop'), wrap = $('#species-wrap');
  renderChosen();
  function fmtName(t) {
    return t.cn ? '<span class="cn">' + escHtml(t.cn) + '</span><span class="sn">' + escHtml(t.name) + (t.rank !== 'species' && t.rank !== 'subspecies' ? ' sp.' : '') + '</span>'
                : '<span class="cn" style="font-style:italic">' + escHtml(t.name) + '</span>';
  }
  function escHtml(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function searchTaxa(q) {
    q = q.trim().toLowerCase();
    var list = boot.taxa || [];
    if (!q) return list.slice(0, 8);
    return list.filter(function (t) {
      return t.name.toLowerCase().indexOf(q) !== -1
        || (t.cn && t.cn.toLowerCase().indexOf(q) !== -1)
        || t.slug.indexOf(q) !== -1
        || t.name.toLowerCase().split(' ')[0].indexOf(q) !== -1;
    }).slice(0, 8);
  }
  function renderChosen() {
    var slug = window.__chosenSlug;
    var t = (boot.taxa || []).filter(function (x) { return x.slug === slug; })[0];
    var host = $('.species-wrap');
    var old = host.querySelector('.chosen-taxa');
    if (old) old.remove();
    if (t) {
      var div = document.createElement('div');
      div.className = 'chosen-taxa';
      div.innerHTML = '<span class="cn">' + escHtml(t.cn || (t.working ? '工作编号' : '')) + '</span><span class="sn">' + escHtml(t.name) + '</span><button type="button" id="sp-clear">更改</button>';
      host.insertBefore(div, spInput);
      spInput.style.display = 'none';
      div.querySelector('#sp-clear').addEventListener('click', function () {
        window.__chosenSlug = '';
        div.remove();
        spInput.style.display = '';
        spInput.value = '';
        spInput.focus();
        scheduleSave();
      });
    } else {
      spInput.style.display = '';
    }
  }
  function openPop(q) {
    q = (q || '').trim();
    var list = searchTaxa(q);
    var qLower = q.toLowerCase();
    var exact = q && list.some(function (t) { return t.name.toLowerCase() === qLower; });
    // 与正式类群重名的输入不提供建立入口（服务端也会拒绝）；形如学名的输入才提示
    // 模板字符串里正则不能写 -（转义被吃掉形成非法区间，整个脚本解析失败）；连字符放类尾
    var nameLike = /^[A-Za-z][A-Za-z. -]{1,79}$/.test(q);
    var createOpt = q && nameLike && !exact
      ? '<div class="opt place-new" data-new-taxon="1">＋ 建立工作编号「' + escHtml(q) + '」</div>'
      : '';
    if (!list.length && !createOpt) { pop.innerHTML = '<div class="none">没有匹配的物种——留空即记为未鉴定</div>'; }
    else pop.innerHTML = list.map(function (t, i) { return '<div class="opt" data-slug="' + escHtml(t.slug) + '">' + fmtName(t) + '</div>'; }).join('') + createOpt;
    pop.classList.add('open');
    Array.prototype.slice.call(pop.querySelectorAll('.opt[data-slug]')).forEach(function (el) {
      el.addEventListener('mousedown', function (e) {
        e.preventDefault();
        window.__chosenSlug = el.getAttribute('data-slug');
        pop.classList.remove('open');
        spInput.value = '';
        renderChosen();
        scheduleSave();
      });
    });
    Array.prototype.slice.call(pop.querySelectorAll('[data-new-taxon]')).forEach(function (el) {
      el.addEventListener('mousedown', function (e) {
        e.preventDefault();
        var name = spInput.value.trim();
        if (!name) return;
        setStatus('正在建立工作编号…');
        fetch('/studio/api/taxa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ name: name })
        }).then(readJson).then(function (j) {
          if (!j || !j.ok) { setStatus((j && j.error) || '无法建立工作编号', true); return; }
          if (!boot.taxa.some(function (t) { return t.slug === j.taxon.slug; })) boot.taxa.push(j.taxon);
          window.__chosenSlug = j.taxon.slug;
          pop.classList.remove('open');
          spInput.value = '';
          renderChosen();
          setStatus(j.created ? '已建立工作编号「' + j.taxon.name + '」——存疑鉴定同样有效，随时可改为正式类群' : '已选择既有工作编号');
          scheduleSave();
        }).catch(function () { setStatus('无法建立工作编号（网络错误）', true); });
      });
    });
  }
  spInput.addEventListener('focus', function () { openPop(spInput.value); });
  spInput.addEventListener('input', function () { openPop(spInput.value); });
  spInput.addEventListener('blur', function () { setTimeout(function () { pop.classList.remove('open'); }, 150); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') pop.classList.remove('open'); });

  // ---- 坐标：粘贴自动解析 + 地图 ----
  var latEl = $('[data-field="latitude"]'), lngEl = $('[data-field="longitude"]');
  // ---- 地点 ComboBox（§16-§18）：搜索已有 → 选中挂接；或直接填下方信息新建 ----
  var placeId = boot.placeId || null;
  var placeSearch = $('#place-search'), placePop = $('#place-pop');
  function placeHintText() {
    return placeId ? '已挂接地点，发布后归入该地点' : '未选择地点——下方手工填写的信息会在保存时自动创建地点';
  }
  function refreshPlaceHint() {
    var el = $('#place-hint');
    if (el) el.textContent = placeHintText();
  }
  function fillPlaceFields(p) {
    if (!p) return;
    var set = function (k, v) { var el = document.querySelector('[data-field="' + k + '"]'); if (el && v != null) el.value = v; };
    set('country_name', p.country);
    set('admin1', p.admin1); set('admin2', p.admin2);
    set('locality', p.locality); set('site_name', p.site_name);
    if (p.latitude != null) { latEl.value = p.latitude; }
    if (p.longitude != null) { lngEl.value = p.longitude; }
    scheduleSave();
  }
  function renderPlacePop(list) {
    if (!placePop) return;
    placePop.innerHTML = list.length
      ? list.map(function (p) {
          var sub = [p.admin1, p.admin2, p.locality].filter(Boolean).join(' · ');
          return '<div class="opt place-opt" data-pid="' + p.id + '"><span class="cn">' + escHtml(p.name) + '</span>' +
            (sub ? '<span class="sn">' + escHtml(sub) + '</span>' : '') + '</div>';
        }).join('') + (placeSearch.value.trim() ? '<div class="opt place-new" data-new="1">＋ 新建地点「' + escHtml(placeSearch.value.trim()) + '」</div>' : '')
      : (placeSearch.value.trim() ? '<div class="opt place-new" data-new="1">＋ 新建地点「' + escHtml(placeSearch.value.trim()) + '」</div>' : '');
    placePop.classList.add('open');
    Array.prototype.slice.call(placePop.querySelectorAll('.place-opt')).forEach(function (el) {
      el.addEventListener('mousedown', function (e) {
        e.preventDefault();
        placeId = Number(el.getAttribute('data-pid'));
        var p = list.filter(function (x) { return x.id === placeId; })[0];
        if (p) fillPlaceFields(p);
        placeSearch.value = p ? p.name : '';
        placePop.classList.remove('open');
        refreshPlaceHint();
        scheduleSave();
      });
    });
    Array.prototype.slice.call(placePop.querySelectorAll('.place-new')).forEach(function (el) {
      el.addEventListener('mousedown', function (e) {
        e.preventDefault();
        placeId = null;
        placePop.classList.remove('open');
        refreshPlaceHint();
        document.querySelector('[data-field="locality"]').focus();
      });
    });
  }
  if (placeSearch) {
    var placeTimer = null;
    placeSearch.addEventListener('input', function () {
      placeId = null; // 手动改动即视为未挂接，保存时按下方信息自动建点
      refreshPlaceHint();
      clearTimeout(placeTimer);
      placeTimer = setTimeout(function () {
        var q = placeSearch.value.trim();
        if (!q) { placePop.classList.remove('open'); return; }
        fetch('/studio/api/places?q=' + encodeURIComponent(q)).then(readJson).then(function (j) {
          if (j && j.ok) renderPlacePop(j.places || []);
        }).catch(function () {});
      }, 250);
    });
    placeSearch.addEventListener('blur', function () { setTimeout(function () { placePop.classList.remove('open'); }, 180); });
    refreshPlaceHint();
  }
  // 半球字母跟随输入符号：北纬 N/南纬 S，东经 E/西经 W
  function updateHemi() {
    var lh = $('#lat-hemi'), lh2 = $('#lng-hemi');
    if (lh) lh.textContent = parseFloat(latEl.value) < 0 ? 'S' : 'N';
    if (lh2) lh2.textContent = parseFloat(lngEl.value) < 0 ? 'W' : 'E';
  }
  [latEl, lngEl].forEach(function (el) {
    el.addEventListener('input', updateHemi);
    el.addEventListener('change', updateHemi);
  });
  updateHemi();

  // ---- 未来日期提示（§11）：非阻塞，仅提醒；记录仍会照常保存 ----
  var dateEl = $('[data-field="observed_at"]');
  function updateDateWarn() {
    if (!dateEl) return;
    var v = String(dateEl.value || '');
    var now = new Date();
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    var todayStr = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
    var bad = v && v > todayStr;
    var w = $('#date-warn');
    if (!w) {
      w = document.createElement('div');
      w.id = 'date-warn';
      w.style.cssText = 'color:#b3541e;font-size:12px;margin-top:4px;letter-spacing:.02em;';
      dateEl.parentNode.insertBefore(w, dateEl.nextSibling);
    }
    w.textContent = bad ? '观察日期在未来——记录仍会保存，请确认日期是否输入有误' : '';
  }
  if (dateEl) {
    dateEl.addEventListener('input', updateDateWarn);
    dateEl.addEventListener('change', updateDateWarn);
  }
  updateDateWarn();

  function tryParsePair(text) {
    var m = String(text).match(/(-?\d+(?:\.\d+)?)\s*[,，\s]\s*(-?\d+(?:\.\d+)?)/);
    if (!m) return false;
    var a = parseFloat(m[1]), b = parseFloat(m[2]);
    if (Math.abs(a) > 90 || Math.abs(b) > 180) return false;
    latEl.value = a; lngEl.value = b;
    scheduleSave();
    return true;
  }
  [latEl, lngEl].forEach(function (el) {
    el.addEventListener('paste', function (e) {
      var text = (e.clipboardData || window.clipboardData).getData('text') || '';
      if (tryParsePair(text)) e.preventDefault();
    });
  });
  var mapBox = $('#map-box'), mapLoaded = false, mapObj = null, marker = null;

  // ---- 地址逆匹配：选点后自动填写空缺的地点信息（OSM Nominatim；地图瓦片同为 OSM 服务） ----
  var geoTimer = null;
  function matchAddress(lat, lng) {
    clearTimeout(geoTimer);
    geoTimer = setTimeout(function () {
      var hint = document.querySelector('#map-box .map-hint');
      if (hint) hint.textContent = '正在识别地址…';
      var url = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&addressdetails=1&accept-language=zh-CN&lat=' + lat + '&lon=' + lng;
      window.__sfnFetch(url, {}, 15000).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
        var a = j && j.address;
        if (!a) { if (hint) hint.textContent = '未能识别地址——可手动填写'; return; }
        // 只填空字段：手工填过的内容绝不覆盖（与 EXIF 坐标同一策略）
        var picks = [
          ['country_name', a.country || a.country_name],
          ['admin1', a.state || a.province || a.region],
          ['admin2', a.county || a.district || a.city_district],
          ['locality', a.city || a.town || a.village || a.municipality],
        ];
        var filled = [];
        picks.forEach(function (kv) {
          if (!kv[1]) return;
          var el = document.querySelector('[data-field="' + kv[0] + '"]');
          if (el && !el.value) { el.value = kv[1]; filled.push(kv[1]); }
        });
        if (filled.length) {
          scheduleSave();
          if (hint) hint.textContent = '已按坐标填入：' + filled.join(' · ') + '（仅空缺字段，可修改）';
        } else if (hint) {
          hint.textContent = '已识别：' + [a.country, a.state, a.county || a.city].filter(Boolean).join(' · ') + '（地点信息已填写，未改动）';
        }
      }).catch(function () { if (hint) hint.textContent = '地址识别失败（网络）——可手动填写'; });
    }, 700); // 防抖：拖动/连续点击时只在停下后请求一次（Nominatim 限速 1 次/秒）
  }

  $('#btn-map').addEventListener('click', function () {
    if (!mapBox.hidden) { mapBox.hidden = true; return; }
    mapBox.hidden = false;
    if (mapLoaded) { setTimeout(function () { if (mapObj) mapObj.invalidateSize(); }, 60); return; }
    mapBox.className = 'loading';
    mapBox.textContent = '地图加载中…';
    var css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);
    var js = document.createElement('script');
    js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    js.onload = function () {
      mapLoaded = true;
      mapBox.className = '';
      mapBox.innerHTML = '<div class="map-inner" id="map-inner"></div><div class="map-hint">点击或拖动标记调整坐标（WGS84）</div>';
      var lat = parseFloat(latEl.value) || 30.0, lng = parseFloat(lngEl.value) || 105.0;
      mapObj = L.map('map-inner', { zoomControl: false }).setView([lat, lng], latEl.value ? 13 : 4);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(mapObj);
      marker = L.marker([lat, lng], { draggable: true }).addTo(mapObj);
      function apply() {
        var p = marker.getLatLng();
        latEl.value = Math.round(p.lat * 1e6) / 1e6;
        lngEl.value = Math.round(p.lng * 1e6) / 1e6;
        scheduleSave();
        matchAddress(latEl.value, lngEl.value);
      }
      marker.on('dragend', apply);
      mapObj.on('click', function (e) { marker.setLatLng(e.latlng); apply(); });
    };
    document.head.appendChild(js);
  });

  // ---- 照片：选择 / 上传 / 面板 / 排序 ----
  var grid = $('#photo-grid'), dropBig = $('#drop-big'), addBtn = $('#photo-add');
  var camInput = $('#photo-camera'), libInput = $('#photo-library');
  var photoErr = $('#photo-err'), panel = $('#photo-panel');
  function pickInput() { return libInput; }
  function openPicker() { libInput.click(); }
  dropBig.addEventListener('click', openPicker);
  addBtn.addEventListener('click', openPicker);
  dropBig.addEventListener('dragover', function (e) { e.preventDefault(); });
  dropBig.addEventListener('drop', function (e) { e.preventDefault(); handleFiles(e.dataTransfer.files); });
  libInput.addEventListener('change', function () { handleFiles(libInput.files); libInput.value = ''; });
  camInput.addEventListener('change', function () { handleFiles(camInput.files); camInput.value = ''; });

  function showPhotoErr(m) { photoErr.textContent = m; photoErr.classList.add('show'); }
  function clearPhotoErr() { photoErr.classList.remove('show'); }

  function thumbOf(pid) { return '/media/derivatives/' + pid + '-480.jpg'; }
  function rerenderGrid() {
    grid.innerHTML = photos.map(function (pid, i) {
      var cover = i === 0;
      return '<div class="photo' + (cover ? ' cover' : '') + '" data-pid="' + pid + '">' +
        '<img src="' + thumbOf(pid) + '" alt="" /><span class="badge">' + (cover ? '★' : (i + 1)) + '</span></div>';
    }).join('') ;
    addBtn.hidden = false;
    dropBig.hidden = photos.length > 0;
    bindGrid();
  }
  function bindGrid() {
    $all('#photo-grid .photo').forEach(function (n) {
      n.setAttribute('draggable', 'true');
      n.addEventListener('click', function () { openPanel(n.getAttribute('data-pid')); });
      n.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/plain', n.getAttribute('data-pid')); });
      n.addEventListener('dragover', function (e) { e.preventDefault(); });
      n.addEventListener('drop', function (e) {
        e.preventDefault();
        var dragPid = e.dataTransfer.getData('text/plain');
        var pid = n.getAttribute('data-pid');
        if (!dragPid || dragPid === pid || !publicId) return;
        var rest = photos.filter(function (x) { return x !== dragPid; });
        var idx = rest.indexOf(pid);
        photos = rest.slice(0, idx).concat([dragPid], rest.slice(idx));
        rerenderGrid();
        pushOrder();
      });
    });
  }
  function pushOrder() {
    if (!publicId) return;
    lastPublishedSnapshot = null; // 照片顺序变化视为发布后修改
    return fetch('/studio/api/observations/' + publicId + '/photos/order', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order: photos }),
    });
  }
  var panelPid = null;
  function openPanel(pid) {
    panelPid = pid;
    var idx = photos.indexOf(pid);
    panel.hidden = false;
    panel.innerHTML =
      '<div class="pp-head"><img src="' + thumbOf(pid) + '" alt="" /><b>' + escHtml(pid) + '</b></div>' +
      '<div class="field"><label>图注</label><input id="pp-caption" placeholder="这张照片在说什么" /></div>' +
      '<div class="field"><label>摄影者</label><input id="pp-photographer" placeholder="默认为记录人" /></div>' +
      '<div class="pp-actions">' +
      '<button type="button" class="ghost" id="pp-cover">' + (idx === 0 ? '★ 已是封面' : '设为封面') + '</button>' +
      '<button type="button" class="ghost" id="pp-del">删除</button>' +
      '<button type="button" class="ghost" id="pp-close">收起</button></div>';
    var cap = panel.querySelector('#pp-caption'), ph = panel.querySelector('#pp-photographer');
    cap.value = window.__photoMeta[pid] ? (window.__photoMeta[pid].caption || '') : '';
    ph.value = window.__photoMeta[pid] ? (window.__photoMeta[pid].photographer_name || '') : '';
    cap.addEventListener('change', function () { patchMedia(pid, { caption: cap.value }); });
    ph.addEventListener('change', function () { patchMedia(pid, { photographer_name: ph.value }); });
    panel.querySelector('#pp-cover').addEventListener('click', function () {
      var rest = photos.filter(function (x) { return x !== pid; });
      photos = [pid].concat(rest);
      rerenderGrid();
      pushOrder();
      openPanel(pid);
    });
    panel.querySelector('#pp-del').addEventListener('click', function () {
      fetch('/studio/api/media/' + pid, { method: 'DELETE' }).then(function (r) {
        if (r.ok) {
          photos = photos.filter(function (x) { return x !== pid; });
          delete window.__photoMeta[pid];
          lastPublishedSnapshot = null; // 删照片视为发布后修改
          rerenderGrid();
          panel.hidden = true;
          setStatus('已删除 ' + pid);
        }
      });
    });
    panel.querySelector('#pp-close').addEventListener('click', function () { panel.hidden = true; });
  }
  function patchMedia(pid, body) {
    return fetch('/studio/api/media/' + pid, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).then(function (r) { if (r.ok) setStatus('已保存'); });
  }
  window.__photoMeta = {};
  // 从服务端渲染的缩略图初始化元信息（boot 注入）
  (boot.photoMeta || []).forEach(function (m) { window.__photoMeta[m.public_id] = m; });
  if (photos.length) bindGrid();

  function handleFiles(fileList) {
    var all = Array.prototype.slice.call(fileList || []);
    var files = all.filter(function (f) { return /image\/(jpeg|png)/.test(f.type); });
    // 被类型过滤掉的照片必须可见（iPhone HEIC 默认不被接受——这就是「点了没反应」的常见来源）
    if (all.length && !files.length) {
      showPhotoErr('所选照片都不是 JPG/PNG（iPhone 相机默认 HEIC 不受支持，可在相机设置改为「兼容性最佳」）。');
      return;
    }
    if (!files.length) return;
    clearPhotoErr();
    if (addBtn) addBtn.disabled = true;
    dropBig.style.pointerEvents = 'none';
    var ensure = publicId ? Promise.resolve(publicId) : create();
    ensure.then(function (pid) {
      if (!pid) { setStatus('创建记录失败', true); return; }
      var first = files[0];
      var fd0 = new FormData();
      fd0.append('photo', first);
      setStatus('读取照片信息…');
      return window.__sfnFetch('/studio/api/exif-preview', { method: 'POST', body: fd0 }, 30000)
        .then(function (r) { return r.ok ? r.json() : {}; })
        .then(function (xj) {
          var x = xj.results && xj.results[0];
          if (x) {
            var dateEl = document.querySelector('[data-field="observed_at"]');
            if (x.date && dateEl && !dateEl.dataset.touched) { dateEl.value = x.date; scheduleSave(); }
            if (x.gps) {
              var la = latEl, lo = lngEl;
              if (!la.value) { la.value = x.gps.lat; scheduleSave(); }
              if (!lo.value) { lo.value = x.gps.lng; scheduleSave(); }
              if (x.gps.lat != null && x.gps.lng != null) matchAddress(x.gps.lat, x.gps.lng);
            }
            var cam = $('#exif-cam');
            if (cam && x.camera) cam.textContent = '相机：' + x.camera;
          }
        })
        .catch(function () {})
        .then(async function () {
          var added = [], failed = 0;
          for (var i = 0; i < files.length; i++) {
            var prepared;
            try { prepared = await window.__sfnPrepareUpload(files[i]); }
            catch (err) { showPhotoErr(err.message || '图片处理失败'); failed++; continue; }
            var fd = new FormData();
            window.__sfnAppendUpload(fd, prepared);
            setStatus('上传照片 ' + (i + 1) + '/' + files.length + '…');
            try {
              var r = await window.__sfnFetch('/studio/observations/' + pid + '/photos', { method: 'POST', body: fd });
              var j = await r.json().catch(function () { return {}; });
              if (r.status === 401) { showPhotoErr('登录已过期，请刷新页面重新登录'); failed++; break; }
              if (!r.ok || !j.ok) { showPhotoErr('照片上传失败：' + ((j && j.error) || '请重试')); failed++; continue; }
              (j.added || []).forEach(function (pid2) {
                added.push(pid2);
                photos.push(pid2);
                window.__photoMeta[pid2] = { caption: '', photographer_name: '' };
                rerenderGrid();
              });
            } catch (e2) {
              showPhotoErr(e2 && e2.name === 'AbortError' ? '上传超时，请检查网络后重试' : '上传失败，请检查网络后重试');
              failed++;
            }
          }
          if (added.length) {
            lastPublishedSnapshot = null; // 新照片视为发布后修改
            lsClear();
            setStatus('已添加 ' + added.length + ' 张照片' + (failed ? '，' + failed + ' 张失败' : ''));
            await saveNow(true);
          } else if (!failed) {
            setStatus('没有照片被添加', true);
          }
        });
    }).catch(function (e) {
      showPhotoErr(e && e.message ? e.message : '上传未能开始，请重试');
    }).finally(function () {
      if (addBtn) addBtn.disabled = false;
      dropBig.style.pointerEvents = '';
    });
  }
  [$('[data-field="observed_at"]')].forEach(function (el) {
    el.addEventListener('input', function () { el.dataset.touched = '1'; });
  });

  // ---- 发布 / 保存 / 快捷键（发布 = 立即公开上线） ----
  $('#btn-savedraft').addEventListener('click', function () {
    // published：仅保存内容并同步主站；private/archived：保存但保持不公开
    saveNow(true, isPublished()).then(function () {
      if (isPublished() && !offline) return fetch('/studio/api/sync', { method: 'POST' }).then(readJson).then(function (j) {
        if (j && j.ok) setStatus('已保存 · 主站已更新');
        return null;
      }).catch(function () { return null; });
      return null;
    }).then(function () { location.href = '/studio'; });
  });
  $('#btn-publish').addEventListener('click', function () {
    var btn = $('#btn-publish');
    btn.disabled = true;
    // 已归档：恢复为草稿（§20，不直接公开）
    if (status === 'archived') {
      postAction('restore').then(function () { updateActions(); });
      return;
    }
    var publishing = status !== 'published'; // draft/private → 发布上线；published → 保存修改
    setStatus(publishing ? '正在检查…（含 WSC 学名校验）' : '正在保存…');
    saveNow(true, !publishing).then(function () {
      if (!publicId) { btn.disabled = false; setStatus('保存失败，无法发布', true); return; }
      if (publishing) {
        return fetch('/studio/api/observations/' + publicId + '/publish', { method: 'POST' }).then(readJson).then(function (j) {
          if (j && j.ok && j.warnings && j.warnings.length) {
            // WSC 建议（不阻塞发布）：醒目展示
            setStatus(j.warnings[0], true);
            if (j.warnings.length > 1) alert(j.warnings.join('
'));
          }
          return j;
        });
      }
      // 保存修改：显式保存已在 PATCH 中带 explicit，服务端负责审计与同步
      return fetch('/studio/api/observations/' + publicId, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ explicit: true }),
      }).then(readJson).then(function (j) {
        btn.disabled = false;
        if (j && j.ok && j.sync === 'queued') setStatus('已保存 · 主站更新中');
        else if (j && j.ok) setStatus('已保存 ' + (j.saved_at || ''));
        else setStatus('保存失败：' + ((j && j.error) || ''), true);
        updateActions();
        return null;
      });
    }).then(function (j) {
      if (!j) return; // 保存失败/保存修改分支已处理
      btn.disabled = false;
      if (j && j.ok) {
        status = 'published';
        lastPublishedSnapshot = snapshotNow();
        updateActions();
        var syncNote = j.sync === 'queued' ? ' · 公开站自动同步中' : '';
        setStatus('已发布 ✓ <a href="' + escHtml(j.public_url || '') + '" target="_blank" rel="noopener">查看公开页面 →</a>' + syncNote, false, true);
        lsClear();
      } else {
        setStatus('无法发布：' + ((j && j.error) || '请检查照片、时间与坐标'), true);
      }
    }).catch(function () {
      btn.disabled = false;
      setStatus('发布失败（网络），请重试', true);
    });
  });
  // 次级菜单：设为私密 / 归档（仅 published 出现 ⋯）
  var moreBtn = $('#btn-more'), menu = $('#status-menu');
  if (moreBtn && menu) {
    moreBtn.addEventListener('click', function () { menu.hidden = !menu.hidden; });
    document.addEventListener('click', function (e) {
      if (!menu.hidden && !menu.contains(e.target) && e.target !== moreBtn) menu.hidden = true;
    });
    Array.prototype.slice.call(menu.querySelectorAll('button')).forEach(function (b) {
      b.addEventListener('click', function () { b.disabled = true; postAction(b.getAttribute('data-act')); });
    });
  }
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') $('#btn-publish').click();
  });
})();
