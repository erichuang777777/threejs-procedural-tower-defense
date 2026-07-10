// Procedural pixel-art sprite generator. See docs/GAME_DESIGN.md §11.
//
// Nothing is loaded from disk (matching the existing renderer's fully
// procedural-canvas-texture approach). Every unit's sprite sheet is drawn
// at a low native pixel grid, then nearest-neighbour blown up into a strip
// of animation frames baked into one THREE.CanvasTexture. State metadata
// ({start, count, fps, loop}) tells the animator which frame range to play.
//
// Naming convention (§11): sprites are addressed by `{unitId}_{state}`
// conceptually — in practice one sheet per unit holds every state, sliced
// by the returned `states` map, so adding a new unit is "call
// buildDoctorSprite/buildEnemySprite with its config", nothing else.

import * as THREE from 'three';
import { damageTypeById } from './data/damageTypes.js';

const SCALE = 4; // device pixels per art pixel — keep integer for crisp edges

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return { c, ctx };
}

// Draws a single art-pixel at (x,y) in a GRID x GRID low-res buffer.
function px(ctx, x, y, color, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
  ctx.globalAlpha = 1;
}

function hex(n) {
  return '#' + (n >>> 0).toString(16).padStart(6, '0');
}

function lighten(n, amt) {
  const r = Math.min(255, ((n >> 16) & 255) + amt);
  const g = Math.min(255, ((n >> 8) & 255) + amt);
  const b = Math.min(255, (n & 255) + amt);
  return (r << 16) | (g << 8) | b;
}
function darken(n, amt) {
  return lighten(n, -amt);
}

function circleFill(ctx, cx, cy, r, color, alpha = 1) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x - cx + 0.5;
      const dy = y - cy + 0.5;
      if (dx * dx + dy * dy <= r * r) px(ctx, x, y, color, alpha);
    }
  }
}

// Blit a small native-res frame canvas into the big sheet at cell index,
// scaling up with nearest-neighbour (imageSmoothingEnabled=false).
function blit(sheetCtx, frameCanvas, index, cellSize) {
  sheetCtx.drawImage(frameCanvas, 0, 0, frameCanvas.width, frameCanvas.height, index * cellSize, 0, cellSize, cellSize);
}

