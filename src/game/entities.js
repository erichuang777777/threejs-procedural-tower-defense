// Runtime gameplay entities. Deliberately Three.js-agnostic — main.js owns
// a parallel "view" (THREE.Sprite + SpriteAnimator) per entity id and
// syncs position/animState from these each tick. See docs/GAME_DESIGN.md
// §5 (doctors), §6 (enemies).
import { gridToWorld, PATH_CELLS, PATH_LENGTH } from './map.js';

let _id = 0;
const nextId = () => `e${++_id}`;

export class Doctor {
  constructor(def, tile, level = 1) {
    this.entityKind = 'doctor';
    this.id = nextId();
    this.def = def;
    this.doctorId = def.id;
    this.damageType = def.damageType;
    this.role = def.role;
    this.tile = tile; // {x,z,type}
    this.pos = gridToWorld(tile.x, tile.z);
    this.level = level;
    this.xp = 0;
    this.xpToNext = 10;
    this.maxHp = def.hp;
    this.hp = def.hp;
    this.range = def.range;
    this.blockCount = def.blockCount;
    this.blockedEnemyIds = new Set();
    this.atkCooldown = 0;
    this.skillCharge = 0;
    this.skillReady = false;
    this.alive = true;
    this.animState = 'idle';
    this.animLockUntil = 0;
  }

  get atk() {
    return this.def.atk * (1 + 0.12 * (this.level - 1));
  }
  get critChance() {
    return this.def.critChance;
  }
  get critMult() {
    return this.def.critMult;
  }

  gridDistanceTo(cellX, cellZ) {
    return Math.hypot(this.tile.x - cellX, this.tile.z - cellZ);
  }

  gainXp(xp) {
    this.xp += xp;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level++;
      this.xpToNext = Math.round(this.xpToNext * 1.35);
      this.maxHp = Math.round(this.maxHp * 1.08);
      this.hp = this.maxHp;
    }
  }

  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    this.animState = 'hurt';
    this.animLockUntil = performance.now() + 260;
    if (this.hp <= 0) {
      this.alive = false;
      this.animState = 'down';
    }
    return this.hp <= 0;
  }

  tickSkillCharge(dt) {
    if (this.skillReady) return;
    this.skillCharge = Math.min(this.def.skill.chargeTime, this.skillCharge + dt);
    if (this.skillCharge >= this.def.skill.chargeTime) this.skillReady = true;
  }
}

export class Enemy {
  // `def` = an ENEMY_UNITS entry. `overrides` lets boss phases swap
  // familyStage/markers/flags/hp at runtime without mutating shared data.
  constructor(def, overrides = {}) {
    this.entityKind = 'enemy';
    this.id = nextId();
    this.def = def;
    this.unitId = def.id;
    this.name = def.name;
    this.familyId = def.familyId;
    this.archetypeId = def.archetypeId;
    this.familyStage = overrides.familyStage || def.familyStage;
    this.markers = overrides.markers || [];
    this.flags = new Set([...(def.flags || []), ...(overrides.flags || [])]);
    this.isBoss = !!def.isBoss;
    this.maxHp = overrides.hp ?? def.hp;
    this.hp = this.maxHp;
    this.speed = def.speed;
    this.contactDamage = def.contactDamage;
    this.xpReward = def.xpReward;
    this.pathPos = 0;
    this.blockedBy = null;
    this.alive = true;
    this.animState = 'move';
    this.animLockUntil = 0;
    this.contactTimer = 0;
    this.phaseIndex = 0;
  }

  get isFlying() {
    return this.flags.has('flying');
  }
  get isShielded() {
    return this.flags.has('shielded');
  }
  get selfHeals() {
    return this.flags.has('selfHeal');
  }
  get splitsOnDeath() {
    return this.flags.has('splitOnDeath');
  }

  get progressFrac() {
    return this.pathPos / PATH_LENGTH;
  }

  worldPosition() {
    const idx = Math.min(Math.floor(this.pathPos), PATH_CELLS.length - 1);
    const nextIdx = Math.min(idx + 1, PATH_CELLS.length - 1);
    const frac = this.pathPos - idx;
    const a = gridToWorld(PATH_CELLS[idx][0], PATH_CELLS[idx][1]);
    const b = gridToWorld(PATH_CELLS[nextIdx][0], PATH_CELLS[nextIdx][1]);
    return { x: a.x + (b.x - a.x) * frac, z: a.z + (b.z - a.z) * frac };
  }

  currentCell() {
    const idx = Math.min(Math.round(this.pathPos), PATH_CELLS.length - 1);
    return PATH_CELLS[idx];
  }

  // Continuous (float) grid position, for smooth doctor range checks.
  currentGridPos() {
    const idx = Math.min(Math.floor(this.pathPos), PATH_CELLS.length - 1);
    const nextIdx = Math.min(idx + 1, PATH_CELLS.length - 1);
    const frac = this.pathPos - idx;
    const a = PATH_CELLS[idx], b = PATH_CELLS[nextIdx];
    return { x: a[0] + (b[0] - a[0]) * frac, z: a[1] + (b[1] - a[1]) * frac };
  }

  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    this.animState = 'hurt';
    this.animLockUntil = performance.now() + 180;
    if (this.hp <= 0) this.alive = false;
    return this.hp <= 0;
  }

  reachedCore() {
    return this.pathPos >= PATH_LENGTH;
  }
}
