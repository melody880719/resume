/* main.js —— 交互细节（全部 IIFE，任何一段失败不影响内容阅读）
   职责：
   1) 移动端全屏抽屉（开合 / Esc / 焦点圈闭 / 还焦汉堡）
   2) 桌面作品下拉 Esc 关闭并还焦父项
   3) 简历页时间轴：桌面（≥768）强制展开、移动端 details 可折叠
   4) 数字亮点：IntersectionObserver + rAF 滚动计数（reduced-motion 直接显示终值）
   5) 简历页阅读进度线（rAF 节流，reduced-motion 隐藏，CSS 已兜底）
   无 fetch、无依赖、file:// 可用。 */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var desktop = window.matchMedia('(min-width: 768px)');

  /* ── 1. 移动端全屏抽屉 ─────────────────────────────── */
  (function initDrawer() {
    var toggle = document.querySelector('.nav-toggle');
    var drawer = document.getElementById('mobile-drawer');
    if (!toggle || !drawer) { return; }

    var lastFocus = null;

    function focusables() {
      return drawer.querySelectorAll('a[href], button:not([disabled])');
    }

    function openDrawer() {
      lastFocus = document.activeElement;
      drawer.hidden = false;
      /* 下一帧再加 is-open，保证 opacity 过渡生效 */
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () {
          drawer.classList.add('is-open');
        });
      });
      toggle.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      var f = focusables();
      if (f.length) { f[0].focus(); }
    }

    function closeDrawer() {
      drawer.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      window.setTimeout(function () {
        drawer.hidden = true;
      }, reduceMotion.matches ? 0 : 400);
      if (lastFocus) { lastFocus.focus(); }
    }

    toggle.addEventListener('click', function () {
      if (drawer.hidden) { openDrawer(); } else { closeDrawer(); }
    });

    /* 抽屉内的关闭按钮 */
    var closeBtn = drawer.querySelector('[data-drawer-close]');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeDrawer);
    }

    /* 点击菜单链接后自动收起 */
    var links = drawer.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) {
      links[i].addEventListener('click', closeDrawer);
    }

    /* Esc 关闭 + Tab 焦点圈闭 */
    drawer.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeDrawer(); return; }
      if (e.key !== 'Tab') { return; }
      var f = focusables();
      if (!f.length) { return; }
      var first = f[0];
      var last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    });
  })();

  /* ── 2. 桌面下拉：Esc 关闭并还焦父项 ──────────────── */
  (function initDropdown() {
    var items = document.querySelectorAll('.nav-item-dropdown');
    for (var i = 0; i < items.length; i++) {
      (function (item) {
        var parent = item.querySelector('.nav-link');
        var menu = item.querySelector('.dropdown');
        if (!parent || !menu) { return; }
        menu.addEventListener('keydown', function (e) {
          if (e.key === 'Escape') {
            parent.focus();
          }
        });
        parent.addEventListener('keydown', function (e) {
          if (e.key === 'Escape') { parent.blur(); }
        });
      })(items[i]);
    }
  })();

  /* ── 3. 时间轴 details：桌面强制展开 / 移动端折叠 ── */
  (function initTimeline() {
    var items = document.querySelectorAll('.timeline-item details');
    if (!items.length) { return; }

    var userState = [];

    function sync() {
      for (var i = 0; i < items.length; i++) {
        if (desktop.matches) {
          items[i].open = true;
        } else {
          /* 从桌面切回移动时折叠；用户手动开合仅在移动端生效 */
          items[i].open = false;
        }
      }
    }

    /* 移动端：summary 点击时记住用户选择（切回桌面后再切回可还原） */
    for (var i = 0; i < items.length; i++) {
      (function (d, idx) {
        var summary = d.querySelector('summary');
        if (summary) {
          summary.addEventListener('click', function () {
            if (desktop.matches) {
              /* 桌面锁定展开，吞掉 toggle */
              if (!d.open) { d.open = true; }
            } else {
              userState[idx] = d.open;
            }
          });
        }
      })(items[i], i);
    }

    var onChange = function () {
      if (desktop.matches) { sync(); }
      else {
        for (var j = 0; j < items.length; j++) {
          items[j].open = !!userState[j];
        }
      }
    };
    if (desktop.addEventListener) { desktop.addEventListener('change', onChange); }
    else if (desktop.addListener) { desktop.addListener(onChange); }

    /* 初始：桌面全展开，移动全折叠 */
    sync();
  })();

  /* ── 4. 数字亮点滚动计数 ──────────────────────────── */
  (function initStats() {
    var nums = document.querySelectorAll('.stat-num');
    if (!nums.length) { return; }

    function format(value, dec) {
      var s = value.toFixed(dec);
      if (value >= 1000) {
        var parts = s.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        s = parts.join('.');
      }
      return s;
    }

    function finalFor(el) {
      var lang = document.documentElement.lang === 'en' ? 'en' : 'zh';
      var target = parseFloat(el.getAttribute('data-count-' + lang) || el.textContent) || 0;
      var dec = parseInt(el.getAttribute('data-dec-' + lang) || '0', 10);
      return { target: target, dec: dec };
    }

    function setFinal(el) {
      var f = finalFor(el);
      el.textContent = format(f.target, f.dec);
    }

    /* 语言切换时：已计数完成的数字直接吸附到当前语言终值 */
    window.addEventListener('rr:langchange', function () {
      for (var i = 0; i < nums.length; i++) { setFinal(nums[i]); }
    });

    if (reduceMotion.matches || !('IntersectionObserver' in window)) {
      /* 降级：终值已写在 HTML 里，无需任何操作 */
      return;
    }

    function animate(el) {
      var f = finalFor(el);
      var duration = 800;
      var start = null;
      function step(ts) {
        if (start === null) { start = ts; }
        var t = Math.min((ts - start) / duration, 1);
        /* easeOutQuint，与 --ease 同族 */
        var eased = 1 - Math.pow(1 - t, 5);
        el.textContent = format(f.target * eased, f.dec);
        if (t < 1) { window.requestAnimationFrame(step); }
        else { el.textContent = format(f.target, f.dec); }
      }
      window.requestAnimationFrame(step);
    }

    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          animate(entries[i].target);
          io.unobserve(entries[i].target);
        }
      }
    }, { threshold: 0.4 });

    for (var k = 0; k < nums.length; k++) { io.observe(nums[k]); }
  })();

  /* ── 5. 简历页阅读进度线 ──────────────────────────── */
  (function initProgress() {
    var line = document.querySelector('.progress-line');
    if (!line || reduceMotion.matches) { return; }

    var ticking = false;
    function update() {
      ticking = false;
      var doc = document.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      var ratio = max > 0 ? Math.min(Math.max(window.scrollY / max, 0), 1) : 0;
      line.style.transform = 'scaleX(' + ratio + ')';
    }
    window.addEventListener('scroll', function () {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    }, { passive: true });
    update();
  })();
})();


