/* i18n.js —— 双语切换器
   职责（仅限三件）：
   1) title / meta description / keywords / og 标签 的中英切换（正文一律成对 data-lang 节点，不经 JS）
   2) img alt 的中英切换（读 data-alt-zh / data-alt-en）
   3) 语言切换按钮逻辑：改 <html lang> + 写 localStorage['rr-lang'] + aria-pressed
   不做任何 DOM 渲染、无 fetch、file:// 可用。 */
(function () {
  'use strict';

  /* v2 TDK 事实源：content-plan-v2.md §6.1（campaigns / links / resume 为占位与沿用口径） */
  var META = {
    home: {
      zh: {
        t: 'melody作品集',
        d: '酒店市场传讯人芦融融的作品集：十五年酒店海报、文案、影像与活动案例，三亚的海是她最常用的底色。',
        k: '酒店海报设计、酒店品牌案例、酒店宣传文案、三亚酒店营销'
      },
      en: {
        t: 'Melody Portfolio',
        d: 'Portfolio of Melody Lu: fifteen years of hotel posters, copy, films and campaigns in Sanya, China.',
        k: 'hotel poster design, hotel brand case study, hotel campaign portfolio'
      }
    },
    work: {
      zh: {
        t: 'melody作品集',
        d: '酒店节气海报、节日视觉、促销文案与新媒体图文模板共 25 件，康年、瑞士及美爵、铂瑞、迎宾馆、华宇五家酒店出品。',
        k: '酒店节气海报、酒店促销海报、新媒体图文模板'
      },
      en: {
        t: 'Melody Portfolio',
        d: 'Twenty-five posters, campaigns and social templates for five hotels in Sanya.',
        k: 'hotel poster, hotel campaign design, social media template'
      }
    },
    videos: {
      zh: {
        t: 'melody作品集',
        d: '六条酒店影像：品牌字形动画、手绘插画、漂浮下午茶实拍与厨师 IP 酒店导览。',
        k: '酒店宣传视频、品牌动画、酒店导览视频'
      },
      en: {
        t: 'Melody Portfolio',
        d: 'Six hotel films: brand motion, hand-drawn animation, floating tea and a chef-led hotel tour.',
        k: 'hotel brand film, motion design, hotel tour video'
      }
    },
    campaigns: {
      zh: {
        t: 'melody作品集',
        d: '完整活动方案脱敏整理中：八周年庆、达人直播与节点营销的全案记录，不日补上。',
        k: '酒店活动策划、酒店整合营销案例'
      },
      en: {
        t: 'Melody Portfolio',
        d: 'Full campaign case files are being prepared for release — anniversaries, livestreams and seasonal nodes.',
        k: 'hotel campaign planning, hotel integrated marketing'
      }
    },
    links: {
      zh: {
        t: 'melody作品集',
        d: '媒体报道与合作链接清单整理中，每一条都将标注出处，不日补上。',
        k: '酒店媒体报道、三亚文旅传播'
      },
      en: {
        t: 'Melody Portfolio',
        d: 'Press mentions and collaboration links, each with its source noted. Being compiled.',
        k: 'hotel press coverage, Sanya tourism PR'
      }
    },
    resume: {
      zh: {
        t: 'melody作品集',
        d: '十五年酒店与地产营销传播履历：五家高端酒店与央企地产项目，抖音自播全年 GMV 300 万，达人联动核销近 600 万。可下载 PDF 简历。',
        k: '芦融融 履历, 市场传讯总监 个人简历, 酒店公关总监履历'
      },
      en: {
        t: 'Melody Portfolio',
        d: 'Fifteen years across five hotels and state-owned real estate in Sanya: ¥3M annual livestream GMV, ¥6M influencer redemptions. Download the PDF.',
        k: 'Melody Lu CV, hotel marketing director China'
      }
    },
    posters: {
      zh: {
        t: 'melody作品集',
        d: '海报与视觉作品已并入「作品全览」页：work.html，25 件作品可分类浏览。',
        k: '酒店海报设计, 酒店主视觉'
      },
      en: {
        t: 'Melody Portfolio',
        d: 'Posters and visuals have been merged into the Selected Work page: work.html.',
        k: 'hotel poster design, hotel brand visuals'
      }
    }
  };

  function currentLang() {
    return document.documentElement.lang === 'en' ? 'en' : 'zh';
  }

  function setMeta(name, content) {
    var el = document.querySelector('meta[name="' + name + '"]');
    if (el) { el.setAttribute('content', content); }
  }

  function setOg(property, content) {
    var el = document.querySelector('meta[property="' + property + '"]');
    if (el) { el.setAttribute('content', content); }
  }

  function apply() {
    var lang = currentLang();
    var page = document.documentElement.getAttribute('data-page') || 'home';
    var m = META[page] && META[page][lang];

    if (m) {
      document.title = m.t;
      setMeta('description', m.d);
      setMeta('keywords', m.k);
      setOg('og:title', m.t);
      setOg('og:description', m.d);
    }

    /* 图片 alt 中英切换 */
    var imgs = document.querySelectorAll('img[data-alt-zh]');
    for (var i = 0; i < imgs.length; i++) {
      var alt = lang === 'en'
        ? imgs[i].getAttribute('data-alt-en') || ''
        : imgs[i].getAttribute('data-alt-zh') || '';
      imgs[i].setAttribute('alt', alt);
    }

    /* 语言切换按钮：aria-pressed = 英文态；aria-label 说明将切换到的语言 */
    var btns = document.querySelectorAll('[data-lang-toggle]');
    for (var j = 0; j < btns.length; j++) {
      btns[j].setAttribute('aria-pressed', lang === 'en' ? 'true' : 'false');
      btns[j].setAttribute('aria-label', lang === 'zh'
        ? '切换到英文 Switch to English'
        : '切换到中文 Switch to Chinese');
    }
  }

  function toggle() {
    var lang = currentLang() === 'en' ? 'zh' : 'en';
    document.documentElement.lang = lang;
    try { localStorage.setItem('rr-lang', lang); } catch (e) { /* 隐私模式等异常：忽略，仅本次会话生效 */ }
    apply();
    try {
      window.dispatchEvent(new CustomEvent('rr:langchange', { detail: { lang: lang } }));
    } catch (e) { /* 老浏览器无 CustomEvent：数字区由 CSS 不受影响，忽略 */ }
  }

  function init() {
    apply();
    var btns = document.querySelectorAll('[data-lang-toggle]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', toggle);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
