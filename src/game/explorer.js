// explorer.js
// Exploring by standing still.
//
// There is no Explore button. Stop on a hex you have not explored and a ticker
// starts running round its edge; when the hex is done, it pings. Better places
// take longer, and the glow tells you so as it goes: every hex runs a pale first
// circuit, and a scenic one keeps going, turning copper, then silver, then gold,
// for as many circuits as it has earned. You learn how good a place is by
// watching it, never before you have stopped there.
//
// Pure timing, no drawing: render/discovery_fx.js draws `charge`.

import { TIERS, exploreSeconds, scenicOf, isExplored } from './discovery.js';

/** Where each circuit of the ticker starts and ends, in seconds. */
export const PHASE_ENDS = TIERS.map(t => t.seconds);

/**
 * Which circuit the ticker is on at `t` seconds, and how far round it is.
 * @returns {{phase:number, frac:number}}
 */
export function phaseAt(t) {
  let start = 0;
  for (let i = 0; i < PHASE_ENDS.length; i++) {
    const end = PHASE_ENDS[i];
    if (t < end) return { phase: i, frac: (t - start) / (end - start) };
    start = end;
  }
  return { phase: PHASE_ENDS.length - 1, frac: 1 };
}

export class Explorer {
  constructor(map, state) {
    this.map = map;
    this.state = state;
    this.charge = null;    // { q, r, t, duration, tier }
  }

  /**
   * Advance the clock.
   * @param {number} dt seconds
   * @param {{q,r,moving}} player
   * @param {boolean} canDwell  false while busy with something else
   * @returns {{q,r,tier}|null} the hex, the moment it finishes exploring
   */
  update(dt, player, canDwell) {
    if (!canDwell || player.moving || isExplored(this.state, player.q, player.r)) {
      this.charge = null;
      return null;
    }
    const col = this.map.get(player.q, player.r);
    if (!col) { this.charge = null; return null; }

    if (!this.charge || this.charge.q !== col.q || this.charge.r !== col.r) {
      this.charge = {
        q: col.q, r: col.r, t: 0,
        duration: exploreSeconds(this.map, col),
        tier: scenicOf(this.map, col).tier,
      };
    }

    this.charge.t += dt;
    if (this.charge.t < this.charge.duration) return null;

    const done = { q: col.q, r: col.r, tier: this.charge.tier };
    this.charge = null;
    return done;
  }
}