function buildTexture(sheetCanvas, cols) {
  const tex = new THREE.CanvasTexture(sheetCanvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(1 / cols, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------------
// Doctor sprites — humanoid pixel figure, weapon colour = damageType.color
// ---------------------------------------------------------------------
const DOCTOR_GRID = 32;
const DOCTOR_CELL = DOCTOR_GRID * SCALE;

function drawDoctorFrame({ palette, weaponColor, pose, flash }) {
  const { c, ctx } = makeCanvas(DOCTOR_GRID, DOCTOR_GRID);
  const bob = pose === 'idleB' ? 1 : 0;
  const lean = pose === 'strike' ? 1 : pose === 'hurt' ? -1 : 0;
  const armFwd = pose === 'strike' || pose === 'skill' ? 5 : pose === 'windup' ? -2 : pose === 'recover' ? 1 : 0;
  const skin = hex(palette.skin);
  const skinShade = hex(darken(palette.skin, 35));
  const coat = hex(palette.coat);
  const coatHi = hex(lighten(palette.coat, 14));
  const coatLo = hex(darken(palette.coat, 26));
  const coatLo2 = hex(darken(palette.coat, 44));
  const accent = hex(palette.accent);
  const accentLo = hex(darken(palette.accent, 30));
  const hair = hex(palette.hair);
  const hairHi = hex(lighten(palette.hair, 25));
  const trouser = 0x223154;
  const trouserHi = hex(lighten(trouser, 16));
  const trouserLo = hex(darken(trouser, 18));
  const cx = 16, cy0 = 4;

  if (pose === 'down') {
    // collapsed silhouette — lying figure, head to one side
    ctx.globalAlpha = 0.88;
    circleFill(ctx, 9, 21, 3.2, skin);
    ctx.fillStyle = hair; ctx.fillRect(5, 18, 5, 3);
    ctx.fillStyle = coatLo; ctx.fillRect(12, 18, 15, 5);
    ctx.fillStyle = coat; ctx.fillRect(12, 18, 15, 2);
    ctx.fillStyle = accent; ctx.fillRect(17, 20, 4, 1);
    ctx.fillStyle = trouserLo; ctx.fillRect(25, 19, 5, 4);
    ctx.globalAlpha = 1;
    return c;
  }

  const ax = cx + lean, ay = cy0 - bob;

  // --- back (far) arm, sleeve + cuff -------------------------------
  ctx.fillStyle = coatLo;
  ctx.fillRect(ax - 8, ay + 9, 3, 7);
  ctx.fillStyle = coatHi;
  ctx.fillRect(ax - 8, ay + 14, 3, 1);
  ctx.fillStyle = skin;
  ctx.fillRect(ax - 7, ay + 16, 2, 2);

  // --- legs (two-tone trousers) -------------------------------------
  ctx.fillStyle = trouser;
  ctx.fillRect(ax - 4, ay + 17, 4, 6);
  ctx.fillRect(ax + 1, ay + 17, 4, 6);
  ctx.fillStyle = trouserHi;
  ctx.fillRect(ax - 4, ay + 17, 1, 6);
  ctx.fillRect(ax + 1, ay + 17, 1, 6);
  ctx.fillStyle = trouserLo;
  ctx.fillRect(ax - 1, ay + 17, 1, 6);
  ctx.fillRect(ax + 4, ay + 17, 1, 6);
  // shoes
  ctx.fillStyle = '#1a1712';
  ctx.fillRect(ax - 5, ay + 23, 5, 2);
  ctx.fillRect(ax + 1, ay + 23, 5, 2);
  ctx.fillStyle = hex(0x3a342a);
  ctx.fillRect(ax - 5, ay + 23, 5, 1);
  ctx.fillRect(ax + 1, ay + 23, 5, 1);

  // --- torso (lab coat, shaded) --------------------------------------
  ctx.fillStyle = coat;
  ctx.fillRect(ax - 6, ay + 10, 12, 8);
  ctx.fillStyle = coatHi;
  ctx.fillRect(ax - 6, ay + 10, 2, 8);
  ctx.fillStyle = coatLo;
  ctx.fillRect(ax + 4, ay + 10, 2, 8);
  ctx.fillStyle = coatLo2;
  ctx.fillRect(ax - 6, ay + 17, 12, 1); // belt shadow line
  // lapel/collar V
  ctx.fillStyle = coatLo;
  px(ctx, ax - 2, ay + 10, coatLo); px(ctx, ax - 1, ay + 11, coatLo);
  px(ctx, ax + 2, ay + 10, coatLo); px(ctx, ax + 1, ay + 11, coatLo);
  // shirt sliver + tie (accent colour ties the sprite to its damage type)
  ctx.fillStyle = '#eef1f6';
  ctx.fillRect(ax - 1, ay + 10, 3, 3);
  ctx.fillStyle = accent;
  ctx.fillRect(ax, ay + 11, 1, 6);
  ctx.fillStyle = accentLo;
  ctx.fillRect(ax + 1, ay + 12, 1, 5);
  // chest pocket
  ctx.fillStyle = coatLo;
  ctx.fillRect(ax - 5, ay + 14, 2, 2);

  // --- front (near) arm, animated toward target ----------------------
  const fx = ax + 6 + Math.max(0, armFwd);
  ctx.fillStyle = coat;
  ctx.fillRect(ax + 5, ay + 9, 3 + Math.max(0, armFwd), 3);
  ctx.fillStyle = coatHi;
  ctx.fillRect(ax + 5, ay + 9, 3 + Math.max(0, armFwd), 1);
  ctx.fillStyle = skin;
  ctx.fillRect(fx - 1, ay + 9, 2, 3);

  // weapon / treatment flash at hand
  if (pose === 'strike' || pose === 'skill' || pose === 'windup') {
    const r = pose === 'skill' ? 3.4 : pose === 'strike' ? 2.2 : 1.1;
    circleFill(ctx, fx + 1, ay + 10.5, r, weaponColor, pose === 'windup' ? 0.45 : 0.95);
    circleFill(ctx, fx + 1, ay + 10.5, Math.max(0.6, r - 1.3), '#ffffff', pose === 'windup' ? 0.2 : 0.6);
  }

  // --- head (shaded, with hair, brows, eyes, mouth) -------------------
  circleFill(ctx, ax, ay + 3.4, 3.5, skin);
  circleFill(ctx, ax + 1.6, ay + 3.6, 2.6, skinShade, 0.35); // cheek shadow
  // hair cap: irregular silhouette using layered fills, not a plain rect
  circleFill(ctx, ax, ay + 1.4, 3.7, hair);
  circleFill(ctx, ax - 2.6, ay + 3, 1.6, hair);
  circleFill(ctx, ax + 2.6, ay + 3, 1.6, hair);
  circleFill(ctx, ax, ay + 3.2, 3.2, skin); // carve the face back out
  circleFill(ctx, ax - 1.8, ay + 0.6, 1.1, hairHi, 0.7);
  // brows + eyes + mouth
  ctx.fillStyle = '#20140c';
  ctx.fillRect(ax - 2, ay + 2.6, 1, 1);
  ctx.fillRect(ax + 1, ay + 2.6, 1, 1);
  ctx.fillStyle = '#1c1c1c';
  ctx.fillRect(ax - 2, ay + 3.4, 1, 1);
  ctx.fillRect(ax + 1, ay + 3.4, 1, 1);
  ctx.fillStyle = hex(darken(palette.skin, 60));
  ctx.fillRect(ax - 1, ay + 5, 2, 1);

  // hurt flash overlay
  if (flash) {
    ctx.fillStyle = '#ff3b3b';
    ctx.globalAlpha = 0.4;
    ctx.fillRect(0, 0, DOCTOR_GRID, DOCTOR_GRID);
    ctx.globalAlpha = 1;
  }

  return c;
}

export function buildDoctorSprite(doctor) {
  const dt = damageTypeById[doctor.damageType];
  const weaponColor = hex(dt ? dt.color : 0xffffff);
  const seq = [
    ['idle', 'idleA'], ['idle', 'idleB'],
    ['attack', 'windup'], ['attack', 'strike'], ['attack', 'recover'],
    ['hurt', 'hurt'], ['hurt', 'idleA'],
    ['skill', 'skill'], ['skill', 'recover'],
    ['down', 'down'],
  ];
  const cols = seq.length;
  const { c: sheet, ctx: sheetCtx } = makeCanvas(cols * DOCTOR_CELL, DOCTOR_CELL);
  seq.forEach(([, pose], i) => {
    const frame = drawDoctorFrame({ palette: doctor.palette, weaponColor, pose, flash: pose === 'hurt' });
    blit(sheetCtx, frame, i, DOCTOR_CELL);
  });
  const texture = buildTexture(sheet, cols);
  return {
    texture,
    cols,
    states: {
      idle: { start: 0, count: 2, fps: 2, loop: true },
      attack: { start: 2, count: 3, fps: 8, loop: false },
      hurt: { start: 5, count: 2, fps: 8, loop: false },
      skill: { start: 7, count: 2, fps: 6, loop: false },
      down: { start: 9, count: 1, fps: 1, loop: false },
    },
  };
}

// ---------------------------------------------------------------------
// Enemy (cancer cell) sprites — blob + nucleus, archetype-varied membrane
// ---------------------------------------------------------------------
const ENEMY_GRID = 24;
const ENEMY_CELL = ENEMY_GRID * SCALE;
const GOLDEN_ANGLE = 2.399963;

const ARCHETYPE_STYLE = {
  rapid: { spikes: 9, spikeLen: 2.0, desat: 0, wobble: 1.4 },
  solid: { spikes: 5, spikeLen: 1.1, desat: 0, wobble: 0.4 },
  hypoxic: { spikes: 4, spikeLen: 0.9, desat: 0.55, wobble: 0.6 },
  resistant: { spikes: 7, spikeLen: 1.4, desat: 0.15, wobble: 0.8, badge: 0x2ecc71 },
  ctc: { spikes: 6, spikeLen: 2.2, desat: 0, wobble: 2.0, streamlined: true },
  stem: { spikes: 8, spikeLen: 1.7, desat: 0, wobble: 1.0, glowCore: true },
  mets: { spikes: 6, spikeLen: 1.2, desat: 0.1, wobble: 1.2, seam: true },
};

function tintColor(base, desat) {
  const r = (base >> 16) & 255, g = (base >> 8) & 255, b = base & 255;
  const gray = (r + g + b) / 3;
  const mix = (ch) => Math.round(ch + (gray - ch) * desat);
  return (mix(r) << 16) | (mix(g) << 8) | mix(b);
}

// Deterministic organic speckle scatter (phyllotaxis/golden-angle spiral) —
// gives a mottled, textured cytoplasm instead of a flat colour fill, with
// no per-frame randomness (so the texture doesn't flicker between frames).
function speckle(ctx, cx, cy, rx, ry, count, colorFn) {
  for (let i = 0; i < count; i++) {
    const ang = i * GOLDEN_ANGLE;
    const dist = Math.sqrt((i + 0.5) / count) * 0.72;
    const sx = cx + Math.cos(ang) * rx * dist;
    const sy = cy + Math.sin(ang) * ry * dist;
    px(ctx, Math.round(sx), Math.round(sy), colorFn(i), 0.85);
  }
}

function drawEnemyFrame({ familyColor, archetype, pose, boss }) {
  const grid = boss ? ENEMY_GRID * 1.5 : ENEMY_GRID;
  const { c, ctx } = makeCanvas(grid, grid);
  const style = ARCHETYPE_STYLE[archetype] || ARCHETYPE_STYLE.solid;
  const baseColor = tintColor(familyColor, style.desat || 0);
  const rim = darken(baseColor, 55);
  const mid = baseColor;
  const core = lighten(baseColor, 20);
  const speck = darken(baseColor, 35);
  const speckHi = lighten(baseColor, 45);
  const cx = grid / 2, cy = grid / 2;
  const r = boss ? 11.1 : 7.4;

  if (pose === 'death1' || pose === 'death2' || pose === 'death3') {
    const spread = pose === 'death1' ? 0.6 : pose === 'death2' ? 3 : 5.5;
    const alpha = pose === 'death3' ? 0.12 : pose === 'death2' ? 0.5 : 0.9;
    const shardN = 7;
    for (let i = 0; i < shardN; i++) {
      const ang = (i / shardN) * Math.PI * 2;
      const sx = cx + Math.cos(ang) * spread;
      const sy = cy + Math.sin(ang) * spread;
      circleFill(ctx, sx, sy, 1.7, hex(i % 2 ? rim : mid), alpha);
    }
    circleFill(ctx, cx, cy, 1.4, hex(core), alpha * 0.8);
    return c;
  }

  const squash = pose === 'hurt' ? 0.72 : pose === 'attack' ? 1.18 : 1.0;
  const rx = r * squash;
  const ry = r / squash;

  // membrane bumps — small irregular clusters, not thin mechanical spikes.
  const spikeN = style.spikes;
  const spikeLen = style.spikeLen * (pose === 'attack' ? 1.5 : 1.0);
  for (let i = 0; i < spikeN; i++) {
    const wobble = Math.sin(i * 2.1) * 0.4 * style.wobble;
    const ang = (i / spikeN) * Math.PI * 2 + (pose === 'move2' ? 0.3 : 0) + wobble * 0.1;
    const len = spikeLen * (0.7 + 0.3 * Math.sin(i * 1.7));
    const bx = cx + Math.cos(ang) * rx * 0.92, by = cy + Math.sin(ang) * ry * 0.92;
    const tx = cx + Math.cos(ang) * (rx + len), ty = cy + Math.sin(ang) * (ry + len);
    circleFill(ctx, (bx + tx) / 2, (by + ty) / 2, 1.1, hex(rim), 0.9);
    px(ctx, Math.round(tx), Math.round(ty), hex(darken(baseColor, 15)), 0.85);
  }

  // body: rim (dark outline) -> mid band -> lighter cytoplasm core
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx + 0.5) / rx, dy = (y - cy + 0.5) / ry;
      const d2 = dx * dx + dy * dy;
      if (d2 > 1) continue;
      const shade = d2 > 0.78 ? rim : d2 > 0.42 ? mid : core;
      px(ctx, x, y, hex(shade));
    }
  }
  // organic mottling texture within the body
  speckle(ctx, cx, cy, rx * 0.85, ry * 0.85, boss ? 14 : 8, (i) => hex(i % 2 ? speck : speckHi));

  // nucleus, with its own two-tone mottling
  const nucleusColor = style.glowCore ? lighten(baseColor, 85) : darken(baseColor, 62);
  circleFill(ctx, cx, cy, r * 0.36, hex(nucleusColor), style.glowCore && pose === 'move1' ? 1 : 0.92);
  speckle(ctx, cx, cy, r * 0.3, r * 0.3, 4, () => hex(darken(nucleusColor, 25)));

  // seam line for metastasis archetype
  if (style.seam) {
    ctx.fillStyle = hex(rim);
    ctx.fillRect(Math.round(cx - rx), Math.round(cy), Math.round(rx * 2), 1);
  }

  // resistance badge (small marker dot, e.g. MDR shield)
  if (style.badge) {
    circleFill(ctx, cx + rx * 0.62, cy - ry * 0.62, 1.3, hex(style.badge), 0.95);
    circleFill(ctx, cx + rx * 0.62, cy - ry * 0.62, 0.6, '#ffffff', 0.8);
  }

  // hurt / attack flash overlay
  if (pose === 'hurt') {
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.55;
    ctx.fillRect(0, 0, grid, grid);
    ctx.globalAlpha = 1;
  } else if (pose === 'attack') {
    ctx.fillStyle = '#ff4d4d';
    ctx.globalAlpha = 0.25;
    ctx.fillRect(0, 0, grid, grid);
    ctx.globalAlpha = 1;
  }

  return c;
}

