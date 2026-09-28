/**
 * The bicycle: a mint-green vintage city bike with a cream-wall tyre,
 * chrome fenders, a leather saddle and a visible chain.
 *
 * Returns the group plus the handles the animation needs
 * (wheel groups, crank group, pedal groups).
 */
import * as THREE from 'three';
import { BIKE } from './config.js';
import { PartBuilder, rodBetween, taperedTube, TAU } from './utils.js';

const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);
const off = (v, x, y, z) => V(v.x + x, v.y + y, v.z + (z || 0));

/** One wheel, built around its own hub (axle along Z). */
function buildWheel(pb, { reflectorAt = 0.6 } = {}) {
  const R = BIKE.wheelR;
  const hw = BIKE.tyreHalfW;

  // --- tread band (dark) ---
  const treadProfile = [
    V(R - 0.014, hw * 0.75), V(R - 0.002, hw * 0.34), V(R, 0),
    V(R - 0.002, -hw * 0.34), V(R - 0.014, -hw * 0.75),
  ];
  const tread = new THREE.LatheGeometry(treadProfile, 40);
  tread.rotateX(Math.PI / 2);
  pb.add('tire', tread);

  // --- cream sidewalls ---
  const wall = (sign) => {
    const pts = [V(0.279, sign * 0.0235), V(0.302, sign * 0.0268), V(R - 0.014, sign * hw * 0.75)];
    const g = new THREE.LatheGeometry(pts, 40);
    g.rotateX(Math.PI / 2);
    return g;
  };
  pb.add('tireWall', wall(1));
  pb.add('tireWall', wall(-1));

  // --- rim: deep box-section wall + polished braking edge ---
  const rimWall = new THREE.CylinderGeometry(BIKE.rimR + 0.008, BIKE.rimR + 0.008, 0.03, 34, 1, true);
  rimWall.rotateX(Math.PI / 2);
  pb.add('chrome', rimWall);
  for (const s of [-1, 1]) {
    pb.add('chrome', new THREE.TorusGeometry(BIKE.rimR + 0.004, 0.0075, 6, 34), { pos: [0, 0, s * 0.015] });
  }

  // --- hub ---
  pb.add('chrome', rodBetween(V(0, 0, -0.055), V(0, 0, 0.055), BIKE.hubR, BIKE.hubR, 16));
  for (const s of [-1, 1]) {
    pb.add('chrome', rodBetween(V(0, 0, s * 0.032), V(0, 0, s * 0.039), 0.042, 0.042, 16));
  }
  pb.add('chromeDark', rodBetween(V(0, 0, -0.068), V(0, 0, -0.05), 0.012, 0.012, 10));
  pb.add('chromeDark', rodBetween(V(0, 0, 0.05), V(0, 0, 0.068), 0.012, 0.012, 10));

  // --- spokes, laced with a little tangential offset ---
  const n = BIKE.spokes;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const side = i % 2 ? 1 : -1;
    const lace = side * 0.30;
    pb.add('steel', rodBetween(
      V(Math.cos(a + lace) * 0.036, Math.sin(a + lace) * 0.036, side * 0.036),
      V(Math.cos(a) * (BIKE.rimR + 0.004), Math.sin(a) * (BIKE.rimR + 0.004), side * 0.006),
      0.0024, 0.0024, 4,
    ));
  }

  // --- spoke reflector, because it is that kind of bike ---
  const rf = reflectorAt;
  pb.add('reflector', new THREE.CylinderGeometry(0.042, 0.042, 0.009, 14), {
    pos: [Math.cos(rf) * 0.17, Math.sin(rf) * 0.17, 0],
    rot: [Math.PI / 2, 0, 0],
  });
}

