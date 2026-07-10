// Battlefield for the gastric (stomach) level. See docs/GAME_DESIGN.md §10.
//
// MVP note (§14): the full dungeon generator's procedural rooms/corridors
// are not wired up yet, so this level's path is hand-authored — an
// axis-aligned polyline standing in for a blood-vessel/lymphatic route
// through the stomach, from the primary tumor (entrance) to the patient's
// vital core. Deploy tiles (ground = melee, highground = ranged) are
// derived procedurally from the path so future maps only need a new
// waypoint list, not new tile-placement code — this is the seam where the
// existing procedural generator's `bfs`/room-graph output can later be fed
// in instead of a hand list (§14 roadmap).

export const TILE_SIZE = 1.4;

// Axis-aligned waypoints, in grid units. Each consecutive pair is a
// straight horizontal or vertical segment (kept planar/non-self-crossing
// by construction).
export const PATH_WAYPOINTS = [
  [1, 1], [1, 4], [4, 4], [4, 1], [7, 1], [7, 5],
  [10, 5], [10, 2], [12, 2], [12, 8], [6, 8], [6, 9],
];

export const ENTRANCE = PATH_WAYPOINTS[0];
export const CORE = PATH_WAYPOINTS[PATH_WAYPOINTS.length - 1];

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

export const PATH_CELLS = rasterizePath(PATH_WAYPOINTS);
export const DEPLOY_TILES = buildDeployTiles(PATH_CELLS);

export function gridToWorld(x, z) {
  return { x: x * TILE_SIZE, z: z * TILE_SIZE };
}

// Total path length in grid steps — used to normalize progress-along-path.
export const PATH_LENGTH = PATH_CELLS.length - 1;
