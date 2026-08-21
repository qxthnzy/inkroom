/* =========================================================
   INKROOM — интерактив лендинга
   Классический скрипт с defer (не модуль), чтобы страница
   открывалась и с file:// — модули туда не грузятся из-за CORS.
   ========================================================= */
(() => {
  'use strict';

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const html = document.documentElement;

  const debounce = (fn, ms) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  };

  /* ---------- Блокировка скролла под модалками ----------
     overflow:hidden на body в iOS Safari страницу не держит, поэтому фиксируем
     body и сами возвращаем позицию. Счётчик — на случай, когда лайтбокс
     открывают из уже открытого меню. */
  let scrollLocks = 0;
  let savedScrollY = 0;

  const lockScroll = () => {
    if (scrollLocks++ > 0) return;
    savedScrollY = window.scrollY;
    document.body.style.top = `${-savedScrollY}px`;
    document.body.classList.add('no-scroll');
  };

  const unlockScroll = () => {
    if (scrollLocks === 0 || --scrollLocks > 0) return;
    document.body.classList.remove('no-scroll');
    document.body.style.top = '';
    // scroll-behavior:smooth превратил бы возврат в анимацию — глушим на один кадр
    const prev = html.style.scrollBehavior;
    html.style.scrollBehavior = 'auto';
    window.scrollTo(0, savedScrollY);
    html.style.scrollBehavior = prev;
  };

  /* ---------- Нумерация секций ----------
     «01 / 11» больше не зашита в CSS: и номер, и знаменатель считаются
     по разметке, поэтому новая секция ничего не ломает. */
  const secIndexes = $$('.sec-index');
  secIndexes.forEach((el, i) => {
    el.textContent = String(i + 1).padStart(2, '0');
  });
  html.style.setProperty('--sec-total', `"${secIndexes.length}"`);

  /* ---------- Шапка: фон при скролле + скрытие вниз ---------- */
  const header = $('#header');
  const nav = $('#nav');
  const burger = $('#burger');
  const logo = $('.header .logo');
  const headerCta = $('.header__cta');
  let lastY = window.scrollY;

  const menuIsOpen = () => nav.classList.contains('is-open');

  /* ---------- Подсветка активного пункта меню ----------
     Позиции секций меряем один раз и пересчитываем, когда меняется высота
     страницы: getBoundingClientRect на каждой секции при каждом скролле
     заметно тормозил на слабых Android. */
  const navLinks = $$('.nav__list a');
  const sections = navLinks
    .map((a) => $(a.getAttribute('href')))
    .filter(Boolean);

  let sectionTops = [];
  let headerH = 0;

  const measureSections = () => {
    if (scrollLocks > 0) return; // при зафиксированном body координаты врут
    headerH = header.offsetHeight;
    sectionTops = sections.map((sec) => ({
      id: sec.id,
      top: sec.getBoundingClientRect().top + window.scrollY,
    }));
  };

  const highlightNav = () => {
    const line = window.scrollY + headerH + 24;
    let current = null;
    for (const sec of sectionTops) {
      if (sec.top <= line) current = sec.id;
    }
    // у нижнего края страницы всегда подсвечиваем последнюю секцию
    if (window.scrollY + window.innerHeight >= html.scrollHeight - 4 && sectionTops.length) {
      current = sectionTops[sectionTops.length - 1].id;
    }
    navLinks.forEach((a) => {
      const active = a.getAttribute('href') === `#${current}`;
      a.classList.toggle('is-active', active);
      // location, а не page: это навигация внутри одной страницы
      if (active) a.setAttribute('aria-current', 'location');
      else a.removeAttribute('aria-current');
    });
  };

  const update = () => {
    if (scrollLocks > 0) return; // под открытой модалкой body зафиксирован, скролл не наш
    const y = window.scrollY;
    header.classList.toggle('is-stuck', y > 40);
    header.classList.toggle('is-hidden', y > 400 && y > lastY && !menuIsOpen());
    lastY = y;
    highlightNav();
  };

  // scroll срабатывает на каждый пиксель — сводим работу к одному кадру
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      update();
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });

  const remeasure = debounce(() => {
    measureSections();
    update();
  }, 150);
  window.addEventListener('resize', remeasure);
  // высота страницы меняется и без resize: раскрытый FAQ, фильтр портфолио,
  // догрузившиеся картинки — ResizeObserver ловит все эти случаи разом
  if ('ResizeObserver' in window) new ResizeObserver(remeasure).observe(document.body);
  window.addEventListener('load', remeasure);

  /* ---------- Мобильное меню ---------- */
  // логотип, CTA и бургер лежат поверх раскрытого меню, поэтому входят в ловушку
  const menuFocusables = () =>
    [logo, ...$$('#nav a'), headerCta, burger].filter(
      (el) => el && el.offsetParent !== null
    );

  const setMenu = (open) => {
    nav.classList.toggle('is-open', open);
    // см. .header.has-menu в CSS: блюр шапки ломает position:fixed у оверлея
    header.classList.toggle('has-menu', open);
    burger.setAttribute('aria-expanded', String(open));
    if (open) lockScroll();
    else unlockScroll();
    // сбрасываем накопленное состояние скролла, иначе шапка может остаться скрытой
    lastY = window.scrollY;
    header.classList.remove('is-hidden');
  };

  const closeMenu = () => {
    if (menuIsOpen()) setMenu(false);
  };

  burger.addEventListener('click', () => setMenu(!menuIsOpen()));
  $$('#nav a').forEach((a) => a.addEventListener('click', closeMenu));

  document.addEventListener('keydown', (e) => {
    if (!menuIsOpen()) return;

    if (e.key === 'Escape') {
      closeMenu();
      burger.focus();
      return;
    }
    if (e.key !== 'Tab') return;

    // ловушка фокуса: Tab не должен уводить на страницу под меню (WCAG 2.4.3)
    const list = menuFocusables();
    if (!list.length) return;
    const i = list.indexOf(document.activeElement);
    if (i === -1) {
      e.preventDefault();
      list[e.shiftKey ? list.length - 1 : 0].focus();
      return;
    }
    const next = e.shiftKey ? i - 1 : i + 1;
    if (next < 0 || next >= list.length) {
      e.preventDefault();
      list[(next + list.length) % list.length].focus();
    }
  });

  /* ---------- Появление блоков при скролле ---------- */
  const revealNow = (el) => el.classList.add('is-in');

  if (reduced || !('IntersectionObserver' in window)) {
    $$('.reveal').forEach(revealNow);
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          revealNow(e.target);
          io.unobserve(e.target);
        });
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.12 }
    );

    const watchReveal = (root) => {
      if (root.matches?.('.reveal')) io.observe(root);
      $$('.reveal', root).forEach((el) => io.observe(el));
    };
    watchReveal(document);

    // элементы, вставленные в DOM позже, тоже должны оживать
    new MutationObserver((records) => {
      records.forEach((rec) => {
        rec.addedNodes.forEach((node) => {
          if (node.nodeType === 1) watchReveal(node);
        });
      });
    }).observe(document.body, { childList: true, subtree: true });

    // после resize (в том числе виртуальной клавиатуры) в кадр могут попасть
    // элементы, которые observer уже не отслеживает — показываем их вручную
    window.addEventListener(
      'resize',
      debounce(() => {
        $$('.reveal:not(.is-in)').forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.top < window.innerHeight && r.bottom > 0) {
            revealNow(el);
            io.unobserve(el);
          }
        });
      }, 200)
    );
  }

  /* ---------- Счётчики в hero ----------
     Итоговые значения лежат в разметке — без JS видно их, а не нули. */
  const counters = $$('.stat__num');
  const format = (n, suffix) => n.toLocaleString('ru-RU') + suffix;

  // «лет студии» считаем от года основания, чтобы цифра не разъезжалась с «с 2014 года»
  const targetOf = (el) =>
    el.dataset.since
      ? new Date().getFullYear() - Number(el.dataset.since)
      : Number.parseInt(el.dataset.count, 10) || 0;

  const runCounter = (el) => {
    const target = targetOf(el);
    const suffix = el.dataset.suffix || '';
    if (reduced) {
      el.textContent = format(target, suffix);
      return;
    }
    const dur = 1600;
    let start = null;
    const frame = (ts) => {
      start ??= ts;
      const p = Math.min((ts - start) / dur, 1);
      const eased = 1 - (1 - p) ** 3;
      el.textContent = format(Math.round(target * eased), suffix);
      if (p < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  };

  if (!reduced && 'IntersectionObserver' in window) {
    const cio = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          runCounter(e.target);
          cio.unobserve(e.target);
        });
      },
      { threshold: 0.6 }
    );
    counters.forEach((el) => {
      el.textContent = format(0, el.dataset.suffix || ''); // обнуляем только когда точно анимируем
      cio.observe(el);
    });
  } else {
    counters.forEach((el) => {
      el.textContent = format(targetOf(el), el.dataset.suffix || '');
    });
  }

  /* ---------- Портфолио: фильтр ---------- */
  const works = $$('.work');
  const empty = $('#galleryEmpty');
  const galleryStatus = $('#galleryStatus');
  const filters = $$('.filter');
  const filtersBox = $('#filters');
  const filtersWrap = $('#filtersWrap');

  filters.forEach((btn) => {
    btn.addEventListener('click', () => {
      filters.forEach((b) => {
        b.classList.remove('is-active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('is-active');
      btn.setAttribute('aria-pressed', 'true');

      const f = btn.dataset.filter;
      let shown = 0;
      works.forEach((w) => {
        const match = f === 'all' || w.dataset.style === f;
        w.classList.toggle('is-hidden', !match);
        if (match) shown++;
      });

      empty.hidden = shown !== 0;
      const label = btn.textContent.trim();
      galleryStatus.textContent = shown
        ? `Показано работ: ${shown} — ${label}`
        : `В стиле «${label}» работ пока нет`;
    });
  });

  /* Горизонтальный скролл фильтров на телефоне: без подсказки не видно,
     что справа есть ещё стили. Классы гасим, когда список доехал до конца. */
  const updateFilterHint = () => {
    const max = filtersBox.scrollWidth - filtersBox.clientWidth;
    filtersWrap.classList.toggle('is-scrollable', max > 4);
    filtersWrap.classList.toggle('is-scroll-end', filtersBox.scrollLeft >= max - 4);
  };
  filtersBox.addEventListener('scroll', updateFilterHint, { passive: true });
  window.addEventListener('resize', debounce(updateFilterHint, 150));
  updateFilterHint();

  /* ---------- Портфолио: лайтбокс ---------- */
  const lb = $('#lightbox');
  const lbImg = $('#lbImg');
  const lbCap = $('#lbCap');
  const lbClose = $('#lbClose');
  const lbPrev = $('#lbPrev');
  const lbNext = $('#lbNext');
  let lbIndex = 0;
  let lastFocused = null;

  const visibleWorks = () => works.filter((w) => !w.classList.contains('is-hidden'));

  const workLabel = (fig) =>
    `${$('.work__title', fig).textContent} — ${$('.work__meta', fig).textContent}`;

  const showAt = (i) => {
    const list = visibleWorks();
    if (!list.length) return;
    lbIndex = (i + list.length) % list.length;
    const fig = list[lbIndex];
    const img = $('img', fig);
    // href ссылки — оригинал без даунскейла, в модалке он и нужен
    lbImg.src = $('.work__btn', fig).getAttribute('href');
    lbImg.alt = img.alt;
    // размеры из исходной карточки: картинка в модалке не дёргает подпись
    lbImg.width = img.getAttribute('width');
    lbImg.height = img.getAttribute('height');
    lbCap.textContent = `${workLabel(fig)} · ${lbIndex + 1} из ${list.length}`;
  };

  const openLightbox = (fig) => {
    lastFocused = document.activeElement;
    showAt(visibleWorks().indexOf(fig));
    lb.hidden = false;
    lockScroll();
    requestAnimationFrame(() => lb.classList.add('is-open'));
    lbClose.focus();
  };

  const closeLightbox = () => {
    lb.classList.remove('is-open');
    unlockScroll();
    setTimeout(() => {
      lb.hidden = true;
    }, 320);
    lastFocused?.focus();
  };

  works.forEach((fig) => {
    // разметка уже даёт кнопке роль и имя — JS только перехватывает переход
    $('.work__btn', fig).addEventListener('click', (e) => {
      e.preventDefault();
      openLightbox(fig);
    });
  });

  lbClose.addEventListener('click', closeLightbox);
  lbPrev.addEventListener('click', () => showAt(lbIndex - 1));
  lbNext.addEventListener('click', () => showAt(lbIndex + 1));
  lb.addEventListener('click', (e) => {
    if (e.target === lb) closeLightbox();
  });

  document.addEventListener('keydown', (e) => {
    if (!lb.classList.contains('is-open')) return;
    if (e.key === 'Escape') return closeLightbox();
    if (e.key === 'ArrowLeft') return showAt(lbIndex - 1);
    if (e.key === 'ArrowRight') return showAt(lbIndex + 1);
    if (e.key !== 'Tab') return;

    // ловушка фокуса: Tab не должен уводить на скрытую под модалкой страницу
    const focusable = [lbClose, lbPrev, lbNext];
    const i = focusable.indexOf(document.activeElement);
    e.preventDefault();
    if (i === -1) return focusable[0].focus();
    const next = e.shiftKey ? i - 1 : i + 1;
    focusable[(next + focusable.length) % focusable.length].focus();
  });

  /* ---------- FAQ ---------- */
  $$('.acc').forEach((acc) => {
    const head = $('.acc__head', acc);
    const body = $('.acc__body', acc);
    const inner = $('.acc__inner', acc);
    let timer = null;

    const open = () => {
      clearTimeout(timer);
      body.hidden = false; // сначала в поток, потом анимация высоты
      acc.classList.add('is-open');
      head.setAttribute('aria-expanded', 'true');
      requestAnimationFrame(() => {
        body.style.height = `${inner.offsetHeight}px`;
      });
    };

    const close = (instant) => {
      clearTimeout(timer);
      acc.classList.remove('is-open');
      head.setAttribute('aria-expanded', 'false');
      body.style.height = '0px';
      // прячем от скринридера только после того, как схлопнулось
      if (instant || reduced) body.hidden = true;
      else
        timer = setTimeout(() => {
          body.hidden = true;
        }, 450);
    };

    acc._close = close;
    head.addEventListener('click', () => {
      const isOpen = acc.classList.contains('is-open');
      $$('.acc.is-open').forEach((other) => {
        if (other !== acc) other._close();
      });
      if (isOpen) close();
      else open();
    });
  });

  window.addEventListener(
    'resize',
    debounce(() => {
      const open = $('.acc.is-open');
      if (open) $('.acc__body', open).style.height = `${$('.acc__inner', open).offsetHeight}px`;
    }, 150)
  );

  /* ---------- Отзывы: карусель ---------- */
  const reviewsSection = $('#reviews');
  const viewport = $('#reviewsViewport');
  const track = $('#reviewsTrack');
  const slides = $$('.review', track);
  const dotsBox = $('#revDots');
  const playBtn = $('#revPlay');
  let rIndex = 0;
  let autoTimer = null;
  let playing = false;
  // 7 секунд не хватало, чтобы дочитать длинный отзыв (WCAG 2.2.1 просит либо
  // больше 20 секунд, либо контроль паузы — контроль есть, но 11 честнее)
  const AUTO_MS = 11000;

  slides.forEach((slide, i) => {
    slide.setAttribute('role', 'group');
    slide.setAttribute('aria-roledescription', 'слайд');
    slide.setAttribute('aria-label', `${i + 1} из ${slides.length}`);

    const dot = document.createElement('button');
    dot.type = 'button';
    dot.setAttribute('aria-label', `Отзыв ${i + 1}`);
    dot.addEventListener('click', () => goTo(i, true));
    dotsBox.appendChild(dot);
  });

  function goTo(i, manual) {
    rIndex = (i + slides.length) % slides.length;
    track.style.transform = `translateX(${-rIndex * 100}%)`;
    slides.forEach((s, k) => {
      // невидимые слайды не должны читаться скринридером
      if (k === rIndex) s.removeAttribute('aria-hidden');
      else s.setAttribute('aria-hidden', 'true');
    });
    $$('button', dotsBox).forEach((dot, k) => {
      if (k === rIndex) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
    if (manual) {
      viewport.setAttribute('aria-live', 'polite');
      restartAuto();
    }
  }

  const tick = () => {
    // автопрокрутку скринридеру не озвучиваем — иначе он говорит каждые 11 секунд
    viewport.setAttribute('aria-live', 'off');
    goTo(rIndex + 1);
  };

  const startAuto = () => {
    if (reduced) return;
    clearInterval(autoTimer);
    autoTimer = setInterval(tick, AUTO_MS);
    playing = true;
    viewport.setAttribute('aria-live', 'off');
    playBtn.setAttribute('aria-label', 'Остановить автопрокрутку');
    playBtn.innerHTML = '<span aria-hidden="true">❙❙</span>';
  };

  const stopAuto = (byUser) => {
    clearInterval(autoTimer);
    autoTimer = null;
    if (!byUser) return;
    playing = false;
    viewport.setAttribute('aria-live', 'polite');
    playBtn.setAttribute('aria-label', 'Запустить автопрокрутку');
    playBtn.innerHTML = '<span aria-hidden="true">▶</span>';
  };

  // пауза, пока идёт взаимодействие: WCAG 2.2.1
  const pause = () => {
    if (playing) clearInterval(autoTimer);
  };
  const resume = () => {
    if (!playing) return;
    clearInterval(autoTimer);
    autoTimer = setInterval(tick, AUTO_MS);
  };
  const restartAuto = () => resume();

  playBtn.addEventListener('click', () => (playing ? stopAuto(true) : startAuto()));

  ['mouseenter', 'focusin'].forEach((ev) =>
    viewport.addEventListener(ev, pause, { passive: true })
  );
  ['mouseleave', 'focusout'].forEach((ev) => viewport.addEventListener(ev, resume));
  document.addEventListener('visibilitychange', () => (document.hidden ? pause() : resume()));

  $('#revPrev').addEventListener('click', () => goTo(rIndex - 1, true));
  $('#revNext').addEventListener('click', () => goTo(rIndex + 1, true));

  // стрелки клавиатуры, пока фокус внутри карусели
  reviewsSection.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    goTo(rIndex + (e.key === 'ArrowLeft' ? -1 : 1), true);
  });

  // свайп на тач-устройствах
  let startX = null;
  track.addEventListener(
    'touchstart',
    (e) => {
      startX = e.touches[0].clientX;
    },
    { passive: true }
  );
  track.addEventListener('touchend', (e) => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 45) goTo(rIndex + (dx < 0 ? 1 : -1), true);
    startX = null;
  });

  goTo(0);
  if (reduced) {
    playBtn.hidden = true;
    viewport.setAttribute('aria-live', 'polite');
  } else {
    startAuto();
  }

  /* ---------- Быстрый выбор мастера / тарифа из карточек ---------- */
  const masterSelect = $('#master');
  const ideaField = $('#idea');

  // класс, а не inline-стиль: иначе подсветка затирала красную рамку у поля с ошибкой
  const flash = (el) => {
    el.classList.add('is-flash');
    setTimeout(() => el.classList.remove('is-flash'), 1200);
  };

  $$('[data-master]').forEach((link) => {
    link.addEventListener('click', () => {
      const i = Array.from(masterSelect.options).findIndex(
        (opt) => opt.textContent === link.dataset.master
      );
      if (i > -1) masterSelect.selectedIndex = i;
      flash(masterSelect);
    });
  });

  $$('[data-plan]').forEach((link) => {
    link.addEventListener('click', () => {
      if (!ideaField.value) ideaField.value = `Интересует вариант «${link.dataset.plan}». `;
      flash(ideaField);
    });
  });

  /* ---------- Маска телефона ---------- */
  const phone = $('#phone');
  const digitsOf = (s) => s.replace(/\D/g, '');

  const maskFrom = (digits) => {
    let d = digits;
    if (d[0] === '8') d = `7${d.slice(1)}`;
    if (d && d[0] !== '7') d = `7${d}`;
    d = d.slice(0, 11);
    if (!d) return '';
    let out = '+7';
    if (d.length > 1) out += ` (${d.slice(1, 4)}`;
    if (d.length >= 5) out += `) ${d.slice(4, 7)}`;
    if (d.length >= 8) out += `-${d.slice(7, 9)}`;
    if (d.length >= 10) out += `-${d.slice(9, 11)}`;
    return out;
  };

  phone.addEventListener('input', () => {
    const caret = phone.selectionStart;
    // сколько цифр стоит левее курсора — этот якорь и восстанавливаем после форматирования
    const digitsBefore = digitsOf(phone.value.slice(0, caret)).length;
    const value = maskFrom(digitsOf(phone.value));
    phone.value = value;

    let seen = 0;
    let pos = value.length;
    if (digitsBefore > 0) {
      for (let i = 0; i < value.length; i++) {
        if (!/\d/.test(value[i])) continue;
        seen++;
        if (seen === digitsBefore) {
          pos = i + 1;
          break;
        }
      }
    }
    try {
      phone.setSelectionRange(pos, pos);
    } catch {
      /* не для всех типов input */
    }
  });

  // ничего не подставляем по фокусу: пользователь мог просто задеть поле
  phone.addEventListener('blur', () => {
    if (digitsOf(phone.value).length < 2) phone.value = '';
  });

  /* ---------- Валидация и отправка формы ---------- */
  const form = $('#consultForm');
  const success = $('#formSuccess');
  const failure = $('#formError');
  const trap = $('#company');
  const tsField = $('#formTs');
  // без бэкенда (статичная демо-версия) отправку имитируем; на боевом стенде
  // достаточно убрать data-demo — и пойдёт настоящий POST на form.action
  const demo = form.dataset.demo === 'true';

  // action/method в разметке — рабочий путь без JS. Раз скрипт есть, отключаем
  // нативную валидацию в пользу своей.
  form.noValidate = true;
  if (tsField) tsField.value = String(Date.now());

  const setError = (name, msg) => {
    const box = $(`[data-err="${name}"]`);
    box.textContent = msg || '';
    box.closest('.field').classList.toggle('has-error', Boolean(msg));
  };

  const validate = () => {
    let ok = true;

    if ($('#name').value.trim().length < 2) {
      setError('name', 'Введите имя');
      ok = false;
    } else setError('name', '');

    if (digitsOf(phone.value).length !== 11) {
      setError('phone', 'Введите телефон полностью');
      ok = false;
    } else setError('phone', '');

    if (!$('#agree').checked) {
      setError('agree', 'Нужно подтвердить согласие');
      ok = false;
    } else setError('agree', '');

    return ok;
  };

  ['#name', '#phone'].forEach((sel) => {
    $(sel).addEventListener('blur', () => {
      if ($(sel).value) validate();
    });
  });
  $('#agree').addEventListener('change', () => {
    if ($('#agree').checked) setError('agree', '');
  });

  // сообщения держатся до следующего действия пользователя, а не N секунд
  form.addEventListener('input', () => {
    success.hidden = true;
    failure.hidden = true;
  });

  const send = async (payload) => {
    if (demo) {
      await new Promise((r) => setTimeout(r, 900));
      return;
    }
    const res = await fetch(form.action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  };

  const resetAfterSend = () => {
    form.reset();
    if (tsField) tsField.value = String(Date.now());
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // бот: заполнил honeypot или отправил форму быстрее человека
    const tooFast = tsField && Date.now() - Number(tsField.value) < 3000;
    if (trap?.value || tooFast) {
      resetAfterSend();
      success.hidden = false;
      return;
    }

    if (!validate()) {
      $('.field.has-error input')?.focus();
      return;
    }

    const btn = $('.form__submit', form);
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Отправляем…';
    form.setAttribute('aria-busy', 'true');
    failure.hidden = true;

    try {
      await send(Object.fromEntries(new FormData(form)));
      resetAfterSend();
      success.hidden = false;
      success.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    } catch (err) {
      console.error('Заявка не ушла:', err);
      failure.hidden = false;
      failure.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    } finally {
      btn.disabled = false;
      btn.textContent = label;
      form.removeAttribute('aria-busy');
    }
  });

  // ?sent=1 — возврат с сервера после отправки формы без JS
  if (new URLSearchParams(location.search).has('sent')) {
    success.hidden = false;
    history.replaceState(null, '', location.pathname + location.hash);
  }

  /* ---------- Год в футере ---------- */
  $('#year').textContent = new Date().getFullYear();

  measureSections();
  update();
})();
