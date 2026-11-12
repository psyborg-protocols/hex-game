// combat.js
// Dice, the way a board game does it: attack dice against defence dice.
//
// Each attack die hits on a 4, 5 or 6. Each defence die blocks a hit on a 5 or 6.
// Damage is hits minus blocks. That is the whole rule, and the dice are shown on
// screen every time, so you can see why a fight went the way it did.

export const HIT_ON = 4;
export const BLOCK_ON = 5;

const d6 = rng => 1 + Math.floor((rng ? rng.next() : Math.random()) * 6);

/**
 * Roll a clash.
 * @returns {{attack:number[], defense:number[], hits:number, blocks:number, damage:number}}
 */
export function clash(attackDice, defenseDice, rng = null) {
  const attack = Array.from({ length: Math.max(0, attackDice) }, () => d6(rng));
  const defense = Array.from({ length: Math.max(0, defenseDice) }, () => d6(rng));
  const hits = attack.filter(v => v >= HIT_ON).length;
  const blocks = defense.filter(v => v >= BLOCK_ON).length;
  return { attack, defense, hits, blocks, damage: Math.max(0, hits - blocks) };
}

/** Expected damage of a clash, for balancing and tests. */
export const expectedDamage = (a, d) => Math.max(0, a * (7 - HIT_ON) / 6 - d * (7 - BLOCK_ON) / 6);
