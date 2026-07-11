// Core simulation engine — Three.js-agnostic. main.js owns rendering and
// reads this each frame. See docs/GAME_DESIGN.md §2 (core loop), §9
// (economy/lives), §9b (deployment).
import { DOCTORS, doctorById } from './data/doctors.js';
import { ENEMY_UNITS } from './data/enemies.js';
import { GASTRIC_LEVEL_WAVES, LUNG_LEVEL_WAVES } from './data/waves.js';
import { BOSS_PHASES } from './data/bossPhases.js';
import { LIVES_START } from './data/deployment.js';
import { Doctor, Enemy } from './entities.js';
import { DeploymentManager } from './deploy.js';
import { WaveSpawner, BossController } from './waveEngine.js';
import { computeDamage, activeSynergies, synergyDamageMult } from './combat.js';
import { buildMap } from './map.js';
import { getDoctorBonus } from './meta.js';

const DEATH_ANIM_DURATION = 0.5;
const MELEE_ATTACK_INTERVAL = 1.0; // enemy contact-attack tick while blocked

// Level id -> wave script. Adding a level = one entry here + a data/maps.js
// waypoint list + level-specific ENEMY_UNITS/BOSS_PHASES — nothing else
// in the engine changes (§0 modularity).
const WAVES_BY_LEVEL = { gastric: GASTRIC_LEVEL_WAVES, lung: LUNG_LEVEL_WAVES };

// Meta promotions/talents (§8, meta.js) are permanent, applied on deploy —
// they scale the doctor's base data, not baked into the DOCTORS registry.
function applyMetaBonus(baseDef) {
  const bonus = getDoctorBonus(baseDef.id);
  if (!bonus || (bonus.statMult === 1 && !bonus.talent)) return baseDef;
  const fx = bonus.talent?.effect || {};
  return {
    ...baseDef,
    atk: Math.round(baseDef.atk * bonus.statMult * (fx.atkMult ?? 1)),
    hp: Math.round(baseDef.hp * bonus.statMult * (fx.hpMult ?? 1)),
    range: baseDef.range + (fx.rangeAdd ?? 0),
    critChance: Math.min(0.95, (baseDef.critChance ?? 0) + (fx.critChanceAdd ?? 0)),
    blockCount: baseDef.blockCount + (fx.blockAdd ?? 0),
  };
}

export class Game {
  constructor(levelId = 'gastric') {
    this.levelId = levelId;
    this.map = buildMap(levelId);
    this.deployment = new DeploymentManager(this.map);
    this.doctors = [];
    this.enemies = [];
    this.lives = LIVES_START;
    this.time = 0;
    this.gameOver = false;
    this.outcome = null; // 'win' | 'lose'
    this.bossSpawned = false;
    this.bossDefeated = false;
    this.boss = null;
    this.bossController = null;
    this._listeners = {};
    this._activeSynergyIds = new Set();

    this.waveSpawner = new WaveSpawner(WAVES_BY_LEVEL[levelId] || GASTRIC_LEVEL_WAVES, {
      spawn: (enemyId) => this.spawnEnemy(enemyId),
      onWaveStart: (i, wave) => this.emit('waveStart', { index: i, wave, total: this.waveSpawner.totalWaves }),
      onAllComplete: () => this.emit('wavesComplete', {}),
    });
  }

  on(event, cb) {
    (this._listeners[event] ||= []).push(cb);
  }
  emit(event, payload) {
    for (const cb of this._listeners[event] || []) cb(payload);
  }

  // --- Deployment -------------------------------------------------------
  tryDeploy(doctorDefId, tile) {
    const baseDef = doctorById[doctorDefId];
    if (!baseDef) return { ok: false, reason: 'unknown_doctor' };
    const check = this.deployment.canDeploy({ doctorDef: baseDef, tile, currentSquadSize: this.doctors.length });
    if (!check.ok) return check;
    const def = applyMetaBonus(baseDef);
    const inst = new Doctor(def, tile);
    this.deployment.commitDeploy(inst, tile, baseDef.deployCost);
    this.doctors.push(inst);
    this.emit('doctorDeployed', { doctor: inst });
    return { ok: true, doctor: inst };
  }

  retreat(doctorInst) {
    if (!doctorInst.alive) return;
    this.deployment.retreat(doctorInst);
    for (const enemyId of doctorInst.blockedEnemyIds) {
      const e = this.enemies.find((x) => x.id === enemyId);
      if (e) e.blockedBy = null;
    }
    doctorInst.alive = false;
    this.doctors = this.doctors.filter((d) => d !== doctorInst);
    this.emit('doctorRetreated', { doctor: doctorInst });
  }

