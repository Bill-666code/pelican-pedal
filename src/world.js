/**
 * The world the pelican rides through: a coastal road, hedgerows that
 * recycle past, a warm sky, considered lighting, and wind streaks that
 * stretch as the pace picks up.
 */
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { clamp, damp, TAU } from './utils.js';

const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);
const ROAD_HALF = 2.6;
const ROAD_TILE = 6; // metres per texture tile

/** Sky dome with a painted gradient + sun glow. */
function makeSky() {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 256;
  const ctx = c.getContext('2d');
  const sky = ctx.createLinearGradient(0, 0, 0, 256);
  sky.addColorStop(0.0, '#5aa8c4');
  sky.addColorStop(0.24, '#8fc7d4');
  sky.addColorStop(0.44, '#c6e0da');
  sky.addColorStop(0.55, '#ecede0');
  sky.addColorStop(0.6, '#f7ecd8');
  sky.addColorStop(0.66, '#e3ddc8');
  sky.addColorStop(1.0, '#c6cbb4');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 16, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(90, 24, 20),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false }),
  );
  dome.name = 'sky';
  dome.renderOrder = -1;
  return dome;
}

/** Asphalt + lane markings, drawn once and scrolled as a conveyor. */
function roadTexture() {
  const w = 1024;
  const h = 384;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');

  ctx.fillStyle = PALETTE.roadBase;
  ctx.fillRect(0, 0, w, h);

  // grain
  const img = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 26;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);

  // soft wheel-polished tracks
  const track = (y) => {
    const g = ctx.createLinearGradient(0, y - 26, 0, y + 26);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(226,230,232,0.16)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, y - 26, w, 52);
  };
  // canvas y for a world z
  const zToY = (z) => ((z + ROAD_HALF) / (ROAD_HALF * 2)) * h;
  track(zToY(-0.55));
  track(zToY(0.55));

  // markings
  ctx.fillStyle = PALETTE.roadLine;
  ctx.globalAlpha = 0.82;
  const edge = 22;
  ctx.fillRect(0, zToY(2.32) - edge / 2, w, edge);
  ctx.fillRect(0, zToY(-2.32) - edge / 2, w, edge);
  // dashed lane divider, offset so the bike rides in the right-hand lane
  const dashY = zToY(-0.95);
  const dashLen = (2.6 / ROAD_TILE) * w;
  ctx.fillRect(w * 0.12, dashY - 9, dashLen, 18);
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 8;
  return tex;
}

