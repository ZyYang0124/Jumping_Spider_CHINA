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

  // ---------- 明信片（1600×1067，横 3:2） ----------
  function drawPostcard(img) {
    var W = 1600, H = 1067;
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var x = c.getContext('2d');
    x.fillStyle = PAPER; x.fillRect(0, 0, W, H);
    if (img) containDraw(x, img, 0, 0, W, 700);
    // 红栏杆短线 motif
    x.fillStyle = RED; x.fillRect(90, 776, 110, 5);
    // 物种名
    x.fillStyle = INK;
    var italic = D.rank === 'species' || D.rank === 'subspecies';
    var size = fitFont(x, D.display, 1100, 64, '700');
    x.font = (italic ? 'italic ' : '') + '700 ' + size + 'px ' + SERIF;
    x.fillText(D.display, 90, 884);
    // 地点 · 日期
    x.fillStyle = MUTED; x.font = '28px ' + SANS;
    x.fillText([D.placeLine, D.date].filter(Boolean).join('　·　'), 90, 956);
    // 编号
    x.fillStyle = FAINT; x.font = '22px ' + SANS;
    x.fillText(D.publicId, 90, 1006);
    // 右侧品牌
    x.textAlign = 'right';
    x.fillStyle = INK; x.font = '600 30px ' + SANS;
    x.fillText('Salticid Notes', W - 90, 902);
    x.fillStyle = RED; x.font = '500 24px ' + SANS;
    x.fillText('跳蛛观察志', W - 90, 944);
    x.fillStyle = FAINT; x.font = '22px ' + SANS;
    x.fillText('© ' + (D.photographer || ''), W - 90, 986);
    x.textAlign = 'left';
    return c;
  }

  // ---------- 物种身份卡（1080×1440，竖 3:4） ----------
  function drawIdCard(img) {
    var W = 1080, H = 1440;
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var x = c.getContext('2d');
    x.fillStyle = PAPER; x.fillRect(0, 0, W, H);
    // 标本标签式内框
    x.strokeStyle = INK; x.lineWidth = 2;
    x.strokeRect(36, 36, W - 72, H - 72);
    // 照片
    if (img) containDraw(x, img, 76, 76, W - 152, 560);
    // kicker
    x.textAlign = 'center';
    x.fillStyle = RED; x.font = '600 26px ' + SANS;
    x.fillText('跳蛛观察志 · 物种身份卡', W / 2, 726);
    // 学名（物种/亚种级用斜体）
    x.fillStyle = INK;
    var italic = D.rank === 'species' || D.rank === 'subspecies';
    var nameSize = fitFont(x, D.display, 760, 58, '700');
    x.font = (italic ? 'italic ' : '') + '700 ' + nameSize + 'px ' + SERIF;
    x.fillText(D.display, W / 2, 806);
    // 红色分隔线
    x.fillStyle = RED; x.fillRect(W / 2 - 30, 838, 60, 3);
    // 信息行
    var rows = [
      ['编号', D.publicId],
      ['观察日期', D.date],
      ['地点', D.placeLine || D.country || '—']
    ];
    if (D.elevation != null) rows.push(['海拔', '约 ' + D.elevation + ' m']);
    if (D.lat != null && D.lng != null) rows.push(['坐标', fmtLat(D.lat) + ' · ' + fmtLng(D.lng)]);
    if (D.photographer) rows.push(['摄影', D.photographer]);
    if (D.hasId && D.identifiedBy) rows.push(['鉴定', D.identifiedBy + ' · ' + (D.date || '')]);
    var y = 930;
    rows.forEach(function (r) {
      x.textAlign = 'left'; x.fillStyle = FAINT; x.font = '24px ' + SANS;
      x.fillText(r[0], 120, y);
      x.textAlign = 'right'; x.fillStyle = INK; x.font = '500 30px ' + SANS;
      x.fillText(String(r[1]), W - 120, y);
      y += 64;
    });
    // 品牌脚注
    x.textAlign = 'center';
    x.fillStyle = FAINT; x.font = '24px ' + SANS;
    x.fillText('salticidnotes.cn', W / 2, H - 96);
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
      openWith(canvas, 'SalticidNotes-' + D.publicId + (kind === 'postcard' ? '-明信片' : '-身份卡') + '.png');
    };
    var fail = function (msg) {
      if (btn) { btn.disabled = false; btn.textContent = kind === 'postcard' ? '导出明信片' : '物种身份卡'; }
      alert(msg || '生成失败，请重试');
    };
    if (!D.mediaUrl) { fail('该观察还没有照片'); return; }
    loadImg(D.mediaUrl).then(function (img) {
      finish(kind === 'postcard' ? drawPostcard(img) : drawIdCard(img));
    }).catch(function () { fail('照片加载失败，请检查网络'); });
  }

  Array.prototype.slice.call(document.querySelectorAll('[data-card]')).forEach(function (btn) {
    btn.addEventListener('click', function () { generate(btn.getAttribute('data-card')); });
  });
})();
