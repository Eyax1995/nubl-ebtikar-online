/* نجمة نُبل وابتكار — عرض ثلاثي الأبعاد في واجهة الموقع (three.js) */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const stageEl = document.getElementById('stage');
if (stageEl) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { stageEl.classList.add('nogl'); }
  if (renderer) {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    stageEl.prepend(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 0.1, 4.7);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    const key = new THREE.DirectionalLight(0xfff1d6, 2.2); key.position.set(3, 4, 5); scene.add(key);
    const rim = new THREE.PointLight(0x2c7a97, 6, 12, 2); rim.position.set(-3.2, -1.5, -2.5); scene.add(rim);
    const spark = new THREE.PointLight(0xf2cf8f, 3.5, 10, 2); spark.position.set(1.5, 2, 3); scene.add(spark);
    scene.add(new THREE.AmbientLight(0x1a2226, 1.2));

    const pivot = new THREE.Group(); const tilt = new THREE.Group(); pivot.add(tilt); scene.add(pivot);
    const mats = [];

    new GLTFLoader().load(stageEl.dataset.model || 'star.glb', (gltf) => {
      const model = gltf.scene;
      model.traverse((o) => { if (o.isMesh) { o.material.envMapIntensity = 1.3; mats.push(o.material); } });
      const box = new THREE.Box3().setFromObject(model); const c = box.getCenter(new THREE.Vector3()); model.position.sub(c);
      tilt.add(model); stageEl.classList.add('ready'); requestAnimationFrame(loop);
    }, undefined, () => { stageEl.classList.add('nogl'); });

    function resize() {
      const w = stageEl.clientWidth, h = stageEl.clientHeight; if (!w || !h) return;
      camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h, false);
    }
    window.addEventListener('resize', resize); resize();

    let hover = false, down = false, lastX = 0, lastY = 0, parX = 0, parY = 0, rotY = 0, rotX = 0, vX = 0, vY = 0;
    stageEl.addEventListener('pointerenter', () => { hover = true; });
    stageEl.addEventListener('pointerleave', () => { hover = false; parX = 0; parY = 0; });
    window.addEventListener('pointermove', (e) => {
      const r = stageEl.getBoundingClientRect();
      if (!down) { parX = ((e.clientX - r.left) / r.width) * 2 - 1; parY = ((e.clientY - r.top) / r.height) * 2 - 1; hover = true; }
      else { const dx = e.clientX - lastX, dy = e.clientY - lastY; rotY += dx * 0.008; rotX = Math.max(-0.55, Math.min(0.55, rotX + dy * 0.008)); vX = dx * 0.008; vY = dy * 0.008; lastX = e.clientX; lastY = e.clientY; }
    }, { passive: true });
    stageEl.addEventListener('pointerdown', (e) => { down = true; lastX = e.clientX; lastY = e.clientY; stageEl.classList.add('dragging'); try { stageEl.setPointerCapture(e.pointerId); } catch (_) {} });
    const up = () => { down = false; stageEl.classList.remove('dragging'); };
    stageEl.addEventListener('pointerup', up); stageEl.addEventListener('pointercancel', up);

    const clock = new THREE.Clock();
    function loop() {
      requestAnimationFrame(loop);
      const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
      if (!down) { if (!reduceMotion) rotY += dt * 0.25; rotY += vX; rotX += vY; vX *= 0.92; vY *= 0.92; }
      pivot.rotation.y = rotY; pivot.rotation.x = rotX * 0.4;
      const ease = 0.06;
      tilt.rotation.y += ((hover ? parX * 0.3 : 0) - tilt.rotation.y) * ease;
      tilt.rotation.x += ((hover ? -parY * 0.22 : 0) - tilt.rotation.x) * ease;
      tilt.position.y = reduceMotion ? 0 : Math.sin(t * 1.1) * 0.06;
      const shimmer = reduceMotion ? 1 : (1 + Math.sin(t * 1.6) * 0.18 + Math.sin(t * 4.3) * 0.08);
      mats.forEach((m) => { if (m.emissiveIntensity !== undefined) m.emissiveIntensity = 0.35 * shimmer; });
      spark.intensity = 3.5 * shimmer;
      renderer.render(scene, camera);
    }
  }
}