function buildFender(pb, centre, arc, startAngle, radius, halfWidth) {
  const g = new THREE.TorusGeometry(radius, 0.011, 6, 40, arc);
  g.scale(1, 1, (halfWidth / 0.011) * 0.55);
  pb.add('cream', g, { pos: [centre.x, centre.y, 0], rot: [0, 0, startAngle] });
  // little mudguard lip
  const lip = new THREE.TorusGeometry(radius - 0.012, 0.006, 5, 30, arc);
  lip.scale(1, 1, 0.5);
  pb.add('chrome', lip, { pos: [centre.x, centre.y, 0], rot: [0, 0, startAngle] });
}

function buildCrank(materials) {
  const pb = new PartBuilder();
  const { bb, crank, crankZ, chainZ, chainringR, cogR } = BIKE;
  const z = chainZ;

  // chainring: rim, spider arms, teeth
  pb.add('chromeDark', new THREE.TorusGeometry(chainringR - 0.012, 0.011, 6, 40), { pos: [0, 0, z] });
  pb.add('chromeDark', new THREE.CylinderGeometry(chainringR - 0.02, chainringR - 0.02, 0.006, 32), {
    pos: [0, 0, z], rot: [Math.PI / 2, 0, 0],
  });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + 0.3;
    pb.add('chromeDark', rodBetween(
      V(Math.cos(a) * 0.03, Math.sin(a) * 0.03, z),
      V(Math.cos(a) * (chainringR - 0.018), Math.sin(a) * (chainringR - 0.018), z),
      0.014, 0.01, 8,
    ));
  }
  for (let i = 0; i < 34; i++) {
    const a = (i / 34) * TAU;
    pb.add('chrome', new THREE.BoxGeometry(0.016, 0.014, 0.005), {
      pos: [Math.cos(a) * (chainringR + 0.004), Math.sin(a) * (chainringR + 0.004), z],
      rot: [0, 0, a],
    });
  }
  pb.add('chromeDark', new THREE.CylinderGeometry(0.026, 0.026, 0.02, 14), { pos: [0, 0, z], rot: [Math.PI / 2, 0, 0] });

  // crank arms
  for (const side of [1, -1]) {
    const armZ = side * crankZ;
    pb.add('chrome', rodBetween(V(0, 0, armZ - side * 0.012), V(crank, 0, armZ - side * 0.012), 0.021, 0.014, 10));
    pb.add('chrome', new THREE.CylinderGeometry(0.024, 0.024, 0.026, 12), { pos: [crank, 0, armZ], rot: [Math.PI / 2, 0, 0] });
  }
  // pedal spindles + platforms (level with the crank group, they spin with it)
  for (const side of [1, -1]) {
    pb.add('steel', rodBetween(V(crank, 0, side * (crankZ - 0.014)), V(crank, 0, side * (crankZ + 0.03)), 0.007, 0.007, 8));
  }

  const group = new THREE.Group();
  group.name = 'crank';
  group.position.copy(bb);
  pb.build(group, materials);

  // platforms live in their own groups so the animation can read their world pose
  const pedals = [];
  for (const side of [1, -1]) {
    const pedal = new THREE.Group();
    pedal.position.set(crank, 0, side * crankZ);
    const shape = new THREE.BoxGeometry(0.115, 0.016, 0.082);
    const body = new THREE.Mesh(shape, materials.steel);
    body.castShadow = true;
    pedal.add(body);
    for (const s of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.03, 0.012), materials.steel);
      rail.position.set(0, 0.006, s * 0.041);
      rail.castShadow = true;
      pedal.add(rail);
    }
    const capMesh = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.03, 0.05), materials.chromeDark);
    capMesh.position.set(-0.042, 0.004, 0);
    pedal.add(capMesh);
    group.add(pedal);
    pedals.push(pedal);
  }
  return { group, pedals };
}

