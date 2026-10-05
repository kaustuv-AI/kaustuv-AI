/* Karnataka Physical AI — scroll storytelling.
   Smooth scroll (Lenis), scrubbed narration and image reveals (GSAP ScrollTrigger),
   and a chapter rail that tells the reader where they are in the story. */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); };

  /* ---------- chapter rail ---------- */
  var railN = $('#rail-n'), railT = $('#rail-t'), railB = $('#rail-b'), rail = $('#rail');
  var marks = [{ el: $('#top'), n: '00', t: 'Opening' }];
  $$('.chapter').forEach(function (c) {
    var sec = c.closest('section'), num = $('span', c);
    if (!sec || !num) return;
    var title = c.textContent.replace(num.textContent, '').trim();
    marks.push({ el: sec, n: num.textContent.replace(/\D/g, '').padStart(2, '0'), t: title });
  });
  var vision = $('#vision'); if (vision) marks.push({ el: vision, n: '12', t: 'One network' });
  var lastMark = -1;
  var railQueued = false;
  function queueRail() { if (!railQueued) { railQueued = true; requestAnimationFrame(updateRail); } }
  function updateRail() {
    railQueued = false;
    var rect = window.KA_RECT || function (el) { return el.getBoundingClientRect(); };
    var mid = innerHeight * 0.5, cur = 0;
    marks.forEach(function (m, i) { if (m.el && rect(m.el).top < mid) cur = i; });
    if (cur !== lastMark) {
      lastMark = cur;
      rail.classList.add('swap');
      setTimeout(function () { railN.textContent = marks[cur].n; railT.textContent = marks[cur].t; rail.classList.remove('swap'); }, reduce ? 0 : 220);
    }
    var h = window.KA_DOCH ? window.KA_DOCH() : root.scrollHeight - innerHeight;
    railB.style.transform = 'scaleY(' + (h > 0 ? scrollY / h : 0).toFixed(4) + ')';
    rail.classList.toggle('on', scrollY > innerHeight * 0.6);
    var navTone = $('#nav').dataset.tone; rail.dataset.tone = navTone;
  }
  addEventListener('scroll', queueRail, { passive: true });
  updateRail();

  /* ---------- word-by-word narration ---------- */
  var NARRATION = ['.opp__intro', '.stack__note', '.eco__body', '.lab__lede', '.journey__who', '.chain__note', '.cost__lede', '.cost__per', '.risks__lede', '.faculty__sub'];
  function splitWords(el) {
    var words = [];
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var parts = n.textContent.split(/(\s+)/), frag = doc.createDocumentFragment();
          parts.forEach(function (p) {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(doc.createTextNode(p)); return; }
            var s = doc.createElement('span'); s.className = 'w'; s.textContent = p; frag.appendChild(s); words.push(s);
          });
          n.parentNode.replaceChild(frag, n);
        } else if (n.nodeType === 1 && !n.classList.contains('pv')) walk(n);
        else if (n.nodeType === 1) words.push(n);
      });
    })(el);
    return words;
  }

  var G = window.gsap, ST = window.ScrollTrigger;
  if (!G || !ST || reduce) return;
  G.registerPlugin(ST);
  root.classList.add('has-gsap');

  /* ---------- smooth scroll ---------- */
  var lenis = null;
  if (window.Lenis && !matchMedia('(pointer: coarse)').matches) {
    lenis = new window.Lenis({ lerp: 0.12, smoothWheel: true, wheelMultiplier: 1 });
    lenis.on('scroll', ST.update);
    G.ticker.add(function (time) { lenis.raf(time * 1000); });
    G.ticker.lagSmoothing(0);
    $$('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href'); if (id.length < 2) return;
        var t = $(id); if (!t) return;
        e.preventDefault(); lenis.scrollTo(t, { offset: 0, duration: 1.6 });
        history.replaceState(null, '', id);
      });
    });
  }

  NARRATION.forEach(function (sel) {
    $$(sel).forEach(function (el) {
      var w = splitWords(el);
      G.fromTo(w, { opacity: 0.16 }, { opacity: 1, ease: 'none', stagger: 0.04,
        scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 48%', scrub: true } });
    });
  });

  /* ---------- background colour flows from chapter to chapter ----------
     Each chapter scrolls in wearing the previous chapter's colour and blends to its own,
     so text always sits on its own chapter's ground. */
  var chapters = $$('main > section'), prevBg = null;
  chapters.forEach(function (sec) {
    var own = getComputedStyle(sec).backgroundColor;
    if (prevBg && own !== prevBg && own !== 'rgba(0, 0, 0, 0)') {
      G.fromTo(sec, { backgroundColor: prevBg }, { backgroundColor: own, ease: 'none', immediateRender: false,
        scrollTrigger: { trigger: sec, start: 'top 98%', end: 'top 42%', scrub: true } });
      G.set(sec, { backgroundColor: own });
    }
    if (own !== 'rgba(0, 0, 0, 0)') prevBg = own;
  });

  /* ---------- hero exit ---------- */
  G.to('.hero__title', { yPercent: -18, opacity: 0.15, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  G.to('.hero__aside', { yPercent: -40, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: '20% top', end: '70% top', scrub: true } });
  $$('.strip').forEach(function (s, i) {
    G.to(s, { yPercent: [-10, -22, -6, -16][i] || -10, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  });

  /* ---------- photography ---------- */
  // GPU-only: the frame clips (overflow hidden), the photo drifts and settles inside it
  $$('.proof__img, .gap__photo').forEach(function (f) {
    var img = $('img', f);
    G.fromTo(img, { scale: 1.22, yPercent: -5 }, { scale: 1.04, yPercent: 5, ease: 'none', force3D: true,
      scrollTrigger: { trigger: f, start: 'top bottom', end: 'bottom top', scrub: true } });
  });
  $$('.proof__word').forEach(function (w, i) {
    var dir = w.classList.contains('proof__word--r') ? -1 : 1;
    G.fromTo(w, { xPercent: -10 * dir }, { xPercent: 8 * dir, ease: 'none',
      scrollTrigger: { trigger: w.parentNode, start: 'top bottom', end: 'bottom top', scrub: true } });
  });
  $$('.plates__img img').forEach(function (img) {
    G.fromTo(img, { scale: 1.3 }, { scale: 1.05, ease: 'none', scrollTrigger: { trigger: img.parentNode, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  /* ---------- big numbers settle as they arrive ---------- */
  $$('.fig--hero .fig__n, .gap__n, .pilot__100, .ledger__total').forEach(function (n) {
    G.fromTo(n, { scale: 0.86, transformOrigin: '0% 100%' }, { scale: 1, ease: 'none',
      scrollTrigger: { trigger: n, start: 'top 95%', end: 'top 50%', scrub: true } });
  });

  /* ---------- stack: the missing layer pulls away ---------- */
  G.fromTo('.stack__list .is-missing', { x: 0 }, { x: 22, ease: 'none', stagger: 0.1,
    scrollTrigger: { trigger: '.stack', start: 'top 70%', end: 'bottom 40%', scrub: true } });

  /* ---------- final vision: pinned, line by line ---------- */
  if (vision && innerWidth > 760) {
    var lines = $$('.vision__t .vl'), bgs = $$('.vision__bg img'), para = $('.vision__p');
    var tl = G.timeline({ scrollTrigger: { trigger: vision, start: 'top top', end: '+=80%', pin: true, scrub: true } });
    tl.fromTo(bgs, { scale: 1.25 }, { scale: 1.02, duration: 3, ease: 'none' }, 0);
    lines.forEach(function (l, i) {
      tl.fromTo(l, { yPercent: 70, opacity: 0, clipPath: 'inset(0 0 100% 0)' }, { yPercent: 0, opacity: 1, clipPath: 'inset(0 0 -10% 0)', duration: 0.6, ease: 'power2.out' }, 0.2 + i * 0.75);
    });
    tl.fromTo(para, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.6 }, 2.5);
  }

  ST.addEventListener('refresh', function () { if (window.KA_MEASURE) window.KA_MEASURE(); });
  addEventListener('load', function () { ST.refresh(); });
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { ST.refresh(); });
})();
