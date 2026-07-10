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
const DOCTOR_GRID = 16;
const DOCTOR_CELL = DOCTOR_GRID * SCALE;

function drawDoctorFrame({ palette, weaponColor, pose, flash }) {
  const { c, ctx } = makeCanvas(DOCTOR_GRID, DOCTOR_GRID);
  const bob = pose === 'idleB' ? 1 : 0;
  const lean = pose === 'strike' ? 1 : pose === 'hurt' ? -1 : 0;
  const armFwd = pose === 'strike' || pose === 'skill' ? 4 : pose === 'windup' ? -2 : pose === 'recover' ? 1 : 0;
  const skin = hex(palette.skin);
  const coat = hex(palette.coat);
  const coatShade = hex(darken(palette.coat, 30));
  const accent = hex(palette.accent);
  const hair = hex(palette.hair);
  const y0 = 2 - bob;

  if (pose === 'down') {
    // collapsed silhouette
    for (let x = 3; x < 13; x++) {
      px(ctx, x, 12, coatShade, 0.9);
      px(ctx, x, 13, skin, 0.7);
    }
    return c;
  }

  // legs (navy trousers)
  ctx.fillStyle = hex(0x24314f);
  ctx.fillRect(5, 11 + bob, 2, 4);
  ctx.fillRect(9, 11 + bob, 2, 4);
  // shoes
  ctx.fillStyle = hex(0x1a1a1a);
  ctx.fillRect(4, 15 + bob, 3, 1);
  ctx.fillRect(9, 15 + bob, 3, 1);

  // torso (coat)
  ctx.fillStyle = coat;
  ctx.fillRect(4 + lean, y0 + 4, 8, 7);
  ctx.fillStyle = coatShade;
  ctx.fillRect(4 + lean, y0 + 9, 8, 2);
  // accent tie/collar stripe
  ctx.fillStyle = accent;
  ctx.fillRect(7 + lean, y0 + 4, 2, 6);

  // back arm (static)
  ctx.fillStyle = coat;
  ctx.fillRect(3 + lean, y0 + 5, 2, 5);
  // front arm (animated toward target)
  ctx.fillStyle = coat;
  ctx.fillRect(10 + lean + Math.max(0, armFwd - 2), y0 + 5, 3, 2);
  ctx.fillStyle = skin;
  ctx.fillRect(12 + lean + armFwd, y0 + 6, 1, 1);

  // weapon / treatment flash at hand
  if (pose === 'strike' || pose === 'skill' || pose === 'windup') {
    const r = pose === 'skill' ? 3 : pose === 'strike' ? 2 : 1;
    circleFill(ctx, 13 + lean + armFwd, y0 + 6.5, r, weaponColor, pose === 'windup' ? 0.4 : 0.95);
  }

  // head
  circleFill(ctx, 8 + lean, y0 + 1.6, 2.4, skin);
  // hair cap
  ctx.fillStyle = hair;
  ctx.fillRect(6 + lean, y0 - 1, 5, 2);
  // glasses/eyes
  ctx.fillStyle = '#1c1c1c';
  px(ctx, 7 + lean, y0 + 1, '#1c1c1c');
  px(ctx, 9 + lean, y0 + 1, '#1c1c1c');

  // hurt flash overlay
  if (flash) {
    ctx.fillStyle = '#ff3b3b';
    ctx.globalAlpha = 0.45;
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
const ENEMY_GRID = 16;
const ENEMY_CELL = ENEMY_GRID * SCALE;

const ARCHETYPE_STYLE = {
  rapid: { spikes: 8, spikeLen: 1.6, desat: 0, wobble: 1.4 },
  solid: { spikes: 4, spikeLen: 1.0, desat: 0, wobble: 0.4 },
  hypoxic: { spikes: 3, spikeLen: 0.8, desat: 0.5, wobble: 0.6 },
  resistant: { spikes: 6, spikeLen: 1.2, desat: 0.15, wobble: 0.8, badge: 0x2ecc71 },
  ctc: { spikes: 5, spikeLen: 1.8, desat: 0, wobble: 2.0, streamlined: true },
  stem: { spikes: 7, spikeLen: 1.4, desat: 0, wobble: 1.0, glowCore: true },
  mets: { spikes: 5, spikeLen: 1.0, desat: 0.1, wobble: 1.2, seam: true },
};

function tintColor(base, desat) {
  const r = (base >> 16) & 255, g = (base >> 8) & 255, b = base & 255;
  const gray = (r + g + b) / 3;
  const mix = (ch) => Math.round(ch + (gray - ch) * desat);
  return (mix(r) << 16) | (mix(g) << 8) | mix(b);
}

function drawEnemyFrame({ familyColor, archetype, pose, boss }) {
  const { c, ctx } = makeCanvas(ENEMY_GRID, ENEMY_GRID);
  const style = ARCHETYPE_STYLE[archetype] || ARCHETYPE_STYLE.solid;
  const baseColor = tintColor(familyColor, style.desat || 0);
  const cx = 8, cy = 8;
  const r = boss ? 6.5 : 5;

  if (pose === 'death1' || pose === 'death2' || pose === 'death3') {
    const spread = pose === 'death1' ? 0.5 : pose === 'death2' ? 2 : 4;
    const alpha = pose === 'death3' ? 0.15 : pose === 'death2' ? 0.55 : 0.9;
    const shardN = 6;
    for (let i = 0; i < shardN; i++) {
      const ang = (i / shardN) * Math.PI * 2;
      const sx = cx + Math.cos(ang) * spread;
      const sy = cy + Math.sin(ang) * spread;
      circleFill(ctx, sx, sy, 1.4, hex(baseColor), alpha);
    }
    return c;
  }

  const squash = pose === 'hurt' ? 0.75 : pose === 'attack' ? 1.15 : 1.0;
  const rx = r * squash;
  const ry = r / squash;

  // membrane spikes
  const spikeN = style.spikes;
  const spikeLen = style.spikeLen * (pose === 'attack' ? 1.6 : 1.0);
  ctx.fillStyle = hex(darken(baseColor, 20));
  for (let i = 0; i < spikeN; i++) {
    const ang = (i / spikeN) * Math.PI * 2 + (pose === 'move2' ? 0.25 : 0);
    const bx = cx + Math.cos(ang) * rx;
    const by = cy + Math.sin(ang) * ry;
    const tx = cx + Math.cos(ang) * (rx + spikeLen);
    const ty = cy + Math.sin(ang) * (ry + spikeLen);
    px(ctx, Math.round(bx), Math.round(by), hex(darken(baseColor, 20)));
    px(ctx, Math.round(tx), Math.round(ty), hex(darken(baseColor, 10)));
  }

  // body (ellipse-ish via scaled circle fill)
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx + 0.5) / rx;
      const dy = (y - cy + 0.5) / ry;
      if (dx * dx + dy * dy <= 1) px(ctx, x, y, hex(baseColor));
    }
  }

  // nucleus
  const nucleusColor = style.glowCore ? hex(lighten(baseColor, 80)) : hex(darken(baseColor, 60));
  circleFill(ctx, cx, cy, r * 0.4, nucleusColor, style.glowCore && pose === 'move1' ? 1 : 0.9);

  // seam line for metastasis archetype
  if (style.seam) {
    ctx.fillStyle = hex(darken(baseColor, 80));
    ctx.fillRect(Math.round(cx - rx), Math.round(cy), Math.round(rx * 2), 1);
  }

  // resistance badge (small marker dot, e.g. MDR shield)
  if (style.badge) {
    circleFill(ctx, cx + rx * 0.6, cy - ry * 0.6, 1.1, hex(style.badge), 0.95);
  }

  // hurt / attack flash overlay
  if (pose === 'hurt') {
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.55;
    ctx.fillRect(0, 0, ENEMY_GRID, ENEMY_GRID);
    ctx.globalAlpha = 1;
  } else if (pose === 'attack') {
    ctx.fillStyle = '#ff4d4d';
    ctx.globalAlpha = 0.25;
    ctx.fillRect(0, 0, ENEMY_GRID, ENEMY_GRID);
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