/* =========================================================
   v2 交互增量（追加区，v1 模块 1–5 全部保留）
   6) 横滚带：桌面 pointer 拖拽（grab/grabbing）+ 滚轮 deltaY 横移
   7) work.html 筛选器：.filter-btn[data-filter] + #posters/#photography/#social 预置
   8) work.html 灯箱：原生 <dialog>，Esc / ←/→ 当前筛选组内循环 / 点遮罩关 / 焦点还原
   9) videos.html 视频原位替换 + #v-<slug> hash 自动开播
   全部 IIFE，任一失败不影响内容阅读；无 fetch、无依赖、file:// 可用。
   ========================================================= */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ── 6. 横滚带：拖拽 + 滚轮 ───────────────────────── */
  (function initStrip() {
    var strips = document.querySelectorAll('.strip');
    if (!strips.length) { return; }
    for (var i = 0; i < strips.length; i++) {
      (function (strip) {
        var down = false, startX = 0, startLeft = 0, moved = false;

        strip.addEventListener('pointerdown', function (e) {
          if (e.pointerType !== 'mouse') { return; } /* 触摸走原生滑动 */
          down = true; moved = false;
          startX = e.clientX; startLeft = strip.scrollLeft;
          strip.classList.add('is-dragging');
          if (strip.setPointerCapture) {
            try { strip.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
          }
        });
        strip.addEventListener('pointermove', function (e) {
          if (!down) { return; }
          var dx = e.clientX - startX;
          if (Math.abs(dx) > 3) { moved = true; }
          strip.scrollLeft = startLeft - dx;
        });
        function end() {
          if (!down) { return; }
          down = false;
          strip.classList.remove('is-dragging');
        }
        strip.addEventListener('pointerup', end);
        strip.addEventListener('pointercancel', end);
        strip.addEventListener('pointerleave', end);

        /* 拖拽后吞掉误触发的点击（避免拖完误跳 work.html） */
        strip.addEventListener('click', function (e) {
          if (moved) {
            e.preventDefault();
            e.stopPropagation();
            moved = false;
          }
        }, true);

        /* 滚轮：deltaY 转横向；到带两端时交还给页面竖向滚动 */
        strip.addEventListener('wheel', function (e) {
          if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) { return; }
          var max = strip.scrollWidth - strip.clientWidth;
          if (max <= 0) { return; }
          var atStart = strip.scrollLeft <= 0 && e.deltaY < 0;
          var atEnd = strip.scrollLeft >= max && e.deltaY > 0;
          if (atStart || atEnd) { return; }
          e.preventDefault();
          strip.scrollLeft += e.deltaY;
        }, { passive: false });
      })(strips[i]);
    }
  })();

  /* ── 7. work.html 筛选器（两段瀑布 + 锚点预置） ────── */
  (function initFilter() {
    var bar = document.querySelector('.filter-bar');
    if (!bar) { return; }
    var btns = bar.querySelectorAll('.filter-btn');
    var cards = document.querySelectorAll('.masonry [data-category]');
    var walls = document.querySelectorAll('[data-wall]');
    if (!cards.length) { return; }

    function applyFilter(f) {
      for (var i = 0; i < btns.length; i++) {
        var on = btns[i].getAttribute('data-filter') === f;
        btns[i].setAttribute('aria-pressed', on ? 'true' : 'false');
      }
      /* 整段隐藏：内容全部被筛掉的瀑布段不留空档（特写位不在 data-wall 段内，恒显） */
      for (var j = 0; j < walls.length; j++) {
        var cats = (walls[j].getAttribute('data-wall') || '').split(',');
        walls[j].hidden = (f !== 'all' && cats.indexOf(f) === -1);
      }
      for (var k = 0; k < cards.length; k++) {
        var fig = cards[k].closest('figure') || cards[k];
        fig.hidden = (f !== 'all' && cards[k].getAttribute('data-category') !== f);
      }
      /* 容器一次性淡入（240ms），不做 FLIP 重排 */
      for (var m = 0; m < walls.length; m++) {
        var w = walls[m].querySelector('.masonry');
        if (!w) { continue; }
        w.classList.remove('filter-fade');
        void w.offsetWidth; /* 强制 reflow 重触发动画 */
        w.classList.add('filter-fade');
      }
    }

    for (var n = 0; n < btns.length; n++) {
      (function (b) {
        b.addEventListener('click', function () {
          applyFilter(b.getAttribute('data-filter'));
        });
      })(btns[n]);
    }

    /* hash 预置（服务导航下拉）：#posters / #photography / #social */
    var map = { posters: 'poster', photography: 'photography', social: 'social' };
    /* ?cat= 直达筛选（服务封面图标卡）：参数值即 data-filter 真实 key，非法值忽略 */
    var CATS = ['poster', 'photography', 'social', 'film'];
    var cat = null;
    try { cat = new URLSearchParams(window.location.search).get('cat'); } catch (e) { /* 极老浏览器：跳过参数 */ }
    var h = (window.location.hash || '').replace('#', '');
    applyFilter((cat && CATS.indexOf(cat) > -1) ? cat : (map[h] || 'all'));
    /* hash 后续变化（浏览器前进/后退、外链跳转）同样生效 */
    window.addEventListener('hashchange', function () {
      var hh = (window.location.hash || '').replace('#', '');
      applyFilter(map[hh] || 'all');
    });
  })();

  /* ── 8. work.html 灯箱（原生 dialog） ─────────────── */
  (function initLightbox() {
    var dlg = document.getElementById('lightbox');
    if (!dlg || typeof dlg.showModal !== 'function') { return; }
    var stage = dlg.querySelector('.lb-stage');
    var img = dlg.querySelector('.lb-img');
    var titleEl = dlg.querySelector('.lb-title');
    var metaEl = dlg.querySelector('.lb-meta');
    var countEl = dlg.querySelector('.lb-count');
    var closeBtn = dlg.querySelector('.lb-close');
    if (!img || !titleEl || !countEl) { return; }

    var items = [];
    var current = 0;
    var lastTrigger = null;

    function lang() { return document.documentElement.lang === 'en' ? 'en' : 'zh'; }
    function pad(n) { return n < 10 ? '0' + n : '' + n; }

    /* 当前筛选结果 = 仍然可见（未被 hidden 祖先藏起）的放大按钮 */
    function visibleItems() {
      var all = document.querySelectorAll('[data-lb]');
      var out = [];
      for (var i = 0; i < all.length; i++) {
        if (all[i].offsetParent !== null) { out.push(all[i]); }
      }
      return out;
    }

    /* 从所属 figure 的 figcaption 取当前语言的作品名 / 元信息 */
    function captionOf(btn, sel) {
      var fig = btn.closest('figure');
      var el = fig && fig.querySelector(sel);
      if (!el) { return ''; }
      var sp = el.querySelector('[data-lang="' + lang() + '"]');
      return (sp ? sp.textContent : el.textContent).replace(/\s+/g, ' ').trim();
    }

    function render() {
      var btn = items[current];
      if (!btn) { return; }
      var l = lang();
      img.src = btn.getAttribute('data-lb-src') || '';
      var thumb = btn.querySelector('img');
      img.alt = thumb
        ? (l === 'en' ? (thumb.getAttribute('data-alt-en') || '') : (thumb.getAttribute('data-alt-zh') || ''))
        : '';
      titleEl.textContent = captionOf(btn, '.wc-title');
      if (metaEl) { metaEl.textContent = captionOf(btn, '.wc-meta'); }
      countEl.textContent = pad(current + 1) + ' / ' + pad(items.length);
    }

    function open(btn) {
      items = visibleItems();
      current = items.indexOf(btn);
      if (current < 0) { return; }
      lastTrigger = btn;
      render();
      dlg.showModal();
      if (closeBtn) { closeBtn.focus(); }
    }

    function step(d) {
      if (!items.length) { return; }
      current = (current + d + items.length) % items.length;
      render();
    }

    document.addEventListener('click', function (e) {
      if (dlg.open || !e.target.closest) { return; }
      var btn = e.target.closest('[data-lb]');
      if (btn) { open(btn); }
    });

    /* 键盘：按钮原生 Enter/Space 已可点；此处兜底 figure[role=button] 形态 */
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') { return; }
      var t = e.target;
      if (dlg.open || !t || !t.getAttribute) { return; }
      if (t.getAttribute('data-lb') !== null) {
        e.preventDefault();
        open(t);
      }
    });

    dlg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    });

    /* 点遮罩空白关闭（点图片不关） */
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg || e.target === stage || (e.target.classList && e.target.classList.contains('lb-bar'))) {
        dlg.close();
      }
    });

    if (closeBtn) {
      closeBtn.addEventListener('click', function () { dlg.close(); });
    }

    dlg.addEventListener('close', function () {
      img.src = '';
      if (lastTrigger) { lastTrigger.focus(); lastTrigger = null; }
    });

    /* 灯箱开着时切语言，caption 跟随 */
    window.addEventListener('rr:langchange', function () {
      if (dlg.open) { render(); }
    });
  })();

  /* ── 9. 视频原位替换 + hash 自动开播 ──────────────── */
  (function initVideos() {
    var cards = document.querySelectorAll('[data-video-src]');
    for (var i = 0; i < cards.length; i++) {
      (function (card) {
        var btn = card.querySelector('button.play-btn');
        if (!btn) { return; } /* 首页封面卡的 play-btn 是 span，点击走链接跳转 */
        var media = card.querySelector('.video-media');
        var cover = card.querySelector('.video-media > img');
        var badge = card.querySelector('.dur-badge');
        var live = null;

        function restore() {
          if (live) {
            if (live.parentNode) { live.parentNode.removeChild(live); }
            live = null;
          }
          if (cover && media && cover.parentNode !== media) {
            media.insertBefore(cover, media.firstChild);
          }
          if (badge) { badge.hidden = false; }
          btn.hidden = false;
        }

        function play() {
          if (live || !media) { return; }
          if (cover && cover.parentNode === media) { media.removeChild(cover); }
          var v = document.createElement('video');
          v.controls = true;
          v.setAttribute('autoplay', '');
          v.setAttribute('preload', 'metadata');
          v.setAttribute('playsinline', '');
          v.src = card.getAttribute('data-video-src');
          v.poster = card.getAttribute('data-video-poster') || '';
          if (cover) {
            if (cover.getAttribute('width')) { v.setAttribute('width', cover.getAttribute('width')); }
            if (cover.getAttribute('height')) { v.setAttribute('height', cover.getAttribute('height')); }
          }
          media.insertBefore(v, media.firstChild);
          live = v;
          btn.hidden = true;
          if (badge) { badge.hidden = true; }
          var p = v.play();
          if (p && p.catch) {
            p.catch(function () { /* 自动播放策略拦截：保留控件，等用户手动播放 */ });
          }
          v.addEventListener('ended', restore);
          v.addEventListener('click', function () {
            if (v.paused) { restore(); } /* 再点换回封面 */
          });
        }

        btn.addEventListener('click', play);
      })(cards[i]);
    }

    /* #v-<slug>：滚动至对应卡并原位开播（服务首页封面卡跳转） */
    var m = (window.location.hash || '').match(/^#v-([\w-]+)$/);
    if (m) {
      var target = document.getElementById('v-' + m[1]);
      if (target) {
        window.setTimeout(function () {
          target.scrollIntoView({
            behavior: reduceMotion.matches ? 'auto' : 'smooth',
            block: 'center'
          });
          var b = target.querySelector('button.play-btn');
          if (b) { b.click(); }
        }, 350);
      }
    }
  })();
})();

