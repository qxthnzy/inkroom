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
  var lastY = window.pageYOffset;

  function onScroll() {
    var y = window.pageYOffset;
    header.classList.toggle('is-stuck', y > 40);
    var menuOpen = $('#nav').classList.contains('is-open');
    header.classList.toggle('is-hidden', y > 400 && y > lastY && !menuOpen);
    lastY = y;
    highlightNav();
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- Мобильное меню ---------- */
  var burger = $('#burger');
  var nav = $('#nav');

  function closeMenu() {
    nav.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('no-scroll');
  }

  burger.addEventListener('click', function () {
    var open = nav.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('no-scroll', open);
  });
  $$('#nav a').forEach(function (a) { a.addEventListener('click', closeMenu); });

  /* ---------- Подсветка активного пункта меню ---------- */
  var navLinks = $$('.nav__list a');
  var sections = navLinks
    .map(function (a) { return document.querySelector(a.getAttribute('href')); })
    .filter(Boolean);

  function highlightNav() {
    var pos = window.pageYOffset + window.innerHeight * 0.32;
    var current = null;
    sections.forEach(function (sec) { if (sec.offsetTop <= pos) current = sec.id; });
    navLinks.forEach(function (a) {
      a.classList.toggle('is-active', a.getAttribute('href') === '#' + current);
    });
  }

  /* ---------- Появление блоков при скролле ---------- */
  var revealables = $$('.reveal');
  if (reduced || !('IntersectionObserver' in window)) {
    revealables.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
    revealables.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Счётчики в hero ---------- */
  var counters = $$('.stat__num');
  function runCounter(el) {
    var target = parseInt(el.dataset.count, 10) || 0;
    var suffix = el.dataset.suffix || '';
    if (reduced) { el.textContent = target.toLocaleString('ru-RU') + suffix; return; }
    var start = null, dur = 1600;
    function frame(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased).toLocaleString('ru-RU') + suffix;
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  if ('IntersectionObserver' in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { runCounter(e.target); cio.unobserve(e.target); }
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { cio.observe(el); });
  } else {
    counters.forEach(runCounter);
  }

  /* ---------- Портфолио: фильтр ---------- */
  var works = $$('.work');
  var empty = $('#galleryEmpty');

  $$('.filter').forEach(function (btn) {
    btn.addEventListener('click', function () {
      $$('.filter').forEach(function (b) {
        b.classList.remove('is-active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('is-active');
      btn.setAttribute('aria-selected', 'true');

      var f = btn.dataset.filter;
      var shown = 0;
      works.forEach(function (w) {
        var match = f === 'all' || w.dataset.style === f;
        w.classList.toggle('is-hidden', !match);
        if (match) shown++;
      });
      empty.hidden = shown !== 0;
    });
  });

  /* ---------- Портфолио: лайтбокс ---------- */
  var lb = $('#lightbox'), lbImg = $('#lbImg'), lbCap = $('#lbCap');
  var lbIndex = 0, lastFocused = null;

  function visibleWorks() {
    return works.filter(function (w) { return !w.classList.contains('is-hidden'); });
  }

  function showAt(i) {
    var list = visibleWorks();
    if (!list.length) return;
    lbIndex = (i + list.length) % list.length;
    var fig = list[lbIndex];
    var img = $('img', fig);
    lbImg.src = img.src;
    lbImg.alt = img.alt;
    lbCap.textContent = $('.work__title', fig).textContent + ' — ' + $('.work__meta', fig).textContent;
  }

  function openLightbox(fig) {
    lastFocused = document.activeElement;
    showAt(visibleWorks().indexOf(fig));
    lb.hidden = false;
    document.body.classList.add('no-scroll');
    requestAnimationFrame(function () { lb.classList.add('is-open'); });
    $('#lbClose').focus();
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
    fig.addEventListener('click', function () { openLightbox(fig); });
    fig.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(fig); }
    });
  });

  $('#lbClose').addEventListener('click', closeLightbox);
  $('#lbPrev').addEventListener('click', function () { showAt(lbIndex - 1); });
  $('#lbNext').addEventListener('click', function () { showAt(lbIndex + 1); });
  lb.addEventListener('click', function (e) { if (e.target === lb) closeLightbox(); });

  document.addEventListener('keydown', function (e) {
    if (lb.hidden) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') showAt(lbIndex - 1);
    if (e.key === 'ArrowRight') showAt(lbIndex + 1);
  });

  /* ---------- FAQ ---------- */
  $$('.acc').forEach(function (acc) {
    var head = $('.acc__head', acc);
    var body = $('.acc__body', acc);
    var inner = $('.acc__inner', acc);

    head.addEventListener('click', function () {
      var isOpen = acc.classList.contains('is-open');

      $$('.acc.is-open').forEach(function (other) {
        if (other === acc) return;
        other.classList.remove('is-open');
        $('.acc__head', other).setAttribute('aria-expanded', 'false');
        $('.acc__body', other).style.height = '0px';
      });

      acc.classList.toggle('is-open', !isOpen);
      head.setAttribute('aria-expanded', String(!isOpen));
      body.style.height = isOpen ? '0px' : inner.offsetHeight + 'px';
    });
  });

  window.addEventListener('resize', function () {
    var open = $('.acc.is-open');
    if (open) $('.acc__body', open).style.height = $('.acc__inner', open).offsetHeight + 'px';
  });

  /* ---------- Отзывы: слайдер ---------- */
  var track = $('#reviewsTrack');
  var slides = $$('.review', track);
  var dotsBox = $('#revDots');
  var rIndex = 0, autoTimer = null;

  slides.forEach(function (_, i) {
    var d = document.createElement('button');
    d.type = 'button';
    d.setAttribute('aria-label', 'Отзыв ' + (i + 1));
    d.addEventListener('click', function () { goTo(i); restartAuto(); });
    dotsBox.appendChild(d);
  });

  function goTo(i) {
    rIndex = (i + slides.length) % slides.length;
    track.style.transform = 'translateX(' + (-rIndex * 100) + '%)';
    $$('button', dotsBox).forEach(function (d, k) { d.classList.toggle('is-active', k === rIndex); });
  }
  function restartAuto() {
    if (reduced) return;
    clearInterval(autoTimer);
    autoTimer = setInterval(function () { goTo(rIndex + 1); }, 7000);
  }

  $('#revPrev').addEventListener('click', function () { goTo(rIndex - 1); restartAuto(); });
  $('#revNext').addEventListener('click', function () { goTo(rIndex + 1); restartAuto(); });

  // свайп на тач-устройствах
  var startX = null;
  track.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend', function (e) {
    if (startX === null) return;
    var dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 45) { goTo(rIndex + (dx < 0 ? 1 : -1)); restartAuto(); }
    startX = null;
  });

  goTo(0);
  restartAuto();

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

  function flash(el) {
    el.style.transition = 'border-color .3s';
    el.style.borderBottomColor = 'var(--ink)';
    setTimeout(function () { el.style.borderBottomColor = ''; }, 1200);
  }

  /* ---------- Маска телефона ---------- */
  var phone = $('#phone');
  phone.addEventListener('input', function () {
    var d = phone.value.replace(/\D/g, '');
    if (d[0] === '8') d = '7' + d.slice(1);
    if (d[0] !== '7') d = '7' + d;
    d = d.slice(0, 11);

    var out = '+7';
    if (d.length > 1) out += ' (' + d.slice(1, 4);
    if (d.length >= 5) out += ') ' + d.slice(4, 7);
    if (d.length >= 8) out += '-' + d.slice(7, 9);
    if (d.length >= 10) out += '-' + d.slice(9, 11);
    phone.value = out;
  });
  phone.addEventListener('focus', function () { if (!phone.value) phone.value = '+7 ('; });
  phone.addEventListener('blur', function () { if (phone.value.replace(/\D/g, '').length < 2) phone.value = ''; });

  /* ---------- Валидация и отправка формы ---------- */
  var form = $('#consultForm');
  var success = $('#formSuccess');

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

    if (phone.value.replace(/\D/g, '').length !== 11) {
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

  form.addEventListener('submit', function (e) {
    e.preventDefault();
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
      btn.disabled = false;
      btn.textContent = label;
      success.hidden = false;
      success.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
      setTimeout(function () { success.hidden = true; }, 12000);
    }, 900);
  });

  /* ---------- Год в футере ---------- */
  $('#year').textContent = new Date().getFullYear();

  onScroll();
})();
