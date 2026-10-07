/* نجمة نُبل وابتكار — مرشد الموقع ثلاثي الأبعاد: تتنقل بين الشرائح والصفحات والعناصر (three.js) */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const NB = (window.NB = window.NB || {});
const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const host = document.getElementById('fx');
const dock = document.getElementById('dock');

function fail() { root.classList.add('nogl'); }

if (host) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }); } catch (e) { fail(); }
  if (renderer) {
    const dpr = Math.min(window.devicePixelRatio || 1, innerWidth < 700 ? 1.6 : 2);
    renderer.setPixelRatio(dpr);
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 10, 6000);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const key = new THREE.DirectionalLight(0xfff1d6, 2.4); key.position.set(0.6, 0.8, 1); scene.add(key);
    const rim = new THREE.PointLight(0x2c7a97, 8, 0, 2); scene.add(rim);
    const spark = new THREE.PointLight(0xf2cf8f, 5, 0, 2); scene.add(spark);
    scene.add(new THREE.AmbientLight(0x223038, 1.1));

    const rig = new THREE.Group();        // الموضع والحجم
    const spin = new THREE.Group();       // الدوران
    rig.add(spin); scene.add(rig); rig.visible = false;

    /* جزيئات ذهبية تتبع النجمة أثناء الانتقال */
    const N = 90, ppos = new Float32Array(N * 3), plife = new Float32Array(N), pvel = new Float32Array(N * 2);
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(ppos, 3));
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,230,170,1)'); gr.addColorStop(.35, 'rgba(240,180,80,.55)'); gr.addColorStop(1, 'rgba(240,180,80,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const pm = new THREE.PointsMaterial({ size: 22, map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .9, sizeAttenuation: false });
    const pts = new THREE.Points(pg, pm); pts.frustumCulled = false; scene.add(pts);
    let pi = 0;
    function emit(x, y, vx, vy) { const i = pi++ % N; ppos[i * 3] = x; ppos[i * 3 + 1] = y; ppos[i * 3 + 2] = -5; pvel[i * 2] = vx; pvel[i * 2 + 1] = vy; plife[i] = 1; }

    const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
    let ready = false;
    loader.load(host.dataset.model, (gltf) => {
      const m = gltf.scene;
      const box = new THREE.Box3().setFromObject(m); const size = box.getSize(new THREE.Vector3());
      m.position.sub(box.getCenter(new THREE.Vector3()));
      const k = 1 / Math.max(size.x, size.y, size.z);
      const wrap = new THREE.Group(); wrap.add(m); wrap.scale.setScalar(k); spin.add(wrap);
      m.traverse((o) => { if (o.isMesh) { o.material.envMapIntensity = 1.5; o.material.side = THREE.DoubleSide; } });
      ready = true; rig.visible = true; root.classList.add('fx-ready');
    }, undefined, fail);

    let W = 0, H = 0;
    function resize() {
      W = innerWidth; H = innerHeight;
      renderer.setSize(W, H, false);
      camera.aspect = W / H;
      const d = (H / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      camera.position.set(0, 0, d); camera.updateProjectionMatrix();
      rim.position.set(-W * .4, -H * .3, 300); spark.position.set(W * .3, H * .3, 500);
    }
    addEventListener('resize', resize); resize();

    /* الهدف: أكثر عنصر [data-slot] ظهوراً في الشاشة، وإلا الرُّكن (dock) */
    const cur = { x: W / 2, y: H / 2, s: 10, ry: 0, rx: 0, a: 0 };
    const vel = { x: 0, y: 0, s: 0 };
    let spinBoost = 0, lastSlot = null, pointer = { x: 0, y: 0, in: false };
    NB.pulse = (amt = 8) => { spinBoost += amt; };
    addEventListener('pointermove', (e) => { pointer.x = (e.clientX / innerWidth) * 2 - 1; pointer.y = (e.clientY / innerHeight) * 2 - 1; pointer.in = true; }, { passive: true });
    document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('[data-slot]')) NB.pulse(10); });

    function pickTarget() {
      if (NB.flying) return { x: W / 2, y: H / 2, s: Math.min(W, H) * (innerWidth < 700 ? .62 : .5), slot: 'fly' };
      const slots = document.querySelectorAll('[data-slot]');
      let best = null, bs = 0;
      slots.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 20 || r.bottom < 0 || r.top > H) return;
        const vis = Math.max(0, Math.min(r.bottom, H) - Math.max(r.top, 0)) / Math.max(r.height, 1);
        const cy = (r.top + r.bottom) / 2, dist = Math.abs(cy - H / 2) / H;
        const score = vis * (1.2 - dist);
        if (vis > .55 && score > bs) { bs = score; best = { el, r }; }
      });
      if (best) {
        const r = best.r; return { x: r.left + r.width / 2, y: r.top + r.height / 2, s: Math.min(r.width, r.height) * (+best.el.dataset.scale || 1), slot: best.el, tilt: +best.el.dataset.tilt || 0 };
      }
      const r = dock ? dock.getBoundingClientRect() : { left: 20, top: H - 90, width: 64, height: 64 };
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, s: r.width * 1.18, slot: 'dock' };
    }

    const clock = new THREE.Clock(); let t = 0, ry = 0;
    function frame() {
      requestAnimationFrame(frame);
      if (document.hidden || !ready) return;
      const dt = Math.min(clock.getDelta(), .05); t += dt;
      const tg = pickTarget();
      if (tg.slot !== lastSlot) { if (lastSlot && !reduce) spinBoost += 9; lastSlot = tg.slot; root.dataset.fxSlot = tg.slot === 'dock' ? 'dock' : tg.slot === 'fly' ? 'fly' : 'slot'; }
      // نابض مخمّد
      const k = reduce ? 1 : 120, dmp = 2 * Math.sqrt(k) * .85;
      if (reduce) { cur.x = tg.x; cur.y = tg.y; cur.s = tg.s; } else {
        vel.x += ((tg.x - cur.x) * k - vel.x * dmp) * dt; cur.x += vel.x * dt;
        vel.y += ((tg.y - cur.y) * k - vel.y * dmp) * dt; cur.y += vel.y * dt;
        vel.s += ((tg.s - cur.s) * k * 1.1 - vel.s * dmp) * dt; cur.s += vel.s * dt;
      }
      const speed = Math.hypot(vel.x, vel.y);
      if (!reduce && speed > 220) { for (let i = 0; i < 2; i++) emit(cur.x - W / 2 + (Math.random() - .5) * cur.s * .5, -(cur.y - H / 2) + (Math.random() - .5) * cur.s * .5, -vel.x * .05, vel.y * .05); }
      for (let i = 0; i < N; i++) { if (plife[i] > 0) { plife[i] -= dt * 1.6; ppos[i * 3] += pvel[i * 2] * dt * 3; ppos[i * 3 + 1] += pvel[i * 2 + 1] * dt * 3; if (plife[i] <= 0) ppos[i * 3 + 2] = 99999; } else ppos[i * 3 + 2] = 99999; }
      pg.attributes.position.needsUpdate = true; pm.opacity = .9;
      // دوران: خمول + دفعة عند الانتقال + ربط بالتمرير
      spinBoost *= Math.pow(.025, dt);
      ry += dt * (reduce ? 0 : .45 + spinBoost * 1.4) + (reduce ? 0 : vel.x * dt * .0009);
      const wob = reduce ? 0 : Math.sin(t * 1.1) * .06;
      const px = pointer.in ? pointer.x : 0, py = pointer.in ? pointer.y : 0;
      const near = tg.slot === 'dock' ? 0 : 1;
      spin.rotation.y = ry + px * .35 * near;
      spin.rotation.x = wob - py * .25 * near + (tg.tilt || 0) * .15;
      spin.rotation.z = Math.sin(t * .6) * .05;
      rig.position.set(cur.x - W / 2, -(cur.y - H / 2) + (reduce ? 0 : Math.sin(t * 1.3) * cur.s * .02), 0);
      rig.scale.setScalar(Math.max(cur.s, 1));
      const sh = reduce ? 1 : 1 + Math.sin(t * 1.6) * .18 + Math.sin(t * 4.3) * .08; spark.intensity = 5 * sh;
      renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);
  }
} else { fail(); }
