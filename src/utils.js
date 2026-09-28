/**
 * Geometry + math helpers shared by the bike, the pelican and the world.
 * Everything here works with plain three.js primitives so parts can be
 * merged per material (keeps draw calls low).
 */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const TAU = Math.PI * 2;

/** Frame-rate independent exponential smoothing. lambda ≈ "sharpness". */
export function damp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

/**
 * A tube along a curve whose radius varies along its length.
 * radiusFn(t) -> radius, t in 0..1 (arc-length parameterised).
 */
export function taperedTube(curve, {
  segments = 28,
  radial = 10,
  radius = () => 0.05,
  capStart = true,
  capEnd = true,
} = {}) {
  curve.arcLengthDivisions = Math.max(64, segments * 4);
  curve.updateArcLengths();
  const length = curve.getLength();
  const ds = length / segments;

  const frames = curve.computeFrenetFrames(segments, false);
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const ring = new THREE.Vector3();
  const P = new THREE.Vector3();
  const rAt = (t) => Math.max(1e-4, radius(t));

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    curve.getPointAt(t, P);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    const r = rAt(t);
    const drds = (rAt(Math.min(1, t + 0.02)) - rAt(Math.max(0, t - 0.02))) / (0.04 * length || 1);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * TAU;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      ring.set(
        N.x * cos + B.x * sin,
        N.y * cos + B.y * sin,
        N.z * cos + B.z * sin,
      );
      positions.push(P.x + ring.x * r, P.y + ring.y * r, P.z + ring.z * r);
      // Analytic normal: radial direction minus the taper slope along the tangent.
      const n = new THREE.Vector3(
        ring.x - frames.tangents[i].x * drds,
        ring.y - frames.tangents[i].y * drds,
        ring.z - frames.tangents[i].z * drds,
      ).normalize();
      normals.push(n.x, n.y, n.z);
      uvs.push(j / radial, t);
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = a + radial + 1;
      // wound so face normals point away from the curve
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }

  // Flat caps (triangle fan around a centre vertex).
  const addCap = (index, flip) => {
    const t = index === 0 ? 0 : 1;
    curve.getPointAt(t, P);
    const T = frames.tangents[index];
    const centre = positions.length / 3;
    positions.push(P.x, P.y, P.z);
    normals.push(flip ? -T.x : T.x, flip ? -T.y : T.y, flip ? -T.z : T.z);
    uvs.push(0.5, 0.5);
    const base = index * (radial + 1);
    for (let j = 0; j < radial; j++) {
      const a = base + j;
      const b = base + j + 1;
      if (flip) indices.push(centre, b, a);
      else indices.push(centre, a, b);
    }
  };
  if (capStart) addCap(0, true);
  if (capEnd) addCap(segments, false);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return sanitizeNormals(geo);
}

/** Cylinder spanning two points, with optional per-end radii. */
export function rodBetween(a, b, rStart, rEnd = rStart, radial = 10, cap = true) {
  const dir = b.clone().sub(a);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(rEnd, rStart, len, radial, 1, !cap);
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.clone().normalize(),
  );
  geo.applyQuaternion(q);
  geo.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return geo;
}

/** Unit bone along +Y (pivot at the base) so it can be stretched by scale.y. */
export function boneGeometry(rTop, rBottom, radial = 10) {
  const geo = new THREE.CylinderGeometry(rTop, rBottom, 1, radial, 1, false);
  geo.translate(0, 0.5, 0);
  return geo;
}

const _dir = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
/** Point a +Y-pivot bone from `from` to `to`. */
export function aimBone(mesh, from, to) {
  _dir.copy(to).sub(from);
  const len = _dir.length() || 1e-5;
  mesh.position.copy(from);
  mesh.quaternion.setFromUnitVectors(_up, _dir.divideScalar(len));
  mesh.scale.set(1, len, 1);
  return len;
}

/**
 * Analytic two-bone IK in the plane spanned by (root -> target) and poleDir.
 * Returns the joint (knee/elbow) position; `end` is the clamped target.
 */
const _axis = new THREE.Vector3();
const _pole = new THREE.Vector3();
export function solveIK2(root, target, l1, l2, poleDir) {
  _axis.copy(target).sub(root);
  let d = _axis.length();
  const min = Math.abs(l1 - l2) + 1e-3;
  const max = l1 + l2 - 1e-3;
  d = clamp(d, min, max);
  _axis.normalize();
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  _pole.copy(poleDir).addScaledVector(_axis, -poleDir.dot(_axis));
  if (_pole.lengthSq() < 1e-6) {
    _pole.set(0, 0, 1).addScaledVector(_axis, -_axis.z);
    if (_pole.lengthSq() < 1e-6) _pole.set(1, 0, 0);
  }
  _pole.normalize();
  const joint = root.clone().addScaledVector(_axis, a).addScaledVector(_pole, h);
  const end = root.clone().addScaledVector(_axis, d);
  return { joint, end, dist: d };
}

/** Rounded rectangle shape, for extruded parts. */
export function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/**
 * computeVertexNormals() can emit zero-length normals for degenerate faces
 * (a NaN normal lights up as a black smear). Replace any with a safe value.
 */
export function sanitizeNormals(geo) {
  const n = geo.attributes.normal;
  if (!n) return geo;
  for (let i = 0; i < n.count; i++) {
    const x = n.getX(i);
    const y = n.getY(i);
    const z = n.getZ(i);
    const len = Math.hypot(x, y, z);
    if (!(len > 1e-6) || !Number.isFinite(len)) n.setXYZ(i, 0, 1, 0);
    else n.setXYZ(i, x / len, y / len, z / len);
  }
  n.needsUpdate = true;
  return geo;
}

