// pixel_art_3.js — homesteading/mind items, metalworking goods, skill glyphs.
// Ramps: wood/clay y->o->r · stone x->s->d · metal w/c->x->s · bone w->x->s
// · foliage g->G->t · fire y->o->r · mystic c->n->d. Light falls from the top-left.
// Tier rule: the same tool silhouette across tiers, upgraded material —
// stone (x+w) < bone (w+x) < metal (x+c). Skill glyphs keep rows 14-15 empty for level pips.
import { draw } from './pcanvas.js';

export const PART3 = {
  // ---- homesteading (metal tier) ----
  plough: (p) => {
    // the ard again, now with an iron share
    p.rect(11, 1, 3, 1, 'y'); p.rect(11, 2, 2, 3, 'o');
    p.diag(12, 4, 7, 9, 'o'); p.diag(11, 4, 6, 9, 'o');
    p.diag(11, 3, 6, 8, 'y');
    p.rect(5, 9, 3, 1, 'x');
    p.rect(3, 10, 5, 1, 'x');
    p.rect(2, 11, 6, 1, 'x');
    p.rect(1, 12, 7, 1, 'x');
    p.rect(2, 13, 5, 1, 'x');
    p.px(5, 9, 'c'); p.rect(3, 10, 3, 1, 'c'); p.px(2, 11, 'c'); p.px(1, 12, 'w');
    p.rect(4, 13, 3, 1, 's'); p.px(7, 12, 's'); p.px(7, 11, 's'); p.px(6, 10, 's');
    p.diag(8, 6, 12, 8, 'o'); p.px(12, 9, 'o');          // brace
  },
  smokehouse: (p) => {
    // slatted smoking hut, smoke curling from the roof
    p.px(3, 1, 'x'); p.px(4, 2, 'x'); p.px(3, 3, 'x');
    p.rect(7, 2, 2, 1, 'r');
    p.rect(5, 3, 6, 1, 'r');
    p.rect(3, 4, 10, 1, 'r');
    p.rect(1, 5, 14, 2, 'r');
    p.rect(5, 3, 3, 1, 'o'); p.rect(3, 4, 5, 1, 'o'); p.rect(1, 5, 7, 1, 'o');
    p.rect(2, 7, 12, 7, 'o');                            // slatted wall
    for (const x of [4, 7, 10]) p.vline(x, 7, 7, 'r');
    p.rect(11, 7, 3, 7, 'r');
    p.rect(6, 9, 4, 5, 'd');                             // smoking chamber
    p.rect(6, 10, 2, 3, 'r'); p.rect(8, 11, 2, 2, 'r');  // meat inside
    p.px(6, 10, 'o'); p.px(8, 11, 'o');
  },
  granary: (p) => {
    // raised store on staddle stones, thatched cap, grain hatch
    p.rect(7, 1, 2, 1, 'y');
    p.rect(5, 2, 6, 1, 'y');
    p.rect(3, 3, 10, 1, 'y');
    p.rect(1, 4, 14, 2, 'y');
    p.rect(3, 3, 5, 1, 'w'); p.rect(1, 4, 7, 1, 'w');
    p.rect(9, 4, 6, 2, 'o'); p.px(11, 3, 'o'); p.px(12, 3, 'o');
    p.rect(2, 6, 12, 6, 'o');                            // wall
    p.rect(2, 7, 12, 1, 'r'); p.rect(2, 10, 12, 1, 'r');
    p.rect(11, 6, 3, 6, 'r');
    p.rect(6, 7, 4, 4, 'd');                             // hatch
    p.rect(6, 9, 4, 2, 'y'); p.px(7, 8, 'y'); p.px(9, 8, 'y'); // grain spilling
    p.rect(3, 12, 2, 3, 'x'); p.rect(11, 12, 2, 3, 'x'); // staddle stones
    p.px(3, 12, 'w'); p.px(11, 12, 'w'); p.px(4, 14, 's'); p.px(12, 14, 's');
  },
  well: (p) => {
    // stone well with a shingled roof, windlass and bucket
    p.rect(7, 1, 2, 1, 'r');
    p.rect(5, 2, 6, 1, 'r');
    p.rect(3, 3, 10, 1, 'r');
    p.rect(5, 2, 3, 1, 'o'); p.rect(3, 3, 5, 1, 'o');
    p.vline(3, 4, 5, 'o'); p.vline(12, 4, 5, 'o');       // posts
    p.rect(4, 5, 8, 1, 'o'); p.px(13, 5, 'o');           // windlass
    p.rect(6, 6, 3, 3, 'o'); p.rect(6, 6, 3, 1, 'y');    // bucket
    p.px(7, 7, 'r');
    p.rect(2, 9, 12, 2, 'x');                            // wall head
    p.rect(2, 9, 9, 1, 'w');
    p.rect(3, 11, 10, 3, 'x');
    p.rect(4, 11, 8, 2, 'B'); p.rect(5, 11, 6, 1, 'c');  // water
    p.rect(4, 13, 9, 1, 's'); p.px(12, 12, 's'); p.px(11, 10, 's');
  },
  market_stall: (p) => {
    // striped awning over a counter of goods
    p.rect(1, 2, 14, 3, 'r');
    p.rect(3, 2, 2, 3, 'w'); p.rect(7, 2, 2, 3, 'w'); p.rect(11, 2, 2, 3, 'w');
    p.rect(1, 2, 14, 1, 'p');
    p.px(1, 5, 'r'); p.px(4, 5, 'w'); p.px(8, 5, 'w'); p.px(12, 5, 'w'); p.px(14, 5, 'r');
    p.vline(2, 6, 8, 'o'); p.vline(13, 6, 8, 'o');       // posts
    p.rect(1, 10, 14, 1, 'y');                           // counter
    p.rect(1, 11, 14, 2, 'o'); p.rect(1, 12, 14, 1, 'r');
    p.circle(5, 8, 1, 'r'); p.px(4, 7, 'o');             // goods
    p.rect(8, 7, 2, 3, 'G'); p.px(8, 7, 'g');
    p.rect(10, 8, 2, 2, 'y'); p.px(10, 8, 'w');
  },
  dog: (p) => {
    // side view: head up, ears pricked, tail raised
    p.rect(2, 3, 2, 2, 'o'); p.px(2, 2, 'o');            // ear
    p.rect(3, 4, 4, 4, 'o');                             // head
    p.rect(1, 6, 3, 2, 'o');                             // muzzle
    p.px(1, 6, 'y'); p.px(1, 7, 'd');
    p.px(4, 5, 'd');                                     // eye
    p.rect(5, 7, 7, 5, 'o');                             // body
    p.rect(5, 7, 6, 1, 'y');
    p.rect(9, 10, 3, 2, 'r'); p.px(6, 11, 'r');
    p.rect(5, 12, 2, 3, 'o'); p.rect(10, 12, 2, 3, 'o'); // legs
    p.vline(6, 12, 3, 'r'); p.vline(11, 12, 3, 'r');
    p.diag(12, 9, 14, 5, 'o'); p.diag(13, 9, 14, 6, 'o'); // tail
    p.px(14, 4, 'y');
  },
  // ---- metalworking goods ----
  knife: (p) => {
    // pointed blade with the edge down, bolster, wrapped grip
    p.px(1, 7, 'x');
    p.rect(2, 6, 2, 2, 'x');
    p.rect(4, 5, 3, 3, 'x');
    p.rect(7, 4, 4, 4, 'x');
    p.px(1, 7, 'c'); p.rect(2, 7, 9, 1, 'c');            // edge
    p.rect(7, 4, 4, 1, 's'); p.px(6, 5, 's'); p.px(3, 6, 's');
    p.px(5, 6, 'w'); p.px(8, 5, 'w'); p.px(9, 5, 'w');
    p.vline(11, 4, 4, 'w');                              // bolster
    p.rect(12, 4, 3, 5, 'o');
    p.rect(12, 4, 3, 1, 'y'); p.rect(12, 8, 3, 1, 'r'); p.px(14, 6, 'r');
  },
  bone_saw: (p) => {
    // toothed bone blade set in a wooden handle
    p.rect(1, 5, 11, 3, 'w');
    p.rect(1, 5, 10, 1, 'w'); p.rect(1, 7, 11, 1, 'x');
    for (const x of [1, 3, 5, 7, 9]) { p.px(x, 8, 'w'); p.px(x + 1, 8, 'x'); }
    p.rect(11, 4, 4, 4, 'o');                            // handle
    p.rect(11, 4, 3, 1, 'y'); p.rect(12, 7, 3, 1, 'r');
    p.rect(12, 5, 2, 2, 'd');
  },
  saw: (p) => {
    // steel blade with set teeth, wooden handle
    p.rect(1, 5, 11, 3, 'x');
    p.rect(1, 5, 10, 1, 'c'); p.rect(1, 7, 11, 1, 's');
    for (const x of [1, 3, 5, 7, 9]) { p.px(x, 8, 'x'); p.px(x + 1, 8, 's'); }
    p.rect(11, 4, 4, 4, 'o');
    p.rect(11, 4, 3, 1, 'y'); p.rect(12, 7, 3, 1, 'r');
    p.rect(12, 5, 2, 2, 'd');
  },
  adze: (p) => {
    // the adze again, now with a forged blade
    p.rect(11, 1, 2, 2, 'o');
    p.diag(12, 2, 9, 6, 'o'); p.diag(11, 2, 8, 6, 'o');
    p.diag(11, 1, 8, 5, 'y');
    p.rect(8, 6, 2, 2, 'o');
    p.rect(2, 7, 8, 2, 'x');
    p.rect(1, 9, 8, 2, 'x');
    p.rect(2, 11, 6, 1, 'x');
    p.vline(1, 9, 2, 'c'); p.rect(2, 7, 4, 1, 'c'); p.px(2, 8, 'w');
    p.rect(5, 10, 5, 1, 's'); p.rect(3, 11, 5, 1, 's');
    p.rect(7, 6, 4, 2, 'y'); p.px(7, 7, 'r'); p.px(10, 7, 'r');
  },
  axe: (p) => {
    // felling axe: flared bit with a keen edge, forged socket, straight haft
    p.rect(6, 1, 4, 1, 'x');
    p.rect(4, 2, 6, 1, 'x');
    p.rect(3, 3, 7, 1, 'x');
    p.rect(2, 4, 8, 2, 'x');
    p.rect(3, 6, 7, 1, 'x');
    p.rect(4, 7, 6, 1, 'x');
    p.rect(6, 8, 4, 1, 'x');
    p.vline(2, 4, 2, 'c'); p.px(3, 3, 'c'); p.px(4, 2, 'c'); p.px(3, 6, 'c'); p.px(4, 7, 'c');
    p.rect(7, 3, 3, 4, 's'); p.px(6, 8, 's');
    p.px(4, 4, 'w'); p.px(5, 3, 'w');
    p.rect(7, 7, 4, 2, 'x'); p.px(7, 7, 'w'); p.px(10, 8, 's'); // socket
    p.rect(8, 9, 2, 6, 'o');
    p.vline(8, 9, 6, 'y'); p.vline(9, 9, 6, 'r');
  },
  pickaxe: (p) => {
    // double-pointed head on a haft
    p.px(1, 4, 'x'); p.rect(2, 3, 3, 1, 'x'); p.rect(11, 3, 3, 1, 'x'); p.px(14, 4, 'x');
    p.rect(4, 4, 8, 2, 'x');
    p.rect(2, 3, 3, 1, 'c'); p.px(1, 4, 'c'); p.px(5, 4, 'w');
    p.rect(9, 5, 5, 1, 's'); p.px(13, 4, 's');
    p.rect(7, 4, 2, 3, 'x'); p.px(7, 4, 'w');            // eye
    p.rect(7, 7, 2, 8, 'o');
    p.vline(7, 7, 8, 'y'); p.vline(8, 7, 8, 'r');
  },
  hoe: (p) => {
    // forged blade set square at the foot of a long handle
    p.diag(13, 1, 6, 9, 'o'); p.diag(12, 1, 5, 9, 'o');
    p.diag(12, 1, 5, 8, 'y');
    p.rect(4, 9, 3, 2, 'o');
    p.rect(1, 10, 7, 3, 'x');
    p.rect(1, 10, 6, 1, 'c');
    p.rect(2, 12, 6, 1, 's'); p.px(7, 11, 's');
    p.rect(4, 8, 4, 2, 'y'); p.px(4, 9, 'r'); p.px(7, 9, 'r');
  },
  hammer: (p) => {
    // forged head with a peen, wedged onto a haft
    p.rect(3, 2, 9, 4, 'x');
    p.rect(2, 3, 1, 2, 'x');                             // peen
    p.rect(3, 2, 7, 1, 'c'); p.px(2, 3, 'c');
    p.rect(9, 3, 3, 3, 's'); p.rect(4, 5, 8, 1, 's');
    p.px(5, 3, 'w'); p.px(6, 3, 'w');
    p.rect(7, 6, 2, 8, 'o');
    p.vline(7, 6, 8, 'y'); p.vline(8, 6, 8, 'r');
    p.rect(6, 6, 4, 1, 'r');                             // wedge collar
  },
  chisel: (p) => {
    // forged bit, bright ferrule, turned wooden handle
    p.rect(5, 1, 6, 4, 'o');                             // handle
    p.rect(6, 1, 4, 1, 'y'); p.vline(5, 2, 3, 'y');
    p.vline(10, 2, 3, 'r'); p.rect(5, 4, 6, 1, 'r');
    p.rect(6, 5, 4, 2, 'x'); p.rect(6, 5, 4, 1, 'c'); p.rect(6, 6, 4, 1, 's'); // ferrule
    p.rect(7, 7, 2, 5, 'x');
    p.vline(7, 7, 5, 'c'); p.vline(8, 7, 5, 's');
    p.rect(6, 12, 4, 1, 'x'); p.rect(6, 13, 4, 1, 'w');  // flared cutting edge
  },
  bone_adze: (p) => {
    // the adze again, blade cut from bone
    p.rect(11, 1, 2, 2, 'o');
    p.diag(12, 2, 9, 6, 'o'); p.diag(11, 2, 8, 6, 'o');
    p.diag(11, 1, 8, 5, 'y');
    p.rect(8, 6, 2, 2, 'o');
    p.rect(2, 7, 8, 2, 'w');
    p.rect(1, 9, 8, 2, 'w');
    p.rect(2, 11, 6, 1, 'w');
    p.rect(5, 10, 5, 1, 'x'); p.rect(3, 11, 5, 1, 'x'); p.px(6, 8, 'x');
    p.px(4, 9, 's'); p.px(7, 10, 's');
    p.rect(7, 6, 4, 2, 'y'); p.px(7, 7, 'r'); p.px(10, 7, 'r');
  },
  bone_tongs: (p) => {
    // two bone arms on a rivet, jaws open at the top
    p.rect(3, 1, 3, 2, 'w'); p.rect(10, 1, 3, 2, 'w');
    p.px(5, 2, 'x'); p.px(10, 2, 'x');
    p.diag(4, 3, 7, 7, 'w'); p.diag(5, 3, 8, 7, 'w');
    p.diag(11, 3, 8, 7, 'w'); p.diag(10, 3, 7, 7, 'w');
    p.diag(7, 8, 4, 14, 'w'); p.diag(8, 8, 11, 14, 'w');
    p.diag(8, 8, 5, 14, 'x'); p.diag(7, 8, 10, 14, 'x');
    p.rect(7, 7, 2, 2, 'x'); p.px(7, 7, 'w');            // rivet
  },
  tongs: (p) => {
    // the same tongs, forged in iron
    p.rect(3, 1, 3, 2, 'x'); p.rect(10, 1, 3, 2, 'x');
    p.px(3, 1, 'c'); p.px(12, 1, 'c'); p.px(5, 2, 's'); p.px(10, 2, 's');
    p.diag(4, 3, 7, 7, 'x'); p.diag(5, 3, 8, 7, 'x');
    p.diag(11, 3, 8, 7, 'x'); p.diag(10, 3, 7, 7, 'x');
    p.diag(7, 8, 4, 14, 'x'); p.diag(8, 8, 11, 14, 'x');
    p.diag(8, 8, 5, 14, 's'); p.diag(7, 8, 10, 14, 's');
    p.rect(7, 7, 2, 2, 's'); p.px(7, 7, 'w');            // rivet
  },
  fine_tongs: (p) => {
    // drawn-out smith's tongs: slim arms, polished jaws
    p.rect(3, 1, 3, 2, 'x'); p.rect(10, 1, 3, 2, 'x');
    p.rect(3, 1, 3, 1, 'c'); p.rect(10, 1, 3, 1, 'c');
    p.px(5, 2, 's'); p.px(10, 2, 's');
    p.diag(4, 3, 7, 7, 'x'); p.diag(5, 3, 8, 7, 'c');
    p.diag(11, 3, 8, 7, 'x'); p.diag(10, 3, 7, 7, 'c');
    p.diag(7, 8, 4, 14, 'x'); p.diag(8, 8, 11, 14, 'x');
    p.diag(8, 8, 5, 14, 'c'); p.diag(7, 8, 10, 14, 'c');
    p.px(4, 14, 'y'); p.px(11, 14, 'y');                 // grip wraps
    p.px(5, 13, 'y'); p.px(10, 13, 'y');
    p.rect(7, 7, 2, 2, 'w');                             // rivet
  },
  anvil: (p) => {
    // horn, face, waist and splayed foot
    p.rect(3, 3, 10, 1, 'x');
    p.rect(1, 4, 13, 2, 'x');
    p.rect(3, 3, 8, 1, 'c'); p.rect(1, 4, 4, 1, 'w');
    p.rect(10, 5, 4, 1, 's'); p.px(13, 4, 's');
    p.rect(5, 6, 6, 3, 'x');
    p.rect(8, 6, 3, 3, 's');
    p.rect(3, 9, 10, 3, 'x');
    p.rect(3, 9, 7, 1, 'x'); p.rect(4, 11, 9, 1, 's');
    p.rect(2, 12, 12, 1, 's'); p.rect(3, 13, 10, 1, 'd');
    p.px(6, 10, 'd'); p.px(11, 10, 'd');
  },
  bellows: (p) => {
    // wedge of leather between two boards, nozzle blowing into the fire
    p.rect(1, 3, 10, 2, 'o'); p.rect(1, 3, 10, 1, 'y'); // top board
    p.px(11, 5, 'o');
    p.rect(1, 5, 11, 4, 'r');                            // leather
    p.px(12, 6, 'r'); p.px(12, 7, 'r');
    p.vline(3, 5, 4, 'p'); p.vline(6, 5, 4, 'p'); p.vline(9, 5, 4, 'p'); // pleats
    p.rect(1, 5, 1, 4, 'o');
    p.rect(1, 9, 10, 2, 'o'); p.rect(1, 10, 10, 1, 'r'); // bottom board
    p.px(11, 9, 'o');
    p.rect(12, 6, 2, 2, 'x'); p.px(12, 6, 'c'); p.px(13, 7, 's'); // nozzle
    p.px(14, 6, 'y'); p.px(14, 7, 'o'); p.px(14, 5, 'o');
    p.px(1, 2, 'o'); p.px(1, 11, 'o');                   // handles
  },
  sword: (p) => {
    // fullered blade, quillons, bound grip, pommel
    p.px(8, 1, 'c');
    p.rect(7, 2, 3, 8, 'x');
    p.vline(7, 2, 8, 'c'); p.vline(9, 2, 8, 's');
    p.vline(8, 3, 6, 'w');                               // fuller
    p.rect(4, 10, 9, 1, 'x'); p.rect(4, 10, 6, 1, 'c');  // crossguard
    p.px(3, 10, 'x'); p.px(13, 10, 'x'); p.px(13, 11, 's');
    p.rect(7, 11, 3, 3, 'o');
    p.vline(7, 11, 3, 'y'); p.vline(9, 11, 3, 'r');
    p.rect(6, 14, 4, 1, 'y'); p.px(9, 14, 'o');          // pommel
  },
  // ---- mind items ----
  amulet: (p) => {
    // pendant stone bound in cord and hung on a thong
    p.diag(3, 4, 7, 1, 'o'); p.diag(13, 4, 9, 1, 'o');
    p.rect(7, 1, 3, 1, 'o');
    p.px(2, 5, 'o'); p.px(14, 5, 'o');
    p.rect(6, 4, 4, 1, 'y'); p.px(5, 5, 'y'); p.px(10, 5, 'y'); // wrap
    p.rect(5, 5, 6, 1, 'b');
    p.rect(4, 6, 8, 4, 'b');
    p.rect(5, 10, 6, 1, 'b');
    p.rect(6, 11, 4, 1, 'b');
    p.px(8, 12, 'b');
    p.rect(5, 5, 4, 1, 'B'); p.rect(4, 6, 3, 1, 'B'); p.px(4, 7, 'B');
    p.px(5, 6, 'c'); p.px(6, 6, 'w');
    p.rect(9, 8, 3, 2, 'n'); p.rect(7, 11, 3, 1, 'n'); p.px(8, 12, 'n'); p.px(10, 10, 'n');
  },
  drum: (p) => {
    // hide head laced to a wooden shell
    p.rect(4, 2, 8, 1, 'w');
    p.rect(2, 3, 12, 2, 'w');
    p.rect(4, 5, 8, 1, 'x');
    p.rect(3, 3, 5, 1, 'w'); p.px(5, 4, 'w');
    p.rect(2, 5, 12, 6, 'o');
    p.rect(3, 11, 10, 2, 'o');
    p.rect(2, 5, 1, 6, 'y'); p.px(3, 5, 'y');
    p.rect(11, 6, 3, 5, 'r'); p.rect(3, 11, 10, 1, 'r'); p.rect(4, 12, 8, 1, 'r');
    for (const x of [4, 7, 10]) { p.diag(x, 5, x + 1, 9, 'y'); p.diag(x + 2, 5, x + 1, 9, 'y'); } // lacing
  },
  journal: (p) => {
    // bound book: leather cover, page block, tie cord
    p.rect(2, 2, 11, 1, 'r');
    p.rect(1, 3, 13, 10, 'r');
    p.rect(2, 13, 11, 1, 'r');
    p.rect(2, 2, 8, 1, 'o'); p.vline(1, 3, 6, 'o');
    p.rect(10, 4, 4, 9, 'p'); p.rect(2, 13, 11, 1, 'p');
    p.rect(3, 4, 8, 8, 'w');                             // pages
    p.rect(3, 4, 7, 1, 'w'); p.vline(3, 4, 8, 'w');
    p.rect(4, 11, 7, 1, 'x'); p.vline(10, 5, 7, 'x');
    p.rect(5, 6, 4, 1, 'x'); p.rect(5, 8, 5, 1, 'x'); p.rect(5, 10, 3, 1, 'x'); // writing
    p.vline(2, 3, 10, 'd');                              // spine
    p.rect(12, 6, 3, 1, 'y'); p.px(14, 7, 'y'); p.px(13, 7, 'y'); // tie
  },
  salve: (p) => {
    // squat jar under a tied cloth cover, green salve inside
    p.rect(5, 1, 6, 1, 'o'); p.rect(4, 2, 8, 1, 'o');    // cloth cover
    p.rect(5, 1, 4, 1, 'y'); p.rect(4, 2, 5, 1, 'y');
    p.rect(4, 3, 8, 1, 'r');                             // tie cord
    p.rect(3, 4, 10, 1, 't');
    p.rect(2, 5, 12, 7, 't');
    p.rect(3, 12, 10, 1, 't');
    p.rect(5, 13, 6, 1, 't');
    p.rect(3, 7, 10, 5, 'G'); p.rect(3, 7, 7, 1, 'g');   // contents
    p.rect(10, 9, 3, 3, 't'); p.px(12, 8, 't');
    p.px(3, 5, 'c'); p.px(2, 6, 'c'); p.px(2, 7, 'c');   // glass glint
    p.rect(11, 6, 3, 2, 'n'); p.rect(5, 13, 6, 1, 'n'); p.rect(9, 12, 4, 1, 'n');
  },
  totem: (p) => {
    // carved pole with a face and outstretched wings
    p.rect(2, 4, 3, 2, 'o'); p.rect(11, 4, 3, 2, 'o');   // wings
    p.px(2, 4, 'y'); p.px(11, 4, 'y'); p.rect(2, 5, 3, 1, 'r'); p.rect(11, 5, 3, 1, 'r');
    p.rect(5, 1, 6, 1, 'o');
    p.rect(4, 2, 8, 12, 'o');
    p.vline(4, 2, 12, 'y'); p.rect(5, 1, 4, 1, 'y');
    p.vline(11, 2, 12, 'r'); p.rect(5, 13, 7, 1, 'r');
    p.rect(5, 3, 6, 4, 'r');                             // painted face
    p.rect(5, 4, 2, 2, 'y'); p.rect(9, 4, 2, 2, 'y');
    p.px(6, 5, 'd'); p.px(9, 5, 'd');
    p.rect(6, 6, 4, 1, 'w');                             // teeth
    p.rect(5, 9, 6, 3, 'y'); p.rect(6, 10, 4, 1, 'r');   // carved band
  },
  shrine: (p) => {
    // standing stones over an altar with an offering flame
    p.px(8, 1, 'y'); p.rect(7, 2, 3, 1, 'y'); p.rect(6, 3, 5, 2, 'o');
    p.px(8, 2, 'w'); p.rect(7, 3, 3, 1, 'y'); p.rect(6, 4, 5, 1, 'r'); p.px(8, 4, 'o');
    p.rect(2, 5, 3, 6, 'x'); p.rect(11, 5, 3, 6, 'x');   // uprights
    p.rect(2, 5, 2, 1, 'w'); p.rect(11, 5, 2, 1, 'w');
    p.vline(4, 6, 5, 's'); p.vline(13, 6, 5, 's');
    p.rect(5, 6, 6, 2, 'x'); p.rect(5, 6, 5, 1, 'w'); p.rect(6, 7, 5, 1, 's'); // lintel
    p.rect(5, 9, 6, 2, 'x'); p.rect(5, 9, 4, 1, 'w'); p.rect(6, 10, 5, 1, 's'); // altar
    p.rect(1, 11, 14, 2, 'x');
    p.rect(1, 11, 9, 1, 'x'); p.rect(2, 12, 12, 1, 's'); p.rect(3, 13, 10, 1, 'd');
  },
  oracle: (p) => {
    // scrying bowl: still water under a scatter of stars
    p.rect(3, 1, 2, 1, 'c'); p.px(3, 2, 'c');            // stars
    p.rect(11, 2, 2, 1, 'c'); p.px(12, 3, 'c');
    p.rect(7, 1, 2, 1, 'w'); p.px(8, 2, 'c');
    p.rect(3, 6, 10, 1, 'x');
    p.rect(2, 7, 12, 1, 'x');
    p.rect(3, 7, 10, 1, 'n');                            // dark water
    p.rect(5, 7, 3, 1, 'b'); p.px(6, 7, 'c');
    p.rect(3, 6, 6, 1, 'w');
    p.rect(2, 8, 12, 2, 'x');
    p.rect(3, 10, 10, 1, 'x');
    p.rect(5, 11, 6, 1, 'x');
    p.rect(10, 8, 4, 2, 's'); p.rect(8, 10, 5, 1, 's'); p.rect(5, 11, 6, 1, 's');
    p.px(3, 8, 'w'); p.px(2, 8, 'w');
    p.rect(6, 12, 4, 2, 'x'); p.rect(4, 13, 8, 1, 'x');  // foot
    p.rect(7, 13, 5, 1, 's'); p.px(6, 12, 'w');
  },
  // ---- skill glyphs (bottom 2 rows stay empty for the level pips) ----
  stoneworking: (p) => {
    // a mason's hammer over a chipped block
    p.rect(2, 1, 9, 4, 'x');
    p.rect(2, 1, 7, 1, 'w'); p.px(2, 2, 'w');
    p.rect(8, 2, 3, 3, 's'); p.rect(3, 4, 8, 1, 's');
    p.rect(5, 5, 2, 6, 'o'); p.vline(5, 5, 6, 'y'); p.vline(6, 5, 6, 'r');
    p.rect(4, 5, 4, 1, 'r');
    p.rect(9, 8, 6, 5, 'x');                             // block
    p.rect(9, 8, 5, 1, 'w');
    p.rect(10, 12, 5, 1, 's'); p.vline(14, 9, 4, 's');
    p.px(11, 10, 'd'); p.px(12, 11, 'd');
  },
  woodworking: (p) => {
    // a broadleaf tree over a stout trunk
    p.rect(6, 1, 4, 1, 'g');
    p.rect(4, 2, 8, 2, 'g');
    p.rect(2, 4, 12, 3, 'G');
    p.rect(3, 7, 10, 2, 'G');
    p.rect(5, 9, 6, 1, 'G');
    p.rect(4, 2, 5, 1, 'g'); p.rect(2, 4, 6, 1, 'g'); p.px(6, 1, 'g');
    p.rect(10, 6, 4, 1, 't'); p.rect(9, 8, 4, 1, 't'); p.rect(6, 9, 5, 1, 't');
    p.px(5, 6, 't'); p.px(8, 5, 't');
    p.rect(6, 10, 3, 3, 'o');
    p.vline(6, 10, 3, 'y'); p.vline(8, 10, 3, 'r');
  },
  homesteading: (p) => {
    // a home with a lit window and smoke from the chimney
    p.px(3, 1, 'x'); p.px(2, 2, 'x');
    p.rect(2, 3, 3, 3, 'r'); p.rect(2, 3, 2, 1, 'o');
    p.rect(7, 2, 2, 1, 'r');
    p.rect(5, 3, 6, 1, 'r');
    p.rect(3, 4, 10, 1, 'r');
    p.rect(1, 5, 14, 2, 'r');
    p.rect(5, 3, 3, 1, 'o'); p.rect(3, 4, 5, 1, 'o'); p.rect(1, 5, 7, 1, 'o');
    p.rect(2, 7, 12, 6, 'y');
    p.rect(2, 7, 12, 1, 'w');
    p.rect(11, 8, 3, 5, 'o'); p.rect(3, 12, 11, 1, 'o');
    p.rect(6, 9, 4, 4, 'r'); p.rect(6, 9, 3, 1, 'o'); p.px(9, 11, 'y');
    p.rect(3, 9, 2, 2, 'B'); p.px(3, 9, 'c');
  },
  metalworking: (p) => {
    // a glowing billet worked on the anvil, sparks flying
    p.rect(12, 1, 2, 1, 'y'); p.px(13, 2, 'o');
    p.px(2, 1, 'y'); p.px(3, 2, 'o');
    p.rect(5, 1, 5, 1, 'o'); p.rect(4, 2, 7, 1, 'y'); p.rect(6, 2, 3, 1, 'w'); // hot billet
    p.rect(3, 3, 10, 1, 'x');
    p.rect(1, 4, 13, 2, 'x');
    p.rect(3, 3, 8, 1, 'c'); p.rect(1, 4, 4, 1, 'w');
    p.rect(10, 5, 4, 1, 's'); p.px(13, 4, 's');
    p.rect(5, 6, 6, 2, 'x'); p.rect(8, 6, 3, 2, 's');
    p.rect(3, 8, 10, 3, 'x');
    p.rect(3, 8, 7, 1, 'x'); p.rect(4, 10, 9, 1, 's');
    p.rect(2, 11, 12, 1, 's'); p.rect(3, 12, 10, 1, 'd');
    p.px(6, 9, 'd'); p.px(11, 9, 'd');
  },
  mind: (p) => {
    // an open eye with rays — attention turned outward
    p.rect(7, 1, 2, 1, 'c');                              // rays
    p.rect(2, 2, 2, 1, 'c'); p.rect(12, 2, 2, 1, 'c');
    p.rect(1, 6, 1, 2, 'c'); p.rect(14, 6, 1, 2, 'c');
    p.rect(6, 4, 4, 1, 'n');
    p.rect(4, 5, 8, 1, 'n');
    p.rect(3, 6, 10, 3, 'n');
    p.rect(4, 9, 8, 1, 'n');
    p.rect(6, 10, 4, 1, 'n');
    p.rect(4, 6, 8, 3, 'w');                              // sclera
    p.rect(6, 5, 4, 1, 'w'); p.rect(6, 9, 4, 1, 'w');
    p.rect(6, 6, 4, 3, 'b');                              // iris
    p.rect(7, 7, 2, 2, 'd');                              // pupil
    p.px(7, 6, 'c'); p.px(6, 6, 'c');
  },
};
