// Battlefield map factory. See docs/GAME_DESIGN.md §10, §14.
//
// Each level supplies a hand-authored axis-aligned waypoint polyline
// (see data/maps.js) standing in for a vessel/lymphatic route through that
// organ. This module turns waypoints into everything downstream needs:
// the rasterized cell-by-cell enemy path, and procedurally-derived
// ground/highground deploy tiles flanking it. Nothing here is gastric- or
// lung-specific — a new level is purely a new `data/maps.js` entry.
import { levelById } from './data/maps.js';

export const TILE_SIZE = 1.4;

function key(x, z) {
  return `${x},${z}`;
}

// Rasterize the polyline into unit grid steps — this doubles as both the
// enemy movement path (moving cell-to-cell) and the "occupied" mask used
// to keep deploy tiles off the path itself.
export function rasterizePath(waypoints) {
  const cells = [[waypoints[0][0], waypoints[0][1]]];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const [x0, z0] = waypoints[i];
    const [x1, z1] = waypoints[i + 1];
    const dx = Math.sign(x1 - x0);
    const dz = Math.sign(z1 - z0);
    let x = x0, z = z0;
    while (x !== x1 || z !== z1) {
      if (x !== x1) x += dx; else z += dz;
      cells.push([x, z]);
    }
  }
  return cells;
}

// Ring of ground tiles adjacent to the path, then a second ring of
// highground tiles adjacent to *those* — generous by design so the player
// always has placement choices near any stretch of path.
export function buildDeployTiles(pathCells) {
  const pathSet = new Set(pathCells.map(([x, z]) => key(x, z)));
  const ground = new Map();
  const highground = new Map();

  for (const [px, pz] of pathCells) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (dx === 0 && dz === 0) continue;
        const gx = px + dx, gz = pz + dz;
        const k = key(gx, gz);
        if (pathSet.has(k) || ground.has(k)) continue;
        ground.set(k, { x: gx, z: gz, type: 'ground' });
      }
    }
  }
  for (const cell of ground.values()) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (dx === 0 && dz === 0) continue;
        const gx = cell.x + dx, gz = cell.z + dz;
        const k = key(gx, gz);
        if (pathSet.has(k) || ground.has(k) || highground.has(k)) continue;
        highground.set(k, { x: gx, z: gz, type: 'highground' });
      }
    }
  }
  return [...ground.values(), ...highground.values()];
}

export function gridToWorld(x, z) {
  return { x: x * TILE_SIZE, z: z * TILE_SIZE };
}

// Builds the full playable-map state for one level: rasterized path,
// deploy tiles, entrance/core markers, and path length for progress calc.
export function buildMap(levelId) {
  const level = levelById[levelId];
  if (!level || !level.waypoints) throw new Error(`No map data for level "${levelId}"`);
  const pathCells = rasterizePath(level.waypoints);
  const deployTiles = buildDeployTiles(pathCells);
  return {
    id: levelId,
    level,
    tileSize: TILE_SIZE,
    waypoints: level.waypoints,
    pathCells,
    deployTiles,
    entrance: level.waypoints[0],
    core: level.waypoints[level.waypoints.length - 1],
    pathLength: pathCells.length - 1,
  };
}
