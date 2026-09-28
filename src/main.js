/**
 * Pelican Pedal — a real-time 3D scene.
 * Wires the renderer, camera, animation state machine and the UI together.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createMaterials, buildEnvironment } from './materials.js';
import { buildBike } from './bike.js';
import { buildPelican, poseRider } from './pelican.js';
import { buildWorld } from './world.js';
import { BIKE, SPEED } from './config.js';
import { clamp, damp } from './utils.js';

const canvas = document.getElementById('scene');
const loader = document.getElementById('loader');

// ---------------------------------------------------------------- renderer
let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
} catch (err) {
  // no WebGL: say so instead of leaving the loader spinning forever
  loader.innerHTML = '<p class="loader-text">当前浏览器不支持 WebGL，'
    + '请更换现代浏览器（Chrome / Edge / Safari / Firefox）后重试。</p>';
  loader.classList.add('failed');
  throw err;
}
renderer.setSize(window.innerWidth, window.innerHeight);
let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(pixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.1, 220);
const HOME = { pos: new THREE.Vector3(2.78, 1.98, 3.92), target: new THREE.Vector3(0.02, 1.0, 0) };
camera.position.copy(HOME.pos);

const controls = new OrbitControls(camera, canvas);
controls.target.copy(HOME.target);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.enablePan = false;
controls.minDistance = 2.1;
controls.maxDistance = 12;
controls.minPolarAngle = 0.22;
controls.maxPolarAngle = 1.53;
controls.rotateSpeed = 0.72;
controls.zoomSpeed = 0.75;
controls.update();

// ---------------------------------------------------------------- content
const materials = createMaterials();
scene.environment = buildEnvironment(renderer);
scene.environmentIntensity = 0.85;

const bike = buildBike(materials);
scene.add(bike.group);

const pelican = buildPelican(materials);
bike.group.add(pelican.group);
for (const leg of pelican.legs) bike.group.add(leg.foot);

const world = buildWorld(scene, materials, renderer);

// ---------------------------------------------------------------- state
const state = {
  targetKmh: 17,
  speed: 0, // m/s (smoothed)
  speedNorm: 0,
  distance: 0,
  playing: true,
  linesOn: true,
  headNod: 0,
};
world.speedLines.enabled = true;

const ui = {
  speed: document.getElementById('speed'),
  speedValue: document.getElementById('speed-value'),
  play: document.getElementById('play'),
  reset: document.getElementById('reset'),
  lines: document.getElementById('lines'),
  fps: document.getElementById('fps'),
  hint: document.getElementById('hint'),
};

// ---------------------------------------------------------------- UI
function syncUI() {
  ui.speed.value = String(state.targetKmh);
  ui.speed.style.setProperty('--fill', `${(state.targetKmh / SPEED.maxKmh) * 100}%`);
  ui.speedValue.textContent = `${state.targetKmh.toFixed(1)} km/h`;
  ui.play.dataset.state = state.playing ? 'playing' : 'paused';
  ui.play.setAttribute('aria-label', state.playing ? '暂停骑行' : '继续骑行');
  ui.play.querySelector('.label').textContent = state.playing ? '暂停' : '继续';
  ui.lines.setAttribute('aria-pressed', String(state.linesOn));
  document.body.classList.toggle('is-paused', !state.playing);
}
ui.speed.addEventListener('input', () => {
  state.targetKmh = Number(ui.speed.value);
  syncUI();
});
ui.play.addEventListener('click', () => {
  state.playing = !state.playing;
  syncUI();
});
ui.reset.addEventListener('click', () => resetCamera());
ui.lines.addEventListener('click', () => {
  state.linesOn = !state.linesOn;
  world.speedLines.enabled = state.linesOn;
  syncUI();
});

function resetCamera() {
  // One undamped update flushes (and zeroes) the residual orbit delta left over
  // from a fling; the second one then parks the view exactly on home.
  const damped = controls.enableDamping;
  controls.enableDamping = false;
  controls.update();
  camera.position.copy(HOME.pos);
  controls.target.copy(HOME.target);
  controls.update();
  controls.enableDamping = damped;
}
resetCamera();

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement && e.key !== ' ') return;
  switch (e.key) {
    case ' ':
      e.preventDefault();
      state.playing = !state.playing;
      syncUI();
      break;
    case 'ArrowUp':
    case 'ArrowRight':
      state.targetKmh = clamp(state.targetKmh + 1, 0, SPEED.maxKmh);
      syncUI();
      break;
    case 'ArrowDown':
    case 'ArrowLeft':
      state.targetKmh = clamp(state.targetKmh - 1, 0, SPEED.maxKmh);
      syncUI();
      break;
    case 'r':
    case 'R':
      resetCamera();
      break;
    case 'l':
    case 'L':
      state.linesOn = !state.linesOn;
      world.speedLines.enabled = state.linesOn;
      syncUI();
      break;
    default:
      break;
  }
});
syncUI();

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();
let frames = 0;
let fpsAccum = 0;
let fps = 60;
let qualityTimer = 0;
let running = true;

document.addEventListener('visibilitychange', () => {
  running = !document.hidden;
  if (running) clock.getDelta(); // swallow the gap
});

function adaptQuality(dt) {
  qualityTimer += dt;
  if (qualityTimer < 1.5) return;
  qualityTimer = 0;
  const maxRatio = Math.min(window.devicePixelRatio || 1, 2);
  if (fps < 26 && pixelRatio > 0.72) {
    pixelRatio = Math.max(0.72, pixelRatio - 0.25);
    renderer.setPixelRatio(pixelRatio);
  } else if (fps > 54 && pixelRatio < maxRatio) {
    pixelRatio = Math.min(maxRatio, pixelRatio + 0.25);
    renderer.setPixelRatio(pixelRatio);
  }
}

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);

  // ---- speed: ease towards the target so slider changes never snap ----
  const target = state.playing ? state.targetKmh / 3.6 : 0;
  state.speed = damp(state.speed, target, 2.8, dt);
  if (state.speed < 0.004) state.speed = 0;
  state.speedNorm = clamp(state.speed / (SPEED.maxKmh / 3.6), 0, 1);
  state.distance += state.speed * dt;

  // ---- drivetrain ----
  const wheelRps = state.speed / BIKE.wheelR; // revolutions per second
  for (const wheel of bike.wheels) wheel.rotation.z -= wheelRps * dt * Math.PI * 2;
  bike.crank.rotation.z -= (wheelRps / SPEED.gearRatio) * dt * Math.PI * 2;
  const phi = bike.crank.rotation.z;

  // ---- rider ----
  const bob = Math.sin(phi * 2 + 0.9) * 0.013 * state.speedNorm
    + Math.sin(phi * 2 + 2.4) * 0.005 * state.speedNorm;
  state.headNod = Math.sin(phi * 1 + 0.4) * 0.018 * state.speedNorm;
  poseRider(pelican, bike, phi, {
    bob,
    speedNorm: state.speedNorm,
    headNod: state.headNod,
  });

  // ---- bike life: a whisper of roll and pitch over the tarmac ----
  bike.group.rotation.x = Math.sin(phi) * 0.011 * state.speedNorm;
  bike.group.rotation.z = Math.sin(phi * 2 + 1.1) * 0.006 * state.speedNorm;

  // ---- world ----
  world.update(dt, state.speed, camera);
  controls.update();
  renderer.render(scene, camera);

  // ---- stats ----
  frames++;
  fpsAccum += dt;
  if (fpsAccum >= 0.5) {
    fps = frames / fpsAccum;
    frames = 0;
    fpsAccum = 0;
    ui.fps.textContent = `${Math.round(fps)} fps`;
  }
  adaptQuality(dt);
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  // keep the whole rider framed on tall/narrow viewports
  camera.fov = clamp(34 * (1.62 / Math.max(0.62, camera.aspect)), 34, 46);
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  renderer.setPixelRatio(pixelRatio);
}
window.addEventListener('resize', resize);
resize();

renderer.setAnimationLoop(() => {
  if (running) animate();
});

// small public surface so the scene can be driven/verified from the console
window.__pelican = {
  THREE,
  state,
  scene,
  camera,
  controls,
  bike,
  pelican,
  world,
  renderer,
  setSpeed(kmh) {
    state.targetKmh = clamp(kmh, 0, SPEED.maxKmh);
    syncUI();
  },
  setPlaying(v) {
    state.playing = v;
    syncUI();
  },
  getFps: () => fps,
  view(pos, target = [0.02, 1.0, 0]) {
    camera.position.set(...pos);
    controls.target.set(...target);
    controls.update();
    return camera.position.toArray();
  },
  info: () => ({
    speed: state.speed,
    kmh: state.speed * 3.6,
    speedNorm: state.speedNorm,
    calls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    pixelRatio,
    crank: bike.crank.rotation.z,
    camera: camera.position.toArray().map((n) => +n.toFixed(3)),
  }),
};

requestAnimationFrame(() => {
  loader.classList.add('done');
  setTimeout(() => loader.remove(), 900);
});
