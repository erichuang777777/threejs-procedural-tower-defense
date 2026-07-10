// Deployment / economy rules. See docs/GAME_DESIGN.md §9b.
export const DEPLOYMENT = {
  dpStart: 24,
  dpRegenPerSec: 1.6,
  dpMax: 999,
  maxDeployed: 6,
  redeployCooldownSec: 20,
  retreatRefundRatio: 0.5,
  damageMultCap: 6.0, // weakness(x3) * MDT(x2) ceiling
};

export const LIVES_START = 20;
