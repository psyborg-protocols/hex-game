// pixel_art_2.js — woodworking goods + stoneworking goods + oven tiers.
// Ramps: wood/clay y->o->r · stone x->s->d · metal w/c->x->s · foliage g->G->t · fire y->o->r.
// Light falls from the top-left. Tools must show their working parts: blade, haft, lashing.
import { draw } from './pcanvas.js';

export const PART2 = {
  basket: (p) => {
    // woven basket with an arched carry handle
    p.rect(7, 1, 2, 1, 'o'); p.px(6, 2, 'o'); p.px(9, 2, 'o');
    p.px(5, 3, 'o'); p.px(10, 3, 'o'); p.px(5, 4, 'o'); p.px(10, 4, 'o');
    p.rect(1, 5, 14, 2, 'y');                            // rim
    p.rect(1, 6, 14, 1, 'o');
    p.rect(2, 7, 12, 4, 'o');
    p.rect(3, 11, 10, 2, 'o');
    p.rect(5, 13, 6, 1, 'o');
    // weave: uprights crossed by one band
    for (const x of [3, 6, 9, 12]) p.vline(x, 7, 6, 'r');
    p.rect(2, 9, 12, 1, 'r');
    p.px(2, 7, 'y'); p.px(3, 7, 'y'); p.px(1, 5, 'w');
    p.rect(11, 11, 2, 2, 'r'); p.rect(5, 13, 6, 1, 'r');
  },
  chair: (p) => {
    // side view: slatted back, overhanging seat, legs at both ends
    p.rect(2, 1, 2, 9, 'o');                             // back post
    p.rect(4, 2, 7, 2, 'o');                             // top slat
    p.rect(4, 6, 7, 1, 'o');                             // lower slat
    p.rect(1, 9, 13, 2, 'y');                            // seat
    p.rect(1, 10, 13, 1, 'o'); p.rect(1, 11, 13, 1, 'r');
    p.rect(2, 12, 2, 3, 'o'); p.rect(11, 12, 2, 3, 'o'); // legs
    p.px(2, 1, 'y'); p.px(4, 2, 'y'); p.px(1, 9, 'w');
    p.vline(3, 2, 8, 'r'); p.rect(4, 3, 7, 1, 'r');
    p.vline(3, 12, 3, 'r'); p.vline(12, 12, 3, 'r');
  },
  table: (p) => {
    // trestle table seen slightly from above
    p.rect(1, 4, 14, 2, 'y');                            // top
    p.rect(1, 6, 14, 1, 'o');
    p.rect(2, 7, 12, 1, 'r');                            // apron
    p.rect(2, 8, 2, 6, 'o'); p.rect(12, 8, 2, 6, 'o');   // front legs
    p.vline(5, 8, 4, 'r'); p.vline(10, 8, 4, 'r');       // back legs
    p.rect(1, 4, 9, 1, 'w');
    p.vline(3, 8, 6, 'r'); p.vline(13, 8, 6, 'r');
  },
  chest: (p) => {
    // domed lid, iron bands and a hasp lock across the seam
    p.rect(4, 2, 8, 1, 'o');
    p.rect(2, 3, 12, 3, 'o');                            // lid
    p.rect(2, 6, 12, 1, 'd');                            // seam
    p.rect(2, 7, 12, 6, 'o');                            // body
    p.rect(3, 13, 10, 1, 'o');
    p.rect(4, 2, 6, 1, 'y'); p.rect(2, 3, 7, 1, 'y'); p.rect(2, 7, 8, 1, 'y');
    p.rect(11, 4, 3, 2, 'r'); p.rect(11, 8, 3, 5, 'r'); p.rect(3, 13, 10, 1, 'r');
    p.px(5, 9, 'r'); p.px(6, 11, 'r');
    p.vline(4, 2, 12, 'x'); p.vline(12, 3, 11, 'x');     // iron bands
    p.px(4, 3, 'w'); p.vline(12, 8, 6, 's');
    p.rect(7, 5, 3, 4, 'x');                             // lock plate
    p.px(7, 5, 'w'); p.rect(7, 8, 3, 1, 's'); p.px(8, 7, 'd');
  },
  cabin: (p) => {
    // log cabin: shingled roof over stacked logs, door and window
    p.rect(7, 1, 2, 1, 'r');
    p.rect(5, 2, 6, 1, 'r');
    p.rect(3, 3, 10, 1, 'r');
    p.rect(1, 4, 14, 2, 'r');
    p.rect(5, 2, 3, 1, 'o'); p.rect(3, 3, 5, 1, 'o'); p.rect(1, 4, 7, 1, 'o');
    p.rect(2, 6, 12, 8, 'o');                            // log wall
    p.rect(2, 8, 12, 1, 'r'); p.rect(2, 10, 12, 1, 'r'); p.rect(2, 12, 12, 1, 'r');
    p.rect(11, 6, 3, 8, 'r');                            // shaded gable end
    p.rect(6, 9, 4, 5, 'd');                             // door
    p.px(9, 11, 'y');
    p.rect(3, 6, 2, 2, 'B'); p.px(3, 6, 'c');            // window
  },
  stone_house: (p) => {
    // dressed-stone walls under a dark roof
    p.rect(7, 1, 2, 1, 'd');
    p.rect(5, 2, 6, 1, 'd');
    p.rect(3, 3, 10, 1, 'd');
    p.rect(1, 4, 14, 2, 'd');
    p.rect(5, 2, 3, 1, 's'); p.rect(3, 3, 5, 1, 's'); p.rect(1, 4, 7, 1, 's');
    p.rect(2, 6, 12, 8, 'x');                            // wall
    p.rect(2, 8, 12, 1, 's'); p.rect(2, 11, 12, 1, 's'); // courses
    p.vline(5, 6, 2, 's'); p.vline(10, 6, 2, 's');
    p.vline(3, 9, 2, 's'); p.vline(8, 9, 2, 's'); p.vline(12, 9, 2, 's');
    p.vline(6, 12, 2, 's'); p.vline(11, 12, 2, 's');
    p.rect(11, 6, 3, 8, 's');
    p.rect(6, 9, 4, 5, 'd');                             // door
    p.px(9, 11, 'y');
    p.rect(3, 6, 2, 2, 'B'); p.px(3, 6, 'c');
  },
  wood_fence: (p) => {
    // three pointed posts carrying two rails
    for (const x of [2, 7, 12]) {
      p.px(x, 2, 'o');
      p.rect(x - 1, 3, 3, 11, 'o');
      p.vline(x - 1, 3, 11, 'y'); p.vline(x + 1, 3, 11, 'r');
    }
    p.rect(1, 5, 14, 2, 'o'); p.rect(1, 5, 14, 1, 'y'); p.rect(1, 6, 14, 1, 'r');
    p.rect(1, 9, 14, 2, 'o'); p.rect(1, 9, 14, 1, 'y'); p.rect(1, 10, 14, 1, 'r');
    for (const x of [2, 7, 12]) { p.px(x, 5, 'o'); p.px(x, 9, 'o'); }
  },
  ladder: (p) => {
    // two rails and four rungs, rails lit on the left
    p.rect(2, 1, 2, 14, 'o'); p.rect(11, 1, 2, 14, 'o');
    p.vline(2, 1, 14, 'y'); p.vline(3, 1, 14, 'r');
    p.vline(11, 1, 14, 'y'); p.vline(12, 1, 14, 'r');
    for (const y of [3, 6, 9, 12]) {
      p.rect(4, y, 7, 2, 'o');
      p.rect(4, y, 7, 1, 'y'); p.rect(4, y + 1, 7, 1, 'r');
    }
  },
  bridge: (p) => {
    // planked deck with a handrail and two stone piers over water
    p.rect(1, 3, 14, 1, 'o'); p.rect(1, 3, 8, 1, 'y');   // handrail
    p.vline(2, 4, 3, 'o'); p.vline(7, 4, 3, 'o'); p.vline(13, 4, 3, 'o');
    p.rect(1, 7, 14, 1, 'y');                            // deck
    p.rect(1, 8, 14, 2, 'o');
    p.rect(1, 9, 14, 1, 'r');
    for (const x of [3, 6, 9, 12]) p.vline(x, 8, 2, 'r');
    p.rect(2, 10, 2, 3, 'x'); p.rect(11, 10, 2, 3, 'x'); // piers
    p.vline(3, 10, 3, 's'); p.vline(12, 10, 3, 's');
    p.rect(5, 12, 4, 1, 'B'); p.rect(1, 13, 5, 1, 'B'); p.rect(9, 13, 6, 1, 'B');
  },
  boat: (p) => {
    // dugout canoe with a thwart, sitting in the water
    p.px(1, 6, 'o'); p.px(14, 6, 'o');
    p.rect(1, 7, 14, 1, 'y');                            // gunwale
    p.rect(2, 8, 12, 1, 'd');                            // hollow
    p.rect(7, 8, 2, 1, 'o');                             // thwart
    p.rect(2, 9, 12, 2, 'o');
    p.rect(4, 11, 8, 1, 'o');
    p.rect(3, 10, 10, 1, 'r'); p.rect(4, 11, 8, 1, 'r');
    p.px(2, 9, 'y'); p.px(3, 9, 'y');
    p.rect(1, 12, 4, 1, 'B'); p.rect(6, 13, 4, 1, 'B'); p.rect(11, 12, 4, 1, 'B');
  },
  cart: (p) => {
    // side view: planked box over an iron-tyred wheel, shaft forward
    p.rect(1, 1, 12, 1, 'y');
    p.rect(1, 2, 12, 3, 'o');
    p.rect(1, 4, 12, 1, 'r');
    p.vline(4, 2, 3, 'r'); p.vline(9, 2, 3, 'r');
    p.diag(13, 2, 14, 3, 'o'); p.px(13, 1, 'o');         // shaft
    p.rect(6, 5, 2, 2, 'r');                             // axle block
    p.circle(7, 10, 4, 'x');                             // iron tyre
    p.circle(7, 10, 3, 'o');
    p.vline(7, 7, 7, 'r'); p.hline(4, 10, 7, 'r');
    p.diag(5, 8, 9, 12, 'r'); p.diag(9, 8, 5, 12, 'r');
    p.px(7, 10, 'y');
    p.px(4, 8, 'w'); p.px(5, 7, 'w'); p.px(10, 12, 's'); p.px(9, 13, 's');
  },
  fishing_rod: (p) => {
    // rod, line and a baited hook
    p.diag(1, 14, 11, 3, 'o');
    p.diag(1, 13, 10, 3, 'y');
    p.rect(1, 12, 2, 3, 'r');                            // grip
    p.vline(12, 4, 6, 'x');                              // line
    p.px(12, 10, 'x'); p.px(13, 11, 'x'); p.px(13, 12, 'x'); p.px(12, 13, 'x'); // hook
    p.px(11, 12, 'x');
    p.px(11, 3, 'y');
  },
  bow: (p) => {
    // recurve bow: two-pixel limbs, wrapped grip, taut string
    const limb = [[7, 1], [5, 2], [4, 3], [3, 4], [3, 5], [2, 6], [2, 7]];
    for (const [x, y] of limb) { p.rect(x, y, 2, 1, 'o'); p.px(x, y, 'y'); }
    for (const [x, y] of limb) { p.rect(x, 15 - y, 2, 1, 'o'); p.px(x, 15 - y, 'y'); }
    p.px(9, 1, 'o'); p.px(9, 14, 'o');
    p.rect(2, 6, 2, 4, 'r');                             // grip wrap
    p.px(2, 7, 'y'); p.px(2, 9, 'y');
    p.vline(9, 2, 12, 'w');                              // string
  },
  arrow: (p) => {
    // knapped point, bound shaft, swept fletching
    p.px(8, 1, 'x');
    p.rect(7, 2, 3, 1, 'x');
    p.rect(7, 3, 3, 2, 'x');
    p.px(6, 4, 'x'); p.px(10, 4, 'x');                   // barbs
    p.px(7, 2, 'w'); p.px(7, 3, 'w');
    p.px(9, 4, 's'); p.px(10, 4, 's');
    p.vline(8, 5, 10, 'o');                              // shaft
    p.rect(7, 5, 3, 1, 'y');                             // binding
    p.px(7, 9, 'w'); p.px(7, 10, 'w'); p.px(6, 11, 'w'); p.px(7, 11, 'w'); p.px(6, 12, 'w');
    p.px(9, 10, 'x'); p.px(9, 11, 'x'); p.px(10, 12, 'x'); p.px(9, 12, 'x'); p.px(10, 13, 'x');
    p.px(8, 14, 'y');                                    // nock
  },
  fine_arrow: (p) => {
    // barbed metal head, bound shaft, trimmed fletching
    p.px(8, 1, 'c');
    p.rect(7, 2, 3, 1, 'x');
    p.rect(7, 3, 3, 2, 'x');
    p.px(6, 4, 'x'); p.px(10, 4, 'x');
    p.px(7, 2, 'c'); p.px(7, 3, 'w');
    p.px(9, 4, 's'); p.px(10, 4, 's');
    p.vline(8, 5, 10, 'o');
    p.rect(7, 5, 3, 1, 'y'); p.px(8, 8, 'y');
    p.px(7, 9, 'w'); p.px(7, 10, 'w'); p.px(6, 11, 'c'); p.px(7, 11, 'w'); p.px(6, 12, 'w');
    p.px(9, 10, 'w'); p.px(9, 11, 'w'); p.px(10, 12, 'c'); p.px(9, 12, 'w'); p.px(10, 13, 'w');
    p.px(8, 14, 'y');
  },
  stone_hammer: (p) => {
    // rough stone head lashed to a wooden haft
    p.rect(4, 1, 8, 1, 'x');
    p.rect(3, 2, 10, 4, 'x');
    p.rect(4, 6, 8, 1, 'x');
    p.rect(4, 1, 6, 1, 'w'); p.px(3, 2, 'w');
    p.rect(10, 3, 3, 3, 's'); p.rect(5, 6, 7, 1, 's');
    p.px(7, 3, 'd'); p.px(8, 4, 'd');                    // pit
    p.rect(7, 6, 2, 8, 'o');                             // haft
    p.vline(7, 7, 7, 'y'); p.vline(8, 7, 7, 'r');
    p.rect(6, 6, 4, 2, 'y'); p.px(6, 7, 'r'); p.px(9, 7, 'r'); // lashing
  },
  stone_axe: (p) => {
    // wedge of stone lashed to a haft, ground edge to the left
    p.rect(7, 1, 4, 1, 'x');
    p.rect(5, 2, 6, 1, 'x');
    p.rect(4, 3, 7, 1, 'x');
    p.rect(3, 4, 8, 2, 'x');
    p.rect(4, 6, 7, 1, 'x');
    p.rect(5, 7, 6, 1, 'x');
    p.rect(7, 8, 4, 1, 'x');
    p.vline(3, 4, 2, 'w'); p.px(4, 3, 'w'); p.px(5, 2, 'w'); p.px(4, 6, 'w');
    p.rect(8, 3, 3, 5, 's'); p.px(7, 8, 's');
    p.px(6, 4, 'd'); p.px(7, 5, 'd'); p.px(6, 6, 'd');
    p.rect(9, 8, 2, 7, 'o');                             // haft
    p.vline(9, 9, 6, 'y'); p.vline(10, 9, 6, 'r');
    p.rect(8, 7, 4, 2, 'y'); p.px(8, 8, 'r'); p.px(11, 8, 'r'); // lashing
  },
  stone_chisel: (p) => {
    // stone bit bound to a short grip, flat cutting face at the foot
    p.rect(6, 1, 4, 5, 'o');                             // grip
    p.vline(6, 1, 5, 'y'); p.vline(9, 1, 5, 'r');
    p.rect(5, 6, 6, 2, 'y'); p.rect(5, 7, 6, 1, 'r');    // binding
    p.rect(6, 8, 4, 5, 'x');                             // bit
    p.vline(6, 8, 5, 'w'); p.vline(9, 8, 5, 's');
    p.rect(6, 13, 4, 1, 'w');                            // cutting face
  },
  stone_adze: (p) => {
    // short haft with a broad stone blade lashed across its foot
    p.rect(11, 1, 2, 2, 'o');
    p.diag(12, 2, 9, 6, 'o'); p.diag(11, 2, 8, 6, 'o');
    p.diag(11, 1, 8, 5, 'y');
    p.rect(8, 6, 2, 2, 'o');
    p.rect(2, 7, 8, 2, 'x');                             // blade
    p.rect(1, 9, 8, 2, 'x');
    p.rect(2, 11, 6, 1, 'x');
    p.vline(1, 9, 2, 'w'); p.rect(2, 7, 4, 1, 'w'); p.px(2, 8, 'w');
    p.rect(5, 10, 5, 1, 's'); p.rect(3, 11, 5, 1, 's');
    p.px(6, 8, 'd'); p.px(4, 9, 'd');
    p.rect(7, 6, 4, 2, 'y'); p.px(7, 7, 'r'); p.px(10, 7, 'r'); // lashing
  },
  quern: (p) => {
    // saddle quern: a hand stone worked over a bed stone, grain around it
    p.ellipse(7, 6, 4, 2, 'x');
    p.rect(4, 4, 5, 1, 'w'); p.px(3, 5, 'w');
    p.rect(8, 7, 4, 1, 's'); p.px(11, 6, 's');
    p.rect(1, 9, 14, 2, 'x');
    p.rect(2, 11, 12, 2, 's');
    p.rect(1, 9, 8, 1, 'w');
    p.rect(3, 12, 10, 1, 'd');
    p.px(2, 8, 'y'); p.px(13, 8, 'y'); p.px(12, 8, 'y'); p.px(3, 8, 'y'); // spilled grain
  },
  grindstone: (p) => {
    // grinding wheel turning in a frame, with a crank
    p.rect(2, 6, 2, 7, 'o'); p.rect(11, 6, 2, 7, 'o');   // uprights
    p.rect(1, 13, 14, 2, 'o'); p.rect(1, 14, 14, 1, 'r');
    p.circle(7, 7, 4, 'x');
    p.px(4, 5, 'w'); p.px(5, 4, 'w'); p.px(6, 4, 'w'); p.px(4, 6, 'w');
    p.px(10, 9, 's'); p.px(9, 10, 's'); p.px(8, 10, 's'); p.px(10, 8, 's');
    p.circle(7, 7, 1, 'd');
    p.vline(7, 4, 2, 's'); p.vline(7, 9, 2, 's'); p.hline(4, 7, 2, 's'); p.hline(9, 7, 2, 's');
    p.px(12, 7, 'o'); p.px(13, 7, 'o'); p.px(13, 8, 'o'); p.px(13, 9, 'r'); // crank
    p.vline(3, 7, 6, 'r'); p.vline(12, 7, 6, 'r');
  },
  whetstone: (p) => {
    // flat honing stone with a bevelled face
    p.rect(2, 6, 12, 1, 'x');
    p.rect(1, 7, 14, 3, 'x');
    p.rect(2, 10, 12, 1, 'x');
    p.rect(2, 6, 10, 1, 'w'); p.px(1, 7, 'w');
    p.rect(3, 9, 11, 1, 's'); p.rect(4, 10, 10, 1, 's'); p.px(14, 8, 's');
    p.px(5, 8, 'd'); p.px(9, 7, 'd'); p.px(11, 8, 'd');  // grit
  },
  stone_anvil: (p) => {
    // block anvil roughed from one stone: horn, face, waisted base
    p.px(1, 5, 'x'); p.rect(2, 4, 11, 3, 'x');
    p.rect(2, 4, 9, 1, 'w');
    p.rect(9, 5, 4, 2, 's');
    p.rect(5, 7, 6, 2, 's');
    p.rect(3, 9, 10, 4, 'x');
    p.rect(3, 9, 7, 1, 'x'); p.rect(4, 12, 9, 1, 's');
    p.px(6, 10, 'd'); p.px(10, 11, 'd');
  },
  rock_wall: (p) => {
    // dry-stone wall: irregular stones, deep gaps, no courses
    p.rect(1, 4, 14, 9, 'x');
    p.rect(1, 4, 8, 1, 'w'); p.px(1, 5, 'w'); p.px(2, 5, 'w');
    // gaps between stones
    for (const [x, y, w] of [[4, 4, 1], [9, 4, 1], [12, 4, 1], [1, 6, 3], [6, 6, 4], [12, 6, 3],
      [3, 8, 1], [8, 8, 1], [11, 8, 1], [1, 10, 4], [7, 10, 3], [12, 10, 3], [5, 12, 1], [10, 12, 1]])
      p.rect(x, y, w, 1, 'd');
    p.px(2, 7, 's'); p.px(9, 7, 's'); p.px(5, 9, 's'); p.px(13, 9, 's');
    p.rect(1, 11, 14, 1, 's'); p.rect(1, 12, 14, 1, 'd');
    p.px(3, 3, 'x'); p.px(4, 3, 'x'); p.px(8, 3, 'x'); p.px(11, 3, 'x'); p.px(12, 3, 'x');
  },
  stone_wall: (p) => {
    // coursed ashlar: dressed blocks in staggered courses
    p.rect(1, 3, 14, 10, 'x');
    p.rect(1, 3, 10, 1, 'w');
    p.rect(1, 6, 14, 1, 'd'); p.rect(1, 9, 14, 1, 'd');  // bed joints
    for (const [x, y] of [[5, 3], [10, 3], [3, 7], [8, 7], [12, 7], [5, 10], [10, 10]])
      p.vline(x, y, 3, 'd');
    p.rect(2, 5, 3, 1, 's'); p.rect(11, 4, 3, 1, 's');
    p.rect(9, 8, 3, 1, 's'); p.rect(2, 11, 3, 1, 's'); p.rect(11, 11, 3, 1, 's');
    p.rect(1, 12, 14, 1, 'd');
  },
  forge: (p) => {
    // stone forge with a glowing fire bed under a hood and chimney
    p.rect(9, 1, 5, 2, 's'); p.rect(10, 3, 3, 3, 's');
    p.rect(9, 1, 4, 1, 'x');
    p.rect(1, 6, 14, 2, 'x');
    p.rect(1, 6, 10, 1, 'w');
    p.rect(2, 8, 12, 6, 's');
    p.rect(2, 13, 12, 1, 'd');
    p.rect(4, 9, 8, 4, 'd');                             // fire chamber
    p.rect(4, 12, 8, 1, 'r'); p.rect(5, 11, 6, 1, 'o');
    p.rect(6, 10, 4, 1, 'o'); p.rect(7, 10, 2, 1, 'y'); p.px(8, 9, 'y');
    p.px(2, 9, 'x'); p.px(13, 10, 'd');
  },
  quarry: (p) => {
    // stepped cut into a rock face, fresh rubble at the foot
    p.rect(1, 1, 14, 3, 'x');
    p.rect(1, 1, 11, 1, 'w');
    p.rect(1, 4, 14, 1, 'd');                            // riser
    p.rect(1, 5, 11, 3, 's');
    p.rect(1, 5, 8, 1, 'x');
    p.rect(1, 8, 11, 1, 'd');
    p.rect(1, 9, 7, 2, 'd');
    p.rect(1, 9, 5, 1, 's');
    p.px(4, 2, 'd'); p.px(9, 2, 'd'); p.px(12, 3, 'd');  // pick marks
    p.px(3, 6, 'd'); p.px(7, 7, 'd');
    p.rect(8, 11, 3, 2, 'x'); p.px(8, 11, 'w'); p.px(10, 12, 's');
    p.rect(11, 12, 4, 2, 'x'); p.px(11, 12, 'w'); p.px(14, 13, 's');
    p.rect(2, 12, 4, 2, 'x'); p.px(2, 12, 'w'); p.px(5, 13, 's');
    p.rect(6, 13, 2, 1, 'x');
  },
  hearth: (p) => {
    // ring of stones with a fire burning in the middle
    p.px(8, 2, 'y');
    p.rect(7, 3, 3, 1, 'y');
    p.rect(6, 4, 5, 2, 'o'); p.rect(7, 4, 3, 1, 'y');
    p.rect(5, 6, 7, 2, 'o'); p.rect(7, 6, 3, 1, 'y');
    p.rect(5, 8, 7, 1, 'r'); p.px(7, 8, 'o'); p.px(9, 8, 'o');
    p.px(6, 3, 'o'); p.px(10, 4, 'o');
    const st = (x, y, w) => { p.rect(x, y, w, 3, 'x'); p.rect(x, y, w - 1, 1, 'w'); p.rect(x + 1, y + 2, w - 1, 1, 's'); };
    st(1, 9, 4); st(6, 10, 4); st(11, 9, 4);
    p.rect(4, 11, 2, 2, 'x'); p.rect(10, 11, 2, 2, 'x');
    p.px(4, 11, 'w'); p.px(10, 11, 'w'); p.px(5, 12, 's'); p.px(11, 12, 's');
  },
  stone_oven: (p) => {
    // rough stone dome with an arched mouth and a fire inside
    p.rect(6, 2, 4, 1, 'x');
    p.rect(4, 3, 8, 1, 'x');
    p.rect(3, 4, 10, 1, 'x');
    p.rect(2, 5, 12, 8, 'x');
    p.rect(1, 13, 14, 1, 's');
    p.rect(4, 3, 5, 1, 'w'); p.rect(3, 4, 4, 1, 'w'); p.px(2, 5, 'w');
    p.rect(11, 6, 3, 7, 's'); p.rect(3, 12, 11, 1, 's');
    p.vline(5, 5, 3, 's'); p.vline(9, 8, 3, 's'); p.rect(3, 7, 3, 1, 's');
    p.rect(6, 8, 4, 5, 'd');                             // mouth
    p.rect(6, 11, 4, 1, 'r'); p.rect(7, 10, 2, 1, 'o'); p.px(7, 9, 'y');
  },
  clay_oven: (p) => {
    // smooth clay dome, small flue, wider mouth
    p.rect(7, 1, 2, 2, 's');
    p.rect(6, 3, 4, 1, 'o');
    p.rect(4, 4, 8, 1, 'o');
    p.rect(3, 5, 10, 1, 'o');
    p.rect(2, 6, 12, 7, 'o');
    p.rect(1, 13, 14, 1, 'r');
    p.rect(6, 3, 3, 1, 'y'); p.rect(4, 4, 5, 1, 'y'); p.rect(3, 5, 4, 1, 'y'); p.px(2, 6, 'y');
    p.rect(11, 7, 3, 6, 'r'); p.rect(3, 12, 11, 1, 'r');
    p.rect(5, 8, 6, 5, 'd');                             // mouth
    p.rect(5, 11, 6, 1, 'r'); p.rect(6, 10, 4, 1, 'o'); p.rect(7, 9, 2, 1, 'y');
  },
  kiln: (p) => {
    // tall banded kiln with a stack rising from the dome
    p.px(12, 1, 'x'); p.px(13, 2, 'x');                  // smoke
    p.rect(8, 1, 4, 1, 's'); p.rect(9, 2, 3, 3, 's');
    p.rect(8, 1, 3, 1, 'x'); p.vline(9, 2, 3, 'x');
    p.rect(5, 4, 6, 1, 'o');
    p.rect(3, 5, 10, 1, 'o');
    p.rect(2, 6, 12, 7, 'o');
    p.rect(1, 13, 14, 1, 'r');
    p.rect(5, 4, 4, 1, 'y'); p.rect(3, 5, 5, 1, 'y'); p.px(2, 6, 'y'); p.px(2, 7, 'y');
    p.rect(2, 8, 12, 1, 's'); p.rect(2, 11, 12, 1, 's'); // iron bands
    p.rect(11, 9, 3, 4, 'r'); p.rect(3, 12, 11, 1, 'r'); p.px(12, 6, 'r'); p.px(13, 7, 'r');
    p.rect(6, 9, 4, 4, 'd');                             // stoke hole
    p.rect(6, 12, 4, 1, 'r'); p.rect(7, 11, 2, 1, 'o'); p.px(7, 10, 'y');
  },
  bakehouse: (p) => {
    // a building for baking: roof, chimney with smoke, oven mouth, window
    p.px(2, 1, 'x'); p.px(3, 2, 'x');
    p.rect(1, 3, 3, 3, 's'); p.rect(1, 3, 2, 1, 'x');
    p.rect(8, 1, 2, 1, 'r');
    p.rect(6, 2, 6, 1, 'r');
    p.rect(4, 3, 10, 1, 'r');
    p.rect(2, 4, 13, 2, 'r');
    p.rect(6, 2, 3, 1, 'o'); p.rect(4, 3, 5, 1, 'o'); p.rect(2, 4, 7, 1, 'o');
    p.rect(3, 6, 11, 8, 'y');
    p.rect(3, 6, 11, 1, 'w');
    p.rect(11, 7, 3, 7, 'o'); p.rect(4, 13, 10, 1, 'o');
    p.rect(5, 9, 5, 5, 'd');                             // oven mouth
    p.rect(5, 12, 5, 1, 'r'); p.rect(6, 11, 3, 1, 'o'); p.px(7, 10, 'y');
    p.rect(11, 8, 2, 2, 'B'); p.px(11, 8, 'c');          // window
  },
  pot: (p) => {
    // round clay pot: constricted neck, rolled rim, two lugs
    p.rect(5, 2, 6, 1, 'y');
    p.rect(6, 2, 4, 1, 'd');                             // mouth
    p.rect(5, 3, 6, 1, 'o');
    p.rect(4, 4, 8, 1, 'o');
    p.rect(3, 5, 10, 1, 'o');
    p.rect(2, 6, 12, 4, 'o');
    p.rect(3, 10, 10, 2, 'o');
    p.rect(5, 12, 6, 1, 'o');
    p.px(1, 6, 'o'); p.px(1, 7, 'o'); p.px(14, 6, 'o'); p.px(14, 7, 'o'); // lugs
    p.px(5, 3, 'y'); p.px(4, 4, 'y'); p.px(3, 5, 'y'); p.vline(2, 6, 4, 'y'); p.px(3, 6, 'y');
    p.rect(11, 7, 3, 3, 'r'); p.rect(10, 10, 3, 2, 'r'); p.rect(5, 12, 6, 1, 'r');
    p.px(12, 6, 'r');
  },
  fine_pot: (p) => {
    // the same form, burnished and painted with slip bands
    p.rect(5, 2, 6, 1, 'y');
    p.rect(6, 2, 4, 1, 'd');
    p.rect(5, 3, 6, 1, 'o');
    p.rect(4, 4, 8, 1, 'o');
    p.rect(3, 5, 10, 1, 'o');
    p.rect(2, 6, 12, 4, 'o');
    p.rect(3, 10, 10, 2, 'o');
    p.rect(5, 12, 6, 1, 'o');
    p.px(1, 6, 'o'); p.px(1, 7, 'o'); p.px(14, 6, 'o'); p.px(14, 7, 'o');
    p.rect(5, 3, 6, 1, 'r'); p.rect(2, 7, 12, 1, 'r'); p.rect(3, 10, 10, 1, 'r'); // painted bands
    p.px(4, 8, 'r'); p.px(6, 9, 'r'); p.px(8, 8, 'r'); p.px(10, 9, 'r');
    p.px(3, 5, 'w'); p.px(2, 6, 'w'); p.px(4, 4, 'w');   // burnish
    p.rect(11, 8, 3, 2, 'p'); p.rect(10, 11, 3, 1, 'p'); p.px(12, 6, 'p'); p.rect(6, 12, 5, 1, 'p');
  },
  field: (p) => {
    // tilled furrows running into the distance, sprouts on the ridges
    const ridge = (x, y, w) => {
      p.rect(x, y, w, 2, 'o');
      p.rect(x, y, w, 1, 'y');
      p.rect(x, y + 1, w, 1, 'r');
    };
    ridge(4, 5, 8); ridge(2, 8, 12); ridge(1, 11, 14);
    for (const [x, y] of [[5, 4], [8, 4], [11, 4]]) { p.px(x, y, 'G'); p.px(x + 1, y - 1, 'g'); p.px(x, y - 1, 'G'); }
    for (const [x, y] of [[3, 7], [7, 7], [11, 7]]) { p.px(x, y, 'G'); p.px(x + 1, y - 1, 'g'); p.px(x, y - 1, 'G'); }
    for (const [x, y] of [[2, 10], [6, 10], [10, 10], [13, 10]]) { p.px(x, y, 'G'); p.px(x + 1, y - 1, 'g'); p.px(x, y - 1, 'G'); }
    p.rect(1, 13, 14, 1, 'r');
  },
  wood_hoe: (p) => {
    // wooden blade set square at the foot of a long handle
    p.diag(13, 1, 6, 9, 'o'); p.diag(12, 1, 5, 9, 'o');
    p.diag(12, 1, 5, 8, 'y');
    p.rect(4, 9, 3, 2, 'o');
    p.rect(1, 10, 7, 3, 'o');
    p.rect(1, 10, 6, 1, 'y');
    p.rect(2, 12, 6, 1, 'r'); p.px(7, 11, 'r');
    p.rect(4, 8, 4, 2, 'y'); p.px(4, 9, 'r'); p.px(7, 9, 'r'); // lashing
  },
  wood_plough: (p) => {
    // ard plough: stilt handle, beam, and a wedge-shaped wooden share
    p.rect(11, 1, 3, 1, 'y'); p.rect(11, 2, 2, 3, 'o');
    p.diag(12, 4, 7, 9, 'o'); p.diag(11, 4, 6, 9, 'o');
    p.diag(11, 3, 6, 8, 'y');
    p.rect(5, 9, 3, 1, 'o');
    p.rect(3, 10, 5, 1, 'o');
    p.rect(2, 11, 6, 1, 'o');
    p.rect(1, 12, 7, 1, 'o');
    p.rect(2, 13, 5, 1, 'o');
    p.px(5, 9, 'y'); p.rect(3, 10, 3, 1, 'y'); p.rect(2, 11, 3, 1, 'y'); p.px(1, 12, 'y');
    p.rect(4, 13, 3, 1, 'r'); p.px(7, 12, 'r'); p.px(7, 11, 'r'); p.px(6, 10, 'r');
    p.diag(8, 6, 12, 8, 'o'); p.px(12, 9, 'o');          // brace
  },
};