  // --- Spawning -----------------------------------------------------------
  spawnEnemy(enemyId, opts = {}) {
    const def = ENEMY_UNITS[enemyId];
    if (!def) return null;
    const inst = new Enemy(def, this.map, opts);
    if (opts.pathPos != null) inst.pathPos = opts.pathPos;
    this.enemies.push(inst);
    if (def.isBoss) {
      this.bossSpawned = true;
      this.boss = inst;
      const phases = BOSS_PHASES[enemyId] || [];
      this.bossController = new BossController(inst, phases, {
        onPhaseChange: (phase, i) => this.emit('bossPhaseChange', { phase, index: i, boss: inst }),
        summonFn: (summonId) => this.spawnEnemy(summonId, { pathPos: Math.max(0, inst.pathPos - 2) }),
      });
      this.emit('bossSpawned', { boss: inst });
    }
    this.emit('enemySpawned', { enemy: inst });
    return inst;
  }

  // --- Main tick ------------------------------------------------------
  update(dt) {
    if (this.gameOver) return;
    this.time += dt;
    this.deployment.update(dt);
    this.waveSpawner.update(dt);
    if (this.bossController) this.bossController.update(dt);

    const synergies = activeSynergies(this.doctors.filter((d) => d.alive).map((d) => d.doctorId));
    const synergyMult = synergyDamageMult(synergies);
    this._syncSynergyEvents(synergies);

    this._updateEnemies(dt);
    this._updateDoctors(dt, synergyMult);

    this.enemies = this.enemies.filter((e) => e.alive || (e.deathTimer || 0) < DEATH_ANIM_DURATION);

    this._checkEndConditions();
  }

  _syncSynergyEvents(activeList) {
    const ids = new Set(activeList.map((s) => s.id));
    for (const s of activeList) {
      if (!this._activeSynergyIds.has(s.id)) this.emit('synergyActivated', { synergy: s });
    }
    for (const id of this._activeSynergyIds) {
      if (!ids.has(id)) this.emit('synergyDeactivated', { id });
    }
    this._activeSynergyIds = ids;
  }

  _updateEnemies(dt) {
    for (const enemy of this.enemies) {
      if (!enemy.alive) {
        enemy.deathTimer = (enemy.deathTimer || 0) + dt;
        continue;
      }
      if (enemy.selfHeals) enemy.hp = Math.min(enemy.maxHp, enemy.hp + (enemy.def.healPerSec || 0) * dt);

      const blocker = enemy.blockedBy ? this.doctors.find((d) => d.id === enemy.blockedBy && d.alive) : null;
      if (!blocker) enemy.blockedBy = null;

      if (enemy.blockedBy) {
        this._setAnim(enemy, 'attack');
        enemy.contactTimer -= dt;
        if (enemy.contactTimer <= 0) {
          enemy.contactTimer = MELEE_ATTACK_INTERVAL;
          const blockerDoc = this.doctors.find((d) => d.id === enemy.blockedBy);
          if (blockerDoc) {
            const died = blockerDoc.takeDamage(enemy.contactDamage);
            if (died) this._onDoctorDied(blockerDoc);
          }
        }
        continue;
      }

      if (!enemy.isFlying) {
        const gp = enemy.currentGridPos();
        const availableBlocker = this.doctors.find(
          (d) => d.alive && d.role === 'melee' && d.blockedEnemyIds.size < d.blockCount && d.gridDistanceTo(gp.x, gp.z) <= d.range
        );
        if (availableBlocker) {
          enemy.blockedBy = availableBlocker.id;
          availableBlocker.blockedEnemyIds.add(enemy.id);
          enemy.contactTimer = MELEE_ATTACK_INTERVAL * 0.5;
          this._setAnim(enemy, 'attack');
          continue;
        }
      }

      enemy.pathPos += enemy.speed * dt;
      this._setAnim(enemy, 'move');

      if (enemy.reachedCore()) {
        this.lives = Math.max(0, this.lives - (enemy.isBoss ? 5 : 1));
        enemy.alive = false;
        enemy.deathTimer = DEATH_ANIM_DURATION; // skip death anim, it "arrived" not "died"
        this.emit('coreHit', { enemy });
      }
    }
  }

