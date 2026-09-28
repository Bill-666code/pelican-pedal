/**
 * Shared dimensions (metres). The bike and the pelican are both authored
 * against these so the feet land on the pedals and the wings hold the bars.
 *
 * Forward is +X, up is +Y, the bike's left/right is ±Z.
 */
import * as THREE from 'three';

const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);

export const BIKE = {
  wheelR: 0.33, // outer tyre radius
  tyreHalfW: 0.028,
  rimR: 0.268,
  hubR: 0.026,
  spokes: 18,

  rear: V(-0.55, 0.33),
  front: V(0.55, 0.33),
  bb: V(-0.02, 0.27), // bottom bracket

  seatTop: V(-0.17, 0.94),
  seatPostTop: V(-0.196, 1.005),
  saddle: V(-0.215, 1.045), // saddle top surface centre

  headBot: V(0.505, 0.73),
  headTop: V(0.44, 0.94),
  barC: V(0.478, 1.022), // handlebar clamp centre
  gripZ: 0.25,
  grip: V(0.408, 1.032, 0.25),

  crank: 0.17, // crank arm length
  crankZ: 0.095, // pedal centre offset
  chainZ: 0.082, // chainring / sprocket plane
  chainringR: 0.115,
  cogR: 0.046,

  frameR: 0.021,
};

/** Where the rider's body attaches — used by pelican.js and the animation rig. */
export const RIDER = {
  hip: V(-0.2, 1.05, 0.118),
  hipZ: 0.118,
  thigh: 0.5,
  shin: 0.46,
  ankleLift: 0.062, // ankle height above the pedal platform
  shoulder: V(0.165, 1.315, 0.205),
  shoulderZ: 0.205,
  humerus: 0.255,
  forearm: 0.235,
  body: V(-0.03, 1.235, 0),
  bodyR: V(0.305, 0.215, 0.218),
  head: V(0.4, 1.7, 0),
  headR: 0.132,
};

export const SPEED = {
  maxKmh: 34,
  gearRatio: 2.45, // wheel revolutions per pedal revolution
};
