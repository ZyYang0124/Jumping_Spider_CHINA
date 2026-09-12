// 分享卡片生成：观察明信片 + 物种身份卡（iOS 视觉：渐变底 + 悬浮圆角卡 + 毛玻璃信息条）。
// 浏览器端 Canvas 原生绘制，零依赖；qrcode-generator 1.4.4（MIT）生成二维码。
(function () {
  var el = document.getElementById('share-data');
  if (!el) return;
  var D;
  try { D = JSON.parse(el.textContent); } catch (e) { return; }

  var INK = '#26221c', PAPER = '#f7f5f0', MUTED = '#6f675c', FAINT = '#988f80', RED = '#b5402c';
  var SERIF = '"Songti SC", "Noto Serif SC", "Source Han Serif SC", "SimSun", Georgia, serif';
  var SANS = '-apple-system, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
  var MARK = null; // 站标画作缓存

  // ---- 弹层样式（自包含注入） ----
  var css = document.createElement('style');
  css.textContent = [
    '.share-modal{position:fixed;inset:0;z-index:300;background:rgba(20,17,12,.68);display:flex;align-items:center;justify-content:center;padding:24px;}',
    '.share-box{background:#fff;border-radius:14px;padding:18px 18px 14px;max-width:min(92vw,1180px);max-height:92vh;overflow:auto;box-shadow:0 18px 60px rgba(0,0,0,.35);}',
    '.share-box img{display:block;max-width:100%;max-height:68vh;width:auto;height:auto;border:1px solid #e4ddcf;}',
    '.share-actions-row{display:flex;gap:10px;justify-content:flex-end;margin-top:14px;}',
    '.share-dl,.share-close{font:inherit;font-size:14px;padding:8px 18px;border-radius:99px;cursor:pointer;}',
    '.share-dl{background:#26221c;color:#f7f5f0;border:none;}',
    '.share-dl:hover{opacity:.85;}',
    '.share-close{background:none;border:none;color:#6f675c;}',
    '.share-close:hover{color:#26221c;}',
    '.share-tip{font-size:12.5px;color:#988f80;margin-right:auto;}'
  ].join('');
  document.head.appendChild(css);

  function loadImg(src) {
    return new Promise(function (res, rej) {
      var img = new Image();
      img.onload = function () { res(img); };
      img.onerror = function () { rej(new Error('图片加载失败')); };
      img.src = src;
    });
  }

  // ---- iOS 基元：圆角路径 / 柔和投影 / 毛玻璃（ctx.filter 不可用时降级为薄纱） ----
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function softShadow(ctx, blur, dy) {
    ctx.shadowColor = 'rgba(38,34,28,0.16)'; ctx.shadowBlur = blur; ctx.shadowOffsetY = dy;
  }
  function clearShadow(ctx) { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }
  function glass(ctx, srcCanvas, x, y, w, h, r, tint) {
    ctx.save();
    rr(ctx, x, y, w, h, r); ctx.clip();
    if (typeof ctx.filter === 'string') {
      ctx.filter = 'blur(26px) saturate(1.15)';
      ctx.drawImage(srcCanvas, x - w * 0.12, y - h * 0.12, w * 1.24, h * 1.24);
      ctx.filter = 'none';
    }
    ctx.fillStyle = tint || 'rgba(251,250,247,0.66)';
    ctx.fillRect(x, y, w, h);
    ctx.restore();
    ctx.save();
    rr(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, Math.max(1, r - 0.75));
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  }
  function iOSBackdrop(ctx, W, H) {
    var g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#f6f3ec'); g.addColorStop(0.55, '#efece2'); g.addColorStop(1, '#e7e6da');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    var spot = ctx.createRadialGradient(W * 0.82, H * 0.1, 0, W * 0.82, H * 0.1, W * 0.5);
    spot.addColorStop(0, 'rgba(255,255,255,0.5)'); spot.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = spot; ctx.fillRect(0, 0, W, H);
  }

  function fitFont(ctx, text, maxW, size, weight) {
    ctx.font = weight + ' ' + size + 'px ' + SERIF;
    while (ctx.measureText(text).width > maxW && size > 20) {
      size -= 2;
      ctx.font = weight + ' ' + size + 'px ' + SERIF;
    }
    return size;
  }
  function wrapText(ctx, text, maxWidth) {
    var lines = [], line = '';
    Array.prototype.slice.call(text).forEach(function (ch) {
      if (ctx.measureText(line + ch).width > maxWidth && line) { lines.push(line); line = ch; }
      else line += ch;
    });
    if (line) lines.push(line);
    return lines;
  }

  function fmtLat(v) { return Math.abs(v).toFixed(5) + '\u00B0 ' + (v >= 0 ? 'N' : 'S'); }
  function fmtLng(v) { return Math.abs(v).toFixed(5) + '\u00B0 ' + (v >= 0 ? 'E' : 'W'); }

  // ---- 二维码（qrcode-generator 1.4.4，MIT） ----
  function pageUrl() { return String(location.href).split('#')[0]; }
  function drawQR(ctx, text, x, y, size, bg) {
    if (typeof qrcode !== 'function') return false;
    var qr;
    try { qr = qrcode(0, 'M'); qr.addData(text); qr.make(); } catch (e) { return false; }
    var n = qr.getModuleCount(), quiet = 4;
    var cell = Math.max(1, Math.floor(size / (n + quiet * 2)));
    var total = cell * (n + quiet * 2);
    var ox = x + Math.floor((size - total) / 2), oy = y + Math.floor((size - total) / 2);
    ctx.fillStyle = bg || PAPER;
    ctx.fillRect(ox - 2, oy - 2, total + 4, total + 4);
    ctx.strokeStyle = 'rgba(38,34,28,0.22)'; ctx.lineWidth = 1;
    ctx.strokeRect(ox - 2.5, oy - 2.5, total + 5, total + 5);
    ctx.fillStyle = INK;
    for (var row = 0; row < n; row++) {
      for (var col = 0; col < n; col++) {
        if (qr.isDark(row, col)) ctx.fillRect(ox + (col + quiet) * cell, oy + (row + quiet) * cell, cell, cell);
      }
    }
    return true;
  }

  // ---------- 明信片（1600×1067）：渐变底 + 悬浮圆角照片卡 + 毛玻璃信息条 ----------
  function drawPostcard(img) {
    var W = 1600, H = 1067;
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var x = c.getContext('2d');
    iOSBackdrop(x, W, H);

    var cx = 44, cy = 44, cw = W - 88, ch = H - 88, cr = 36;
    softShadow(x, 60, 26);
    x.fillStyle = 'rgba(255,255,255,0.9)';
    rr(x, cx, cy, cw, ch, cr); x.fill();
    clearShadow(x);

    var px = cx + 26, py = cy + 26, pw = cw - 52, ph = ch - 52 - 190;
    if (img) {
      var sc = Math.min(pw / img.width, ph / img.height);
      var dw = img.width * sc, dh = img.height * sc;
      x.save();
      rr(x, px, py, pw, ph, 18); x.clip();
      x.fillStyle = '#fdfdfb'; x.fillRect(px, py, pw, ph);
      x.drawImage(img, px + (pw - dw) / 2, py + (ph - dh) / 2, dw, dh);
      x.restore();
      x.strokeStyle = 'rgba(38,34,28,0.1)'; x.lineWidth = 1;
      rr(x, px + 0.5, py + 0.5, pw - 1, ph - 1, 18); x.stroke();
    }

    var gy = py + ph + 16, gh = cy + ch - 26 - gy;
    glass(x, c, px, gy, pw, gh, 16, 'rgba(251,250,247,0.6)');

    var textX = px + 30;
    x.textAlign = 'left';
    x.fillStyle = INK;
    var size = fitFont(x, D.placeLine || D.site, 620, 46, '700');
    x.font = '700 ' + size + 'px ' + SERIF;
    x.fillText(D.placeLine || D.site, textX, gy + 64);
    x.fillStyle = MUTED; x.font = '300 24px ' + SANS;
    x.fillText(D.date || '', textX, gy + 116);
    x.fillStyle = FAINT; x.font = '21px ' + SANS;
    x.fillText('\u00A9 ' + (D.photographer || '') + ' \u00B7 红栏杆跳蛛观察志', textX, gy + 168);
    if (drawQR(x, pageUrl(), px + pw - 128, gy + 20, 118, 'rgba(255,255,255,0.9)')) {
      x.textAlign = 'right'; x.fillStyle = FAINT; x.font = '17px ' + SANS;
      x.fillText('扫码查看本页', px + pw - 64, gy + 164);
    }
    x.textAlign = 'right'; x.fillStyle = FAINT; x.font = '21px ' + SANS;
    x.fillText(D.publicId, px + pw - 150, gy + 96);
    x.fillStyle = RED; x.fillRect(px + pw - 120, gy + 150, 120, 3);
    x.textAlign = 'left';
    return c;
  }

  // ---------- 物种身份卡（1080×1440）：悬浮档案卡 + 毛玻璃信息面板 ----------
  function drawIdCard(img) {
    var W = 1080, H = 1440;
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var x = c.getContext('2d');
    iOSBackdrop(x, W, H);

    var cx = 36, cy = 36, cw = W - 72, ch = H - 72, cr = 32;
    softShadow(x, 56, 24);
    x.fillStyle = 'rgba(255,255,255,0.9)';
    rr(x, cx, cy, cw, ch, cr); x.fill();
    clearShadow(x);

    var px = cx + 24, py = cy + 24, pw = cw - 48, ph = 620;
    if (img) {
      var sc = Math.min(pw / img.width, (ph - 16) / img.height);
      var dw = img.width * sc, dh = img.height * sc;
      x.save();
      rr(x, px, py, pw, ph, 18); x.clip();
      x.fillStyle = '#fdfdfb'; x.fillRect(px, py, pw, ph);
      x.drawImage(img, px + (pw - dw) / 2, py + (ph - dh) / 2, dw, dh);
      x.restore();
      x.strokeStyle = 'rgba(38,34,28,0.1)'; x.lineWidth = 1;
      rr(x, px + 0.5, py + 0.5, pw - 1, ph - 1, 18); x.stroke();
    }

    var gy = py + ph - 40 + 20, gh = cy + ch - 24 - gy;
    glass(x, c, px, gy, pw, gh, 18, 'rgba(251,250,247,0.72)');

    var textX = px + 34, textW = pw - 68;
    x.textAlign = 'left';
    x.fillStyle = INK;
    var nsize = fitFont(x, D.display, textW, 56, '400');
    x.font = (D.rank === 'species' || D.rank === 'subspecies' ? 'italic ' : '') + '400 ' + nsize + 'px ' + SERIF;
    var ty = gy + 66;
    x.fillText(D.display, textX, ty);
    ty += 44;
    x.font = '26px ' + SANS; x.fillStyle = MUTED;
    if (D.encounters) { x.fillText(D.encounters, textX, ty); ty += 40; }
    if (D.regionLine) { x.fillText(D.regionLine, textX, ty); ty += 40; }
    if (D.monthsLine) { x.fillText(D.monthsLine, textX, ty); ty += 40; }
    if (D.sexLine) { x.fillText(D.sexLine, textX, ty); ty += 40; }
    if (D.habitatLine) { x.fillText(D.habitatLine, textX, ty); ty += 40; }
    if (D.speciesNote) {
      x.font = '25px ' + SERIF; x.fillStyle = INK;
      var noteLines = wrapText(x, D.speciesNote, textW).slice(0, 3);
      ty += 10;
      noteLines.forEach(function (ln) { x.fillText(ln, textX, ty); ty += 38; });
      if (D.speciesNote.length > 90) { x.font = '21px ' + SANS; x.fillStyle = FAINT; x.fillText('……完整笔记见物种页', textX, ty); ty += 32; }
    }

    var stripY = gy + gh - 88;
    x.strokeStyle = 'rgba(38,34,28,0.14)'; x.lineWidth = 1;
    x.beginPath(); x.moveTo(textX, stripY); x.lineTo(px + pw - 34, stripY); x.stroke();
    x.font = '22px ' + SANS; x.fillStyle = FAINT;
    x.fillText(D.range || '', textX, stripY + 48);
    if (MARK) {
      var mh = 36, mw = (MARK.width / MARK.height) * mh;
      x.drawImage(MARK, px + pw - 34 - mw, stripY + 16, mw, mh);
      x.textAlign = 'right';
      x.fillStyle = FAINT;
      x.fillText('红栏杆跳蛛观察志', px + pw - 34 - mw - 10, stripY + 48);
    } else {
      x.textAlign = 'right';
      x.fillStyle = FAINT;
      x.fillText('红栏杆跳蛛观察志', px + pw - 34, stripY + 48);
    }
    x.fillStyle = RED; x.fillRect(px + pw - 34 - 110, stripY + 76, 110, 3);
    x.textAlign = 'left';

    if (D.qrUrl) {
      var qy = gy + gh - 228;
      glass(x, c, px + pw - 174, qy, 150, 150, 16, 'rgba(255,255,255,0.82)');
      drawQR(x, location.origin + D.qrUrl, px + pw - 174 + 15, qy + 15, 120, 'rgba(255,255,255,0.85)');
    }
    return c;
  }

  // ---------- 弹层 ----------
  var modal = null;
  function ensureModal() {
    if (modal) return;
    modal = document.createElement('div');
    modal.className = 'share-modal';
    modal.innerHTML =
      '<div class="share-box">' +
      '  <div class="share-preview"></div>' +
      '  <div class="share-actions-row">' +
      '    <span class="share-tip">长按或右键图片也可以保存</span>' +
      '    <button type="button" class="share-dl">下载图片</button>' +
      '    <button type="button" class="share-close">关闭</button>' +
      '  </div>' +
      '</div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function (e) {
      if (e.target === modal || e.target.classList.contains('share-close')) modal.remove();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.body.contains(modal)) modal.remove();
    });
  }

  function openWith(canvas, filename) {
    ensureModal();
    var old = document.querySelector('.share-modal');
    if (old) old.remove();
    document.body.appendChild(modal);
    var preview = modal.querySelector('.share-preview');
    preview.innerHTML = '';
    var url = canvas.toDataURL('image/png');
    var img = document.createElement('img');
    img.src = url;
    img.alt = '分享卡片预览';
    preview.appendChild(img);
    modal.querySelector('.share-dl').onclick = function () {
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    };
  }

  function generate(kind) {
    var btn = document.querySelector('[data-card="' + kind + '"]');
    if (btn) { btn.disabled = true; btn.textContent = '正在生成…'; }
    var finish = function (canvas) {
      if (btn) { btn.disabled = false; btn.textContent = kind === 'postcard' ? '导出明信片' : '物种身份卡'; }
      openWith(canvas, 'SN-' + (D.mediaId || D.publicId) + (kind === 'postcard' ? '-明信片' : '-身份卡') + '.png');
    };
    var fail = function (msg) {
      if (btn) { btn.disabled = false; btn.textContent = kind === 'postcard' ? '导出明信片' : '物种身份卡'; }
      alert(msg || '生成失败，请重试');
    };
    if (!D.mediaUrl) { fail('该观察还没有照片'); return; }
    var markP = MARK
      ? Promise.resolve()
      : loadImg('/logo-mark.png').then(function (m) { MARK = m; }).catch(function () { MARK = null; });
    Promise.all([loadImg(D.mediaUrl), markP]).then(function (res) {
      finish(kind === 'postcard' ? drawPostcard(res[0]) : drawIdCard(res[0]));
    }).catch(function () { fail('照片加载失败，请检查网络'); });
  }

  Array.prototype.slice.call(document.querySelectorAll('[data-card]')).forEach(function (btn) {
    btn.addEventListener('click', function () { generate(btn.getAttribute('data-card')); });
  });
})();