  _updateDoctors(dt, synergyMult) {
    for (const doctor of this.doctors) {
      if (!doctor.alive) continue;
      doctor.atkCooldown -= dt;
      doctor.tickSkillCharge(dt);

      if (doctor.role === 'melee') {
        for (const enemyId of [...doctor.blockedEnemyIds]) {
          const enemy = this.enemies.find((e) => e.id === enemyId);
          if (!enemy || !enemy.alive) doctor.blockedEnemyIds.delete(enemyId);
        }
        if (doctor.atkCooldown <= 0 && doctor.blockedEnemyIds.size > 0) {
          doctor.atkCooldown = 1 / doctor.def.atkSpeed;
          this._setAnim(doctor, 'attack');
          for (const enemyId of doctor.blockedEnemyIds) {
            const enemy = this.enemies.find((e) => e.id === enemyId);
            if (enemy && enemy.alive) this._attack(doctor, enemy, synergyMult);
          }
        }
      } else {
        const target = this._pickRangedTarget(doctor);
        if (target && doctor.atkCooldown <= 0) {
          doctor.atkCooldown = 1 / doctor.def.atkSpeed;
          this._setAnim(doctor, 'attack');
          this._attack(doctor, target, synergyMult);
          if (doctor.def.aoeRadius) {
            const tp = target.currentGridPos();
            for (const other of this.enemies) {
              if (other === target || !other.alive) continue;
              const op = other.currentGridPos();
              if (Math.hypot(op.x - tp.x, op.z - tp.z) <= doctor.def.aoeRadius) this._attack(doctor, other, synergyMult, 0.6);
            }
          }
        }
      }

      if (doctor.skillReady) this._castSkill(doctor, synergyMult);
    }
  }

  _pickRangedTarget(doctor) {
    let best = null;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const gp = enemy.currentGridPos();
      if (doctor.gridDistanceTo(gp.x, gp.z) > doctor.range) continue;
      if (!best || enemy.pathPos > best.pathPos) best = enemy;
    }
    return best;
  }

  _castSkill(doctor, synergyMult) {
    const skill = doctor.def.skill;
    let targets = [];
    if (doctor.role === 'melee') {
      targets = [...doctor.blockedEnemyIds].map((id) => this.enemies.find((e) => e.id === id)).filter((e) => e && e.alive);
    } else {
      const primary = this._pickRangedTarget(doctor);
      if (primary) {
        targets = [primary];
        if (skill.duration) {
          // "systemic" skills (e.g. 全身化療) hit everything currently in range
          targets = this.enemies.filter((e) => {
            if (!e.alive) return false;
            const gp = e.currentGridPos();
            return doctor.gridDistanceTo(gp.x, gp.z) <= doctor.range;
          });
        }
      }
    }
    if (!targets.length) return; // wait for a target before consuming charge
    doctor.skillReady = false;
    doctor.skillCharge = 0;
    this._setAnim(doctor, 'skill');
    this.emit('skillCast', { doctor, skill });
    const mult = skill.mult || skill.dotMult || 2;
    for (const t of targets) this._attack(doctor, t, synergyMult, mult, true);
  }

  _attack(doctor, enemy, synergyMult, skillMult = 1, isSkill = false) {
    const result = computeDamage(doctor, enemy, { synergyMult, skillMult });
    const died = enemy.takeDamage(result.amount);
    this.emit('damageDealt', { doctor, enemy, result, isSkill });
    if (died) this._onEnemyDied(enemy, doctor);
  }

  _onEnemyDied(enemy, killerDoctor) {
    if (killerDoctor) killerDoctor.gainXp(enemy.xpReward);
    const blocker = enemy.blockedBy ? this.doctors.find((d) => d.id === enemy.blockedBy) : null;
    if (blocker) blocker.blockedEnemyIds.delete(enemy.id);
    enemy.deathTimer = 0;
    this._setAnim(enemy, 'death');
    this.emit('enemyDied', { enemy, killerDoctor });

    if (enemy.splitsOnDeath && enemy.def.splitInto) {
      const { enemyId, count } = enemy.def.splitInto;
      for (let i = 0; i < count; i++) {
        this.spawnEnemy(enemyId, { pathPos: Math.max(0, enemy.pathPos - 0.4 * (i + 1)) });
      }
    }
    if (enemy.isBoss) this.bossDefeated = true;
  }

  _onDoctorDied(doctor) {
    this.deployment.onDoctorDied(doctor);
    for (const enemyId of doctor.blockedEnemyIds) {
      const e = this.enemies.find((x) => x.id === enemyId);
      if (e) e.blockedBy = null;
    }
    doctor.alive = false;
    this.doctors = this.doctors.filter((d) => d !== doctor);
    this.emit('doctorDied', { doctor });
  }

  _setAnim(entity, state) {
    if (performance.now() < (entity.animLockUntil || 0)) return; // hurt flash takes priority
    entity.animState = state;
  }

  _checkEndConditions() {
    if (this.lives <= 0) {
      this.gameOver = true;
      this.outcome = 'lose';
      this.emit('gameOver', { outcome: 'lose' });
      return;
    }
    if (this.waveSpawner.complete && this.bossSpawned && this.bossDefeated) {
      this.gameOver = true;
      this.outcome = 'win';
      this.emit('gameOver', { outcome: 'win' });
    }
  }
}

export { DOCTORS };