export function buildEnemySprite(enemy, { familyColor, tint } = {}) {
  const color = tint ?? familyColor ?? 0xcccccc;
  const boss = !!enemy.isBoss;
  const seq = [
    ['move', 'move1'], ['move', 'move2'],
    ['attack', 'attack'], ['attack', 'move1'],
    ['hurt', 'hurt'], ['hurt', 'move1'],
    ['death', 'death1'], ['death', 'death2'], ['death', 'death3'],
  ];
  const cols = seq.length;
  const cell = boss ? ENEMY_CELL * 1.4 : ENEMY_CELL;
  const { c: sheet, ctx: sheetCtx } = makeCanvas(cols * cell, cell);
  seq.forEach(([, pose], i) => {
    const frame = drawEnemyFrame({ familyColor: color, archetype: enemy.archetypeId, pose, boss });
    blit(sheetCtx, frame, i, cell);
  });
  const texture = buildTexture(sheet, cols);
  return {
    texture,
    cols,
    states: {
      move: { start: 0, count: 2, fps: 4, loop: true },
      attack: { start: 2, count: 2, fps: 6, loop: false },
      hurt: { start: 4, count: 2, fps: 8, loop: false },
      death: { start: 6, count: 3, fps: 8, loop: false },
    },
  };
}

// Simple sprite cache keyed by unit id (+ optional tint) so identical units
// share one texture/material instead of rebuilding per-instance.
const cache = new Map();
export function getDoctorSprite(doctor) {
  const key = 'doc:' + doctor.id;
  if (!cache.has(key)) cache.set(key, buildDoctorSprite(doctor));
  return cache.get(key);
}
export function getEnemySprite(enemy, opts) {
  const key = 'enemy:' + enemy.id + ':' + (opts?.tint ?? 'base');
  if (!cache.has(key)) cache.set(key, buildEnemySprite(enemy, opts));
  return cache.get(key);
}
