/* =========================================================
   INKROOM — интерактив лендинга
   ========================================================= */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------- Шапка: фон при скролле + скрытие вниз ---------- */
  var header = $('#header');
  var nav = $('#nav');
  var burger = $('#burger');
  var lastY = window.pageYOffset;

  function menuIsOpen() { return nav.classList.contains('is-open'); }

  function onScroll() {
    var y = window.pageYOffset;
    header.classList.toggle('is-stuck', y > 40);
    header.classList.toggle('is-hidden', y > 400 && y > lastY && !menuIsOpen());
    lastY = y;
    highlightNav();
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- Мобильное меню ---------- */
  function closeMenu() {
    if (!menuIsOpen()) return;
    nav.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('no-scroll');
    // сбрасываем накопленное состояние скролла, иначе шапка может остаться скрытой
    lastY = window.pageYOffset;
    header.classList.remove('is-hidden');
  }

  burger.addEventListener('click', function () {
    var open = nav.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('no-scroll', open);
    if (open) {
      lastY = window.pageYOffset;
      header.classList.remove('is-hidden');
    }
  });
  $$('#nav a').forEach(function (a) { a.addEventListener('click', closeMenu); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menuIsOpen()) { closeMenu(); burger.focus(); }
  });

  /* ---------- Подсветка активного пункта меню ---------- */
  var navLinks = $$('.nav__list a');
  var sections = navLinks
    .map(function (a) { return document.querySelector(a.getAttribute('href')); })
    .filter(Boolean);

  function highlightNav() {
    // секция считается активной, когда её верх ушёл под фиксированную шапку
    var offset = header.offsetHeight + 24;
    var y = window.pageYOffset;
    var current = null;
    sections.forEach(function (sec) {
      if (sec.getBoundingClientRect().top + y - offset <= y) current = sec.id;
    });
    // у нижнего края страницы всегда подсвечиваем последнюю секцию
    if (y + window.innerHeight >= document.documentElement.scrollHeight - 4 && sections.length) {
      current = sections[sections.length - 1].id;
    }
    navLinks.forEach(function (a) {
      a.classList.toggle('is-active', a.getAttribute('href') === '#' + current);
      if (a.getAttribute('href') === '#' + current) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  }

  /* ---------- Появление блоков при скролле ---------- */
  var revealables = $$('.reveal');
  function revealAll() { revealables.forEach(function (el) { el.classList.add('is-in'); }); }

  if (reduced || !('IntersectionObserver' in window)) {
    revealAll();
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
    revealables.forEach(function (el) { io.observe(el); });

    // после resize (в том числе виртуальной клавиатуры) в кадр могут попасть
    // элементы, которые observer уже не отслеживает — показываем их вручную
    window.addEventListener('resize', debounce(function () {
      revealables.forEach(function (el) {
        if (el.classList.contains('is-in')) return;
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) {
          el.classList.add('is-in');
          io.unobserve(el);
        }
      });
    }, 200));
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  }

  /* ---------- Счётчики в hero ---------- */
  /* Итоговые значения лежат в разметке — без JS видно их, а не нули. */
  var counters = $$('.stat__num');

  function format(n, suffix) { return n.toLocaleString('ru-RU') + suffix; }

  function runCounter(el) {
    var target = parseInt(el.dataset.count, 10) || 0;
    var suffix = el.dataset.suffix || '';
    if (reduced) { el.textContent = format(target, suffix); return; }
    var start = null, dur = 1600;
    function frame(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = format(Math.round(target * eased), suffix);
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  if (!reduced && 'IntersectionObserver' in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { runCounter(e.target); cio.unobserve(e.target); }
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) {
      el.textContent = format(0, el.dataset.suffix || '');   // обнуляем только когда точно анимируем
      cio.observe(el);
    });
  }

  /* ---------- Портфолио: фильтр ---------- */
  var works = $$('.work');
  var empty = $('#galleryEmpty');
  var galleryStatus = $('#galleryStatus');
  var filters = $$('.filter');

  filters.forEach(function (btn) {
    btn.addEventListener('click', function () {
      filters.forEach(function (b) {
        b.classList.remove('is-active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('is-active');
      btn.setAttribute('aria-pressed', 'true');

      var f = btn.dataset.filter;
      var shown = 0;
      works.forEach(function (w) {
        var match = f === 'all' || w.dataset.style === f;
        w.classList.toggle('is-hidden', !match);
        if (match) shown++;
      });
      empty.hidden = shown !== 0;
      galleryStatus.textContent = shown
        ? 'Показано работ: ' + shown + ' — ' + btn.textContent.trim()
        : 'В стиле «' + btn.textContent.trim() + '» работ пока нет';
    });
  });

  /* ---------- Портфолио: лайтбокс ---------- */
  var lb = $('#lightbox'), lbImg = $('#lbImg'), lbCap = $('#lbCap');
  var lbClose = $('#lbClose'), lbPrev = $('#lbPrev'), lbNext = $('#lbNext');
  var lbIndex = 0, lastFocused = null;

  function visibleWorks() {
    return works.filter(function (w) { return !w.classList.contains('is-hidden'); });
  }

  function workLabel(fig) {
    return $('.work__title', fig).textContent + ' — ' + $('.work__meta', fig).textContent;
  }

  function showAt(i) {
    var list = visibleWorks();
    if (!list.length) return;
    lbIndex = (i + list.length) % list.length;
    var fig = list[lbIndex];
    var img = $('img', fig);
    lbImg.src = img.getAttribute('src');
    lbImg.alt = img.alt;
    // размеры из исходной карточки: картинка в модалке не дёргает подпись
    lbImg.width = img.getAttribute('width');
    lbImg.height = img.getAttribute('height');
    lbCap.textContent = workLabel(fig) + ' · ' + (lbIndex + 1) + ' из ' + list.length;
  }

  function openLightbox(fig) {
    lastFocused = document.activeElement;
    showAt(visibleWorks().indexOf(fig));
    lb.hidden = false;
    document.body.classList.add('no-scroll');
    requestAnimationFrame(function () { lb.classList.add('is-open'); });
    lbClose.focus();
  }

  function closeLightbox() {
    lb.classList.remove('is-open');
    document.body.classList.remove('no-scroll');
    setTimeout(function () { lb.hidden = true; }, 320);
    if (lastFocused) lastFocused.focus();
  }

  works.forEach(function (fig) {
    fig.setAttribute('tabindex', '0');
    fig.setAttribute('role', 'button');
    fig.setAttribute('aria-label', 'Открыть работу: ' + workLabel(fig));
    fig.addEventListener('click', function () { openLightbox(fig); });
    fig.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(fig); }
    });
  });

  lbClose.addEventListener('click', closeLightbox);
  lbPrev.addEventListener('click', function () { showAt(lbIndex - 1); });
  lbNext.addEventListener('click', function () { showAt(lbIndex + 1); });
  lb.addEventListener('click', function (e) { if (e.target === lb) closeLightbox(); });

  document.addEventListener('keydown', function (e) {
    if (!lb.classList.contains('is-open')) return;
    if (e.key === 'Escape') { closeLightbox(); return; }
    if (e.key === 'ArrowLeft') { showAt(lbIndex - 1); return; }
    if (e.key === 'ArrowRight') { showAt(lbIndex + 1); return; }
    if (e.key !== 'Tab') return;

    // ловушка фокуса: Tab не должен уводить на скрытую под модалкой страницу
    var focusable = [lbClose, lbPrev, lbNext];
    var i = focusable.indexOf(document.activeElement);
    e.preventDefault();
    if (i === -1) { focusable[0].focus(); return; }
    var next = e.shiftKey ? i - 1 : i + 1;
    focusable[(next + focusable.length) % focusable.length].focus();
  });

  /* ---------- FAQ ---------- */
  $$('.acc').forEach(function (acc) {
    var head = $('.acc__head', acc);
    var body = $('.acc__body', acc);
    var inner = $('.acc__inner', acc);
    var timer = null;

    function open() {
      clearTimeout(timer);
      body.hidden = false;                     // сначала в поток, потом анимация высоты
      acc.classList.add('is-open');
      head.setAttribute('aria-expanded', 'true');
      requestAnimationFrame(function () { body.style.height = inner.offsetHeight + 'px'; });
    }

    function close(instant) {
      clearTimeout(timer);
      acc.classList.remove('is-open');
      head.setAttribute('aria-expanded', 'false');
      body.style.height = '0px';
      // прячем от скринридера только после того, как схлопнулось
      if (instant || reduced) body.hidden = true;
      else timer = setTimeout(function () { body.hidden = true; }, 450);
    }

    acc._close = close;
    head.addEventListener('click', function () {
      var isOpen = acc.classList.contains('is-open');
      $$('.acc.is-open').forEach(function (other) { if (other !== acc) other._close(); });
      if (isOpen) close(); else open();
    });
  });

  window.addEventListener('resize', debounce(function () {
    var open = $('.acc.is-open');
    if (open) $('.acc__body', open).style.height = $('.acc__inner', open).offsetHeight + 'px';
  }, 150));

  /* ---------- Отзывы: карусель ---------- */
  var viewport = $('#reviewsViewport');
  var track = $('#reviewsTrack');
  var slides = $$('.review', track);
  var dotsBox = $('#revDots');
  var playBtn = $('#revPlay');
  var rIndex = 0, autoTimer = null, playing = false;
  var AUTO_MS = 7000;

  slides.forEach(function (slide, i) {
    slide.setAttribute('role', 'group');
    slide.setAttribute('aria-roledescription', 'слайд');
    slide.setAttribute('aria-label', (i + 1) + ' из ' + slides.length);

    var d = document.createElement('button');
    d.type = 'button';
    d.setAttribute('aria-label', 'Отзыв ' + (i + 1));
    d.addEventListener('click', function () { goTo(i, true); });
    dotsBox.appendChild(d);
  });

  function goTo(i, manual) {
    rIndex = (i + slides.length) % slides.length;
    track.style.transform = 'translateX(' + (-rIndex * 100) + '%)';
    slides.forEach(function (s, k) {
      // невидимые слайды не должны читаться скринридером
      if (k === rIndex) s.removeAttribute('aria-hidden');
      else s.setAttribute('aria-hidden', 'true');
    });
    $$('button', dotsBox).forEach(function (d, k) {
      if (k === rIndex) d.setAttribute('aria-current', 'true');
      else d.removeAttribute('aria-current');
    });
    if (manual) {
      viewport.setAttribute('aria-live', 'polite');
      restartAuto();
    }
  }

  function tick() {
    // автопрокрутку скринридеру не озвучиваем — иначе он говорит каждые 7 секунд
    viewport.setAttribute('aria-live', 'off');
    goTo(rIndex + 1);
  }

  function startAuto() {
    if (reduced) return;
    clearInterval(autoTimer);
    autoTimer = setInterval(tick, AUTO_MS);
    playing = true;
    viewport.setAttribute('aria-live', 'off');
    playBtn.setAttribute('aria-label', 'Остановить автопрокрутку');
    playBtn.innerHTML = '<span aria-hidden="true">❙❙</span>';
  }

  function stopAuto(byUser) {
    clearInterval(autoTimer);
    autoTimer = null;
    if (byUser) {
      playing = false;
      viewport.setAttribute('aria-live', 'polite');
      playBtn.setAttribute('aria-label', 'Запустить автопрокрутку');
      playBtn.innerHTML = '<span aria-hidden="true">▶</span>';
    }
  }

  // пауза, пока идёт взаимодействие: WCAG 2.2.1
  function pause() { if (playing) clearInterval(autoTimer); }
  function resume() { if (playing) { clearInterval(autoTimer); autoTimer = setInterval(tick, AUTO_MS); } }

  function restartAuto() { if (playing) resume(); }

  playBtn.addEventListener('click', function () {
    if (playing) stopAuto(true); else startAuto();
  });

  ['mouseenter', 'focusin'].forEach(function (ev) {
    viewport.addEventListener(ev, pause, { passive: true });
  });
  ['mouseleave', 'focusout'].forEach(function (ev) {
    viewport.addEventListener(ev, resume);
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) pause(); else resume();
  });

  $('#revPrev').addEventListener('click', function () { goTo(rIndex - 1, true); });
  $('#revNext').addEventListener('click', function () { goTo(rIndex + 1, true); });

  // свайп на тач-устройствах
  var startX = null;
  track.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend', function (e) {
    if (startX === null) return;
    var dx = e.changedTouches[0].clientX - startX;
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
  var masterSelect = $('#master');
  var ideaField = $('#idea');

  $$('[data-master]').forEach(function (link) {
    link.addEventListener('click', function () {
      var name = link.dataset.master;
      Array.prototype.some.call(masterSelect.options, function (opt, i) {
        if (opt.textContent === name) { masterSelect.selectedIndex = i; return true; }
        return false;
      });
      flash(masterSelect);
    });
  });

  $$('[data-plan]').forEach(function (link) {
    link.addEventListener('click', function () {
      var plan = link.dataset.plan;
      if (!ideaField.value) ideaField.value = 'Интересует вариант «' + plan + '». ';
      flash(ideaField);
    });
  });

  // класс, а не inline-стиль: иначе подсветка затирала красную рамку у поля с ошибкой
  function flash(el) {
    el.classList.add('is-flash');
    setTimeout(function () { el.classList.remove('is-flash'); }, 1200);
  }

  /* ---------- Маска телефона ---------- */
  var phone = $('#phone');

  function digitsOf(s) { return s.replace(/\D/g, ''); }

  function maskFrom(digits) {
    var d = digits;
    if (d[0] === '8') d = '7' + d.slice(1);
    if (d && d[0] !== '7') d = '7' + d;
    d = d.slice(0, 11);
    if (!d) return '';
    var out = '+7';
    if (d.length > 1) out += ' (' + d.slice(1, 4);
    if (d.length >= 5) out += ') ' + d.slice(4, 7);
    if (d.length >= 8) out += '-' + d.slice(7, 9);
    if (d.length >= 10) out += '-' + d.slice(9, 11);
    return out;
  }

  phone.addEventListener('input', function () {
    var caret = phone.selectionStart;
    // сколько цифр стоит левее курсора — этот якорь и восстанавливаем после форматирования
    var digitsBefore = digitsOf(phone.value.slice(0, caret)).length;
    var value = maskFrom(digitsOf(phone.value));
    phone.value = value;

    var seen = 0, pos = value.length;
    for (var i = 0; i < value.length; i++) {
      if (/\d/.test(value[i])) {
        seen++;
        if (seen === digitsBefore) { pos = i + 1; break; }
      }
    }
    if (digitsBefore === 0) pos = value.length;
    try { phone.setSelectionRange(pos, pos); } catch (err) { /* не для всех типов input */ }
  });

  // ничего не подставляем по фокусу: пользователь мог просто задеть поле
  phone.addEventListener('blur', function () {
    if (digitsOf(phone.value).length < 2) phone.value = '';
  });

  /* ---------- Валидация и отправка формы ---------- */
  var form = $('#consultForm');
  var success = $('#formSuccess');
  var trap = $('#company');
  var tsField = $('#formTs');

  // action/method в разметке — резерв на случай, если этот скрипт не загрузился.
  // Раз он работает, отключаем нативную валидацию в пользу своей.
  form.noValidate = true;
  if (tsField) tsField.value = String(Date.now());

  function setError(name, msg) {
    var box = $('[data-err="' + name + '"]');
    var field = box.closest('.field');
    box.textContent = msg || '';
    field.classList.toggle('has-error', Boolean(msg));
  }

  function validate() {
    var ok = true;

    var name = $('#name');
    if (name.value.trim().length < 2) { setError('name', 'Введите имя'); ok = false; }
    else setError('name', '');

    if (digitsOf(phone.value).length !== 11) {
      setError('phone', 'Введите телефон полностью'); ok = false;
    } else setError('phone', '');

    var agree = $('#agree');
    if (!agree.checked) { setError('agree', 'Нужно подтвердить согласие'); ok = false; }
    else setError('agree', '');

    return ok;
  }

  ['#name', '#phone'].forEach(function (sel) {
    $(sel).addEventListener('blur', function () { if ($(sel).value) validate(); });
  });
  $('#agree').addEventListener('change', function () { if ($('#agree').checked) setError('agree', ''); });

  // сообщение об успехе держится до следующего действия пользователя, а не 12 секунд
  form.addEventListener('input', function () { success.hidden = true; });

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    // бот: заполнил honeypot или отправил форму быстрее человека
    var tooFast = tsField && Date.now() - Number(tsField.value) < 3000;
    if ((trap && trap.value) || tooFast) {
      form.reset();
      if (tsField) tsField.value = String(Date.now());
      success.hidden = false;
      return;
    }

    if (!validate()) {
      var firstBad = $('.field.has-error input');
      if (firstBad) firstBad.focus();
      return;
    }

    var btn = $('.form__submit', form);
    var label = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Отправляем…';

    // здесь место для реального запроса на бэкенд / в CRM
    setTimeout(function () {
      form.reset();
      if (tsField) tsField.value = String(Date.now());
      btn.disabled = false;
      btn.textContent = label;
      success.hidden = false;
      success.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    }, 900);
  });

  /* ---------- Год в футере ---------- */
  $('#year').textContent = new Date().getFullYear();

  onScroll();
})();
