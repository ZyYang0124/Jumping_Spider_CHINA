// 分享卡片生成（§分享传播）：观察明信片 + 物种身份卡。
// 浏览器端 Canvas 原生绘制，零依赖；同源图片不污染画布。
(function () {
  var el = document.getElementById('share-data');
  if (!el) return;
  var D;
  try { D = JSON.parse(el.textContent); } catch (e) { return; }

  var INK = '#26221c', PAPER = '#f7f5f0', MUTED = '#6f675c', FAINT = '#988f80', RED = '#b5402c';
  var SERIF = '"Songti SC", "Noto Serif SC", "Source Han Serif SC", "SimSun", Georgia, serif';
  var SANS = '-apple-system, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';

  // 弹层样式（自包含注入）
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

  var MARK = null; // 站标画作（加载失败则降级为纯排版）

  function loadImg(src) {
    return new Promise(function (res, rej) {
      var img = new Image();
      img.onload = function () { res(img); };
      img.onerror = function () { rej(new Error('图片加载失败')); };
      img.src = src;
    });
  }

  // contain 完整绘制：等比缩放整张照片放进目标框，居中，四周露出纸色底（不裁切、不变形）
  function containDraw(ctx, img, x, y, w, h) {
    var s = Math.min(w / img.width, h / img.height);
    var dw = img.width * s, dh = img.height * s;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }

  function fitFont(ctx, text, maxW, size, weight) {
    ctx.font = weight + ' ' + size + 'px ' + SERIF;
    while (ctx.measureText(text).width > maxW && size > 20) {
      size -= 2;
      ctx.font = weight + ' ' + size + 'px ' + SERIF;
    }
    return size;
  }

  function fmtLat(v) { return Math.abs(v).toFixed(5) + '° ' + (v >= 0 ? 'N' : 'S'); }
  function fmtLng(v) { return Math.abs(v).toFixed(5) + '° ' + (v >= 0 ? 'E' : 'W'); }

  // ---------- 二维码（qrcode-generator 1.4.4，MIT）：扫码直达观察页 ----------
  function pageUrl() {
    return String(location.href).split('#')[0];
  }
  function drawQR(ctx, text, x, y, size) {
    if (typeof qrcode !== 'function') return false;
    var qr;
    try { qr = qrcode(0, 'M'); qr.addData(text); qr.make(); } catch (e) { return false; }
    var n = qr.getModuleCount(), quiet = 4;
    var cell = Math.max(1, Math.floor(size / (n + quiet * 2)));
    var total = cell * (n + quiet * 2);
    var ox = x + Math.floor((size - total) / 2), oy = y + Math.floor((size - total) / 2);
    ctx.fillStyle = PAPER; // 静区：纸色与墨色的对比度足够扫描，且与卡片融为一体
    ctx.fillRect(ox - 2, oy - 2, total + 4, total + 4);
    ctx.strokeStyle = 'rgba(38,34,28,0.22)'; ctx.lineWidth = 1;
    ctx.strokeRect(ox - 2.5, oy - 2.5, total + 5, total + 5);
    ctx.fillStyle = INK;
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (qr.isDark(r, c)) ctx.fillRect(ox + (c + quiet) * cell, oy + (r + quiet) * cell, cell, cell);
      }
    }
    return true;
  }

  // ---------- 明信片（1600×1067，横 3:2）—— Editorial 版式：照片 + 纸面页脚 ----------
  function drawPostcard(img) {
    var W = 1600, H = 1067;
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var x = c.getContext('2d');
    x.fillStyle = PAPER; x.fillRect(0, 0, W, H);
    // 照片区：contain 完整构图（白底棚拍与纸面自然融合）
    var photoH = 780, margin = 60;
    if (img) {
      var s = Math.min((W - margin * 2) / img.width, (photoH - 24) / img.height);
      var dw = img.width * s, dh = img.height * s;
      x.drawImage(img, (W - dw) / 2, (photoH - dh) / 2, dw, dh);
    }
    // 页脚分隔细线
    x.strokeStyle = 'rgba(38,34,28,0.14)'; x.lineWidth = 1;
    x.beginPath(); x.moveTo(margin, photoH + 28); x.lineTo(W - margin, photoH + 28); x.stroke();
    // 左：地点 + 日期
    x.textAlign = 'left';
    x.fillStyle = INK;
    var size = fitFont(x, D.placeLine || D.site, 760, 46, '700');
    x.font = '700 ' + size + 'px ' + SERIF;
    x.fillText(D.placeLine || D.site, margin, photoH + 106);
    x.fillStyle = MUTED; x.font = '300 24px ' + SANS;
    x.fillText(D.date || '', margin, photoH + 158);
    // 右：编号 + 二维码 + 红栏杆线
    x.fillStyle = FAINT; x.font = '22px ' + SANS;
    x.textAlign = 'right';
    x.fillText(D.mediaId || D.publicId, W - margin - 190, photoH + 106);
    if (drawQR(x, pageUrl(), W - margin - 170, photoH + 40, 130)) {
      x.textAlign = 'right'; x.fillStyle = FAINT; x.font = '18px ' + SANS;
      x.fillText('扫码查看本页', W - margin - 105, photoH + 196);
    }
    x.fillStyle = RED; x.fillRect(W - margin - 34, photoH + 148, 34, 2);
    if (MARK) {
      x.font = '22px ' + SANS;
      var idw = x.measureText(String(D.mediaId || D.publicId)).width;
      var mh = 72, mw = (MARK.width / MARK.height) * mh;
      x.drawImage(MARK, W - margin - 190 - idw - 28 - mw, photoH + 76, mw, mh);
    }
    x.textAlign = 'left';
    // 底缘署名
    x.fillStyle = FAINT; x.font = '20px ' + SANS;
    x.fillText('© ' + (D.photographer || '') + ' · 红栏杆跳蛛观察志', margin, H - 36);
    return c;
  }

  // ---------- 物种身份卡（1080×1440，竖 3:4）—— Archive 收藏卡版式 ----------
  function drawIdCard(img) {
    var W = 1080, H = 1440, margin = 64;
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var x = c.getContext('2d');
    x.fillStyle = PAPER; x.fillRect(0, 0, W, H);
    // 外框：1px 暖灰档案卡边
    x.strokeStyle = 'rgba(38,34,28,0.28)'; x.lineWidth = 2;
    x.strokeRect(28, 28, W - 56, H - 56);
    // 照片区（上 55%，contain 完整构图）
    var photoH = 700;
    if (img) {
      var s2 = Math.min((W - margin * 2) / img.width, (photoH - 20) / img.height);
      var dw2 = img.width * s2, dh2 = img.height * s2;
      x.drawImage(img, (W - dw2) / 2, 28 + 20 + (photoH - 20 - dh2) / 2, dw2, dh2);
    }
    var top = 28 + photoH + 36;
    // 学名（第一层级，serif italic 400）
    x.textAlign = 'left';
    x.fillStyle = INK;
    var nsize = fitFont(x, D.display, W - margin * 2, 58, '400');
    x.font = (D.rank === 'species' || D.rank === 'subspecies' ? 'italic ' : '') + '400 ' + nsize + 'px ' + SERIF;
    x.fillText(D.display, margin, top + 40);
    var y = top + 100;
    // 事实行：相遇次数 / 地区 / 性别
    x.font = '26px ' + SANS; x.fillStyle = MUTED;
    if (D.encounters) { x.fillText(D.encounters, margin, y); y += 44; }
    if (D.regionLine) { x.fillText(D.regionLine, margin, y); y += 44; }
    if (D.sexLine) { x.fillText(D.sexLine, margin, y); y += 44; }
    // 档案栏：年份区间 · 品牌 + 红栏杆线
    var stripY = H - margin - 96;
    x.strokeStyle = 'rgba(38,34,28,0.14)'; x.lineWidth = 1;
    x.beginPath(); x.moveTo(margin, stripY); x.lineTo(W - margin, stripY); x.stroke();
    x.font = '22px ' + SANS; x.fillStyle = FAINT;
    x.fillText(D.range || '', margin, stripY + 52);
    x.textAlign = 'right';
    x.fillText('红栏杆跳蛛观察志', W - margin, stripY + 52);
    if (MARK) {
      var brandW = x.measureText('红栏杆跳蛛观察志').width;
      var mh2 = 38, mw2 = (MARK.width / MARK.height) * mh2;
      x.drawImage(MARK, W - margin - brandW - 16 - mw2, stripY + 18, mw2, mh2);
    }
    x.fillStyle = RED; x.fillRect(W - margin - 120, stripY + 84, 120, 3);
    // 二维码：右上角纸贴片（扫码到物种页）
    if (D.qrUrl) drawQR(x, location.origin + D.qrUrl, W - margin - 140, 60, 140);
    x.textAlign = 'left';
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
