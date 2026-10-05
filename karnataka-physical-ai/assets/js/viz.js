/* Karnataka Physical AI — data visualisations and the pilot simulator.
   Bars grow when they enter view (transform only), every mark has a hover/focus tooltip. */
(function () {
  'use strict';
  var doc = document;
  var $ = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); };
  var inr = function (n) { return Math.round(n).toLocaleString('en-IN'); };
  var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  /* ---------- tooltip ---------- */
  var tip = doc.createElement('div'); tip.className = 'viz-tip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true; doc.body.appendChild(tip);
  function showTip(el, x, y) {
    tip.innerHTML = el.dataset.tip; tip.hidden = false;
    var w = tip.offsetWidth, h = tip.offsetHeight;
    var left = Math.min(innerWidth - w - 12, Math.max(12, x - w / 2)), top = y - h - 14;
    if (top < 70) top = y + 18;
    tip.style.transform = 'translate(' + left + 'px,' + top + 'px)';
  }
  function bindTip(el) {
    el.addEventListener('pointermove', function (e) { showTip(el, e.clientX, e.clientY); });
    el.addEventListener('pointerleave', function () { tip.hidden = true; });
    el.addEventListener('focus', function () { var r = el.getBoundingClientRect(); showTip(el, r.left + r.width / 2, r.top); });
    el.addEventListener('blur', function () { tip.hidden = true; });
  }
  addEventListener('scroll', function () { tip.hidden = true; }, { passive: true });

  /* ---------- bars & lollipops ---------- */
  $$('.bars').forEach(function (host) {
    var rows = JSON.parse(host.dataset.rows), dot = host.classList.contains('bars--dot');
    var min = +(host.dataset.min || 0), max = +(host.dataset.max || Math.max.apply(null, rows.map(function (r) { return r[1]; })));
    var ref = host.dataset.ref ? (+host.dataset.ref - min) / (max - min) : null;
    var html = rows.map(function (r, i) {
      var v = Math.max(0.02, (r[1] - min) / (max - min));
      var t = '<b>' + esc(r[0]) + '</b> ' + esc(r[2]) + (r[3] ? '<br><span>' + esc(r[3]) + '</span>' : '');
      return '<div class="bar' + (r[4] ? ' bar--hl' : '') + '" tabindex="0" data-tip="' + esc(t) + '" style="--v:' + v.toFixed(4) + ';--i:' + i + '">' +
        '<span class="bar__l">' + esc(r[0]) + '</span>' +
        '<span class="bar__track"><i></i>' + (dot ? '<b class="bar__dot"></b>' : '') + (ref !== null ? '<em class="bar__ref" style="left:' + (ref * 100).toFixed(2) + '%"></em>' : '') + '</span>' +
        '<span class="bar__v">' + esc(r[2]) + '</span></div>';
    }).join('');
    if (ref !== null) html = '<p class="bar__refl" style="--r:' + ref.toFixed(4) + '"><span>' + esc(host.dataset.refLabel) + '</span></p>' + html;
    if (dot) html += '<div class="bar__axis"><span>' + min.toFixed(2) + '</span><span>' + ((min + max) / 2).toFixed(3) + '</span><span>' + max.toFixed(2) + '</span></div>';
    host.innerHTML = html;
    $$('.bar', host).forEach(bindTip);
  });

  /* ---------- composition bar ---------- */
  $$('.comp').forEach(function (host) {
    var rows = JSON.parse(host.dataset.rows);
    host.innerHTML = '<div class="comp__bar">' + rows.map(function (r, i) {
      return '<span class="comp__seg comp__seg--' + i + '" tabindex="0" style="flex:' + r[1] + ' 1 0;--i:' + i + '" data-tip="<b>' + esc(r[0]) + '</b> ' + r[1] + '% of GSVA"></span>';
    }).join('') + '</div><div class="comp__labels">' + rows.map(function (r, i) {
      return '<span style="flex:' + Math.max(r[1], 16) + ' 1 0"><b>' + r[1] + '%</b>' + esc(r[0]) + '</span>';
    }).join('') + '</div>';
    $$('.comp__seg', host).forEach(bindTip);
  });

  // grow when visible
  var io = new IntersectionObserver(function (en) {
    en.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('grown'); io.unobserve(e.target); } });
  }, { threshold: 0.35 });
  $$('.bars, .comp').forEach(function (h) { io.observe(h); });

  /* ---------- pilot simulator ---------- */
  var sim = $('#sim');
  if (sim) {
    var labs = $('#sim-labs'), seats = $('#sim-seats'), months = $('#sim-months'), dots = $('#sim-dots');
    var MAXDOTS = 12 * 240 / 10, sq = [];
    for (var i = 0; i < MAXDOTS; i++) { var d = doc.createElement('i'); d.style.setProperty('--d', (i % 48) * 6 + 'ms'); dots.appendChild(d); sq.push(d); }
    var lakh = function (v) { return v >= 100 ? '₹' + (v / 100).toFixed(2) + ' Cr' : '₹' + (Math.round(v * 10) / 10).toString().replace(/\.0$/, '') + ' L'; };
    function render() {
      var L = +labs.value, S = +seats.value, Mo = +months.value;
      $('#sim-labs-o').textContent = L; $('#sim-seats-o').textContent = S; $('#sim-months-o').textContent = Mo.toFixed(1);
      var learners = L * S, capLo = L * 8, capHi = L * 16, del = L * Mo * 8.26, total = capHi + del;
      $('#sim-learners').textContent = inr(learners);
      $('#sim-capex').textContent = '₹' + capLo + '–' + capHi + ' L';
      $('#sim-delivery').textContent = lakh(del);
      $('#sim-total').textContent = '≤ ' + lakh(total);
      $('#sim-per').textContent = '₹' + inr(total * 1e5 / learners);
      var n = Math.round(learners / 10);
      sq.forEach(function (d, k) { d.classList.toggle('on', k < n); d.classList.toggle('lab-edge', k < n && (k % Math.round(S / 10)) === 0); });
      $('#sim-split-a').style.flexGrow = capHi; $('#sim-split-b').style.flexGrow = del;
      [labs, seats, months].forEach(function (r) { r.style.setProperty('--fill', ((r.value - r.min) / (r.max - r.min) * 100).toFixed(1) + '%'); });
    }
    [labs, seats, months].forEach(function (r) { r.addEventListener('input', render); });
    $('#sim-reset').addEventListener('click', function () { labs.value = 4; seats.value = 120; months.value = 3.3; render(); });
    render();
  }
})();
