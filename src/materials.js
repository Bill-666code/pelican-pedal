/**
 * Shared materials + a hand-painted equirect environment map.
 * The env map is what makes the chrome rims, chain and lenses read as
 * "real" metal/glass under a warm studio-ish sky.
 */
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export function createMaterials() {
  const std = (color, roughness, metalness, extra = {}) =>
    new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness, metalness, ...extra });

  return {
    // ---- bicycle ----
    frame: std(PALETTE.frameMint, 0.28, 0.12, { envMapIntensity: 1.15 }),
    frameDark: std(PALETTE.frameMintDark, 0.34, 0.15),
    cream: std(PALETTE.frameCream, 0.42, 0.05),
    chrome: std(PALETTE.chrome, 0.16, 0.95, { envMapIntensity: 1.4 }),
    steel: std(PALETTE.steel, 0.42, 0.7, { envMapIntensity: 1.25 }),
    chromeDark: std(PALETTE.chromeDark, 0.28, 0.88, { envMapIntensity: 1.35 }),
    tire: std(PALETTE.tireTread, 0.85, 0.0),
    tireWall: std(PALETTE.tireWall, 0.62, 0.0),
    leather: std(PALETTE.leather, 0.62, 0.05),
    leatherDark: std(PALETTE.leatherDark, 0.7, 0.05),
    coral: std(PALETTE.accentWarm, 0.3, 0.1),
    hedgeTrunk: std('#7a6650', 0.9, 0.0),
    hedgeLeaf: std('#8aa878', 0.85, 0.0),
    post: std('#e8e2d2', 0.75, 0.0),
    reflector: new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffb347'),
      roughness: 0.25,
      metalness: 0.1,
      emissive: new THREE.Color('#ff8a1f'),
      emissiveIntensity: 0.45,
    }),
    lampLens: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#fff2d0'),
      roughness: 0.05,
      metalness: 0.0,
      transmission: 0.55,
      thickness: 0.04,
      ior: 1.45,
      emissive: new THREE.Color('#ffe6ad'),
      emissiveIntensity: 0.22,
      clearcoat: 1,
    }),
    tailLens: new THREE.MeshStandardMaterial({
      color: new THREE.Color('#e8483a'),
      roughness: 0.18,
      metalness: 0.1,
      emissive: new THREE.Color('#d8321f'),
      emissiveIntensity: 0.75,
    }),

    // ---- pelican ----
    feather: std(PALETTE.featherLight, 0.72, 0.0),
    body: std('#ffffff', 0.72, 0.0, { vertexColors: true }),
    featherShade: std(PALETTE.featherShade, 0.78, 0.0),
    wing: std(PALETTE.wingGrey, 0.7, 0.0),
    wingShade: std(PALETTE.wingShade, 0.68, 0.0),
    wingTip: std(PALETTE.wingTip, 0.62, 0.04),
    beak: std(PALETTE.beak, 0.36, 0.04),
    beakLower: std(PALETTE.beakLower, 0.42, 0.04),
    pouch: std(PALETTE.pouch, 0.5, 0.02),
    foot: std(PALETTE.foot, 0.48, 0.03),
    footShade: std(PALETTE.footShade, 0.5, 0.03),
    leg: std(PALETTE.leg, 0.55, 0.02),
    capRed: std(PALETTE.capRed, 0.42, 0.02),
    capWhite: std(PALETTE.capWhite, 0.55, 0.0),
    glassFrame: std(PALETTE.glassFrame, 0.32, 0.25),
    visor: std(PALETTE.visor, 0.42, 0.08),
    lens: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(PALETTE.lens),
      roughness: 0.08,
      metalness: 0.35,
      transmission: 0.0,
      opacity: 0.92,
      transparent: true,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      envMapIntensity: 2.2,
    }),
    eye: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#20242a'),
      roughness: 0.1,
      metalness: 0.0,
      clearcoat: 1,
      envMapIntensity: 1.6,
    }),
  };
}

/** Small procedural equirect: sky gradient, warm sun, ground bounce. */
function equirectCanvas() {
  const w = 512;
  const h = 256;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');

  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.56);
  sky.addColorStop(0, PALETTE.skyTop);
  sky.addColorStop(0.7, '#e7efe4');
  sky.addColorStop(1, PALETTE.skyHorizon);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h * 0.56);

  const ground = ctx.createLinearGradient(0, h * 0.56, 0, h);
  ground.addColorStop(0, '#cfc7b4');
  ground.addColorStop(0.35, PALETTE.groundFar);
  ground.addColorStop(1, '#8d9a8a');
  ctx.fillStyle = ground;
  ctx.fillRect(0, h * 0.56, w, h * 0.44);

  // warm sun + a soft secondary fill light
  const sun = ctx.createRadialGradient(w * 0.68, h * 0.2, 2, w * 0.68, h * 0.2, h * 0.42);
  sun.addColorStop(0, 'rgba(255,248,225,1)');
  sun.addColorStop(0.25, 'rgba(255,241,205,0.75)');
  sun.addColorStop(1, 'rgba(255,241,205,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, w, h);

  const fill = ctx.createRadialGradient(w * 0.16, h * 0.3, 2, w * 0.16, h * 0.3, h * 0.5);
  fill.addColorStop(0, 'rgba(214,240,232,0.5)');
  fill.addColorStop(1, 'rgba(214,240,232,0)');
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, w, h);

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const source = equirectCanvas();
  const target = pmrem.fromEquirectangular(source);
  source.dispose();
  pmrem.dispose();
  return target.texture;
}
