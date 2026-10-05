/* Karnataka Physical AI — Three.js scenes.
   1. Ch01: a neural network on a screen collapses into a robot arm that starts to act.
   2. Network: the Karnataka map as a 3D plate with rising regional nodes and live links.
   3. Journey: a mobile manipulator that assembles itself as the learner progresses.
   Each scene renders only while visible. Without WebGL the 2D versions stay in place. */
(function () {
  'use strict';
  var T = window.THREE, doc = document, root = doc.documentElement;

  function glOK() {
    try { var c = doc.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); }
    catch (e) { return false; }
  }
  if (!T || !glOK()) { root.classList.add('no-gl'); return; }
  root.classList.add('gl-on');

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var COL = { ivory: 0xF5F1E8, gold: 0xE3B341, red: 0xE0545B, blue: 0x8FB0C9 };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var smooth = function (a, b, v) { var x = clamp((v - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
  var lerp = function (a, b, k) { return a + (b - a) * k; };
  var stages = [];

  /* ---------- shared stage ---------- */
  function Stage(canvas, fov) {
    var self = this;
    this.canvas = canvas; this.host = canvas.parentElement;
    this.renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(fov || 35, 1, 0.1, 200);
    this.visible = false; this.w = 1; this.h = 1;
    new ResizeObserver(function () { self.resize(); }).observe(this.host);
    new IntersectionObserver(function (e) { self.visible = e[0].isIntersecting; }, { rootMargin: '120px' }).observe(this.host);
    this.resize();
    stages.push(this);
  }
  Stage.prototype.resize = function () {
    var w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    this.w = w; this.h = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  };
  Stage.prototype.draw = function () { this.renderer.render(this.scene, this.camera); };

  function lineMat(color, op) { return new T.LineBasicMaterial({ color: color, transparent: true, opacity: op == null ? 1 : op, depthWrite: false }); }
  function solidMat(color, op) { return new T.MeshBasicMaterial({ color: color, transparent: true, opacity: op == null ? 1 : op, depthWrite: false }); }
  function edges(geo, color, op) { return new T.LineSegments(new T.EdgesGeometry(geo, 25), lineMat(color, op)); }
  function grid(size, div, op) {
    var g = new T.GridHelper(size, div, COL.blue, COL.blue);
    g.material.transparent = true; g.material.opacity = op; g.material.depthWrite = false;
    return g;
  }
  function progressOf(el) {
    var r = el.getBoundingClientRect(), total = r.height - innerHeight;
    return total > 0 ? clamp(-r.top / total, 0, 1) : clamp((innerHeight - r.top) / (innerHeight + r.height), 0, 1);
  }

  /* ---------- robot arm (shared) ---------- */
  function makeArm(color) {
    color = color || COL.ivory;
    var g = new T.Group(), parts = [];
    function part(obj, parent, y) { obj.position.y = y; obj.userData.y = y; parent.add(obj); parts.push(obj); return obj; }
    function joint(parent, y, r, len) {
      var j = new T.Group(); j.position.y = y; parent.add(j);
      var m = edges(new T.CylinderGeometry(r, r, len, 18, 1), COL.gold, 1); m.rotation.x = Math.PI / 2; j.add(m); parts.push(m); m.userData.y = 0;
      var dot = new T.Mesh(new T.SphereGeometry(r * 0.32, 16, 12), solidMat(COL.gold, 1)); j.add(dot); parts.push(dot); dot.userData.y = 0;
      return j;
    }
    part(edges(new T.CylinderGeometry(0.5, 0.6, 0.22, 28, 1), color), g, 0.11);
    var j1 = new T.Group(); j1.position.y = 0.22; g.add(j1);
    part(edges(new T.CylinderGeometry(0.3, 0.34, 0.3, 24, 1), color), j1, 0.15);
    var j2 = joint(j1, 0.42, 0.17, 0.46);
    part(edges(new T.BoxGeometry(0.2, 1.3, 0.2), color), j2, 0.72);
    var j3 = joint(j2, 1.4, 0.14, 0.4);
    part(edges(new T.BoxGeometry(0.16, 1.0, 0.16), color), j3, 0.52);
    var j4 = joint(j3, 1.06, 0.1, 0.3);
    part(edges(new T.BoxGeometry(0.24, 0.16, 0.24), color), j4, 0.1);
    var fl = part(edges(new T.BoxGeometry(0.05, 0.3, 0.14), color), j4, 0.33); fl.position.x = -0.08;
    var fr = part(edges(new T.BoxGeometry(0.05, 0.3, 0.14), color), j4, 0.33); fr.position.x = 0.08;
    var tip = new T.Object3D(); tip.position.y = 0.42; j4.add(tip);
    return { group: g, j1: j1, j2: j2, j3: j3, j4: j4, fl: fl, fr: fr, tip: tip, parts: parts };
  }
  function setOpacity(obj, op) {
    obj.traverse(function (o) { if (o.material) { o.material.opacity = op; o.visible = op > 0.005; } });
  }

  /* =================================================================
     1. CH01 — model becomes machine
     ================================================================= */
  (function () {
    var canvas = doc.getElementById('gl-shift'), section = doc.getElementById('ch01');
    if (!canvas || !section) return;
    var st = new Stage(canvas, 32), S = st.scene;
    S.add(grid(12, 24, 0.12));

    // the "screen": a monitor outline with a layered network inside
    var screen = new T.Group(); screen.position.set(0, 1.7, 0); S.add(screen);
    var frame = new T.LineLoop(new T.BufferGeometry().setFromPoints([
      new T.Vector3(-2.3, -1.25, 0), new T.Vector3(2.3, -1.25, 0), new T.Vector3(2.3, 1.25, 0), new T.Vector3(-2.3, 1.25, 0)]), lineMat(COL.ivory, 0.55));
    screen.add(frame);
    var stand = new T.LineSegments(new T.BufferGeometry().setFromPoints([
      new T.Vector3(0, -1.25, 0), new T.Vector3(0, -1.7, 0), new T.Vector3(-0.6, -1.7, 0), new T.Vector3(0.6, -1.7, 0)]), lineMat(COL.ivory, 0.4));
    screen.add(stand);

    var layers = [4, 6, 6, 3], nodes = [], linkPts = [];
    layers.forEach(function (n, li) {
      for (var k = 0; k < n; k++) {
        var p = new T.Vector3(-1.65 + li * 1.1, (k - (n - 1) / 2) * 0.36, 0);
        var m = new T.Mesh(new T.OctahedronGeometry(0.065, 0), solidMat(COL.ivory, 1));
        m.position.copy(p); m.userData = { home: p.clone(), layer: li, k: k };
        screen.add(m); nodes.push(m);
      }
    });
    var off = 0;
    for (var li = 0; li < layers.length - 1; li++) {
      for (var a = 0; a < layers[li]; a++) for (var b = 0; b < layers[li + 1]; b++) {
        linkPts.push(nodes[off + a].userData.home, nodes[off + layers[li] + b].userData.home);
      }
      off += layers[li];
    }
    var links = new T.LineSegments(new T.BufferGeometry().setFromPoints(linkPts), lineMat(COL.ivory, 0.16));
    screen.add(links);

    var arm = makeArm(); S.add(arm.group);
    // targets for collapsing nodes: the arm's joints
    var targets = [arm.j1, arm.j2, arm.j3, arm.j4, arm.tip];

    var t0 = performance.now(), inv = new T.Matrix4(), tgt = new T.Vector3();
    st.update = function (now) {
      var t = reduce ? 3 : (now - t0) / 1000;
      var p = reduce ? 0.72 : progressOf(section);
      var mobile = innerWidth <= 760;
      if (mobile) return false;

      // camera slowly orbits as the story advances
      var ang = -0.55 + p * 1.0;
      st.camera.position.set(Math.sin(ang) * 8.2, 2.6 + p * 0.6, Math.cos(ang) * 8.2);
      st.camera.lookAt(0, 1.45, 0);

      // 1) inference on a screen
      var collapse = smooth(0.14, 0.44, p);
      frame.material.opacity = 0.55 * (1 - smooth(0.1, 0.3, p));
      stand.material.opacity = 0.4 * (1 - smooth(0.1, 0.26, p));
      links.material.opacity = 0.16 * (1 - smooth(0.12, 0.34, p));
      screen.rotation.y = -ang * 0.85 * (1 - collapse);
      screen.updateMatrixWorld(true); arm.group.updateMatrixWorld(true);
      inv.copy(screen.matrixWorld).invert();
      nodes.forEach(function (n, i) {
        var pulse = 1 + 0.5 * Math.max(0, Math.sin(t * 3 - n.userData.layer * 1.1)) * (1 - collapse);
        targets[i % targets.length].getWorldPosition(tgt); tgt.applyMatrix4(inv);
        n.position.lerpVectors(n.userData.home, tgt, collapse);
        n.scale.setScalar(pulse * (1 - 0.5 * collapse));
        n.material.opacity = 1 - smooth(0.36, 0.48, p);
        n.material.color.setHex(collapse > 0.2 ? COL.gold : COL.ivory);
      });

      // 2) the machine assembles, bottom to top
      arm.parts.forEach(function (o, i) {
        var k = smooth(0.26 + i * 0.022, 0.34 + i * 0.022, p);
        setOpacity(o, k);
        o.position.y = o.userData.y - (1 - k) * 0.35;
      });

      // 3) and starts to act
      var q = smooth(0.5, 0.76, p), idle = reduce ? 0 : 1;
      arm.j1.rotation.y = q * 0.9 + Math.sin(t * 0.55) * 0.35 * q * idle;
      arm.j2.rotation.z = -q * (0.45 + Math.sin(t * 0.8) * 0.12 * idle);
      arm.j3.rotation.z = -q * (1.05 + Math.sin(t * 0.8 + 1) * 0.18 * idle);
      arm.j4.rotation.z = -q * (0.5 + Math.sin(t * 1.1) * 0.2 * idle);
      var grip = 0.05 + 0.04 * Math.max(0, Math.sin(t * 1.6)) * q * idle;
      arm.fl.position.x = -grip - 0.03; arm.fr.position.x = grip + 0.03;
      canvas.style.opacity = p >= 0.78 ? 0.18 : 1;
      return true;
    };
  })();

  /* =================================================================
     2. NETWORK — 3D Karnataka
     ================================================================= */
  (function () {
    var canvas = doc.getElementById('gl-map'), M = window.KA_MAP, wrap = doc.querySelector('.map__canvas'), mapSec = doc.getElementById('map-explorer');
    if (!canvas || !M || !wrap) return;
    wrap.classList.add('map--3d');
    var st = new Stage(canvas, 30), S = st.scene;
    var SC = 100, toX = function (x) { return (x - M.W / 2) / SC; }, toZ = function (y) { return (y - M.H / 2) / SC; };
    var REG = window.KA_REGIONS || [];

    var plate = new T.Group(); S.add(plate);
    var g = grid(14, 28, 0.08); g.position.y = -0.03; plate.add(g);
    var fills = {}, outlinePts = [];
    M.d.forEach(function (f) {
      var pts = [], re = /([ML])([\d.\-]+),([\d.\-]+)/g, m;
      while ((m = re.exec(f.d))) pts.push(new T.Vector2(toX(+m[2]), toZ(+m[3])));
      if (pts.length < 3) return;
      var kk = f.v === 'Kalaburagi';
      var mesh = new T.Mesh(new T.ShapeGeometry(new T.Shape(pts)), new T.MeshBasicMaterial({ color: kk ? COL.red : COL.ivory, transparent: true, opacity: kk ? 0.07 : 0.03, side: T.DoubleSide, depthWrite: false }));
      mesh.rotation.x = Math.PI / 2; mesh.userData.base = mesh.material.opacity; mesh.userData.kk = kk;
      plate.add(mesh); fills[f.n] = mesh;
      for (var i = 0; i < pts.length; i++) {
        var a = pts[i], b = pts[(i + 1) % pts.length];
        outlinePts.push(new T.Vector3(a.x, 0.002, a.y), new T.Vector3(b.x, 0.002, b.y));
      }
    });
    plate.add(new T.LineSegments(new T.BufferGeometry().setFromPoints(outlinePts), lineMat(COL.ivory, 0.32)));

    // nodes
    var nodes = {}, labels = {}, hub = null;
    REG.forEach(function (r, i) {
      var c = M.c[r.id]; if (!c) return;
      var pos = new T.Vector3(toX(c[0]), 0, toZ(c[1])), col = r.kk ? COL.red : COL.gold;
      var pg = new T.BoxGeometry(0.035, 1, 0.035); pg.translate(0, 0.5, 0);
      var pillar = new T.Mesh(pg, solidMat(col, 0.9)); pillar.position.copy(pos); pillar.scale.y = 0.001; plate.add(pillar);
      var cap = new T.Mesh(new T.OctahedronGeometry(0.08, 0), solidMat(col, 1)); cap.position.copy(pos); plate.add(cap);
      var ring = new T.Mesh(new T.RingGeometry(0.1, 0.125, 40), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, side: T.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.copy(pos).setY(0.01); plate.add(ring);
      var pulse = ring.clone(); pulse.material = ring.material.clone(); plate.add(pulse);
      nodes[r.id] = { pos: pos, pillar: pillar, cap: cap, ring: ring, pulse: pulse, h: r.id === 'Bengaluru' ? 1.25 : 0.75, cur: 0, i: i };
      var el = doc.createElement('button');
      el.type = 'button'; el.tabIndex = -1; el.className = 'ka3-label' + (r.kk ? ' kk' : '');
      el.textContent = r.label || r.id;
      el.addEventListener('click', function () { if (window.KA_SELECT) window.KA_SELECT(r.id); });
      canvas.parentElement.appendChild(el); labels[r.id] = el;
      if (r.id === 'Bengaluru') hub = pos;
    });

    // links from the anchor node
    var arcs = [];
    if (hub) REG.forEach(function (r, i) {
      if (r.id === 'Bengaluru' || !nodes[r.id]) return;
      var b = nodes[r.id].pos, d = hub.distanceTo(b);
      var mid = hub.clone().add(b).multiplyScalar(0.5); mid.y = 0.5 + d * 0.32;
      var curve = new T.QuadraticBezierCurve3(hub.clone().setY(0.02), mid, b.clone().setY(0.02));
      var pts = curve.getPoints(80);
      var line = new T.Line(new T.BufferGeometry().setFromPoints(pts), lineMat(r.kk ? COL.red : COL.gold, 0.6));
      line.geometry.setDrawRange(0, 0); plate.add(line);
      var dot = new T.Mesh(new T.SphereGeometry(0.035, 12, 10), solidMat(COL.ivory, 0)); plate.add(dot);
      arcs.push({ line: line, curve: curve, dot: dot, i: i, n: pts.length });
    });

    var sel = window.KA_REGION || 'Bengaluru';
    doc.addEventListener('map:select', function (e) { sel = e.detail; });
    var look = new T.Vector3(0, 0, 0.4), tmp = new T.Vector3(), t0 = performance.now();

    st.update = function (now) {
      var t = reduce ? 0 : (now - t0) / 1000;
      var r = mapSec.getBoundingClientRect();
      var p = reduce ? 1 : clamp((innerHeight - r.top) / (innerHeight * 1.05), 0, 1);
      var drift = reduce ? 0 : Math.sin(t * 0.15) * 0.06;
      var az = -0.42 + p * 0.38 + drift, pol = 0.86 - p * 0.12, R = 11.6;
      var sn = nodes[sel];
      tmp.set(0, 0, 0.4); if (sn) tmp.lerp(sn.pos, 0.28);
      look.lerp(tmp, 0.06);
      st.camera.position.set(look.x + R * Math.sin(pol) * Math.sin(az), R * Math.cos(pol), look.z + R * Math.sin(pol) * Math.cos(az));
      st.camera.lookAt(look);

      Object.keys(fills).forEach(function (n) {
        var f = fills[n], isSel = sn && REG.some(function (x) { return x.id === sel && x.d === n; });
        var target = isSel ? 0.16 : f.userData.base;
        f.material.opacity = lerp(f.material.opacity, target, 0.1);
        f.material.color.setHex(isSel ? (f.userData.kk ? COL.red : COL.gold) : (f.userData.kk ? COL.red : COL.ivory));
      });
      Object.keys(nodes).forEach(function (id) {
        var n = nodes[id], grow = smooth(0.15 + n.i * 0.05, 0.5 + n.i * 0.05, p), isSel = id === sel;
        n.cur = lerp(n.cur, (n.h + (isSel ? 0.45 : 0)) * grow, 0.12);
        n.pillar.scale.y = Math.max(0.001, n.cur);
        n.cap.position.y = n.cur + 0.08; n.cap.rotation.y = t * 0.8;
        n.cap.scale.setScalar(isSel ? 1.5 : 1);
        var ph = reduce ? 0.5 : (t * 0.6 + n.i * 0.13) % 1;
        n.pulse.scale.setScalar(1 + ph * (isSel ? 5 : 2.5));
        n.pulse.material.opacity = (1 - ph) * (isSel ? 0.7 : 0.25) * grow;
        // label
        tmp.copy(n.cap.position).project(st.camera);
        var lx = (tmp.x * 0.5 + 0.5) * st.w, ly = (-tmp.y * 0.5 + 0.5) * st.h;
        var el = labels[id];
        el.style.transform = 'translate(' + lx.toFixed(1) + 'px,' + (ly - 14).toFixed(1) + 'px) translate(-50%,-100%)';
        el.style.opacity = grow;
        el.classList.toggle('sel', isSel);
      });
      arcs.forEach(function (a) {
        var k = smooth(0.4 + a.i * 0.03, 0.85 + a.i * 0.03, p);
        a.line.geometry.setDrawRange(0, Math.floor(a.n * k));
        var u = reduce ? 0.6 : (t * 0.22 + a.i * 0.17) % 1;
        a.dot.position.copy(a.curve.getPoint(u));
        a.dot.material.opacity = k >= 1 ? 0.9 * Math.sin(u * Math.PI) : 0;
      });
      return true;
    };
  })();

  /* =================================================================
     3. JOURNEY — the robot builds itself
     ================================================================= */
  (function () {
    var canvas = doc.getElementById('gl-build');
    if (!canvas) return;
    var st = new Stage(canvas, 34), S = st.scene;
    var floor = grid(10, 40, 0.14); S.add(floor);
    var bot = new T.Group(); S.add(bot);
    var parts = [];
    function add(obj, parent, join, off) {
      parent.add(obj);
      var mats = []; obj.traverse(function (o) { if (o.material) mats.push(o.material); });
      parts.push({ obj: obj, join: join, home: obj.position.clone(), off: off || new T.Vector3(0, 1.2, 0), k: 0, mats: mats });
      return obj;
    }
    var chassis = edges(new T.BoxGeometry(1.6, 0.08, 1.1), COL.ivory); chassis.position.y = 0.36; add(chassis, bot, 0, new T.Vector3(0, 0, 0));
    var wheels = [];
    [[-0.52, -0.66], [0.52, -0.66], [-0.52, 0.66], [0.52, 0.66]].forEach(function (w) {
      var wh = edges(new T.CylinderGeometry(0.26, 0.26, 0.13, 22, 1), COL.ivory); wh.rotation.x = Math.PI / 2; wh.position.set(w[0], 0.26, w[1]);
      add(wh, bot, 0, new T.Vector3(w[0] * 1.6, 0.2, w[1] * 1.8)); wheels.push(wh);
    });
    var cam = edges(new T.BoxGeometry(0.12, 0.1, 0.2), COL.ivory); cam.position.set(0.82, 0.46, 0); add(cam, bot, 1, new T.Vector3(1.2, 0.8, 0));
    var compute = edges(new T.BoxGeometry(0.52, 0.06, 0.38), COL.ivory); compute.position.set(-0.25, 0.44, 0); add(compute, bot, 2, new T.Vector3(-1.4, 1.2, 0));
    [[-0.62, -0.42], [0.62, -0.42], [-0.62, 0.42], [0.62, 0.42]].forEach(function (s) {
      var so = edges(new T.CylinderGeometry(0.025, 0.025, 0.36, 8, 1), COL.ivory); so.position.set(s[0], 0.58, s[1]); add(so, bot, 2, new T.Vector3(s[0], 1.4, s[1]));
    });
    var deck = edges(new T.BoxGeometry(1.42, 0.05, 0.98), COL.ivory); deck.position.y = 0.78; add(deck, bot, 2, new T.Vector3(0, 1.6, 0));
    var lidar = new T.Group(); lidar.position.set(0.42, 0.89, 0);
    lidar.add(edges(new T.CylinderGeometry(0.17, 0.17, 0.13, 24, 1), COL.ivory));
    var lidarTop = edges(new T.CylinderGeometry(0.12, 0.17, 0.06, 24, 1), COL.ivory); lidarTop.position.y = 0.09; lidar.add(lidarTop);
    add(lidar, bot, 1, new T.Vector3(0.6, 1.6, 0.4));

    var arm = makeArm(); arm.group.scale.setScalar(0.42); arm.group.position.set(-0.35, 0.8, 0); bot.add(arm.group);
    var armLow = [], armHigh = [];
    arm.parts.forEach(function (o, i) { (i < 6 ? armLow : armHigh).push(o); });
    function addArmPart(o, join) {
      var mats = []; o.traverse(function (x) { if (x.material) mats.push(x.material); });
      parts.push({ obj: o, join: join, home: o.position.clone(), off: new T.Vector3(0, 2.4, 0), k: 0, mats: mats });
    }
    armLow.forEach(function (o) { addArmPart(o, 4); });
    armHigh.forEach(function (o) { addArmPart(o, 5); });

    // payload cube, maze, path, scan fan, simulation twin
    var cube = edges(new T.BoxGeometry(0.16, 0.16, 0.16), COL.gold); cube.position.set(-1.1, 0.08, 0.2); S.add(cube);
    var cubeHome = cube.position.clone();
    var maze = new T.LineSegments(new T.BufferGeometry().setFromPoints([
      [-2.6, -1.8, 2.6, -1.8], [2.6, -1.8, 2.6, 1.8], [2.6, 1.8, -2.6, 1.8], [-2.6, 1.8, -2.6, -1.8], [-0.6, -1.8, -0.6, -0.6], [1.2, 1.8, 1.2, 0.7], [-2.6, 0.5, -1.6, 0.5]
    ].reduce(function (a, s) { a.push(new T.Vector3(s[0], 0.01, s[1]), new T.Vector3(s[2], 0.01, s[3])); return a; }, [])), lineMat(COL.blue, 0));
    S.add(maze);
    var walls = new T.LineSegments(maze.geometry.clone().translate(0, 0.35, 0), lineMat(COL.blue, 0)); S.add(walls);
    var pathCurve = new T.EllipseCurve(0, 0, 1.55, 0.95, 0, Math.PI * 2, false, 0);
    var path = new T.LineLoop(new T.BufferGeometry().setFromPoints(pathCurve.getPoints(90).map(function (v) { return new T.Vector3(v.x, 0.015, v.y); })), lineMat(COL.gold, 0));
    S.add(path);
    var fanPts = []; for (var r = 0; r < 64; r++) { var a = r / 64 * Math.PI * 2; fanPts.push(new T.Vector3(0, 0, 0), new T.Vector3(Math.cos(a) * 2.2, 0, Math.sin(a) * 2.2)); }
    var fan = new T.LineSegments(new T.BufferGeometry().setFromPoints(fanPts), lineMat(COL.gold, 0)); fan.position.y = 0.92; bot.add(fan);
    var twin = new T.Group(); S.add(twin);
    [[1.6, 0.08, 1.1, 0.36], [1.42, 0.05, 0.98, 0.78], [0.34, 0.13, 0.34, 0.89]].forEach(function (b) {
      var c = edges(new T.BoxGeometry(b[0], b[1], b[2]), COL.blue, 0.4); c.position.y = b[3]; twin.add(c);
    });
    [[-0.52, -0.66], [0.52, -0.66], [-0.52, 0.66], [0.52, 0.66]].forEach(function (w) {
      var c = edges(new T.CylinderGeometry(0.26, 0.26, 0.13, 22, 1), COL.blue, 0.4); c.rotation.x = Math.PI / 2; c.position.set(w[0], 0.26, w[1]); twin.add(c);
    });
    setOpacity(twin, 0);
    twin.position.set(2.9, 0, -0.6);

    var step = window.KA_STEP || 0, stepT = performance.now();
    doc.addEventListener('journey:step', function (e) { if (e.detail !== step) { step = e.detail; stepT = performance.now(); } });
    var t0 = performance.now(), look = new T.Vector3(0, 0.6, 0), lookTo = new T.Vector3(), ivory = new T.Color(COL.ivory), gold = new T.Color(COL.gold);
    var tipW = new T.Vector3();

    st.update = function (now) {
      var t = reduce ? 2 : (now - t0) / 1000, ts = reduce ? 2 : (now - stepT) / 1000;
      // assembly
      parts.forEach(function (pt) {
        var target = step >= pt.join ? 1 : 0;
        pt.k += (target - pt.k) * (reduce ? 1 : 0.07);
        pt.obj.position.copy(pt.home).addScaledVector(pt.off, 1 - pt.k);
        var hot = step === pt.join && ts < 3.5, final = step === 7;
        pt.mats.forEach(function (m) {
          m.opacity = 0.1 + 0.9 * pt.k;
          if (m.userData.tint == null) m.userData.tint = m.color.getHex() !== COL.gold;
          if (m.userData.tint) {
            m.color.copy(ivory).lerp(gold, (hot || final) ? 0.85 : 0);
          }
        });
      });

      // motion per stage
      var moving = step === 3 || step >= 6;
      var u = reduce ? 0.15 : (t * 0.09) % 1;
      var bp = new T.Vector3();
      if (moving) {
        var p0 = pathCurve.getPoint(u), p1 = pathCurve.getPoint((u + 0.01) % 1);
        bot.position.lerp(bp.set(p0.x, 0, p0.y), 0.12);
        bot.rotation.y = -Math.atan2(p1.y - p0.y, p1.x - p0.x);
        wheels.forEach(function (w) { w.rotation.y = -t * 6; });
      } else {
        bot.position.lerp(bp.set(0, 0, 0), 0.08);
        bot.rotation.y += (0 - bot.rotation.y) * 0.08;
      }
      fan.rotation.y = t * 2.4;
      fan.material.opacity = lerp(fan.material.opacity, (step === 1 || step === 3 || step === 7) ? 0.22 : 0, 0.08);
      maze.material.opacity = walls.material.opacity = lerp(maze.material.opacity, step >= 3 ? 0.45 : 0, 0.06);
      path.material.opacity = lerp(path.material.opacity, step === 3 || step >= 6 ? 0.55 : 0, 0.06);
      setOpacity(twin, lerp(twin.children[0].material.opacity, step === 2 ? 0.45 : 0, 0.08));
      twin.rotation.y = Math.sin(t * 0.4) * 0.2;

      // arm behaviour
      var j2 = 0, j3 = 0, j4 = 0, j1 = 0, carry = false;
      if (step === 4) { // control: damped oscillation, settling
        var e = Math.exp(-(ts % 4) * 1.4);
        j2 = -0.5 + 0.6 * e * Math.cos(ts * 9); j3 = -0.9 + 0.5 * e * Math.sin(ts * 9);
      } else if (step === 5) { // pick and place
        var c = (ts % 6) / 6, reach = smooth(0, 0.25, c) * (1 - smooth(0.75, 1, c));
        j1 = -2.4 + smooth(0.35, 0.65, c) * 2.4;
        j2 = -0.9 * reach; j3 = -1.4 * reach; j4 = -0.6 * reach;
        carry = c > 0.28 && c < 0.8;
      } else if (step >= 6) {
        j1 = Math.sin(t * 0.5) * 0.4; j2 = -0.2; j3 = -1.6; j4 = -0.4; carry = true;
      }
      arm.j1.rotation.y += (j1 - arm.j1.rotation.y) * 0.1;
      arm.j2.rotation.z += (j2 - arm.j2.rotation.z) * 0.15;
      arm.j3.rotation.z += (j3 - arm.j3.rotation.z) * 0.15;
      arm.j4.rotation.z += (j4 - arm.j4.rotation.z) * 0.15;
      var g = carry ? 0.05 : 0.09; arm.fl.position.x = -g; arm.fr.position.x = g;
      bot.updateMatrixWorld(true);
      if (carry && step >= 5) { arm.tip.getWorldPosition(tipW); cube.position.lerp(tipW, 0.35); }
      else cube.position.lerp(cubeHome, 0.15);
      cube.material.opacity = step >= 5 ? 1 : 0;

      // camera
      lookTo.set(step === 2 ? 1.4 : bot.position.x * 0.5, 0.6, step === 2 ? -0.3 : bot.position.z * 0.5);
      look.lerp(lookTo, 0.05);
      var ang = (reduce ? 0.7 : t * (step === 7 ? 0.35 : 0.12)) + 0.6, R = step === 2 ? 6.4 : (step >= 3 ? 5.6 : 4.4);
      st.camera.position.set(look.x + Math.sin(ang) * R, 2.3 + (step >= 3 ? 0.9 : 0), look.z + Math.cos(ang) * R);
      st.camera.lookAt(look);
      return true;
    };
  })();

  /* ---------- loop ---------- */
  function loop(now) {
    for (var i = 0; i < stages.length; i++) {
      var s = stages[i];
      if (!s.visible || !s.update) continue;
      if (s.update(now) !== false) s.draw();
    }
    if (!reduce) requestAnimationFrame(loop);
  }
  if (reduce) {
    // draw each scene once when it first becomes visible, then on scroll
    addEventListener('scroll', function () { requestAnimationFrame(function (n) { stages.forEach(function (s) { if (s.visible && s.update && s.update(n) !== false) s.draw(); }); }); }, { passive: true });
    doc.addEventListener('journey:step', function () { requestAnimationFrame(loop); });
    doc.addEventListener('map:select', function () { requestAnimationFrame(loop); });
    setTimeout(function () { requestAnimationFrame(loop); }, 300);
  } else requestAnimationFrame(loop);
})();
