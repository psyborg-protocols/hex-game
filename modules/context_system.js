// modules/context_system.js

/**
 * Determines the player's current contextual action based on their position and surroundings.
 */
export class ContextSystem {
  constructor(game) {
    this.game = game;
  }

  /**
   * Analyzes the game state to determine all relevant actions.
   * @returns {Array<{mode: string, params: object}>} An array of all possible contexts.
   */
  determine() {
    const contexts = [];
    const q = this.game.player.q;
    const r = this.game.player.r;
    const currentHeight = this.game.world.getHeight(q, r);
    const dirs = [ {dq:1,dr:0},{dq:-1,dr:0},{dq:0,dr:1},{dq:0,dr:-1},{dq:1,dr:-1},{dq:-1,dr:1} ];

    // MODIFIED: Check for mining/quarrying opportunities
    const hasPickaxe = this.game.actions.hasItem('pickaxe');
    const hasHammer = this.game.actions.hasItem('hammer');

    if (hasPickaxe || hasHammer) {
      for (const {dq, dr} of dirs) {
        const nq = q + dq;
        const nr = r + dr;
        const h = this.game.world.getHeight(nq, nr);
        if (h !== -Infinity && h - currentHeight >= 3) {
          // Player can mine if they have a pickaxe, otherwise they can only quarry with a hammer.
          const tool = hasPickaxe ? 'pickaxe' : 'hammer';
          contexts.push({ mode: 'mine', params: { q: nq, r: nr, tool: tool } });
        }
      }
    }

    // Check for harvesting opportunities (all trees on the current tile)
    const feat = (this.game.world.featureMap[r] && this.game.world.featureMap[r][q]) || { type: 'none', trees: 0 };
    if ((feat.type === 'forest' || feat.type === 'dark_forest') && feat.trees > 0 && this.game.propsGroup) {
      this.game.propsGroup.children.forEach(ch => {
        if ((ch.userData?.type === 'forest' || ch.userData?.type === 'dark_forest') && ch.userData.q === q && ch.userData.r === r) {
          contexts.push({ mode: 'harvest', params: { q, r, treeMesh: ch } });
        }
      });
    }

    // Check for trading opportunities (standing near or in a city)
    const checkedCities = new Set();
    for (const {dq, dr} of [{dq:0, dr:0}, ...dirs]) {
      const nq = q + dq;
      const nr = r + dr;
      const cityKey = `${nq},${nr}`;
      if (checkedCities.has(cityKey)) continue;

      if (this.game.world.isInside(nq, nr)) {
        const f = (this.game.world.featureMap[nr] && this.game.world.featureMap[nr][nq]) || { type: 'none' };
        if (f.type === 'city') {
          contexts.push({ mode: 'trade', params: { cityQ: nq, cityR: nr } });
          checkedCities.add(cityKey);
        }
      }
    }

    return contexts;
  }
}
