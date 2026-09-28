/**
 * The pelican: white body, a long amber bill with a sagging pouch, a red &
 * white cycling cap, wraparound sunglasses, and a two-bone rig for both legs
 * and wings so the pedals and handlebars stay connected through the pose.
 *
 * The rider group leans forward over the bars like a cyclist; the pose
 * function below keeps feet and hands locked to the bike while it does.
 */
import * as THREE from 'three';
import { BIKE, RIDER } from './config.js';
import { PALETTE, hexToRgb } from './palette.js';
import {
  PartBuilder, boneGeometry, taperedTube, extrudeCentered, taperZ, loftGeometry,
  TAU, aimBone, solveIK2, clamp, lerp,
} from './utils.js';

const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);
const H = RIDER.head;

/** Unit-length bone (pivot at the base, stretches along +Y), optionally flattened. */
function bone(rTip, rBase, flat = 1, radial = 10) {
  const g = boneGeometry(rTip, rBase, radial);
  if (flat !== 1) g.scale(1, 1, flat);
  return g;
}

export function buildPelican(materials) {
  const rider = new THREE.Group();
  rider.name = 'rider';
  const pb = new PartBuilder();
  const B = RIDER.body;
  const bodyR = RIDER.bodyR;

  // ---------------- torso: one continuous skin ----------------
  // A pear-shaped loft so the breast melts into the neck instead of reading
  // as a stack of spheres. The grey mantle is painted on with vertex colours
  // rather than a second shell — no z-fighting, no inside-out surfaces.
  const BODY_PROFILE = [
    { x: -0.35, y: 1.205, ry: 0.012, rz: 0.016 },
    { x: -0.305, y: 1.212, ry: 0.078, rz: 0.094 },
    { x: -0.225, y: 1.19, ry: 0.136, rz: 0.162 },
    { x: -0.10, y: 1.19, ry: 0.176, rz: 0.201 },
    { x: 0.02, y: 1.202, ry: 0.19, rz: 0.216 },
    { x: 0.12, y: 1.238, ry: 0.174, rz: 0.199 },
    { x: 0.21, y: 1.293, ry: 0.139, rz: 0.158 },
    { x: 0.275, y: 1.355, ry: 0.094, rz: 0.107 },
    { x: 0.315, y: 1.408, ry: 0.044, rz: 0.05 },
  ];
  const WHITE = hexToRgb(PALETTE.featherLight);
  const GREY = hexToRgb(PALETTE.wingGrey);
  const bodyColor = (t, a) => {
    // grey over the back and upper flanks, white breast and belly
    const up = clamp((Math.cos(a) - 0.05) / 0.75, 0, 1);
    const back = clamp((0.78 - t) / 0.55, 0, 1);
    const k = clamp(up * back, 0, 1);
    const s = k * k * (3 - 2 * k);
    return [lerp(WHITE.r, GREY.r, s), lerp(WHITE.g, GREY.g, s), lerp(WHITE.b, GREY.b, s)];
  };
  pb.add('body', loftGeometry(BODY_PROFILE, { steps: 48, radial: 24, colorFn: bodyColor }));

  // a few primaries over the mantle, lying flat along the spine
  const spineY = (x) => {
    let best = 0;
    for (const p of BODY_PROFILE) {
      if (p.x <= x) best = p.y + p.ry;
    }
    return best;
  };
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    const x = 0.0 - t * 0.24;
    const y = spineY(x) + 0.006;
    const z = (i % 2 ? 1 : -1) * 0.045;
    const f = taperedTube(new THREE.CatmullRomCurve3([
      V(x + 0.05, spineY(x + 0.05) + 0.004, z * 0.6), V(x, y, z), V(x - 0.06, y - 0.03, z * 1.1),
    ]), { segments: 7, radial: 6, radius: (u) => 0.03 * (1 - u * 0.85) });
    f.scale(1, 1, 0.5);
    pb.add('wingShade', f);
  }

  // ---------------- tail ----------------
  const tail = taperedTube(new THREE.CatmullRomCurve3([
    V(-0.26, 1.30, 0), V(-0.38, 1.325, 0), V(-0.47, 1.335, 0),
  ]), { segments: 10, radial: 9, radius: (t) => 0.095 - t * 0.07 });
  tail.scale(1, 1, 0.55);
  pb.add('featherShade', tail);
  for (let i = 0; i < 4; i++) {
    const a = (i - 1.5) * 0.19;
    const f = taperedTube(new THREE.CatmullRomCurve3([
      V(-0.33, 1.325, a * 0.12), V(-0.43, 1.345, a * 0.22), V(-0.55, 1.35, a * 0.3),
    ]), { segments: 7, radial: 6, radius: (t) => 0.038 * (1 - t * 0.88) });
    f.scale(1, 1, 0.34);
    pb.add('feather', f);
  }

  // ---------------- nape crest (tucked below the cap band) ----------------
  for (let i = 0; i < 3; i++) {
    const a = (i - 1) * 0.24;
    const f = taperedTube(new THREE.CatmullRomCurve3([
      V(H.x - 0.095, H.y - 0.055, a * 0.04), V(H.x - 0.17, H.y - 0.012, a * 0.08),
    ]), { segments: 6, radial: 6, radius: (t) => 0.026 * (1 - t * 0.85) });
    f.scale(1, 1, 0.5);
    pb.add('feather', f);
  }

  // ---------------- shoulder / hip masses (soft blends, not lumps) ----
  for (const s of [-1, 1]) {
    pb.add('feather', new THREE.SphereGeometry(1, 16, 12), {
      pos: [RIDER.shoulder.x + 0.005, RIDER.shoulder.y - 0.03, s * (RIDER.shoulderZ - 0.055)],
      scale: [0.17, 0.155, 0.1],
    });
    pb.add('feather', new THREE.SphereGeometry(1, 16, 12), {
      pos: [RIDER.hip.x + 0.01, RIDER.hip.y + 0.04, s * (RIDER.hipZ - 0.045)],
      scale: [0.15, 0.165, 0.1],
    });
  }

  // ---------------- neck (animated bone) ----------------
  const neck = new THREE.Mesh(bone(0.088, 0.108, 0.88, 14), materials.feather);
  neck.castShadow = true;
  neck.receiveShadow = true;
  rider.add(neck);
  const neckBase = V(0.055, 1.395, 0);

  // ---------------- head ----------------
  const headG = new THREE.Group();
  headG.name = 'head';
  headG.position.copy(H);
  rider.add(headG);
  const hp = new PartBuilder();
  const HR = 0.14;
  hp.add('feather', new THREE.SphereGeometry(1, 24, 18), { scale: HR });
  // brow over the bill, cheek under it
  hp.add('feather', new THREE.SphereGeometry(1, 14, 12), { pos: [0.06, 0.045, 0], scale: [0.075, 0.05, 0.088] });
  hp.add('feather', new THREE.SphereGeometry(1, 14, 12), { pos: [0.04, -0.035, 0], scale: [0.082, 0.062, 0.086] });

  // ---- upper mandible: long, slender, tipped gently downward ----
  // It hangs from the lower half of the head so the cap can sit over the crown.
  const upper = new THREE.Shape();
  upper.moveTo(0.05, 0.004);
  upper.bezierCurveTo(0.16, 0.002, 0.30, -0.026, 0.385, -0.052);
  upper.bezierCurveTo(0.406, -0.058, 0.412, -0.071, 0.401, -0.083);
  upper.bezierCurveTo(0.39, -0.093, 0.372, -0.086, 0.35, -0.081);
  upper.bezierCurveTo(0.25, -0.069, 0.16, -0.07, 0.05, -0.072);
  upper.bezierCurveTo(0.032, -0.072, 0.03, -0.014, 0.05, 0.004);
  const upperGeo = extrudeCentered(upper, { depth: 0.044, bevel: 0.011, segments: 4, curveSegments: 26 });
  taperZ(upperGeo, (x) => THREE.MathUtils.clamp(1.05 - x * 1.6, 0.4, 1.08));
  hp.add('beak', upperGeo);

  // ---- gular pouch ----
  const pouch = new THREE.Shape();
  pouch.moveTo(0.045, -0.068);
  pouch.bezierCurveTo(0.14, -0.082, 0.225, -0.09, 0.285, -0.086);
  pouch.bezierCurveTo(0.312, -0.084, 0.31, -0.112, 0.275, -0.132);
  pouch.bezierCurveTo(0.21, -0.168, 0.125, -0.165, 0.08, -0.126);
  pouch.bezierCurveTo(0.05, -0.1, 0.04, -0.08, 0.045, -0.068);
  const pouchGeo = extrudeCentered(pouch, { depth: 0.036, bevel: 0.014, segments: 5, curveSegments: 26 });
  taperZ(pouchGeo, (x) => THREE.MathUtils.clamp(1.0 - (x - 0.045) * 1.3, 0.38, 1.04));
  hp.add('pouch', pouchGeo);
  hp.add('beakLower', new THREE.SphereGeometry(1, 14, 10), { pos: [0.07, -0.08, 0], scale: [0.058, 0.026, 0.062] });

  // nostrils
  for (const s of [-1, 1]) {
    hp.add('wingTip', new THREE.SphereGeometry(1, 10, 8), { pos: [0.115, 0.0, s * 0.02], scale: [0.02, 0.006, 0.005] });
  }

  // ---- eyes (sitting just behind the lenses) ----
  for (const s of [-1, 1]) {
    hp.add('eye', new THREE.SphereGeometry(0.024, 14, 12), { pos: [0.098, 0.026, s * 0.09] });
  }

  // ---- cycling cap: red crown, white band + panels, dark peak ----
  const capR = 0.152;
  const capTilt = -0.1;
  const capPos = [0.002, 0.048, 0];
  hp.add('capRed', new THREE.SphereGeometry(capR, 26, 16, 0, TAU, 0, Math.PI * 0.5),
    { pos: capPos, rot: [0, 0, capTilt] });
  for (const phi of [0.45, Math.PI - 0.45]) {
    hp.add('capWhite', new THREE.SphereGeometry(capR + 0.0015, 10, 14, phi - 0.1, 0.2, 0, Math.PI * 0.5),
      { pos: capPos, rot: [0, 0, capTilt] });
  }
  hp.add('capWhite', new THREE.CylinderGeometry(capR + 0.001, capR + 0.002, 0.026, 26, 1, true),
    { pos: [0.002, 0.05, 0], rot: [0, 0, capTilt] });
  // peak: a squashed dome, pitched down over the eyes
  hp.add('visor', new THREE.SphereGeometry(1, 18, 12, 0, TAU, 0, Math.PI * 0.52), {
    pos: [0.112, 0.052, 0], rot: [0, 0, -0.62], scale: [0.105, 0.032, 0.082],
  });
  hp.add('capWhite', new THREE.SphereGeometry(0.015, 10, 8), { pos: [-0.03, 0.152, 0], scale: [1, 0.7, 1] });

  // ---- wraparound sunglasses (shells that hug the head) ----
  const GR = HR + 0.013; // frame radius
  const LR = HR + 0.02; // lens radius
  // frame band around the front
  hp.add('glassFrame', new THREE.SphereGeometry(GR, 32, 10, Math.PI * 0.48, Math.PI * 1.04, 1.17, 0.36));
  // two lenses, leaving a bridge gap at the front centre
  hp.add('lens', new THREE.SphereGeometry(LR, 20, 10, Math.PI * 0.53, Math.PI * 0.39, 1.21, 0.28));
  hp.add('lens', new THREE.SphereGeometry(LR, 20, 10, Math.PI * 1.08, Math.PI * 0.39, 1.21, 0.28));
  // temple arms
  for (const s of [-1, 1]) {
    hp.add('glassFrame', new THREE.CylinderGeometry(0.008, 0.008, 0.08, 8), {
      pos: [-0.03, 0.045, s * 0.142], rot: [0, 0, Math.PI / 2 - 0.35],
    });
  }

  hp.build(headG, materials);

  // ---------------- legs (animated) ----------------
  const legs = [];
  for (const s of [1, -1]) {
    const thigh = new THREE.Mesh(bone(0.043, 0.075, 0.9, 12), materials.feather);
    const shin = new THREE.Mesh(boneGeometry(0.028, 0.036, 10), materials.leg);
    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), materials.feather);
    const ankle = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), materials.leg);
    for (const m of [thigh, shin, knee, ankle]) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
    rider.add(thigh, shin, knee, ankle);
    legs.push({ side: s, thigh, shin, knee, ankle, foot: null });
  }

  // webbed feet ride on the bike, not on the bobbing body
  const feet = [];
  const footShape = new THREE.Shape();
  footShape.moveTo(-0.05, 0);
  footShape.bezierCurveTo(-0.055, -0.038, -0.018, -0.056, 0.028, -0.054);
  footShape.bezierCurveTo(0.072, -0.054, 0.11, -0.048, 0.126, -0.028);
  footShape.bezierCurveTo(0.132, -0.017, 0.126, -0.006, 0.116, 0);
  footShape.bezierCurveTo(0.126, 0.006, 0.132, 0.017, 0.126, 0.028);
  footShape.bezierCurveTo(0.11, 0.048, 0.072, 0.054, 0.028, 0.054);
  footShape.bezierCurveTo(-0.018, 0.056, -0.055, 0.038, -0.05, 0);
  const footGeo = extrudeCentered(footShape, { depth: 0.014, bevel: 0.006, segments: 3, curveSegments: 16 });
  footGeo.rotateX(-Math.PI / 2);
  for (const s of [1, -1]) {
    const foot = new THREE.Group();
    foot.name = `foot${s > 0 ? 'R' : 'L'}`;
    const sole = new THREE.Mesh(footGeo, materials.foot);
    sole.position.set(0.02, -0.04, 0);
    sole.castShadow = true;
    foot.add(sole);
    for (let i = -1; i <= 1; i++) {
      const toe = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), materials.footShade);
      toe.position.set(0.124, -0.034, i * 0.026);
      toe.scale.set(0.022, 0.012, 0.016);
      toe.castShadow = true;
      foot.add(toe);
    }
    const leg = legs.find((l) => l.side === s);
    if (leg) leg.foot = foot;
    feet.push({ side: s, group: foot });
  }

  // ---------------- wings (animated) ----------------
  const wings = [];
  for (const s of [1, -1]) {
    const upper = new THREE.Mesh(bone(0.062, 0.105, 0.38, 12), materials.wingShade);
    const fore = new THREE.Mesh(bone(0.034, 0.062, 0.32, 10), materials.wing);
    const hand = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const primary = taperedTube(
        new THREE.CatmullRomCurve3([V(0, 0, 0), V(0.026, -0.028, 0), V(0.042, -0.07, 0)]),
        { segments: 6, radial: 5, radius: (t) => 0.015 * (1 - t * 0.7) },
      );
      primary.scale(1, 1, 0.45);
      const m = new THREE.Mesh(primary, i < 2 ? materials.wingTip : materials.wing);
      m.position.set(0, -0.004, (i - 1.5) * 0.024);
      m.rotation.y = (i - 1.5) * 0.3;
      m.castShadow = true;
      hand.add(m);
    }
    const curl = taperedTube(
      new THREE.CatmullRomCurve3([V(0, 0, 0), V(0.04, 0.004, 0), V(0.045, -0.046, 0), V(0.008, -0.07, 0)]),
      { segments: 10, radial: 8, radius: (t) => 0.026 * (1 - t * 0.45) },
    );
    curl.scale(1, 1, 0.72);
    const curlMesh = new THREE.Mesh(curl, materials.wing);
    curlMesh.castShadow = true;
    hand.add(curlMesh);
    for (const m of [upper, fore]) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
    rider.add(upper, fore, hand);
    wings.push({ side: s, upper, fore, hand });
  }

  pb.build(rider, materials);

  return { group: rider, head: headG, neck, neckBase, legs, wings, feet };
}