export function buildBike(materials) {
  const bike = new THREE.Group();
  bike.name = 'bike';
  const pb = new PartBuilder();
  const {
    rear, front, bb, seatTop, headBot, headTop, barC, frameR, cogR, gripZ, chainZ,
  } = BIKE;

  // ---------------- frame ----------------
  const seatTube = rodBetween(bb, seatTop, frameR, frameR * 0.88, 14);
  pb.add('frame', seatTube);
  pb.add('frame', rodBetween(bb, headBot, frameR * 1.08, frameR * 0.92, 14)); // down tube
  pb.add('frame', rodBetween(off(seatTop, 0, -0.02), off(headTop, 0, -0.01), frameR * 0.92, frameR * 0.86, 14)); // top tube
  pb.add('frame', rodBetween(headBot, headTop, frameR * 1.2, frameR * 1.15, 16)); // head tube
  pb.add('frameDark', rodBetween(off(bb, 0, 0, -0.045), off(bb, 0, 0, 0.045), 0.031, 0.031, 16)); // BB shell

  // chainstays + seatstays, gently bowed
  for (const s of [-1, 1]) {
    const stay = new THREE.CatmullRomCurve3([
      V(bb.x + 0.01, bb.y - 0.005, s * 0.036),
      V(bb.x - 0.26, bb.y + 0.012, s * 0.062),
      V(rear.x, rear.y, s * 0.052),
    ]);
    pb.add('frame', taperedTube(stay, { segments: 14, radial: 10, radius: () => 0.0155 }));
    const seatStay = new THREE.CatmullRomCurve3([
      V(seatTop.x + 0.005, seatTop.y - 0.03, s * 0.018),
      V(seatTop.x - 0.2, seatTop.y - 0.16, s * 0.05),
      V(rear.x, rear.y, s * 0.052),
    ]);
    pb.add('frame', taperedTube(seatStay, { segments: 14, radial: 9, radius: (t) => 0.0135 - t * 0.002 }));
  }
  // seat cluster + a slim seatpost
  pb.add('frameDark', new THREE.CylinderGeometry(0.028, 0.028, 0.022, 12), { pos: [seatTop.x, seatTop.y, 0], rot: [0, 0, -0.2] });
  pb.add('chrome', rodBetween(seatTop, BIKE.seatPostTop, 0.0155, 0.0155, 12));
  pb.add('chromeDark', new THREE.CylinderGeometry(0.021, 0.021, 0.012, 12), { pos: [BIKE.seatPostTop.x, BIKE.seatPostTop.y, 0], rot: [0, 0, -0.2] });

  // headset + head badge
  pb.add('chrome', rodBetween(off(headTop, 0, -0.012), off(headTop, 0, 0.03), 0.028, 0.026, 14));
  pb.add('chrome', rodBetween(off(headBot, 0, -0.03), off(headBot, 0, 0.012), 0.028, 0.026, 14));
  const badge = new THREE.Mesh(new THREE.CircleGeometry(0.026, 20), materials.coral);
  badge.position.set(headBot.x + 0.021, (headBot.y + headTop.y) / 2 + 0.01, 0.012);
  badge.rotation.y = Math.PI / 2 - 0.25;
  badge.rotation.z = 0;
  badge.castShadow = false;
  bike.add(badge);

  // ---------------- fork ----------------
  for (const s of [-1, 1]) {
    const blade = new THREE.CatmullRomCurve3([
      V(headBot.x - 0.004, headBot.y - 0.02, s * 0.03),
      V(headBot.x + 0.022, headBot.y - 0.2, s * 0.046),
      V(front.x, front.y, s * 0.05),
    ]);
    pb.add('frame', taperedTube(blade, { segments: 16, radial: 10, radius: (t) => 0.0175 - t * 0.004 }));
  }
  pb.add('frame', rodBetween(off(headBot, 0.0, -0.03, -0.036), off(headBot, 0.0, -0.03, 0.036), 0.019, 0.019, 12));

  // ---------------- handlebar ----------------
  const barCurve = new THREE.CatmullRomCurve3([
    V(barC.x - 0.055, barC.y + 0.004, 0),
    V(barC.x + 0.012, barC.y + 0.012, 0),
    V(barC.x + 0.006, barC.y + 0.006, gripZ * 0.55),
    V(BIKE.grip.x, BIKE.grip.y, gripZ * 0.86),
    V(BIKE.grip.x - 0.075, BIKE.grip.y - 0.004, gripZ),
  ]);
  pb.add('chrome', taperedTube(barCurve, { segments: 40, radial: 9, radius: () => 0.0145 }));

  // grips + bar-end caps
  for (const s of [-1, 1]) {
    const g0 = V(BIKE.grip.x - 0.012, BIKE.grip.y, s * (gripZ * 0.82));
    const g1 = V(BIKE.grip.x - 0.082, BIKE.grip.y - 0.004, s * gripZ);
    pb.add('leather', rodBetween(g0, g1, 0.019, 0.021, 12));
    pb.add('chrome', new THREE.SphereGeometry(0.019, 12, 8, 0, TAU, 0, Math.PI / 2),
      { pos: [g1.x, g1.y, g1.z], rot: [0, 0, -Math.PI / 2 * Math.sign(s)], scale: [1, 0.5, 1] });
    pb.add('leatherDark', new THREE.TorusGeometry(0.0195, 0.003, 5, 14), { pos: [g0.x, g0.y, g0.z], rot: [Math.PI / 2, 0, 0] });
  }
  // stem + clamp
  pb.add('chrome', rodBetween(headTop, barC, 0.019, 0.019, 12));
  pb.add('chrome', new THREE.CylinderGeometry(0.026, 0.026, 0.036, 12), { pos: [barC.x, barC.y, 0], rot: [Math.PI / 2, 0, 0] });
  // bell
  pb.add('chrome', new THREE.SphereGeometry(0.028, 14, 10, 0, TAU, 0, Math.PI / 2), { pos: [barC.x + 0.012, barC.y + 0.02, -0.105] });
  pb.add('chrome', new THREE.CylinderGeometry(0.012, 0.012, 0.012, 8), { pos: [barC.x + 0.012, barC.y + 0.012, -0.105] });

  // ---------------- headlamp ----------------
  const lamp = new THREE.Group();
  lamp.position.set(headBot.x + 0.075, headBot.y - 0.06, 0);
  const lampBody = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.062, 0.075, 20), materials.chrome);
  lampBody.rotation.z = -Math.PI / 2;
  lampBody.castShadow = true;
  lamp.add(lampBody);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.05, 20), materials.lampLens);
  lens.position.set(0.039, 0, 0);
  lens.rotation.y = Math.PI / 2;
  lamp.add(lens);
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.022), materials.chromeDark);
  bracket.position.set(-0.03, -0.045, 0);
  lamp.add(bracket);
  bike.add(lamp);

  // ---------------- saddle ----------------
  const saddleShape = new THREE.Shape();
  saddleShape.moveTo(0.145, 0);
  saddleShape.bezierCurveTo(0.13, 0.032, 0.02, 0.05, -0.06, 0.068);
  saddleShape.bezierCurveTo(-0.13, 0.082, -0.175, 0.05, -0.175, 0);
  saddleShape.bezierCurveTo(-0.175, -0.05, -0.13, -0.082, -0.06, -0.068);
  saddleShape.bezierCurveTo(0.02, -0.05, 0.13, -0.032, 0.145, 0);
  const saddleGeo = new THREE.ExtrudeGeometry(saddleShape, {
    depth: 0.03, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 4, curveSegments: 24,
  });
  saddleGeo.rotateX(-Math.PI / 2);
  saddleGeo.rotateY(Math.PI / 2);
  pb.add('leather', saddleGeo, { pos: [BIKE.saddle.x + 0.02, BIKE.saddle.y - 0.012, 0], rot: [0, 0, -0.09] });
  pb.add('leatherDark', rodBetween(
    BIKE.seatPostTop,
    V(BIKE.saddle.x + 0.02, BIKE.saddle.y - 0.028, 0), 0.011, 0.011, 8,
  ));

  // ---------------- fenders + rear light ----------------
  buildFender(pb, front, Math.PI * 1.32, -Math.PI * 0.16, BIKE.wheelR + 0.045, 0.016);
  buildFender(pb, rear, Math.PI * 1.5, -Math.PI * 0.25, BIKE.wheelR + 0.045, 0.016);
  for (const s of [-1, 1]) {
    pb.add('chrome', rodBetween(V(rear.x, rear.y, s * 0.055), V(rear.x - 0.2, rear.y + 0.3, s * 0.03), 0.005, 0.005, 6));
  }
  const tailLight = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 10), materials.tailLens);
  tailLight.position.set(rear.x - 0.26, rear.y + 0.29, 0);
  tailLight.scale.set(0.7, 1, 1.1);
  bike.add(tailLight);

  // ---------------- static build ----------------
  pb.build(bike, materials);

  // wheels (merged separately so they can spin)
  const wheels = [];
  for (const [name, centre] of [['rearWheel', rear], ['frontWheel', front]]) {
    const wheelPb = new PartBuilder();
    buildWheel(wheelPb, { reflectorAt: name === 'rearWheel' ? 0.6 : 2.1 });
    const g = new THREE.Group();
    g.name = name;
    g.position.copy(centre);
    wheelPb.build(g, materials);
    bike.add(g);
    wheels.push(g);
  }

  // rear sprocket rides on the rear wheel
  const cogPb = new PartBuilder();
  cogPb.add('chromeDark', new THREE.CylinderGeometry(cogR, cogR, 0.007, 20), { rot: [Math.PI / 2, 0, 0] });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    cogPb.add('chrome', new THREE.BoxGeometry(0.011, 0.011, 0.005), {
      pos: [Math.cos(a) * (cogR + 0.004), Math.sin(a) * (cogR + 0.004), 0], rot: [0, 0, a],
    });
  }
  const cog = new THREE.Group();
  cogPb.build(cog, materials);
  cog.position.set(0, 0, chainZ - rear.z);
  wheels[0].add(cog);

  // chain
  const chainPb = new PartBuilder();
  const c1 = new THREE.Vector2(BIKE.bb.x, BIKE.bb.y);
  const c2 = new THREE.Vector2(BIKE.rear.x, BIKE.rear.y);
  for (const part of chainParts(c1, BIKE.chainringR, c2, cogR, chainZ)) {
    if (part.geo) chainPb.add('steel', part.geo, { pos: part.pos, rot: part.rot });
    else chainPb.add('steel', part);
  }
  chainPb.build(bike, materials);

  // crank assembly
  const { group: crankGroup, pedals } = buildCrank(materials);
  bike.add(crankGroup);

  return { group: bike, wheels, crank: crankGroup, pedals };
}

/**
 * Chain: two straight runs plus a wrap around each wheel. Built from
 * primitives on purpose — a closed TubeGeometry degenerates at the seam and
 * hands the shader NaN normals, which render as black.
 */
function chainParts(c1, r1, c2, r2, z) {
  const d = new THREE.Vector2().subVectors(c2, c1);
  const L = d.length();
  const alpha = Math.atan2(d.y, d.x);
  const beta = Math.acos(THREE.MathUtils.clamp((r1 - r2) / L, -1, 1));
  const at = (c, r, a) => V(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, z);
  const parts = [];
  for (const sign of [1, -1]) {
    const a1 = alpha + sign * beta;
    parts.push(rodBetween(at(c1, r1, a1), at(c2, r2, a1), 0.0072, 0.0072, 6));
    parts.push({
      geo: new THREE.TorusGeometry(r1, 0.0072, 5, 14, Math.PI),
      pos: [c1.x, c1.y, z],
      rot: [0, 0, a1 - sign * Math.PI],
    });
    parts.push({
      geo: new THREE.TorusGeometry(r2, 0.0072, 5, 12, Math.PI),
      pos: [c2.x, c2.y, z],
      rot: [0, 0, a1],
    });
  }
  return parts;
}
