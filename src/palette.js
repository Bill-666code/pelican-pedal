/**
 * One cohesive palette for the whole scene.
 * Warm cream + mint green (frame) + coral red (cap) + charcoal (details).
 */
export const PALETTE = {
  // Environment
  skyTop: '#cfeae0',
  skyHorizon: '#f4efe2',
  sunWarm: '#fff3d6',
  groundFar: '#b9c9b4',
  roadBase: '#7c8087',
  roadDark: '#6b6f76',
  roadLine: '#efe6d2',
  fog: '#e7e6da',

  // Bicycle
  frameMint: '#7ad9bd',
  frameMintDark: '#4fbb9d',
  frameCream: '#f4ece0',
  chrome: '#d8dde2',
  chromeDark: '#8d959c',
  tireWall: '#efe4d2',
  tireTread: '#33383d',
  leather: '#b9744a',
  leatherDark: '#8d5433',
  steel: '#8b939b',

  // Pelican
  featherLight: '#fbf8f1',
  featherShade: '#e6e2d6',
  featherWarm: '#f3ece0',
  wingGrey: '#cfd4d9',
  wingShade: '#9aa2a9',
  wingTip: '#3b4046',
  beak: '#f2a44c',
  beakLower: '#e8913c',
  pouch: '#f0b662',
  foot: '#f0a63c',
  footShade: '#d98b2b',
  leg: '#cf8a45',
  capRed: '#e04f3c',
  capRedDark: '#bf3c2b',
  capWhite: '#fbf7ef',
  glassFrame: '#2b3036',
  visor: '#3a4046',
  lens: '#8a6a2c',
  lensRim: '#1c2024',

  // UI accent
  accent: '#2fbfa0',
  accentWarm: '#e2604a',
};

/** #rrggbb -> {r,g,b} in 0..1 */
export function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}
