/* Karnataka Physical AI — interaction layer. No dependencies. */
(function () {
  'use strict';

  var doc = document, root = doc.documentElement;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mqSmall = matchMedia('(max-width: 760px)');
  var mqMid = matchMedia('(max-width: 980px)');
  var $ = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var NS = 'http://www.w3.org/2000/svg';
  var inr = function (n) { return Math.round(n).toLocaleString('en-IN'); };

  function svgEl(tag, attrs, parent) {
    var el = doc.createElementNS(NS, tag);
    for (var k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  }

  /* ------------------------------------------------------------------
     Reveal + counters
     ------------------------------------------------------------------ */
  // stagger sibling reveal-lines
  $$('h1, h2, h3, p').forEach(function (h) {
    var gap = h.classList.contains('vision__t') ? 0.55 : 0.12;
    $$(':scope > .reveal-line', h).forEach(function (l, i) { l.style.setProperty('--d', (i * gap) + 's'); });
  });

  function countUp(el) {
    var target = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0), fmt = el.dataset.fmt, suf = el.dataset.suffix || '';
    var show = function (v) { el.textContent = (fmt === 'in' ? inr(v) : v.toFixed(dec)) + suf; };
    if (reduce) { show(target); return; }
    var t0 = null, dur = 1800;
    function step(t) {
      if (!t0) t0 = t;
      var k = clamp((t - t0) / dur, 0, 1), e = 1 - Math.pow(1 - k, 4);
      show(target * e);
      if (k < 1) requestAnimationFrame(step); else show(target);
    }
    requestAnimationFrame(step);
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var el = en.target;
      el.classList.add('in');
      if (el.dataset.rlHost) $$(':scope > .reveal-line', el).forEach(function (l) { l.classList.add('in'); });
      if (el.dataset.count) countUp(el);
      $$('[data-count]', el).forEach(function (c) { if (!c.dataset.done) { c.dataset.done = 1; countUp(c); } });
      io.unobserve(el);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
  $$('.reveal, .proof__img').forEach(function (el) { io.observe(el); });
  // masked lines are clipped to nothing, so observe their (unclipped) parent instead
  $$('.reveal-line').forEach(function (l) { var h = l.parentElement; if (!h.dataset.rlHost) { h.dataset.rlHost = 1; io.observe(h); } });
  $$('[data-count]').forEach(function (el) { if (!el.closest('.reveal')) io.observe(el); });

  /* ------------------------------------------------------------------
     Navigation
     ------------------------------------------------------------------ */
  var nav = $('#nav'), burger = $('.nav__burger'), menu = $('#menu');
  var tonedSections = $$('[data-tone]').filter(function (s) { return s !== nav; });
  var navLinks = $$('.nav__links a');
  var linkTargets = navLinks.map(function (a) { return $(a.getAttribute('href')); });

  function setMenu(open) {
    burger.setAttribute('aria-expanded', open);
    menu.hidden = !open;
    doc.body.style.overflow = open ? 'hidden' : '';
  }
  burger.addEventListener('click', function () { setMenu(burger.getAttribute('aria-expanded') !== 'true'); });
  $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
  doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); burger.focus(); } });

  function updateNav() {
    var y = scrollY, probe = 40;
    nav.classList.toggle('is-scrolled', y > 40);
    var tone = 'dark';
    for (var i = 0; i < tonedSections.length; i++) {
      var r = tonedSections[i].getBoundingClientRect();
      if (r.top <= probe && r.bottom > probe) { tone = tonedSections[i].dataset.tone; break; }
    }
    if (!menu.hidden) tone = 'dark';
    nav.dataset.tone = tone;
    var h = root.scrollHeight - innerHeight;
    nav.style.setProperty('--p', h > 0 ? (y / h).toFixed(4) : 0);
    var active = -1;
    linkTargets.forEach(function (t, i) { if (t && t.getBoundingClientRect().top < innerHeight * 0.4) active = i; });
    navLinks.forEach(function (a, i) { a.classList.toggle('is-active', i === active); });
  }

  /* ------------------------------------------------------------------
     Scroll progress helper for sticky sections
     ------------------------------------------------------------------ */
  function progressOf(sec) {
    var r = sec.getBoundingClientRect(), total = r.height - innerHeight;
    return total > 0 ? clamp(-r.top / total, 0, 1) : (r.top < innerHeight * 0.5 ? 1 : 0);
  }
  function onAt(container, p) {
    $$('[data-at]', container).forEach(function (el) { el.classList.toggle('on', p >= parseFloat(el.dataset.at)); });
  }

  /* CH01 — the world changed */
  var shift = $('#ch01'), chain = $('.system__chain', shift), arm = $('.system__arm', shift);
  function updateShift() {
    if (reduce || mqSmall.matches) {
      onAt(shift, 1); shift.classList.remove('is-final');
      chain.style.setProperty('--chain', 1); arm.style.setProperty('--arm', 1);
      return;
    }
    var p = progressOf(shift);
    onAt(shift, p);
    chain.style.setProperty('--chain', clamp((p - 0.14) / 0.48, 0, 1).toFixed(3));
    arm.style.setProperty('--arm', clamp((p - 0.56) / 0.18, 0, 1).toFixed(3));
    shift.classList.toggle('is-final', p >= 0.78);
  }

  /* CH04 — ecosystem network */
  var eco = $('#ch04'), ecoSvg = $('.eco__viz svg', eco);
  (function buildEco() {
    var nodes = [
      ['BRAINz', 'Existing'], ['AI University / AI Hub', 'Existing'], ['AI Data Labs', 'Existing'],
      ['Polytechnics', 'Existing'], ['KHETP', 'Existing · ₹2,500 Cr'], ['Universities', 'Existing'], ['Industry', 'Existing']
    ];
    var gL = $('.eco__links', ecoSvg), gN = $('.eco__nodes', ecoSvg), cx = 300, cy = 300, R = 230;
    nodes.forEach(function (n, i) {
      var a = (-90 + i * (360 / nodes.length)) * Math.PI / 180;
      var x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
      var ix = cx + 66 * Math.cos(a), iy = cy + 66 * Math.sin(a);
      svgEl('line', { x1: x, y1: y, x2: ix, y2: iy, pathLength: 1 }, gL);
      var g = svgEl('g', { 'class': 'eco__node' }, gN);
      svgEl('circle', { cx: x, cy: y, r: 6 }, g);
      var right = Math.cos(a) > 0.2, left = Math.cos(a) < -0.2;
      var anchor = right ? 'start' : left ? 'end' : 'middle';
      var tx = x + (right ? 14 : left ? -14 : 0), ty = y + (Math.sin(a) < -0.5 ? -26 : Math.sin(a) > 0.5 ? 28 : 4);
      var t = svgEl('text', { x: tx, y: ty, 'text-anchor': anchor }, g); t.textContent = n[0];
      var s = svgEl('text', { x: tx, y: ty + 15, 'text-anchor': anchor, 'class': 'sub' }, g); s.textContent = n[1].toUpperCase();
    });
  })();
  function updateEco() {
    var p = (reduce || mqMid.matches) ? 1 : progressOf(eco);
    if (mqMid.matches && !reduce) {
      var r = eco.getBoundingClientRect();
      p = clamp((innerHeight - r.top) / (innerHeight * 1.1), 0, 1);
    }
    eco.style.setProperty('--strike', clamp((p - 0.12) / 0.2, 0, 1).toFixed(3));
    ecoSvg.style.setProperty('--core', clamp((p - 0.3) / 0.15, 0, 1).toFixed(3));
    ecoSvg.style.setProperty('--link', clamp((p - 0.38) / 0.3, 0, 1).toFixed(3));
    onAt(eco, p);
  }

  /* ------------------------------------------------------------------
     Karnataka map
     ------------------------------------------------------------------ */
  var REGIONS = [
    { id: 'Bengaluru', d: 'Bengaluru Urban', kk: false,
      role: 'Anchor node. The interface between advanced research, the densest industry base and the rest of the network.',
      ctx: 'Bengaluru Urban produces 40.4% of State GDP; district HDI 0.738.',
      inst: 'IISc and ART Park; engineering colleges and polytechnics across Bengaluru Urban and Rural.',
      focus: 'Industrial robotics, warehouse AMRs, AI + vision at the edge.',
      node: 'Full six-zone regional node with spokes in Tumakuru, Davanagere and Shivamogga.' },
    { id: 'Mysuru', d: 'Mysuru', kk: false,
      role: 'Southern manufacturing belt node for the Old Mysore region.',
      ctx: 'Mysuru division per capita income ₹4.06 lakh (2024–25).',
      inst: 'Engineering colleges and polytechnics across Mysuru, Mandya and Hassan.',
      focus: 'Factory automation, PLC / SCADA, industrial robotics.',
      node: 'Regional node serving the Old Mysore belt.' },
    { id: 'Mangaluru', d: 'Dakshina Kannada', kk: false,
      role: 'Coastal node for Dakshina Kannada, Udupi and Uttara Kannada.',
      ctx: 'Coastal cluster in the IT Policy’s Beyond Bengaluru programme.',
      inst: 'NITK Surathkal and engineering colleges across the coastal districts.',
      focus: 'Port and logistics automation, drones, multi-domain robotics.',
      node: 'Regional node for the coastal cluster.' },
    { id: 'Hubballi-Dharwad', label: 'Hubballi–Dharwad', d: 'Dharwad', kk: false,
      role: 'North Karnataka hinge — connects the Belagavi division to the network.',
      ctx: 'Belagavi division per capita income ₹2.26 lakh vs state average ₹3.86 lakh.',
      inst: 'IIT Dharwad, KLE Technological University and regional polytechnics.',
      focus: 'Embedded systems, IIoT, agri-machinery automation.',
      node: 'Regional node with spokes in Belagavi and Vijayapura.' },
    { id: 'Belagavi', d: 'Belagavi', kk: false,
      role: 'Precision-manufacturing and foundry-cluster node; home of the state technological university.',
      ctx: 'Largest district in the Belagavi division.',
      inst: 'Visvesvaraya Technological University (VTU) and affiliated colleges.',
      focus: 'Automation, machining-cell robotics, quality inspection with vision.',
      node: 'Spoke-to-node candidate, linked to Hubballi–Dharwad.' },
    { id: 'Raichur', d: 'Raichur', kk: true,
      role: 'Kalyana Karnataka node — agriculture and energy economy.',
      ctx: 'District HDI 0.562 against Bengaluru Urban’s 0.738.',
      inst: 'IIIT Raichur, agricultural and engineering colleges in the district.',
      focus: 'Agri-robotics, drones, energy-plant automation.',
      node: 'Proposed node in Kalyana Karnataka; candidate pilot region.' },
    { id: 'Kalaburagi', d: 'Kalaburagi', kk: true,
      role: 'Kalyana Karnataka anchor — where the gap is widest and the case is strongest.',
      ctx: 'Kalaburagi division per capita income ₹1.90 lakh; district HDI 0.539.',
      inst: 'Central University of Karnataka and engineering colleges in Kalaburagi.',
      focus: 'Foundational robotics, embedded systems, mobile robots.',
      node: 'Regional node with spokes in Bidar, Raichur and Ballari.' }
  ];

  var M = window.KA_MAP;
  function drawMap(host, opts) {
    var pad = 30, vb = [-pad, -pad, M.W + pad * 2, M.H + pad * 2];
    var svg = svgEl('svg', { viewBox: vb.join(' '), role: 'img' });
    var gD = svgEl('g', {}, svg), districts = {};
    M.d.forEach(function (f) {
      var p = svgEl('path', { d: f.d, 'class': 'ka-d' + (f.v === 'Kalaburagi' ? ' kk' : '') }, gD);
      districts[f.n] = p;
    });
    host.appendChild(svg);
    return { svg: svg, districts: districts };
  }

  var mapHost = $('#ka-map');
  if (M && mapHost) {
    var mp = drawMap(mapHost);
    var gLinks = svgEl('g', {}, mp.svg), gNodes = svgEl('g', {}, mp.svg);
    var hub = M.c.Bengaluru, nodeEls = {}, regionBtns = {};
    REGIONS.forEach(function (r) {
      var c = M.c[r.id];
      if (r.id !== 'Bengaluru') {
        var mx = (hub[0] + c[0]) / 2 + (c[1] - hub[1]) * 0.12, my = (hub[1] + c[1]) / 2 - (c[0] - hub[0]) * 0.12;
        svgEl('path', { d: 'M' + hub + 'Q' + mx + ',' + my + ' ' + c, 'class': 'ka-link' }, gLinks);
      }
    });
    [['Hubballi-Dharwad', 'Belagavi'], ['Kalaburagi', 'Raichur']].forEach(function (pr) {
      svgEl('path', { d: 'M' + M.c[pr[0]] + 'L' + M.c[pr[1]], 'class': 'ka-link' }, gLinks);
    });
    REGIONS.forEach(function (r) {
      var c = M.c[r.id], g = svgEl('g', { 'class': 'ka-node' + (r.kk ? ' kk' : ''), transform: 'translate(' + c + ')' }, gNodes);
      svgEl('circle', { r: 14, 'class': 'pulse' }, g);
      svgEl('rect', { x: -7, y: -7, width: 14, height: 14, 'class': 'dot' }, g);
      var left = c[0] < 140, t = svgEl('text', { x: left ? 16 : -16, y: -14, 'text-anchor': left ? 'start' : 'end' }, g);
      t.textContent = (r.label || r.id).toUpperCase();
      g.addEventListener('click', function () { selectRegion(r.id, true); });
      nodeEls[r.id] = g;
    });
    // clicking a district selects the nearest node
    Object.keys(mp.districts).forEach(function (n) {
      mp.districts[n].addEventListener('click', function () {
        var b = mp.districts[n].getBBox(), x = b.x + b.width / 2, y = b.y + b.height / 2, best = null, bd = 1e9;
        REGIONS.forEach(function (r) { var c = M.c[r.id], d = Math.pow(c[0] - x, 2) + Math.pow(c[1] - y, 2); if (d < bd) { bd = d; best = r.id; } });
        selectRegion(best, true);
      });
      mp.districts[n].style.cursor = 'pointer';
    });
    var list = $('.map__regions');
    REGIONS.forEach(function (r, i) {
      var b = doc.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'tab'); b.className = r.kk ? 'kk' : '';
      b.innerHTML = '<i></i>' + (r.label || r.id) + '<small>' + (r.kk ? 'Kalyana K.' : 'Node 0' + (i + 1)) + '</small>';
      b.addEventListener('click', function () { selectRegion(r.id, false); });
      b.addEventListener('keydown', function (e) {
        var k = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
        if (!k) return; e.preventDefault();
        var nx = REGIONS[(i + k + REGIONS.length) % REGIONS.length].id; selectRegion(nx, false); regionBtns[nx].focus();
      });
      list.appendChild(b); regionBtns[r.id] = b;
    });
    var panel = $('.map__panel');
    function selectRegion(id) {
      var r = REGIONS.filter(function (x) { return x.id === id; })[0];
      REGIONS.forEach(function (x) {
        var on = x.id === id;
        nodeEls[x.id].classList.toggle('sel', on);
        regionBtns[x.id].setAttribute('aria-selected', on);
        regionBtns[x.id].tabIndex = on ? 0 : -1;
        if (mp.districts[x.d]) mp.districts[x.d].classList.toggle('sel', on);
      });
      $('#mp-name').textContent = r.label || r.id;
      $('#mp-role').textContent = r.role;
      $('#mp-ctx').innerHTML = r.ctx + ' <span class="pv pv--ver">Verified</span>';
      $('#mp-inst').textContent = r.inst;
      $('#mp-focus').innerHTML = r.focus + ' <span class="pv pv--pro">Proposal</span>';
      $('#mp-node').innerHTML = r.node + ' <span class="pv pv--pro">Proposed · not approved</span>';
      panel.classList.remove('swap'); void panel.offsetWidth;
    }
    selectRegion('Bengaluru');

    // pilot mini map
    var pm = $('#pilot-map');
    if (pm) {
      var pmap = drawMap(pm);
      var zones = [[[M.c.Bengaluru[0] - 30, M.c.Bengaluru[1] - 30], 'Near Bengaluru', false], [[(M.c.Kalaburagi[0] + M.c.Raichur[0]) / 2, (M.c.Kalaburagi[1] + M.c.Raichur[1]) / 2], 'Kalyana Karnataka', true]];
      zones.forEach(function (z) {
        var g = svgEl('g', { 'class': 'ka-node sel' + (z[2] ? ' kk' : ''), transform: 'translate(' + z[0] + ')' }, pmap.svg);
        svgEl('circle', { r: 70, fill: z[2] ? 'rgba(224,84,91,.10)' : 'rgba(227,179,65,.10)', stroke: z[2] ? '#E0545B' : '#E3B341', 'stroke-dasharray': '6 6' }, g);
        var t = svgEl('text', { y: 12, 'text-anchor': 'middle', style: 'font-size:38px;fill:#F5F1E8;stroke-width:0' }, g); t.textContent = '2';
        var l = svgEl('text', { y: -84, 'text-anchor': 'middle' }, g); l.textContent = z[1].toUpperCase();
      });
      var note = svgEl('text', { x: 0, y: M.H + 24, style: 'font:500 16px JetBrains Mono, monospace;fill:rgba(245,241,232,.45);letter-spacing:.1em' }, pmap.svg);
      note.textContent = 'INDICATIVE REGIONS · SITES NOT SELECTED';
    }
  }

  /* ------------------------------------------------------------------
     Blueprint
     ------------------------------------------------------------------ */
  var ZONES = {
    z1: { k: 'Zone 01 · 300–400 sq ft', n: 'Automation', p: 'Programme and monitor industrial controllers — the working language of every factory floor in the state.',
      eq: 'PLC trainers · SCADA + HMI stations · conveyor sort-and-inspect cell · pneumatics bench',
      sk: 'Ladder logic and PLC programming · SCADA / HMI design · sensors and actuators · fault-finding',
      pr: 'Automated sorting line · HMI for a conveyor cell · fault-injection drills',
      area: '300–400 sq ft', areaTag: 'co' },
    z2: { k: 'Zone 02 · 500–600 sq ft', n: 'Industrial robotics', p: 'Robot arms, cobots and vision-guided picking — inside a guarded cell, with safety practice built in.',
      eq: '6-axis cobot in a guarded cell · S/O Arm benches (6-DOF, ±0.1 mm) · vision-guided picking station',
      sk: 'Kinematics · trajectory planning · teach-pendant and offline programming · cell safety',
      pr: 'Vision pick-and-place · palletising routine · arm calibration',
      area: '500–600 sq ft', areaTag: 'co', img: 'assets/img/so-arm-set.webp', cap: 'S/O Arm classroom set · My Equation lab' },
    z3: { k: 'Zone 03 · 350–450 sq ft', n: 'Multi-domain robotics', p: 'Robots that move through the world: mobile platforms, quadrupeds and drones, tested in a mapped arena and a netted cage.',
      eq: 'Campus Robot (LiDAR + SLAM) · T-Bot fleet (ROS 2, Jetson) · AprilTag maze arena · quadrupeds and Q-Bot · netted drone cage',
      sk: 'SLAM and navigation · legged control · flight fundamentals · multi-robot coordination',
      pr: 'Warehouse navigation · quadruped gait tuning · inspection drone mission',
      area: '350–450 sq ft', areaTag: 'co', img: 'assets/img/tbot-maze.webp', cap: 'T-Bot fleet in the maze arena · My Equation lab' },
    z4: { k: 'Zone 04 · 150–200 sq ft', n: 'AI + vision', p: 'Where models meet sensors: perception that runs at the edge, on the robot, in real time.',
      eq: 'Edge-compute stations (Jetson-class) · GPU workstations · camera and LiDAR calibration rig',
      sk: 'Computer vision · sensor fusion · model deployment on edge hardware · collecting data from robots',
      pr: 'Object detection for picking · LiDAR obstacle mapping · visual defect inspection',
      area: '150–200 sq ft', areaTag: 'asm', img: 'assets/img/tbot.webp', cap: 'T-Bot · LiDAR + IMU + Jetson' },
    z5: { k: 'Zone 05 · 150–200 sq ft', n: 'Embedded + IIoT', p: 'The electronics underneath every robot — and the network that lets machines report on themselves.',
      eq: 'Microcontroller and sensor benches · motor drivers · IoT gateways · bench instruments',
      sk: 'Embedded C · motor control · communication buses · IIoT telemetry',
      pr: 'Motor-driver board · machine-health monitor · wireless sensor node',
      area: '150–200 sq ft', areaTag: 'asm' },
    z6: { k: 'Zone 06 · 550–700 sq ft', n: 'R&D + training', p: 'Prototype, test and teach. The room where faculty are trained and projects are shown to industry.',
      eq: '3D printing and fabrication · assembly and test benches · briefing area with smart board, projector and AV',
      sk: 'Mechanical design · rapid prototyping · test and documentation · presenting engineering work',
      pr: 'Capstone builds · train-the-trainer sessions · industry demo days',
      area: '250–300 sq ft R&D + 300–400 sq ft common workspace', areaTag: 'co', img: 'assets/img/mentor-humanoid.webp', cap: 'Mentor-led humanoid demonstration' }
  };
  var TAG = { co: '<span class="pv pv--co">Company-reported</span>', asm: '<span class="pv pv--asm">Assumption</span>' };

  var bp = $('.bp'), bpSvg = $('#bp-svg'), bpPanel = $('#bp-panel');
  var VB0 = [0, 0, 1200, 780], vbNow = VB0.slice(), vbAnim = null;
  var panelDefault = $('.bp__panel-in').innerHTML;

  // seating rows in zone 06
  (function () {
    var g = $('#z6 .seats');
    for (var r = 0; r < 3; r++) for (var c = 0; c < 12; c++) svgEl('circle', { cx: 480 + c * 27, cy: 586 + r * 24, r: 5 }, g);
  })();

  // prepare blueprint draw-on
  $$('.eq > *', bpSvg).forEach(function (el) {
    if (el.getTotalLength && el.tagName !== 'text' && el.tagName !== 'g') {
      try { el.style.setProperty('--len', Math.ceil(el.getTotalLength())); } catch (e) {}
    }
  });
  $$('.seats circle', bpSvg).forEach(function (el) { el.style.setProperty('--len', 32); });
  if (reduce) bp.classList.add('drawn');
  else new IntersectionObserver(function (en, o) { if (en[0].isIntersecting) { bp.classList.add('drawn'); o.disconnect(); } }, { threshold: 0.25 }).observe(bp);

  function animateVB(to) {
    if (vbAnim) cancelAnimationFrame(vbAnim);
    var from = vbNow.slice(), t0 = null, dur = reduce ? 1 : 1100;
    function step(t) {
      if (!t0) t0 = t;
      var k = clamp((t - t0) / dur, 0, 1), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      vbNow = from.map(function (v, i) { return v + (to[i] - v) * e; });
      bpSvg.setAttribute('viewBox', vbNow.map(function (v) { return v.toFixed(2); }).join(' '));
      if (k < 1) vbAnim = requestAnimationFrame(step);
    }
    vbAnim = requestAnimationFrame(step);
  }
  function zoneBox(id) {
    var r = $('#' + id + ' .zone__hit'), x = +r.getAttribute('x'), y = +r.getAttribute('y'), w = +r.getAttribute('width'), h = +r.getAttribute('height');
    var pad = 40, ar = 1200 / 780; x -= pad; y -= pad; w += pad * 2; h += pad * 2;
    if (w / h > ar) { var nh = w / ar; y -= (nh - h) / 2; h = nh; } else { var nw = h * ar; x -= (nw - w) / 2; w = nw; }
    return [x, y, w, h];
  }
  function row(dt, dd) { return '<div><dt>' + dt + '</dt><dd>' + dd + '</dd></div>'; }
  function selectZone(id) {
    $$('.bp__zones [data-zone]').forEach(function (b) { if (b.getAttribute('role')) b.setAttribute('aria-selected', b.dataset.zone === id); });
    $$('.zone', bpSvg).forEach(function (z) { z.classList.toggle('sel', z.id === id); });
    bp.classList.toggle('has-sel', id !== 'all');
    bpPanel.classList.add('swap');
    setTimeout(function () {
      var inner = $('.bp__panel-in');
      if (id === 'all') { inner.innerHTML = panelDefault; }
      else {
        var z = ZONES[id];
        inner.innerHTML = '<p class="bp__pk">' + z.k + '</p><h3 class="bp__pn">' + z.n + '</h3><p class="bp__pp">' + z.p + '</p>' +
          (z.img ? '<figure class="bp__ph"><img src="' + z.img + '" alt=""><figcaption>Real photo · ' + z.cap + '</figcaption></figure>' : '') +
          '<dl class="bp__dl">' + row('Equipment', z.eq) + row('Skills', z.sk) + row('Projects', z.pr) + row('Indicative area', z.area + ' ' + TAG[z.areaTag]) + '</dl>';
      }
      bpPanel.classList.remove('swap');
    }, reduce ? 0 : 260);
    animateVB(id === 'all' ? VB0 : zoneBox(id));
  }
  $$('.bp__zones [data-zone]').forEach(function (b, i, all) {
    b.addEventListener('click', function () { selectZone(b.dataset.zone); });
    b.addEventListener('keydown', function (e) {
      var k = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!k) return; e.preventDefault(); var n = all[(i + k + all.length) % all.length]; n.focus(); n.click();
    });
  });
  $$('.zone', bpSvg).forEach(function (z) {
    z.addEventListener('click', function () { selectZone(bp.classList.contains('has-sel') && z.classList.contains('sel') ? 'all' : z.id); });
  });

  /* ------------------------------------------------------------------
     Configurator
     ------------------------------------------------------------------ */
  var CFG = {
    seats: { 500: 30, 1000: 60, 2000: 80, 5000: 160 },
    maxZones: { 500: 3, 1000: 4, 2000: 6, 5000: 6 },
    mult: { 500: 1, 1000: 1.8, 2000: 3.2, 5000: 7 },
    scale: { 500: 1, 1000: 2, 2000: 3, 5000: 6 },
    room: { 500: [190, 124], 1000: [262, 170], 2000: [350, 228], 5000: [392, 252] },
    kit: { z1: [3, 6], z2: [4.5, 9], z3: [3.5, 7], z4: [2.5, 5], z5: [2, 4], z6: [2, 4] },
    weight: { z1: 1.2, z2: 1.6, z3: 1.4, z4: .8, z5: .7, z6: 1.3 },
    name: { z1: 'Automation', z2: 'Industrial robotics', z3: 'Multi-domain', z4: 'AI + vision', z5: 'Embedded + IIoT', z6: 'R&D + training' },
    equip: {
      z1: function (n) { return (2 * n) + ' PLC trainers · ' + n + ' SCADA/HMI station' + (n > 1 ? 's' : '') + ' · conveyor cell'; },
      z2: function (n) { return n + ' cobot cell' + (n > 1 ? 's' : '') + ' · ' + (4 * n) + ' S/O Arms · vision picking'; },
      z3: function (n) { return (2 * n) + ' T-Bots · ' + n + ' Campus Robot' + (n > 1 ? 's' : '') + ' · ' + n + ' quadruped' + (n > 1 ? 's' : '') + ' · ' + (n > 1 ? 'arena + drone cage' : 'mini arena'); },
      z4: function (n) { return (3 * n) + ' edge-compute stations · camera / LiDAR rig'; },
      z5: function (n) { return (4 * n) + ' embedded benches · IoT gateway kit'; },
      z6: function (n) { return n + ' 3D printer' + (n > 1 ? 's' : '') + ' · assembly benches · briefing AV'; }
    }
  };
  var cfgForm = $('.cfg__controls'), cfgSvg = $('#cfg-svg'), warn = $('#cfg-warn');
  var order = [];
  $$('input[name="zone"]:checked', cfgForm).forEach(function (i) { order.push(i.value); });

  function money(lakh) { return lakh >= 100 ? '₹' + (lakh / 100).toFixed(2).replace(/\.?0+$/, '') + ' Cr' : '₹' + Math.round(lakh) + ' L'; }
  function renderCfg(msg) {
    var area = +$('input[name="area"]:checked', cfgForm).value, max = CFG.maxZones[area];
    while (order.length > max) { var drop = order.pop(); $('input[value="' + drop + '"]', cfgForm).checked = false; msg = msg || (area.toLocaleString('en-IN') + ' sq ft fits up to ' + max + ' zones — the most recent selection was removed.'); }
    $$('input[name="zone"]', cfgForm).forEach(function (i) { i.disabled = !i.checked && order.length >= max; i.parentNode.style.opacity = i.disabled ? .45 : 1; });
    warn.textContent = msg || (order.length >= max && max < 6 ? 'At ' + area.toLocaleString('en-IN') + ' sq ft, up to ' + max + ' zones fit. Increase the floor area to add more.' : '');

    var z = order.slice().sort(), n = CFG.scale[area], seats = CFG.seats[area], has = z.length > 0;
    var lo = 0, hi = 0;
    z.forEach(function (id) { lo += CFG.kit[id][0] * CFG.mult[area]; hi += CFG.kit[id][1] * CFG.mult[area]; });
    var cohort = seats * 4;
    $('#o-seats').textContent = has ? seats : '—';
    $('#o-cohort').textContent = has ? inr(cohort) : '—';
    $('#o-year').textContent = has ? inr(cohort * 4) : '—';
    $('#o-fac').textContent = has ? Math.ceil(seats / 15) + 1 : '—';
    $('#o-proj').textContent = has ? Math.round(cohort / 4) : '—';
    $('#o-capex').textContent = has ? money(lo) + '–' + money(hi).replace('₹', '') : '—';
    $('#cfg-code').textContent = 'PAI-C-' + area + (z.length ? '-' + z.map(function (id) { return id.slice(1); }).join('') : '');
    $('#o-equip').innerHTML = has ? z.map(function (id) { return '<li><b>' + CFG.name[id] + '</b> — ' + CFG.equip[id](n) + '</li>'; }).join('') : '<li>Select at least one zone.</li>';

    // plan drawing
    while (cfgSvg.firstChild) cfgSvg.removeChild(cfgSvg.firstChild);
    var R = CFG.room[area], ox = (400 - R[0]) / 2, oy = (260 - R[1]) / 2;
    svgEl('rect', { x: ox, y: oy, width: R[0], height: R[1], fill: 'none', stroke: '#C9DCEB', 'stroke-width': 2.5 }, cfgSvg);
    var t = svgEl('text', { x: ox, y: oy - 6 }, cfgSvg); t.textContent = area.toLocaleString('en-IN') + (area === 5000 ? '+' : '') + ' SQ FT';
    if (has) {
      var rows = z.length > 3 ? 2 : 1, perRow = Math.ceil(z.length / rows), gap = 6, inner = 8;
      for (var rI = 0; rI < rows; rI++) {
        var ids = z.slice(rI * perRow, (rI + 1) * perRow), tot = 0;
        ids.forEach(function (id) { tot += CFG.weight[id]; });
        var rh = (R[1] - inner * 2 - gap * (rows - 1)) / rows, x = ox + inner, avail = R[0] - inner * 2 - gap * (ids.length - 1);
        ids.forEach(function (id) {
          var w = avail * CFG.weight[id] / tot, y = oy + inner + rI * (rh + gap);
          svgEl('rect', { x: x, y: y, width: w, height: rh, 'class': 'cz' }, cfgSvg);
          var l = svgEl('text', { x: x + 5, y: y + 12 }, cfgSvg); l.textContent = id.slice(1).padStart(2, '0');
          if (w > 70) { var l2 = svgEl('text', { x: x + 5, y: y + 23, style: 'opacity:.7' }, cfgSvg); l2.textContent = CFG.name[id].toUpperCase(); }
          x += w + gap;
        });
      }
    }
  }
  cfgForm.addEventListener('change', function (e) {
    var t = e.target, msg = '';
    if (t.name === 'zone') {
      if (t.checked) order.push(t.value); else order = order.filter(function (v) { return v !== t.value; });
    }
    renderCfg(msg);
  });
  renderCfg();

  /* ------------------------------------------------------------------
     Journey
     ------------------------------------------------------------------ */
  var jSteps = $$('.journey__steps li'), jImgs = $$('.journey__frame img'), jMeter = $('#jr-meter');
  function setStep(i) {
    jSteps.forEach(function (s, k) { s.classList.toggle('on', k === i); });
    jImgs.forEach(function (im) { im.classList.toggle('on', +im.dataset.step === i); });
    jMeter.style.width = ((i + 1) / jSteps.length * 100) + '%';
  }
  var jio = new IntersectionObserver(function (en) {
    en.forEach(function (e) { if (e.isIntersecting) setStep(jSteps.indexOf(e.target)); });
  }, { rootMargin: '-45% 0px -45% 0px' });
  jSteps.forEach(function (s) { jio.observe(s); });
  setStep(0);

  /* ------------------------------------------------------------------
     Roadmap — horizontal on desktop
     ------------------------------------------------------------------ */
  var road = $('#roadmap'), track = $('.road__track', road), rail = $('.road__rail', road), roadDist = 0;
  function sizeRoad() {
    if (mqMid.matches || reduce) { road.style.height = ''; track.style.transform = ''; roadDist = 0; return; }
    roadDist = Math.max(0, track.scrollWidth - innerWidth + 40);
    road.style.height = (innerHeight + roadDist) + 'px';
  }
  function updateRoad() {
    if (!roadDist) return;
    var p = progressOf(road);
    track.style.transform = 'translate3d(' + (-p * roadDist).toFixed(1) + 'px,0,0)';
    rail.style.setProperty('--rp', p.toFixed(3));
  }

  /* ------------------------------------------------------------------
     Parallax
     ------------------------------------------------------------------ */
  var heroStrips = $('.hero__strips'), plx = $$('.parallax img');
  function updateParallax() {
    if (reduce) return;
    if (scrollY < innerHeight * 1.2) heroStrips.style.transform = 'translate3d(0,' + (scrollY * 0.25).toFixed(1) + 'px,0)';
    plx.forEach(function (img) {
      var r = img.parentNode.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      var k = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
      img.style.transform = 'translate3d(0,' + (k * -6).toFixed(2) + '%,0) scale(1.12)';
    });
  }

  /* ------------------------------------------------------------------
     Frame loop
     ------------------------------------------------------------------ */
  var ticking = false;
  function frame() {
    ticking = false;
    updateNav(); updateShift(); updateEco(); updateRoad(); updateParallax();
  }
  function req() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  addEventListener('scroll', req, { passive: true });
  addEventListener('resize', function () { sizeRoad(); req(); });
  addEventListener('load', function () { sizeRoad(); req(); });
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { sizeRoad(); req(); });
  sizeRoad(); frame();
})();