/* ═══ 封面与三入口菜单（design-spec-v2 §9 v2.4 · 2026-11 回滚恢复） ═══ */
(function () {
  var cover = document.getElementById('cover');
  var gate = document.querySelector('.gate-menu');
  if (!gate) { return; }

  function wakeMenu() { gate.classList.add('gate-enter'); }

  /* #works 已随首页精简删除，揭幕后焦点落到三入口菜单第一项（原生 a，可直接 focus） */
  function focusWorks() {
    var first = gate.querySelector('.gate-item');
    if (!first) { return; }
    try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); }
  }

  /* 留口：?skip-cover=1 或 rr-skip-cover=1 时直接进菜单 */
  var skip = /[?&]skip-cover=1/.test(window.location.search);
  if (!skip) {
    try { skip = localStorage.getItem('rr-skip-cover') === '1'; } catch (e) {}
  }

  if (skip || !cover) {
    if (cover) { cover.style.display = 'none'; }
    document.body.classList.remove('cover-lock');
    wakeMenu();
    return;
  }

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var revealing = false;

  function reveal() {
    if (revealing) { return; }
    revealing = true;
    wakeMenu(); /* 掀开同时菜单开始入场 */
    if (reduce) {
      cover.style.display = 'none';
      document.body.classList.remove('cover-lock');
      focusWorks();
      return;
    }
    cover.classList.add('revealing');
    window.setTimeout(function () { /* 620ms 兜底，等 600ms 揭幕过渡走完 */
      cover.style.display = 'none';
      document.body.classList.remove('cover-lock');
      focusWorks();
    }, 620);
  }

  /* 按钮（Enter/Space 原生可用）与背景点击共用同一揭幕函数 */
  var gateBtn = cover.querySelector('.cover__gate');
  if (gateBtn) { gateBtn.addEventListener('click', reveal); }
  cover.addEventListener('click', function (e) {
    if (!gateBtn || e.target !== gateBtn) { reveal(); }
  });
})();
