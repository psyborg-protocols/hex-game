# Character art: the Wanderer

The player sprite lives in `src/render/player_sprite.js`. It is about 16px tall at 1x and is shown at 3x in game. These rules keep it, and any character drawn later, simple to read and good to look at.

## Rules

1. **Silhouette first.** The swept-back hood flows into a slim A-line cloak, so the whole figure is one bold shape. Fill it black and it should still read as a hooded traveller. Detail goes inside the shape, not on its edge. Keep the hem flare to a pixel or two; a wide bell reads as heavy.
2. **One accent.** The scarf is the only colour that isn't the cloak. Each cloak colour in `CLOAK_COLORS` comes paired with the scarf that suits it: teal for crimson, amber and rose, gold for forest, ocean and plum, and red for slate and snow. New gear should use the earthy gear palette (wood, stone, steel, fur, straw) and not add another accent.
3. **Coloured outlines.** Each material is outlined in a dark shade of itself: plum around the cloak, dark brown around gear, near-black navy for the trousers. Never use pure black, and draw no hard lines inside the figure.
4. **Three tones per material,** lit from the top left: highlight, lit and shade on the cloak, plus one darker tone for the outline.
5. **Short, solid legs, easy stride.** The legs are two pixels wide and three rows long, in dark trousers that act as their own outline. Long legs or 1px legs read as stilts. When walking, feet travel only a pixel either side of standing; a wide scissor reads as frantic.
6. **Hands only when needed.** In the cloak, the arms stay hidden and a single skin pixel appears only where a hand grips an item. In the tunic, the arms show and swing.
7. **Nothing pokes up.** The hood tip sweeps back rather than up, and the hair has no tuft. Anything rising above the head reads as an antenna at 3x.
8. **Follow-through.** The scarf tail lags the body by a frame and streams out while walking. The cloak hem kicks back on contact frames. The idle breath uses uneven timing (a long hold, then a short dip) so it reads as alive rather than mechanical.
9. **Smear frames.** Swings have three keys (wind-up, strike, follow-through). The strike draws a pale crescent along the arc, a cheap way to make tiny sprites feel punchy.

## Two looks

- **Tunic:** the Wanderer starts bare-headed, with brown hair, a belted linen tunic and the scarf.
- **Cloak:** a Hooded Cloak, bought from Farmers or Herbalists, is put on for good by clicking it in the pack (`state.cloak`). It is not a worn slot. It keeps the night chill off, and its colour is the player's colour (`state.playerColor`, picked under Game).

## How it's built

- Body parts are pixel grids, one character per pixel, with `.` for empty. Side views are authored facing right, and the pen mirrors them for facing left.
- Leg letters split the far leg (`Q Y Z`) from the near leg (`q p`, `U u`, `K k`). Boots swap the shin and foot colours through the palette.
- Held items are authored once, upright, with a grip cell. `rotateItem` turns them to `fwd`, `down` or `back` for swings, so every tool stays consistent in every pose.
- Walking is 4 frames: contact, pass, contact, pass. The body rises 1px on the pass frames, and the legs grid has a hidden top row so they never detach from the hem.

## Preview

Render a contact sheet with any 2D-context shim (see `tests/player_sprite.test.mjs` for a minimal mock) and look at it at 3x as well as zoomed in. A sprite that only looks good at 10x is not done.
