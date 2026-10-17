/* أسهم نُبل وابتكار للتسويق — مجسّم WebGL تفاعلي يتلوّن ويتأثر بالمؤشر ويعبر الشاشة في التنقّل بين الصفحات */
import {
  WebGLRenderer, Scene, PerspectiveCamera, PMREMGenerator, DirectionalLight, PointLight, AmbientLight,
  Group, Mesh, Shape, ExtrudeGeometry, MeshPhysicalMaterial, Color, Raycaster, Vector2,
  NoToneMapping, SRGBColorSpace,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

(function () {
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ON_DARK = ['#D06429', '#338C89', '#DB9C47', '#FFFFFF'];
  const ON_LIGHT = ['#18566D', '#D06429', '#338C89', '#DB9C47'];
  const PAL = ['#D06429', '#338C89', '#DB9C47', '#FFFFFF', '#18566D', '#E4B575', '#66A9A6', '#DC8B5E'];
  const GAP = 50, STACK_H = GAP * 3 + 58, STACK_W = 92;
  const Z_IDLE = '45', Z_FLY = '95';

  let renderer;
  try {
    const t = document.createElement('canvas');
    if (!(t.getContext('webgl2') || t.getContext('webgl'))) throw 0;
    renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { root.classList.add('nogl'); return; }

  const cv = renderer.domElement;
  cv.id = 'cx3d'; cv.setAttribute('aria-hidden', 'true');
  cv.style.cssText = `position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:${Z_IDLE}`;
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = NoToneMapping;
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  const cam = new PerspectiveCamera(30, 1, 1, 10000);
  scene.environment = new PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  const key = new DirectionalLight(0xfff3e0, 1.05); key.position.set(300, 500, 700); scene.add(key);
  const rim = new PointLight(0x66a9a6, 2.5, 0, 0); rim.position.set(-600, -300, -300); scene.add(rim);
  scene.add(new AmbientLight(0xffffff, 0.15));

  let W = 1, H = 1;
  function resize() {
    W = root.clientWidth || innerWidth; H = innerHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, W < 700 ? 1.5 : 1.75));
    renderer.setSize(W, H, false);
    cam.aspect = W / H; cam.position.set(0, 0, (H / 2) / Math.tan((15 * Math.PI) / 180));
    cam.far = cam.position.z * 4; cam.updateProjectionMatrix();
  }

  // ---------- شكل السهم (^) بأطراف وزاوية مستديرة ----------
  function chevronGeo() {
    const w = 38, h = 19, r = 7, s = Math.SQRT1_2;
    const A = [-w, -h], P = [0, h], B = [w, -h];
    const nL = [-s, s], nR = [s, s];
    const sh = new Shape();
    sh.moveTo(A[0] + nL[0] * r, A[1] + nL[1] * r);
    sh.lineTo(P[0] + nL[0] * r, P[1] + nL[1] * r);
    sh.absarc(P[0], P[1], r, (3 * Math.PI) / 4, Math.PI / 4, true);
    sh.lineTo(B[0] + nR[0] * r, B[1] + nR[1] * r);
    sh.absarc(B[0], B[1], r, Math.PI / 4, -(3 * Math.PI) / 4, true);
    sh.lineTo(P[0], P[1] - r * Math.SQRT2);
    sh.lineTo(A[0] - nL[0] * r, A[1] - nL[1] * r);
    sh.absarc(A[0], A[1], r, -Math.PI / 4, (3 * Math.PI) / 4, true);
    const g = new ExtrudeGeometry(sh, { depth: 13, bevelEnabled: true, bevelThickness: 3.2, bevelSize: 2.6, bevelSegments: 5, curveSegments: 18 });
    g.translate(0, 0, -6.5); g.computeVertexNormals();
    return g;
  }
  const GEO = chevronGeo();

  // ---------- النسخ (كل خانة .slot في الصفحة = مجسّم) ----------
  const insts = [];
  const tmpC = new Color();
  function makeInst(colors) {
    const pivot = new Group(), rig = new Group(); pivot.add(rig); scene.add(pivot);
    const items = colors.map((c, i) => {
      const mat = new MeshPhysicalMaterial({ color: new Color(c), roughness: 0.38, metalness: 0.05, clearcoat: 0.7, clearcoatRoughness: 0.22, envMapIntensity: 0.32, emissive: new Color(0x000000) });
      const m = new Mesh(GEO, mat); rig.add(m);
      const it = { m, mat, base: new Color(c), target: new Color(c), i, hot: 0, hit: false, lastHit: 0, cyc: 0, pal: PAL.indexOf(c.toUpperCase()), spin: 0, f: 0 };
      m.userData.it = it; return it;
    });
    const inst = { pivot, rig, items, slot: null, scale: 1, x: 0, y: 0, appear: 0, appearTo: 1, born: performance.now(), ry: -0.5, rx: -0.28, fan: 1, flight: null, alive: true, burst: 0 };
    pivot.userData.inst = inst; insts.push(inst); return inst;
  }
  function setColors(inst, colors) { inst.items.forEach((it, k) => { it.base.set(colors[k]); it.target.set(colors[k]); it.pal = PAL.indexOf(colors[k].toUpperCase()); }); }
  function kill(inst) { inst.alive = false; scene.remove(inst.pivot); inst.items.forEach((it) => it.mat.dispose()); insts.splice(insts.indexOf(inst), 1); if (inst.slot) inst.slot.classList.remove('gl-on'); }
  const darkOf = (el) => !!el.closest('.dark,.terra,.hero,.s-end,.sec-navy,.slide.dark,.slide.terra,.hero-star,.hero-slot');
  function slotFit(slot) {
    const r = slot.getBoundingClientRect(); const k = parseFloat(slot.dataset.scale || '1') || 1;
    return { x: r.left + r.width / 2 - W / 2, y: H / 2 - (r.top + r.height / 2), s: Math.max(0.25, Math.min((r.height * 0.82) / STACK_H, (r.width * 0.8) / STACK_W)) * Math.min(k, 1.15), r };
  }
  function bind(inst, slot) { inst.slot = slot; slot.classList.add('gl-on'); }
  function scan(skip) {
    document.querySelectorAll('#main .slot[data-slot], main .slot[data-slot]').forEach((slot) => {
      if (slot === skip || insts.some((i) => i.slot === slot)) return;
      const inst = makeInst(darkOf(slot) ? ON_DARK : ON_LIGHT); bind(inst, slot);
      inst.born = performance.now() + (reduce ? 0 : 120);
    });
    insts.slice().forEach((i) => { if (i.slot && !i.flight && !document.contains(i.slot)) kill(i); });
  }

  // ---------- المؤشر ----------
  const ptr = { x: -9999, y: -9999, on: false, moved: false, t: 0 };
  const ray = new Raycaster(), ndc = new Vector2();
  let hotInst = null;
  addEventListener('pointermove', (e) => { ptr.x = e.clientX; ptr.y = e.clientY; ptr.on = true; ptr.moved = true; ptr.t = performance.now(); }, { passive: true });
  document.addEventListener('pointerleave', () => { ptr.on = false; }, { passive: true });
  addEventListener('pointerup', (e) => { if (e.pointerType === 'touch') setTimeout(() => { if (performance.now() - ptr.t > 900) ptr.on = false; }, 1000); }, { passive: true });
  addEventListener('pointerdown', (e) => {
    ptr.x = e.clientX; ptr.y = e.clientY; ptr.on = true; ptr.t = performance.now();
    const hit = pick(); if (!hit) return;
    const inst = hit.m.parent.parent.userData.inst; inst.burst = 1;
    inst.items.forEach((it, k) => { it.spin += Math.PI * 2 * (k % 2 ? -1 : 1); it.pal = (it.pal + 1 + k) % PAL.length; it.target.set(PAL[it.pal]); it.lastHit = performance.now() + 1600; });
    if (window.NB && NB.pulse) NB.pulse(10);
  }, { passive: true });
  function pick() {
    ndc.set((ptr.x / W) * 2 - 1, -(ptr.y / H) * 2 + 1); ray.setFromCamera(ndc, cam);
    const ms = []; insts.forEach((i) => { if (i.pivot.visible && i.appear > 0.5) i.items.forEach((it) => ms.push(it.m)); });
    const h = ray.intersectObjects(ms, false)[0]; return h ? h.object.userData.it : null;
  }

  // ---------- العبور بين الصفحات ----------
  let flyer = null, phase = '';
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  function startFlight(inst, to, dur, onEnd) {
    inst.flight = { t0: performance.now(), dur, from: { x: inst.x, y: inst.y, s: inst.scale, ry: inst.ry, fan: inst.fan }, to, onEnd };
  }
  function onLeave() {
    phase = 'leave'; cv.style.zIndex = Z_FLY;
    const vis = insts.filter((i) => i.slot && i.pivot.visible && i.appear > 0.3);
    flyer = vis.sort((a, b) => b.scale - a.scale)[0] || null;
    if (!flyer) { flyer = makeInst(ON_DARK); flyer.appear = 1; flyer.born = 0; flyer.x = W / 2 + 160; flyer.y = -H / 2 - 160; flyer.scale = 0.8; }
    if (flyer.slot) flyer.slot = null;
    insts.forEach((i) => { if (i !== flyer) i.appearTo = 0; });
    setColors(flyer, ON_DARK);
    const big = Math.min((H * 0.62) / STACK_H, (W * 0.5) / STACK_W);
    startFlight(flyer, { x: 0, y: 0, s: big, ry: flyer.ry + Math.PI * 2, fan: 1.32 }, reduce ? 1 : 640);
  }
  function onEnter() {
    phase = 'enter';
    insts.slice().forEach((i) => { if (i !== flyer) kill(i); });
    const slots = Array.from(document.querySelectorAll('#main .slot[data-slot], main .slot[data-slot]'));
    const first = slots.find((s) => { const r = s.getBoundingClientRect(); return r.width > 4 && r.bottom > 0 && r.top < H; });
    scan(first);
    insts.forEach((i) => { if (i !== flyer) { i.born = performance.now() + 380; } });
    if (!flyer) return;
    const f = flyer;
    if (first) {
      const t = slotFit(first); setColors(f, darkOf(first) ? ON_DARK : ON_LIGHT);
      startFlight(f, { x: t.x, y: t.y, s: t.s, ry: -0.5 - Math.PI * 2, fan: 1, slot: first }, reduce ? 1 : 760, () => { bind(f, first); });
    } else {
      startFlight(f, { x: -W / 2 - 240, y: H / 2 + 200, s: f.scale * 0.6, ry: f.ry - Math.PI, fan: 1 }, reduce ? 1 : 700, () => kill(f));
    }
    flyer = null;
  }
  new MutationObserver(() => {
    const L = root.classList.contains('leaving'), E = root.classList.contains('entering');
    if (L && phase !== 'leave') onLeave();
    else if (E && phase !== 'enter') onEnter();
    else if (!L && !E && phase) { phase = ''; setTimeout(() => { if (!phase) cv.style.zIndex = Z_IDLE; }, 60); }
  }).observe(root, { attributes: true, attributeFilter: ['class'] });

  // ---------- الحلقة ----------
  let last = performance.now(), wasAny = true;
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now; const t = now / 1000;
    const k = 1 - Math.pow(0.0015, dt), kf = 1 - Math.pow(0.02, dt);

    let hit = null;
    if (ptr.on && (ptr.moved || insts.some((i) => i.flight))) { hit = pick(); ptr.moved = false; }
    else if (ptr.on) hit = hotInst;
    hotInst = hit;
    root.classList.toggle('cx-hot', !!hit);

    let any = false;
    for (const inst of insts.slice()) {
      // الموضع: رحلة عبور أو تتبّع الخانة
      if (inst.flight) {
        const F = inst.flight, p = Math.min(1, (now - F.t0) / F.dur), e = ease(p);
        let tx = F.to.x, ty = F.to.y, ts = F.to.s;
        if (F.to.slot) { const sf = slotFit(F.to.slot); tx = sf.x; ty = sf.y; ts = sf.s; }
        const arc = Math.sin(Math.PI * p) * Math.min(W, H) * 0.12;
        inst.x = F.from.x + (tx - F.from.x) * e; inst.y = F.from.y + (ty - F.from.y) * e + arc;
        inst.scale = F.from.s + (ts - F.from.s) * e; inst.ry = F.from.ry + (F.to.ry - F.from.ry) * e; inst.fan = F.from.fan + (F.to.fan - F.from.fan) * e;
        inst.appear = 1; inst.pivot.visible = true;
        if (p >= 1) { inst.flight = null; inst.ry = ((inst.ry % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); if (inst.ry > Math.PI) inst.ry -= Math.PI * 2; F.onEnd && F.onEnd(); if (!inst.alive) continue; }
      } else if (inst.slot) {
        const sf = slotFit(inst.slot);
        const off = sf.r.bottom < -80 || sf.r.top > H + 80 || sf.r.width < 4 || getComputedStyle(inst.slot).visibility === 'hidden';
        inst.pivot.visible = !off && inst.appear > 0.001; if (off && inst.appearTo > 0) { inst.x = sf.x; inst.y = sf.y; inst.scale = sf.s; continue; }
        inst.x = sf.x; inst.y = sf.y; inst.scale = sf.s;
      } else if (phase === 'leave' && inst === flyer) { inst.ry += dt * 0.9; }
      // الظهور والاختفاء
      const born = now >= inst.born;
      inst.appear += ((born ? inst.appearTo : 0) - inst.appear) * (inst.appearTo ? kf * 0.9 : kf * 1.6);
      if (inst.appearTo === 0 && inst.appear < 0.01 && inst !== flyer) { kill(inst); continue; }
      if (!inst.pivot.visible) continue;
      any = true;
      // الميلان مع المؤشر + تمايل هادئ
      const cx = inst.x + W / 2, cy = H / 2 - inst.y;
      const px = ptr.on ? (ptr.x - cx) / W : 0, py = ptr.on ? (ptr.y - cy) / H : 0;
      const sway = reduce ? 0 : Math.sin(t * 0.6 + inst.born * 0.001) * 0.12;
      const tRy = (inst.flight ? inst.ry : -0.5 + sway + px * 1.3), tRx = -0.26 + py * 0.7 + (reduce ? 0 : Math.cos(t * 0.5) * 0.05);
      if (!inst.flight) inst.ry += (tRy - inst.ry) * k * 0.6;
      inst.rx += (tRx - inst.rx) * k * 0.6;
      inst.burst *= Math.pow(0.08, dt);
      const ap = inst.appear;
      inst.pivot.position.set(inst.x, inst.y, 0);
      inst.pivot.scale.setScalar(inst.scale * (0.55 + 0.45 * ap) * (1 + inst.burst * 0.08));
      inst.rig.rotation.set(inst.rx, inst.ry, 0);
      const n = inst.items.length;
      const instHot = !!hit && inst.items.includes(hit);
      if (instHot && !inst.hov) inst.items.forEach((it, j) => { it.waveAt = now + Math.abs(j - inst.items.indexOf(hit)) * 85; });
      inst.hov = instHot;
      inst.items.forEach((it, j) => {
        const ly = ((n - 1) / 2 - j) * GAP * inst.fan;
        // قرب المؤشر من السهم (بالبكسل على الشاشة)
        const iy = cy - ly * inst.scale, dx = ptr.x - cx, dy = ptr.y - iy;
        const R = 70 * inst.scale + 50, near = ptr.on ? Math.exp(-((dx * dx + dy * dy) / (R * R))) : 0;
        it.f += (near - it.f) * k;
        const isHit = hit === it;
        if (isHit && !it.hit) { it.spin += Math.PI * 2 * (j % 2 ? -1 : 1); it.cyc = now; it.pal = (it.pal + 1) % PAL.length; it.target.set(PAL[it.pal]); if (window.NB && NB.pulse) NB.pulse(4); }
        if (isHit && now - it.cyc > 700) { it.cyc = now; it.pal = (it.pal + 1) % PAL.length; it.target.set(PAL[it.pal]); }
        if (it.waveAt && now >= it.waveAt) { it.waveAt = 0; if (!isHit) { it.pal = (it.pal + 1) % PAL.length; it.target.set(PAL[it.pal]); it.lastHit = now + 600; it.spin += Math.PI * (j % 2 ? -1 : 1); } }
        if (isHit) it.lastHit = Math.max(it.lastHit, now);
        it.hit = isHit;
        if (!isHit && now - it.lastHit > 1400 && !it.target.equals(it.base)) it.target.copy(it.base);
        it.hot += ((isHit ? 1 : 0) - it.hot) * k;
        it.mat.color.lerp(it.target, 1 - Math.pow(0.0008, dt));
        tmpC.copy(it.mat.color).multiplyScalar(0.14 * it.hot + 0.06 * it.f); it.mat.emissive.copy(tmpC);
        const flo = reduce ? 0 : Math.sin(t * 1.3 + j * 0.8) * 3;
        const drop = (1 - Math.min(1, ap * 1.25 - j * 0.08)) * 90;
        it.m.position.set(-Math.sign(dx || 1) * it.f * 10, ly + flo - drop, it.f * 46 + it.hot * 18);
        it.m.rotation.x += ((-it.f * 0.35) - it.m.rotation.x) * k;
        it.m.rotation.z += ((Math.max(-1, Math.min(1, dx / R)) * it.f * 0.45) - it.m.rotation.z) * k;
        it.m.rotation.y += (it.spin - it.m.rotation.y) * (1 - Math.pow(0.03, dt));
        const sc = 1 + it.f * 0.14 + it.hot * 0.08;
        it.m.scale.set(sc * (1 + it.hot * 0.06), sc * (1 - it.hot * 0.05), sc * (1 + it.hot * 0.3));
      });
    }
    if (any || wasAny) renderer.render(scene, cam);
    wasAny = any;
  }

  function boot() {
    resize(); document.body.appendChild(cv); root.classList.add('gl3');
    scan(); insts.forEach((i, k) => { i.born = performance.now() + 250 + k * 120; });
    requestAnimationFrame(frame);
    addEventListener('resize', resize);
    // الصفحات التي تُحمَّل خانات جديدة لاحقاً
    let pend = false;
    new MutationObserver(() => { if (pend || phase) return; pend = true; setTimeout(() => { pend = false; if (!phase) scan(); }, 120); })
      .observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
