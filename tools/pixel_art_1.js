// pixel_art_1.js — gathered resources + food, drawn on a 16x16 canvas.
// Palette (SWEETIE-16): k ink, p purple, r red, o orange, y yellow, g light green,
// G green, t teal, b blue, B sky, c cyan, w white, x grey, s slate, d dark, n navy.
//
// Material ramps (light -> mid -> dark). Light always falls from the TOP-LEFT.
//   wood/clay  y -> o -> r        stone   x -> s -> d      metal  w/c -> x -> s
//   flesh      o -> r -> p        foliage g -> G -> t      bone   w -> x -> s
//   water      c -> B -> b        fire    y -> o -> r
import { draw } from './pcanvas.js';

export const PART1 = {
  berries: (p) => {
    // three berries hanging off a leafy twig, each lobe shaded apart
    p.vline(8, 2, 5, 'G');
    p.px(7, 7, 'G'); p.px(9, 7, 'G');
    // leaves, pointed and angled away from the stem
    p.px(6, 1, 'g'); p.rect(4, 2, 4, 1, 'g'); p.rect(3, 3, 5, 1, 'G'); p.rect(4, 4, 3, 1, 't');
    p.px(11, 2, 'g'); p.rect(9, 3, 4, 1, 'g'); p.rect(9, 4, 5, 1, 'G'); p.rect(10, 5, 3, 1, 't');
    const berry = (cx, cy) => {
      p.circle(cx, cy, 2, 'r');
      p.px(cx, cy - 2, 'o'); p.px(cx - 1, cy - 1, 'o'); p.px(cx - 2, cy, 'o');
      p.px(cx - 1, cy - 2, 'y');
      p.px(cx + 2, cy, 'p'); p.px(cx + 2, cy + 1, 'p'); p.px(cx + 1, cy + 1, 'p');
      p.px(cx + 1, cy + 2, 'p'); p.px(cx, cy + 2, 'p');
    };
    berry(4, 9); berry(11, 9); berry(8, 12);
  },
  seeds: (p) => {
    // a scatter of plump oval seeds
    const seed = (x, y) => {
      p.rect(x + 1, y, 2, 1, 'y');
      p.rect(x, y + 1, 4, 1, 'y');
      p.rect(x + 1, y + 2, 2, 1, 'o');
      p.px(x, y + 1, 'w'); p.px(x + 3, y + 1, 'o');
    };
    seed(1, 3); seed(7, 2); seed(10, 6);
    seed(2, 8); seed(6, 10); seed(11, 11);
  },
  grain: (p) => {
    // wheat ear: one solid head seamed into kernels, on a green stalk
    p.px(5, 1, 'y'); p.px(6, 1, 'y'); p.px(9, 1, 'y'); p.px(10, 1, 'y'); // awns
    p.rect(7, 2, 2, 1, 'y');
    p.rect(6, 3, 4, 2, 'y');
    p.rect(5, 5, 6, 3, 'y');
    p.rect(6, 8, 4, 2, 'y');
    p.rect(7, 10, 2, 1, 'y');
    // kernel seams
    p.vline(8, 3, 7, 'o');
    p.rect(6, 4, 4, 1, 'o'); p.rect(5, 6, 6, 1, 'o'); p.rect(6, 9, 4, 1, 'o');
    p.px(6, 3, 'w'); p.px(5, 5, 'w');
    p.px(10, 5, 'r'); p.px(10, 7, 'r'); p.px(9, 8, 'r'); p.px(9, 10, 'r');
    p.vline(8, 11, 4, 'G'); p.px(8, 14, 't');              // stalk
    p.px(9, 12, 'G'); p.px(10, 12, 'G'); p.px(11, 11, 'g'); // blade
  },
  rabbit: (p) => {
    // sitting rabbit in profile, facing right
    p.rect(6, 2, 2, 4, 'w'); p.rect(9, 2, 2, 4, 'w');   // ears
    p.px(7, 3, 'r'); p.px(7, 4, 'r'); p.px(10, 3, 'r'); p.px(10, 4, 'r');
    p.ellipse(9, 7, 3, 2, 'w');                          // head
    p.px(12, 8, 'w');                                    // muzzle
    p.ellipse(6, 11, 5, 3, 'w');                         // haunch + body
    p.rect(10, 11, 3, 3, 'w');                           // foreleg
    p.circle(2, 9, 1, 'w');                              // tail puff
    // shading: underside and rear
    p.rect(4, 13, 6, 1, 'x'); p.rect(11, 13, 2, 1, 'x');
    p.px(2, 11, 'x'); p.px(3, 12, 'x'); p.px(8, 9, 'x'); p.px(9, 9, 'x');
    p.px(7, 6, 'x');
    p.px(11, 6, 'd'); p.px(11, 7, 'd');                  // eye
    p.px(13, 8, 'r');                                    // nose
  },
  fish: (p) => {
    // fish in profile, nose right, forked tail left — dark back, pale belly
    p.rect(6, 4, 6, 1, 'b');
    p.rect(4, 5, 9, 1, 'b');
    p.rect(3, 6, 11, 1, 'b');
    p.rect(3, 7, 11, 1, 'B');
    p.rect(3, 8, 11, 1, 'B');
    p.rect(4, 9, 9, 1, 'c');
    p.rect(6, 10, 6, 1, 'c');
    p.rect(7, 3, 4, 1, 'b');                             // dorsal fin
    p.rect(6, 11, 3, 1, 'B');                            // pelvic fin
    p.rect(1, 3, 2, 4, 'b'); p.rect(2, 7, 2, 2, 'b'); p.rect(1, 9, 2, 3, 'b'); // tail fork
    p.diag(10, 5, 9, 9, 'B');                            // gill line
    p.px(12, 6, 'w'); p.px(12, 7, 'w'); p.px(13, 7, 'd');
    p.px(7, 5, 'B'); p.px(8, 5, 'B');                    // back sheen
  },
  herb: (p) => {
    // leafy sprig — paired leaves stepping up a curved stem
    p.vline(8, 8, 6, 'G'); p.diag(8, 8, 7, 4, 'G');
    const leafL = (x, y) => { p.rect(x, y, 3, 1, 'G'); p.px(x + 1, y - 1, 'g'); p.px(x + 2, y - 1, 'g'); p.px(x, y + 1, 't'); };
    const leafR = (x, y) => { p.rect(x, y, 3, 1, 'G'); p.px(x, y - 1, 'g'); p.px(x + 1, y - 1, 'g'); p.px(x + 2, y + 1, 't'); };
    leafL(4, 12); leafR(9, 11);
    leafL(4, 8); leafR(9, 7);
    leafL(5, 5);
    p.px(7, 3, 'g'); p.px(8, 3, 'g'); p.px(8, 2, 'g');   // new tip
  },
  branch: (p) => {
    // forked branch with a side twig and a knot
    p.diag(2, 13, 12, 3, 'o'); p.diag(2, 12, 11, 3, 'o');
    p.diag(3, 13, 12, 4, 'r');                            // underside shadow
    p.diag(2, 12, 11, 2, 'y');                            // lit top edge
    p.diag(9, 6, 13, 5, 'o'); p.px(13, 4, 'o');           // fork
    p.diag(6, 9, 3, 7, 'o');                              // twig
    p.px(6, 8, 'r'); p.px(9, 6, 'r');                     // knots
  },
  reed: (p) => {
    // two cattails: long seed heads on green stems, one leaf blade
    const cattail = (x, y) => {
      p.px(x + 1, y - 2, 'y'); p.px(x + 1, y - 1, 'y');       // spike
      p.rect(x, y, 3, 1, 'o');
      p.rect(x, y + 1, 3, 5, 'o');
      p.rect(x, y + 6, 3, 1, 'o');
      p.vline(x, y + 1, 5, 'y');
      p.vline(x + 2, y + 1, 5, 'r'); p.px(x + 1, y + 6, 'r');
    };
    cattail(3, 3); cattail(9, 5);
    p.vline(4, 10, 5, 'G'); p.px(4, 14, 't');
    p.vline(10, 12, 3, 'G');
    p.diag(11, 13, 14, 8, 'G'); p.px(14, 7, 'g'); p.px(13, 9, 'g'); // blade
  },
  rough_log: (p) => {
    // unhewn log: ragged bark, sawn end showing rings
    p.rect(2, 5, 9, 1, 'o');
    p.rect(1, 6, 10, 5, 'o');
    p.rect(2, 11, 9, 1, 'o');
    p.rect(2, 5, 9, 1, 'y'); p.px(1, 6, 'y'); p.px(4, 6, 'y'); p.px(8, 6, 'y');
    p.rect(2, 10, 9, 1, 'r'); p.rect(3, 11, 8, 1, 'r');
    p.px(3, 8, 'r'); p.px(4, 8, 'r'); p.px(7, 7, 'r'); p.px(8, 9, 'r'); p.px(5, 9, 'r');
    p.ellipse(12, 8, 2, 3, 'y');                          // cut end
    p.ellipse(12, 8, 1, 2, 'o');
    p.px(12, 8, 'r');
  },
  log: (p) => {
    // clean debarked log with concentric end grain
    p.rect(2, 6, 8, 1, 'y');
    p.rect(1, 7, 9, 3, 'o');
    p.rect(2, 10, 8, 1, 'r');
    p.px(3, 8, 'y'); p.px(6, 8, 'y');
    p.ellipse(11, 8, 3, 3, 'y');
    p.ellipse(11, 8, 2, 2, 'o');
    p.ellipse(11, 8, 1, 1, 'r');
    p.px(10, 6, 'w');
  },
  beam: (p) => {
    // squared timber, 3/4 view: lit top face, shaded front, notched end
    p.rect(3, 4, 11, 2, 'y');                             // top face
    p.rect(1, 6, 11, 5, 'o');                             // front face
    p.diag(1, 6, 3, 4, 'y');                              // mitre
    p.rect(1, 10, 11, 1, 'r');
    p.rect(12, 6, 2, 4, 'r');                             // right end in shadow
    p.rect(1, 8, 8, 1, 'r'); p.rect(2, 7, 6, 1, 'y');     // grain
    p.rect(1, 6, 3, 1, 'y');
  },
  plank: (p) => {
    // thin sawn board with long grain and end cut
    p.rect(1, 7, 14, 1, 'y');
    p.rect(1, 8, 14, 2, 'o');
    p.rect(1, 10, 14, 1, 'r');
    p.rect(3, 9, 5, 1, 'r'); p.rect(9, 8, 4, 1, 'y'); p.px(4, 8, 'y');
    p.vline(12, 7, 4, 'r'); p.vline(13, 7, 4, 'y');       // end cut
  },
  cord: (p) => {
    // coiled rope with a loose tail; twist marks around the ring
    p.ellipse(7, 8, 6, 5, 'y');
    p.ellipse(7, 8, 3, 2, null);
    p.ellipse(7, 8, 3, 2, 'o'); p.ellipse(7, 8, 2, 1, null);
    // twist marks
    for (const [x, y] of [[3, 4], [6, 3], [9, 4], [11, 6], [11, 10], [8, 12], [5, 12], [2, 10], [1, 7]])
      p.px(x, y, 'o');
    p.rect(2, 5, 2, 1, 'w'); p.px(4, 4, 'w');             // lit top-left
    p.rect(6, 12, 4, 1, 'r'); p.px(11, 11, 'r'); p.px(12, 9, 'r');
    p.diag(12, 10, 14, 13, 'y'); p.px(14, 14, 'o');       // loose end
  },
  flint: (p) => {
    // knapped flint point: central ridge with flake scars fanning off it
    p.rect(7, 1, 2, 1, 'x');
    p.rect(6, 2, 4, 1, 'x');
    p.rect(5, 3, 6, 2, 'x');
    p.rect(4, 5, 8, 4, 'x');
    p.rect(5, 9, 6, 2, 'x');
    p.rect(6, 11, 4, 1, 'x');
    p.rect(7, 12, 2, 1, 'x');
    p.vline(7, 2, 10, 'w');                                    // ridge
    // flake scars: chevrons off the ridge, dark to the right
    p.px(6, 3, 's'); p.px(5, 4, 's'); p.px(6, 4, 's');
    p.px(5, 6, 's'); p.px(4, 7, 's'); p.px(5, 7, 's');
    p.px(5, 9, 's'); p.px(6, 10, 's');
    p.px(8, 2, 'd'); p.px(8, 3, 's'); p.px(9, 4, 'd'); p.px(9, 3, 's');
    p.px(8, 5, 's'); p.px(9, 6, 'd'); p.px(10, 5, 'd'); p.px(10, 6, 's');
    p.px(8, 8, 's'); p.px(9, 9, 'd'); p.px(10, 8, 'd');
    p.px(8, 11, 'd'); p.px(8, 12, 'd');
  },
  stone: (p) => {
    // faceted boulder, lit from the top-left
    p.rect(5, 3, 5, 1, 'x');
    p.rect(3, 4, 8, 1, 'x');
    p.rect(2, 5, 11, 2, 'x');
    p.rect(2, 7, 12, 4, 'x');
    p.rect(3, 11, 10, 1, 'x');
    p.rect(5, 12, 7, 1, 'x');
    // shaded right facet + base
    p.rect(10, 5, 3, 2, 's'); p.rect(11, 7, 3, 4, 's');
    p.rect(8, 11, 5, 1, 's'); p.rect(5, 12, 7, 1, 's');
    p.px(9, 12, 'd'); p.px(10, 12, 'd'); p.px(13, 10, 'd');
    p.diag(10, 4, 11, 6, 'd'); p.diag(6, 8, 4, 10, 'd');  // creases
    p.rect(5, 3, 4, 1, 'w'); p.px(3, 4, 'w'); p.px(4, 4, 'w');
  },
  stone_block: (p) => {
    // dressed ashlar in 3/4 view: lit top face, chiselled front, dark right side
    p.rect(3, 3, 9, 2, 'x');                              // top face
    p.diag(1, 5, 3, 3, 'x');
    p.rect(1, 5, 10, 8, 's');                             // front face
    p.rect(11, 5, 3, 7, 'd');                             // right side
    p.rect(3, 3, 8, 1, 'w');
    p.rect(1, 5, 10, 1, 'x');
    p.px(3, 7, 'x'); p.px(4, 8, 'x'); p.px(7, 7, 'x'); p.px(8, 9, 'x'); p.px(4, 11, 'x');
    p.px(2, 12, 'd'); p.px(6, 12, 'd'); p.px(9, 12, 'd'); // chisel bites
  },
  clay: (p) => {
    // lumpy mound of wet clay, grooved where it was worked by hand
    p.rect(5, 4, 6, 1, 'o');
    p.rect(3, 5, 9, 2, 'o');
    p.rect(2, 7, 11, 3, 'o');
    p.rect(1, 10, 13, 2, 'o');
    p.rect(3, 12, 10, 1, 'o');
    p.rect(5, 4, 4, 1, 'y'); p.rect(3, 5, 4, 1, 'y'); p.rect(2, 7, 2, 1, 'y'); p.px(1, 10, 'y');
    p.rect(10, 7, 3, 3, 'r'); p.rect(10, 10, 4, 2, 'r'); p.rect(3, 12, 10, 1, 'r');
    p.px(6, 7, 'r'); p.px(7, 8, 'r'); p.px(8, 8, 'r');     // groove
    p.px(4, 10, 'r'); p.px(5, 10, 'r');
  },
  bone: (p) => {
    // femur: knuckled ends on a diagonal shaft
    const knob = (x, y) => {
      p.rect(x, y, 2, 2, 'w'); p.rect(x + 2, y + 2, 2, 2, 'w');
      p.px(x + 1, y + 2, 'w'); p.px(x + 2, y + 1, 'w');
    };
    knob(2, 10); knob(10, 2);
    for (let i = 0; i <= 5; i++) { p.px(5 + i, 10 - i, 'w'); p.px(6 + i, 10 - i, 'w'); }
    for (let i = 0; i <= 5; i++) p.px(6 + i, 10 - i, 'x');
    p.px(3, 11, 'x'); p.px(4, 12, 'x'); p.px(12, 4, 'x'); p.px(13, 4, 'x');
    p.px(2, 10, 'w'); p.px(10, 2, 'w');
  },
  hide: (p) => {
    // cured hide: an irregular piece of leather with one corner turned back
    p.rect(4, 2, 8, 1, 'o');
    p.rect(2, 3, 11, 1, 'o');
    p.rect(1, 4, 13, 3, 'o');
    p.rect(1, 7, 14, 3, 'o');
    p.rect(2, 10, 12, 2, 'o');
    p.rect(3, 12, 10, 1, 'o');
    p.rect(5, 13, 6, 1, 'o');
    p.px(14, 6, 'o'); p.px(1, 10, 'o');                    // ragged edge
    p.clear(13, 4, 1, 1); p.clear(2, 11, 1, 1);
    // turned-back corner showing the pale suede side
    p.rect(9, 2, 3, 1, 'y'); p.rect(10, 3, 3, 1, 'y'); p.rect(11, 4, 3, 1, 'y');
    p.px(9, 3, 'd'); p.px(10, 4, 'd'); p.px(11, 5, 'd'); p.px(12, 5, 'd'); p.px(13, 5, 'd');
    p.px(12, 3, 'w'); p.px(13, 4, 'w');
    // form: lit upper left, dark lower right
    p.px(2, 4, 'y'); p.px(3, 4, 'y'); p.px(1, 5, 'y'); p.px(4, 3, 'y'); p.px(5, 3, 'y');
    p.rect(9, 9, 6, 1, 'r'); p.rect(8, 11, 6, 1, 'r'); p.rect(5, 13, 6, 1, 'r');
    p.px(4, 8, 'r'); p.px(5, 8, 'r'); p.px(7, 6, 'r'); p.px(3, 11, 'r');
  },
  sinew: (p) => {
    // hank of sinew: fibres flaring from a tight binding, frayed at both ends
    p.rect(1, 2, 14, 1, 'w');
    p.rect(2, 3, 12, 1, 'w');
    p.rect(3, 4, 10, 1, 'w');
    p.rect(4, 5, 8, 1, 'w');
    p.rect(5, 6, 6, 1, 'w');
    p.rect(6, 7, 4, 2, 'w');
    p.rect(5, 9, 6, 1, 'w');
    p.rect(4, 10, 8, 1, 'w');
    p.rect(3, 11, 10, 1, 'w');
    p.rect(2, 12, 12, 1, 'w');
    p.rect(1, 13, 14, 1, 'w');
    // fibre grooves running with the flare
    p.diag(3, 2, 6, 6, 'x'); p.diag(12, 2, 9, 6, 'x');
    p.diag(6, 9, 3, 13, 'x'); p.diag(9, 9, 12, 13, 'x');
    p.diag(6, 3, 7, 6, 'x'); p.diag(9, 3, 8, 6, 'x');
    // frayed ends
    p.clear(2, 2, 1, 1); p.clear(5, 2, 1, 1); p.clear(10, 2, 1, 1); p.clear(13, 2, 1, 1);
    p.clear(3, 13, 1, 1); p.clear(6, 13, 1, 1); p.clear(9, 13, 1, 1); p.clear(12, 13, 1, 1);
    p.rect(4, 7, 8, 2, 'o');                               // binding
    p.rect(4, 8, 8, 1, 'r');
    p.px(4, 7, 'y'); p.px(5, 7, 'y');
  },
  ore: (p) => {
    // dark rock with bright metal nuggets showing in the fracture
    p.rect(5, 3, 5, 1, 's');
    p.rect(3, 4, 9, 1, 's');
    p.rect(2, 5, 11, 6, 's');
    p.rect(3, 11, 9, 1, 's');
    p.rect(5, 12, 6, 1, 's');
    p.rect(2, 10, 11, 1, 'd'); p.rect(3, 11, 9, 1, 'd'); p.rect(5, 12, 6, 1, 'd');
    p.px(11, 6, 'd'); p.px(12, 7, 'd'); p.px(12, 8, 'd');
    const nug = (x, y) => { p.rect(x, y, 2, 2, 'x'); p.px(x, y, 'w'); p.px(x + 1, y + 1, 'c'); };
    nug(4, 5); nug(8, 6); nug(5, 8); nug(10, 4);
    p.px(3, 4, 'x'); p.px(4, 4, 'x'); p.px(2, 5, 'x');
  },
  ingot: (p) => {
    // cast ingot: trapezoid, lit top face, stamped
    p.rect(5, 4, 7, 1, 'w');
    p.rect(4, 5, 9, 2, 'x');
    p.rect(3, 7, 11, 3, 'x');
    p.rect(3, 10, 11, 1, 's');
    p.rect(4, 5, 6, 1, 'c');
    p.px(5, 8, 'c');                                      // sheen
    p.rect(11, 7, 3, 3, 's');
    p.px(8, 8, 'd'); p.px(9, 8, 'd'); p.px(8, 9, 'd');    // stamp
  },
  brick: (p) => {
    // two fired bricks, offset like courses in a wall
    p.rect(2, 4, 10, 1, 'y');
    p.rect(2, 5, 10, 3, 'o');
    p.rect(2, 7, 10, 1, 'r');
    p.rect(4, 9, 10, 1, 'y');
    p.rect(4, 10, 10, 3, 'o');
    p.rect(4, 12, 10, 1, 'r');
    p.px(4, 6, 'r'); p.px(8, 5, 'y'); p.px(6, 11, 'r'); p.px(10, 10, 'y');
    p.rect(10, 5, 2, 2, 'r'); p.rect(12, 10, 2, 2, 'r');
  },
  cooked_meat: (p) => {
    // drumstick: roasted meat on the bone, bone to the lower right
    p.rect(4, 2, 5, 1, 'o');
    p.rect(3, 3, 7, 2, 'o');
    p.rect(2, 5, 9, 3, 'r');
    p.rect(3, 8, 8, 2, 'r');
    p.rect(5, 10, 5, 1, 'r');
    p.rect(3, 3, 5, 1, 'o'); p.rect(2, 5, 4, 1, 'o');
    p.px(4, 3, 'y'); p.px(5, 3, 'y');
    p.px(4, 7, 'p'); p.px(7, 6, 'p'); p.px(6, 9, 'p'); p.px(9, 8, 'p');
    p.diag(9, 10, 12, 13, 'w');                           // bone
    p.rect(12, 12, 2, 2, 'w'); p.px(11, 13, 'w');
    p.px(13, 13, 'x'); p.px(11, 12, 'x');
  },
  stew: (p) => {
    // bowl of stew: chunks above the rim, steam rising
    p.rect(5, 4, 2, 1, 'w'); p.rect(9, 3, 2, 1, 'w'); p.rect(7, 2, 2, 1, 'w'); // steam
    p.rect(4, 5, 8, 1, 'r'); p.px(6, 4, 'o'); p.px(9, 4, 'g');
    p.rect(2, 6, 12, 1, 'r');                             // surface of the stew
    p.px(3, 6, 'o'); p.px(7, 6, 'y'); p.px(11, 6, 'G');
    p.rect(2, 7, 12, 1, 'y');                             // bowl rim, lit
    p.rect(2, 8, 12, 2, 'o');
    p.rect(3, 10, 10, 2, 'o');
    p.rect(5, 12, 6, 1, 'o');
    p.rect(3, 11, 10, 1, 'r'); p.rect(5, 12, 6, 1, 'r'); p.rect(10, 8, 4, 2, 'r');
    p.px(3, 8, 'y'); p.px(4, 9, 'y');
  },
  bread: (p) => {
    // round boule with a scored cross and a dusting of flour
    p.rect(5, 3, 6, 1, 'y');
    p.rect(3, 4, 10, 2, 'y');
    p.rect(2, 6, 12, 4, 'o');
    p.rect(3, 10, 10, 2, 'o');
    p.rect(5, 12, 6, 1, 'r');
    p.rect(3, 4, 8, 1, 'w'); p.rect(5, 3, 5, 1, 'w');
    p.rect(2, 6, 8, 1, 'y'); p.px(2, 7, 'y');
    p.rect(11, 8, 3, 2, 'r'); p.rect(9, 11, 4, 1, 'r'); p.px(13, 7, 'r');
    p.diag(4, 9, 8, 5, 'r'); p.diag(5, 10, 9, 6, 'r');    // score marks
  },
  smoked_meat: (p) => {
    // cured strips hanging from a hook, one behind the other
    p.px(7, 1, 'x'); p.px(8, 1, 'x'); p.px(6, 2, 'x'); p.px(9, 2, 'x');
    // back strip, shorter and deeper in shadow
    p.rect(9, 3, 4, 1, 'p');
    p.rect(9, 4, 5, 6, 'p');
    p.rect(10, 10, 3, 1, 'p');
    p.px(12, 5, 'r'); p.px(13, 7, 'r');
    // front strip
    p.rect(3, 2, 5, 1, 'r');
    p.rect(2, 3, 7, 9, 'r');
    p.rect(3, 12, 5, 1, 'r');
    p.rect(4, 13, 3, 1, 'r');
    p.vline(2, 3, 8, 'o'); p.rect(3, 2, 4, 1, 'o');
    p.px(4, 5, 'o'); p.px(5, 5, 'o'); p.px(3, 8, 'o'); p.px(6, 9, 'o'); p.px(4, 11, 'o');
    p.rect(7, 6, 2, 5, 'p'); p.rect(6, 11, 3, 1, 'p'); p.px(6, 12, 'p'); p.px(7, 12, 'p');
  },
};
