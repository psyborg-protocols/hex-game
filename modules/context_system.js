// modules/context_system.js

/**
 * Determines the player's current contextual action based on their position and surroundings.
 */
export class ContextSystem {
  constructor(game) {
    this.game = game;
  }

  /**
   * Analyzes the game state to determine the most relevant action.
   * @returns {{mode: string|null, params: object}} The determined mode and its parameters.
   */
  determine() {
    const q = this.game.player.q;
    const r = this.game.player.r;
    const currentHeight = this.game.world.getHeight(q, r);
    const dirs = [ {dq:1,dr:0},{dq:-1,dr:0},{dq:0,dr:1},{dq:0,dr:-1},{dq:1,dr:-1},{dq:-1,dr:1} ];

    // Check for mining opportunities (steep cliffs)
    for (const {dq, dr} of dirs) {
      const nq = q + dq;
      const nr = r + dr;
      const h = this.game.world.getHeight(nq, nr);
      if (h !== -Infinity && h - currentHeight >= 3) {
        return { mode: 'mine', params: { q: nq, r: nr } };
      }
    }

    // Check for harvesting opportunities (standing in a forest)
    const feat = (this.game.world.featureMap[r] && this.game.world.featureMap[r][q]) || 'none';
    if (feat === 'forest' && this.game.propsGroup) {
      const treeMesh = this.game.propsGroup.children.find(ch => 
        ch.userData?.type === 'forest' && ch.userData.q === q && ch.userData.r === r
      );
      if (treeMesh) {
        return { mode: 'harvest', params: { q, r, treeMesh } };
      }
    }

    // Check for trading opportunities (standing near or in a city)
    for (const {dq, dr} of [{dq:0, dr:0}, ...dirs]) {
      const nq = q + dq;
      const nr = r + dr;
      if (this.game.world.isInside(nq, nr)) {
        const f = (this.game.world.featureMap[nr] && this.game.world.featureMap[nr][nq]) || 'none';
        if (f === 'city') {
          return { mode: 'trade', params: { cityQ: nq, cityR: nr } };
        }
      }
    }

    // No specific context found
    return { mode: null, params: {} };
  }
}