function groundTexture() {
  const s = 256;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#a9bda2';
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * s;
    const y = Math.random() * s;
    const r = 2 + Math.random() * 12;
    ctx.fillStyle = `rgba(${Math.random() > 0.5 ? '150,172,140' : '186,199,168'},${0.05 + Math.random() * 0.16})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function cloudTexture() {
  const w = 256;
  const h = 128;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const blob = (x, y, r) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.85)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.4)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  };
  blob(w * 0.3, h * 0.62, 46);
  blob(w * 0.5, h * 0.45, 58);
  blob(w * 0.68, h * 0.6, 44);
  blob(w * 0.44, h * 0.68, 50);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function streakTexture() {
  const w = 256;
  const h = 32;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.32, 'rgba(255,255,255,0.75)');
  g.addColorStop(0.72, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // soften the vertical edges
  ctx.globalCompositeOperation = 'destination-in';
  const v = ctx.createLinearGradient(0, 0, 0, h);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(0.5, 'rgba(0,0,0,1)');
  v.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Instanced wind streaks that billboard toward the camera. */
class SpeedLines {
  constructor(count = 40) {
    const geo = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.MeshBasicMaterial({
      map: streakTexture(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0,
      fog: false,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.mesh.name = 'speedLines';
    this.dummy = new THREE.Object3D();
    this.color = new THREE.Color('#ffffff');
    this.items = [];
    for (let i = 0; i < count; i++) this.items.push(this.spawn(true));
    this.enabled = true;
    this.strength = 0;
  }

  spawn(initial = false) {
    // kept clear of the rider's silhouette so the character always reads
    const side = Math.random() < 0.5 ? 1 : -1;
    return {
      x: initial ? -9 + Math.random() * 15 : 4.2 + Math.random() * 2.5,
      y: 0.1 + Math.random() * 2.15,
      z: side * (1.15 + Math.random() * 2.7),
      len: 0.3 + Math.random() * 0.85,
      thick: 0.012 + Math.random() * 0.034,
      rate: 0.8 + Math.random() * 0.6,
      fade: 0.3 + Math.random() * 0.7,
    };
  }

  update(dt, speed, camera) {
    const target = this.enabled ? clamp(speed / 6, 0, 1) : 0;
    this.strength = damp(this.strength, target, 5, dt);
    this.mesh.material.opacity = this.strength * 0.92;
    this.mesh.visible = this.strength > 0.01;
    if (!this.mesh.visible) return;

    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      it.x -= speed * it.rate * dt;
      if (it.x < -9) Object.assign(it, this.spawn());

      const stretch = 0.35 + this.strength * 1.9;
      this.dummy.position.set(it.x, it.y, it.z);
      this.dummy.quaternion.copy(camera.quaternion);
      this.dummy.scale.set(it.len * stretch * (0.45 + this.strength), it.thick * (0.75 + this.strength * 0.9), 1);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);

      // fade in from behind, and never smear across the lens
      const depth = clamp((it.x + 9) / 12, 0, 1);
      const near = clamp((camera.position.distanceTo(this.dummy.position) - 0.85) / 1.5, 0, 1);
      const b = it.fade * this.strength * depth * near;
      this.color.setRGB(b, b * 0.99, b * 0.93);
      this.mesh.setColorAt(i, this.color);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

/** Trees + marker posts recycled as the world scrolls past. */
function hedgerow(scene, materials) {
  const group = new THREE.Group();
  group.name = 'hedgerow';
  const trunkGeos = [];
  const leafGeos = [];
  const postGeos = [];
  const bandGeos = [];
  const SPAN = 60;

  const rnd = (seed) => {
    // deterministic pseudo random so the seam wraps perfectly
    const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  for (let i = 0; i < 30; i++) {
    const baseX = -SPAN / 2 + (i / 30) * SPAN;
    for (const side of [-1, 1]) {
      const r1 = rnd(i * 3 + (side > 0 ? 0 : 1));
      const r2 = rnd(i * 3 + (side > 0 ? 2 : 5));
      const x = baseX + r1 * 1.2;
      const z = side * (7.0 + r2 * 9.0);
      const h = 0.6 + r1 * 0.5 + r2 * 1.1;
      trunkGeos.push(new THREE.CylinderGeometry(0.055, 0.08, h, 6).translate(x, h / 2, z));
      for (let k = 0; k < 3; k++) {
        const s = (0.3 + rnd(i * 7 + k + side) * 0.36) * (1 - k * 0.14);
        const g = new THREE.IcosahedronGeometry(s, 0);
        g.translate(x + (rnd(i + k) - 0.5) * 0.4, h + 0.14 + k * 0.26, z + (rnd(i * 5 + k) - 0.5) * 0.4);
        leafGeos.push(g);
      }
    }
  }
  // roadside marker posts
  for (let i = 0; i < 12; i++) {
    const x = -SPAN / 2 + (i / 12) * SPAN;
    for (const side of [-1, 1]) {
      const z = side * 2.95;
      postGeos.push(new THREE.CylinderGeometry(0.045, 0.055, 0.5, 8).translate(x, 0.25, z));
      bandGeos.push(new THREE.CylinderGeometry(0.052, 0.052, 0.1, 8).translate(x, 0.4, z));
    }
  }
  const add = (geos, mat, cast) => {
    if (!geos.length) return;
    const mesh = new THREE.Mesh(mergeSimple(geos), mat);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  add(trunkGeos, materials.hedgeTrunk, true);
  add(leafGeos, materials.hedgeLeaf, true);
  add(postGeos, materials.post, true);
  add(bandGeos, materials.coral, false);
  scene.add(group);
  return { group, span: SPAN };
}

/** Merge same-attribute position/normal/uv geometries without extra deps. */
function mergeSimple(geos) {
  const position = [];
  const normal = [];
  const uv = [];
  const index = [];
  let offset = 0;
  for (const g of geos) {
    const p = g.attributes.position;
    const n = g.attributes.normal;
    const u = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      position.push(p.getX(i), p.getY(i), p.getZ(i));
      normal.push(n.getX(i), n.getY(i), n.getZ(i));
      uv.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0);
    }
    const idx = g.index;
    if (idx) {
      for (let i = 0; i < idx.count; i++) index.push(idx.getX(i) + offset);
    } else {
      for (let i = 0; i < p.count; i++) index.push(i + offset);
    }
    offset += p.count;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  return geo;
}

export function buildWorld(scene, materials, renderer) {
  scene.fog = new THREE.Fog(new THREE.Color(PALETTE.fog), 14, 78);
  scene.add(makeSky());

  // ---- lighting ----
  const hemi = new THREE.HemisphereLight(0xd6f0ea, 0xa89878, 0.55);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xfff0d2, 3.1);
  key.position.set(4.2, 5.0, 3.0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 18;
  const s = 2.4;
  key.shadow.camera.left = -s;
  key.shadow.camera.right = s;
  key.shadow.camera.top = s * 1.25;
  key.shadow.camera.bottom = -s * 0.55;
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 2.2;
  key.target.position.set(0, 1.1, 0);
  scene.add(key, key.target);

  // cool sky rim from behind to separate the white bird from the backdrop
  const rim = new THREE.DirectionalLight(0xbcdcf5, 1.15);
  rim.position.set(-4.2, 2.4, -3.6);
  scene.add(rim);

  // warm bounce off the tarmac
  const bounce = new THREE.DirectionalLight(0xffe3bd, 0.4);
  bounce.position.set(-1.2, -1.6, 2.2);
  scene.add(bounce);

  // ---- ground + road ----
  const gTex = groundTexture();
  gTex.repeat.set(48, 48);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(180, 180),
    new THREE.MeshStandardMaterial({ map: gTex, color: 0xffffff, roughness: 0.95, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.012;
  ground.receiveShadow = true;
  scene.add(ground);

  const rTex = roadTexture();
  const repeats = 120 / ROAD_TILE;
  rTex.repeat.set(repeats, 1);
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(120, ROAD_HALF * 2),
    new THREE.MeshStandardMaterial({ map: rTex, roughness: 0.82, metalness: 0.02 }),
  );
  road.rotation.x = -Math.PI / 2;
  road.receiveShadow = true;
  scene.add(road);

  // soft shoulder strip so the tarmac does not just stop
  const shoulder = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 0.9),
    new THREE.MeshStandardMaterial({ color: 0xcfc4ab, roughness: 0.98 }),
  );
  for (const side of [-1, 1]) {
    const m = shoulder.clone();
    m.position.set(0, -0.006, side * (ROAD_HALF + 0.45));
    m.receiveShadow = true;
    scene.add(m);
  }

  // contact shadow under the bike, keeps it grounded even at low sun angles
  const blob = new THREE.Mesh(
    new THREE.PlaneGeometry(2.1, 1.05),
    new THREE.MeshBasicMaterial({
      map: radialCanvas(), transparent: true, color: 0xffffff,
      depthWrite: false, blending: THREE.MultiplyBlending, opacity: 1,
    }),
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.set(0, 0.006, 0);
  blob.renderOrder = 1;
  scene.add(blob);

  // ---- clouds ----
  const cloudMat = new THREE.MeshBasicMaterial({
    map: cloudTexture(), transparent: true, opacity: 0.75, depthWrite: false, fog: false,
  });
  const clouds = [];
  for (let i = 0; i < 7; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(16 + i * 1.4, 7 + i * 0.7), cloudMat);
    m.position.set(-60 + i * 17 + (i % 3) * 5, 11 + (i % 4) * 4.5, -34 - (i % 3) * 12);
    m.renderOrder = -0.5;
    scene.add(m);
    clouds.push(m);
  }

  const hedge = hedgerow(scene, materials);
  const lines = new SpeedLines(48);
  scene.add(lines.mesh);

  const state = { roadOffset: 0, hedgeOffset: 0, cloudOffset: 0 };

  return {
    key,
    speedLines: lines,
    update(dt, speed, camera) {
      // scroll the world backwards: the bike is always at the origin
      state.roadOffset += (speed * dt) / ROAD_TILE;
      rTex.offset.x = state.roadOffset % 1;
      gTex.offset.x = (state.roadOffset * 0.35) % 1;

      state.hedgeOffset = (state.hedgeOffset + speed * dt) % hedge.span;
      hedge.group.position.x = -state.hedgeOffset;

      state.cloudOffset = (state.cloudOffset + speed * dt * 0.12) % 170;
      for (const c of clouds) c.position.x = ((c.position.x - speed * dt * 0.12) % 170 + 340) % 170 - 120;

      lines.update(dt, speed, camera);
    },
  };
}

/** Multiplied onto the road: dark in the middle, white at the rim. */
function radialCanvas() {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(138,138,138,1)');
  g.addColorStop(0.4, 'rgba(196,196,196,1)');
  g.addColorStop(1, 'rgba(255,255,255,1)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
