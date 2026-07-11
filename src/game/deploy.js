// Deployment economy: DP regen/cost, squad slot cap, retreat/redeploy
// cooldown, tile occupancy. See docs/GAME_DESIGN.md §9b.
import { DEPLOYMENT } from './data/deployment.js';

export class DeploymentManager {
  constructor(map, config = DEPLOYMENT) {
    this.map = map;
    this.config = config;
    this.dp = config.dpStart;
    this.occupied = new Map(); // tileKey -> doctorInstanceId
    this.redeployCooldowns = new Map(); // doctorDefId -> secondsRemaining
  }

  tileKey(tile) {
    return `${tile.x},${tile.z}`;
  }

  isTileFree(tile) {
    return !this.occupied.has(this.tileKey(tile));
  }

  canAfford(cost) {
    return this.dp >= cost;
  }

  isOnCooldown(doctorDefId) {
    return (this.redeployCooldowns.get(doctorDefId) || 0) > 0;
  }

  cooldownRemaining(doctorDefId) {
    return this.redeployCooldowns.get(doctorDefId) || 0;
  }

  // Returns {ok, reason} — caller (Game) creates the Doctor instance itself
  // once this validates, then calls commitDeploy to reserve the tile/DP.
  canDeploy({ doctorDef, tile, currentSquadSize }) {
    if (currentSquadSize >= this.config.maxDeployed) return { ok: false, reason: 'squad_full' };
    if (!doctorDef.deployTiles.includes(tile.type)) return { ok: false, reason: 'wrong_tile' };
    if (!this.isTileFree(tile)) return { ok: false, reason: 'tile_occupied' };
    if (!this.canAfford(doctorDef.deployCost)) return { ok: false, reason: 'insufficient_dp' };
    if (this.isOnCooldown(doctorDef.id)) return { ok: false, reason: 'on_cooldown' };
    return { ok: true };
  }

  commitDeploy(doctorInst, tile, cost) {
    this.dp -= cost;
    this.occupied.set(this.tileKey(tile), doctorInst.id);
  }

  retreat(doctorInst) {
    this.occupied.delete(this.tileKey(doctorInst.tile));
    this.dp += Math.round(doctorInst.def.deployCost * this.config.retreatRefundRatio);
    this.redeployCooldowns.set(doctorInst.doctorId, this.config.redeployCooldownSec);
  }

  onDoctorDied(doctorInst) {
    this.occupied.delete(this.tileKey(doctorInst.tile));
    this.redeployCooldowns.set(doctorInst.doctorId, this.config.redeployCooldownSec);
  }

  update(dt) {
    this.dp = Math.min(this.config.dpMax, this.dp + this.config.dpRegenPerSec * dt);
    for (const [id, remaining] of this.redeployCooldowns) {
      const next = remaining - dt;
      if (next <= 0) this.redeployCooldowns.delete(id);
      else this.redeployCooldowns.set(id, next);
    }
  }

  availableTiles(type) {
    return this.map.deployTiles.filter((t) => t.type === type && this.isTileFree(t));
  }
}