/**
 * Loft a smooth body from a centre-line profile of elliptical cross-sections.
 * profile: [{ x, y, ry, rz }, ...] ordered along +X. Much nicer than
 * stacking spheres when you want one continuous skin.
 */
export function loftGeometry(profile, {
  steps = 40, radial = 20, capStart = false, capEnd = false, colorFn = null,
} = {}) {
  const pts = profile.map((p) => new THREE.Vector3(p.x, p.y, 0));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
  const key = (t) => t * (profile.length - 1);
  const sample = (t) => {
    const f = key(t);
    const i = Math.min(profile.length - 2, Math.max(0, Math.floor(f)));
    const u = f - i;
    const a = profile[i];
    const b = profile[i + 1];
    const smooth = u * u * (3 - 2 * u);
    return {
      x: lerp(a.x, b.x, smooth),
      y: lerp(a.y, b.y, smooth),
      ry: Math.max(0.006, lerp(a.ry, b.ry, smooth)),
      rz: Math.max(0.006, lerp(a.rz, b.rz, smooth)),
    };
  };
  curve.arcLengthDivisions = 128;
  curve.updateArcLengths();

  const positions = [];
  const normals = [];
  const uvs = [];
  const colors = colorFn ? [] : null;
  const indices = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const s = sample(t);
    // getPoint (not getPointAt): the ring must use the same parameter as the
    // radii, otherwise arc-length remapping twists the skin inside out.
    const p = curve.getPoint(t);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * TAU;
      positions.push(p.x, p.y + Math.cos(a) * s.ry, Math.sin(a) * s.rz);
      normals.push(0, Math.cos(a) / s.ry, Math.sin(a) / s.rz);
      uvs.push(j / radial, t);
      if (colors) {
        const c = colorFn(t, a, s);
        colors.push(c[0], c[1], c[2]);
      }
    }
  }
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = a + radial + 1;
      // wound so the face normal points outward, away from the spine
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  if (colors) geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  // rounded-off ends
  const cap = (i, flip) => {
    const t = i / steps;
    const p = curve.getPoint(t);
    const centre = positions.length / 3;
    positions.push(p.x, p.y, 0);
    normals.push(flip ? -1 : 1, 0, 0);
    uvs.push(0.5, 0.5);
    if (colors) {
      const c = colorFn(t, flip ? 0 : Math.PI, sample(t));
      colors.push(c[0], c[1], c[2]);
    }
    const base = i * (radial + 1);
    for (let j = 0; j < radial; j++) {
      if (flip) indices.push(centre, base + j + 1, base + j);
      else indices.push(centre, base + j, base + j + 1);
    }
  };
  if (capStart) cap(0, true);
  if (capEnd) cap(steps, false);
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return sanitizeNormals(geo);
}

/** Extrude a 2D shape, centred on the extrusion axis. */
export function extrudeCentered(shape, {
  depth = 0.05, bevel = 0.01, segments = 3, curveSegments = 24,
} = {}) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: segments,
    curveSegments,
  });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

/** Squeeze a geometry along Z as a function of X — cheap way to taper an extrusion. */
export function taperZ(geo, fn) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const s = fn(p.getX(i));
    p.setZ(i, p.getZ(i) * s);
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  return sanitizeNormals(geo);
}

/** Soft-edged radial alpha texture (used for blob shadows and glows). */
export function radialTexture(inner = 0.0, softness = 1.0, power = 2) {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, (size / 2) * inner, size / 2, size / 2, (size / 2) * softness);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5 - size / 2) / (size / 2);
      const dy = (y + 0.5 - size / 2) / (size / 2);
      const d = clamp(Math.sqrt(dx * dx + dy * dy), 0, 1);
      const a = Math.pow(1 - d, power) * 255;
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Collects geometry per material key and merges each bucket into one mesh.
 * Keeps the scene cheap to draw while the code stays declarative.
 */
export class PartBuilder {
  constructor() {
    this.buckets = new Map();
  }

  /** add(key, geometry, transform?) — transform = {pos:[x,y,z], rot:[x,y,z], scale:[x,y,z]|number} */
  add(key, geometry, transform) {
    const g = geometry.clone();
    if (transform) {
      const m = new THREE.Matrix4();
      const pos = new THREE.Vector3(...(transform.pos || [0, 0, 0]));
      const quat = new THREE.Quaternion();
      if (transform.quat) quat.copy(transform.quat);
      else if (transform.rot) quat.setFromEuler(new THREE.Euler(...transform.rot));
      const s = transform.scale === undefined
        ? new THREE.Vector3(1, 1, 1)
        : typeof transform.scale === 'number'
          ? new THREE.Vector3(transform.scale, transform.scale, transform.scale)
          : new THREE.Vector3(...transform.scale);
      m.compose(pos, quat, s);
      g.applyMatrix4(m);
    }
    if (!this.buckets.has(key)) this.buckets.set(key, []);
    // ExtrudeGeometry (and friends) come back non-indexed; normalise so every
    // bucket can be merged.
    const ready = g.index ? g : mergeVertices(g);
    this.buckets.get(key).push(ready);
    return this;
  }

  /** Merge everything into `group`, one child mesh per material key. */
  build(group, materials) {
    for (const [key, geos] of this.buckets) {
      if (!geos.length) continue;
      const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
      if (!merged) {
        console.warn(`[parts] merge failed for "${key}"`);
        continue;
      }
      const mesh = new THREE.Mesh(merged, materials[key]);
      mesh.name = key;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    this.buckets.clear();
    return group;
  }
}
