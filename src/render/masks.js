// masks.js
// Per-asset hit regions measured from the art's own alpha.
//
// Picking must agree with what is drawn, so both are derived from the same
// pixels: a tree is clickable where its sprite is opaque, and nothing else —
// including the corners of the bounding box that are only sky. The masks are
// built lazily, once per sprite, and cached; each is a tiny grid (a sprite is
// at most 16x27).

/**
 * @param {{decor:{index:object, image:Image}}} res  the loaded art.
 * @returns {{sprite:Function}}
 *   `sprite(name, x, y)` — is pixel (x, y) of that sprite opaque? `null` where
 *   no mask exists (treated as opaque by the picker).
 */
export function makeMasks(res) {
  const sprites = new Map();

  /** Opaque-pixel test for one w x h region of an image, row-major. */
  const grid = (img, sx, sy, w, h) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, sx, sy, w, h, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h).data;
    return (x, y) => (x >= 0 && y >= 0 && x < w && y < h) ? d[(y * w + x) * 4 + 3] > 128 : false;
  };

  return {
    sprite: (name, x, y) => {
      const box = res.decor?.index?.sprites[name];
      if (!box || !res.decor.image) return null;
      let m = sprites.get(name);
      if (!m) {
        m = grid(res.decor.image, box.x, box.y, box.w, box.h);
        sprites.set(name, m);
      }
      return m(x, y);
    },
  };
}