// scratch objects, reused every frame
const _m = new THREE.Matrix4();
const _mInv = new THREE.Matrix4();
const _pivot = new THREE.Vector3(RIDER.hip.x, RIDER.hip.y, 0);
const _rot = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();

/**
 * Pose the rig for a crank angle. Foot and hand targets are converted from
 * bike space into the leaning rider's space, so a bobbing, leaning body
 * never detaches from the machine.
 */
export function poseRider(pelican, bike, phi, {
  bob = 0, speedNorm = 0, headNod = 0, leanAngle = 0.1,
} = {}) {
  const g = pelican.group;
  const lean = leanAngle + speedNorm * 0.05;

  // lean about the hip, then translate for the bob
  _rot.makeRotationZ(-lean);
  _p.copy(_pivot).applyMatrix4(_rot).sub(_pivot);
  g.position.set(_p.x + speedNorm * 0.03, _p.y + bob, 0);
  g.quaternion.setFromEuler(new THREE.Euler(0, 0, -lean));
  g.updateMatrix();

  // bike space -> rider space
  _m.multiplyMatrices(bike.group.matrix, _mInv.copy(g.matrix).invert());
  const toLocal = (v) => v.clone().applyMatrix4(_m);

  // ---- legs ----
  for (const leg of pelican.legs) {
    const angle = phi + (leg.side > 0 ? 0 : Math.PI);
    const pedal = V(
      BIKE.bb.x + BIKE.crank * Math.cos(angle),
      BIKE.bb.y + BIKE.crank * Math.sin(angle),
      leg.side * BIKE.crankZ,
    );
    const hip = V(RIDER.hip.x, RIDER.hip.y, leg.side * RIDER.hipZ);
    const target = toLocal(V(pedal.x, pedal.y + RIDER.ankleLift, pedal.z));
    const { joint, end } = solveIK2(hip, target, RIDER.thigh, RIDER.shin, V(0.45, 1, 0));
    aimBone(leg.thigh, hip, joint);
    aimBone(leg.shin, joint, end);
    leg.knee.position.copy(joint);
    leg.ankle.position.copy(end);
    // the foot is parented to the bike: keep it flat on the pedal
    leg.foot.position.set(pedal.x, pedal.y + RIDER.ankleLift, pedal.z);
    leg.foot.rotation.set(0, 0, 0);
  }

  // ---- wings ----
  for (const wing of pelican.wings) {
    const shoulder = V(RIDER.shoulder.x, RIDER.shoulder.y, wing.side * RIDER.shoulderZ);
    const grip = toLocal(V(BIKE.grip.x, BIKE.grip.y, wing.side * BIKE.gripZ));
    const { joint, end } = solveIK2(shoulder, grip, RIDER.humerus, RIDER.forearm, V(-0.22, -1, 0.05));
    aimBone(wing.upper, shoulder, joint);
    aimBone(wing.fore, joint, end);
    wing.hand.position.copy(end);
    wing.hand.quaternion.copy(wing.fore.quaternion);
    wing.hand.rotateX(Math.PI * 0.5);
  }

  // ---- neck + head ----
  const head = pelican.head;
  head.rotation.set(0, 0, -0.02 - 0.05 * speedNorm + headNod);
  head.position.set(
    RIDER.head.x + speedNorm * 0.02,
    RIDER.head.y + Math.sin(phi * 2 + 0.6) * 0.008 * speedNorm,
    RIDER.head.z,
  );
  g.updateMatrixWorld(true);
  _v.copy(head.localToWorld(V(-0.055, -0.015, 0)));
  _p.copy(_v);
  aimBone(pelican.neck, pelican.neckBase, g.worldToLocal(_p));
}
