// Generic sprite-sheet animation state machine, driven by the `states`
// metadata returned from sprites.js ({start, count, fps, loop}). Kept
// separate from entity gameplay state (entities.js) so the same animator
// works for doctors and enemies alike.
export class SpriteAnimator {
  constructor(states, { defaultState } = {}) {
    this.states = states;
    this.current = defaultState || Object.keys(states)[0];
    this.frame = 0;
    this.t = 0;
    this.done = false;
  }

  play(name, { restart = false } = {}) {
    if (!this.states[name]) return;
    if (this.current === name && !restart) return;
    this.current = name;
    this.frame = 0;
    this.t = 0;
    this.done = false;
  }

  update(dt) {
    const s = this.states[this.current];
    if (!s || s.count <= 1) return;
    this.t += dt;
    const frameDur = 1 / s.fps;
    while (this.t >= frameDur) {
      this.t -= frameDur;
      this.frame++;
      if (this.frame >= s.count) {
        if (s.loop) {
          this.frame = 0;
        } else {
          this.frame = s.count - 1;
          this.done = true;
        }
      }
    }
  }

  // Global frame index into the sprite sheet strip, for texture.offset.x.
  get frameIndex() {
    const s = this.states[this.current];
    return s ? s.start + this.frame : 0;
  }

  get isDone() {
    const s = this.states[this.current];
    return s && !s.loop && this.done;
  }
}
