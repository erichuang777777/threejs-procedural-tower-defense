// Wave spawner + multi-phase boss controller. See docs/GAME_DESIGN.md §7, §13.
export class WaveSpawner {
  constructor(waves, { spawn, onWaveStart, onAllComplete }) {
    this.waves = waves;
    this.spawn = spawn;
    this.onWaveStart = onWaveStart || (() => {});
    this.onAllComplete = onAllComplete || (() => {});
    this.waveIndex = -1;
    this.state = 'delay';
    this.spawnQueue = [];
    this.spawnGapRemaining = 0;
    this.delayRemaining = 0;
    this.complete = false;
    this._advance();
  }

  _advance() {
    this.waveIndex++;
    if (this.waveIndex >= this.waves.length) {
      this.complete = true;
      this.onAllComplete();
      return;
    }
    const wave = this.waves[this.waveIndex];
    this.delayRemaining = wave.delay;
    this.state = 'delay';
    this.spawnQueue = [];
    for (const group of wave.spawn) {
      for (let i = 0; i < group.count; i++) this.spawnQueue.push({ enemyId: group.enemyId, gap: group.gap });
    }
    this.spawnGapRemaining = 0;
  }

  get currentWave() {
    return this.waves[this.waveIndex];
  }
  get totalWaves() {
    return this.waves.length;
  }

  update(dt) {
    if (this.complete) return;
    if (this.state === 'delay') {
      this.delayRemaining -= dt;
      if (this.delayRemaining <= 0) {
        this.state = 'spawning';
        this.onWaveStart(this.waveIndex, this.currentWave);
      }
      return;
    }
    this.spawnGapRemaining -= dt;
    while (this.spawnQueue.length && this.spawnGapRemaining <= 0) {
      const next = this.spawnQueue.shift();
      this.spawn(next.enemyId);
      this.spawnGapRemaining = next.gap;
      if (next.gap > 0) break;
    }
    if (this.spawnQueue.length === 0) this._advance();
  }
}

// Drives a boss Enemy instance through BOSS_PHASES: swaps which resistance
// layer it uses (its "stage"), toggles flags (e.g. shielded), and triggers
// periodic reinforcement summons — all purely by re-pointing the enemy's
// familyStage/flags fields, no special-cased combat logic needed.
export class BossController {
  constructor(enemy, phases, { onPhaseChange, summonFn } = {}) {
    this.enemy = enemy;
    this.phases = phases;
    this.phaseIndex = -1;
    this.onPhaseChange = onPhaseChange || (() => {});
    this.summonFn = summonFn || (() => {});
    this.summonTimer = 0;
    this._applyPhase(0, true);
  }

  _applyPhase(i, initial = false) {
    const phase = this.phases[i];
    this.phaseIndex = i;
    this.enemy.familyStage = phase.familyStage;
    this.enemy.flags = new Set(phase.flags || []);
    this.enemy.phaseIndex = i;
    this.summonTimer = 0;
    if (!initial) this.onPhaseChange(phase, i);
  }

  update(dt) {
    if (!this.enemy.alive) return;
    const hpPct = this.enemy.hp / this.enemy.maxHp;
    for (let i = this.phases.length - 1; i >= 0; i--) {
      if (hpPct <= this.phases[i].hpPct && i > this.phaseIndex) {
        this._applyPhase(i);
        break;
      }
    }
    const phase = this.phases[this.phaseIndex];
    if (phase.summon) {
      this.summonTimer -= dt;
      if (this.summonTimer <= 0) {
        this.summonTimer = phase.summon.intervalSec;
        this.summonFn(phase.summon.enemyId);
      }
    }
  }

  get currentPhase() {
    return this.phases[this.phaseIndex];
  }
}
