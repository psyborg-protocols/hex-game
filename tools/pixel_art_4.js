// pixel_art_4.js — icons added by the Hex Quest fork: the new gear, the
// defences, and raw meat. Same conventions as parts 1-3: SWEETIE-16 letters,
// light from the top left, outline added automatically by pcanvas.

export const PART4 = {
  meat: (p) => {
    // a raw haunch on the bone
    p.ellipse(6, 7, 4, 4, 'r');
    p.ellipse(5, 6, 2, 2, 'o');
    p.px(4, 5, 'y');
    p.rect(9, 9, 2, 2, 'r');
    p.diag(10, 10, 13, 13, 'w');
    p.diag(11, 10, 14, 13, 'w');
    p.px(14, 12, 'w'); p.px(12, 14, 'w');
    p.px(8, 9, 'p'); p.px(7, 10, 'p'); p.px(5, 10, 'p');
  },
  stone_knife: (p) => {
    // knapped flint blade bound to a short haft
    p.diag(3, 3, 8, 8, 'x');
    p.diag(4, 3, 9, 8, 'x');
    p.diag(3, 4, 7, 8, 's');
    p.px(3, 3, 'w'); p.px(4, 4, 'w');
    p.rect(8, 8, 2, 2, 'y');
    p.diag(10, 10, 13, 13, 'o');
    p.diag(11, 10, 14, 13, 'r');
  },
  spear: (p) => {
    p.diag(2, 13, 11, 4, 'o');
    p.diag(3, 13, 12, 4, 'r');
    p.rect(11, 2, 3, 3, 'x');
    p.px(13, 1, 'x'); p.px(14, 1, 'w'); p.px(12, 2, 'w');
    p.px(10, 5, 'y'); p.px(11, 5, 'y');
  },
  hide_armor: (p) => {
    // a laced leather jerkin
    p.rect(4, 3, 8, 11, 'o');
    p.rect(2, 3, 2, 5, 'o'); p.rect(12, 3, 2, 5, 'o');
    p.clear(6, 3, 4, 2);
    p.rect(4, 3, 2, 10, 'y');
    p.rect(10, 4, 2, 10, 'r');
    p.vline(8, 5, 8, 'd');
    p.px(7, 6, 'w'); p.px(9, 8, 'w'); p.px(7, 10, 'w');
    p.rect(4, 12, 8, 1, 'r');
  },
  leather_pack: (p) => {
    p.rect(3, 4, 10, 10, 'o');
    p.rect(3, 4, 10, 4, 'r');
    p.rect(3, 4, 3, 10, 'y');
    p.rect(7, 7, 2, 2, 'y');
    p.rect(5, 1, 6, 1, 'r'); p.px(5, 2, 'r'); p.px(10, 2, 'r'); p.px(5, 3, 'r'); p.px(10, 3, 'r');
    p.rect(11, 8, 2, 6, 'r');
  },
  workbench: (p) => {
    // a heavy bench with a saw lying across it
    p.rect(1, 6, 14, 2, 'o');
    p.hline(1, 6, 14, 'y');
    p.rect(2, 8, 2, 6, 'r'); p.rect(12, 8, 2, 6, 'r');
    p.rect(4, 11, 8, 1, 'r');
    p.rect(4, 3, 7, 2, 'x'); p.hline(4, 3, 7, 'w');
    p.rect(11, 3, 3, 2, 'o');
  },
  watchtower: (p) => {
    p.rect(4, 1, 8, 2, 'r');
    p.rect(3, 3, 10, 3, 'o');
    p.rect(3, 3, 10, 1, 'y');
    p.rect(5, 4, 2, 2, 'd'); p.rect(9, 4, 2, 2, 'd');
    p.vline(4, 6, 9, 'o'); p.vline(11, 6, 9, 'r');
    p.diag(5, 7, 10, 12, 'r');
    p.diag(10, 7, 5, 12, 'o');
    p.rect(3, 14, 10, 1, 's');
  },
  shield: (p) => {
    // round planked shield with a boss
    p.circle(8, 8, 6, 'o');
    p.vline(5, 3, 11, 'r'); p.vline(10, 3, 11, 'r');
    p.circle(8, 8, 2, 'x');
    p.px(7, 7, 'w');
    p.px(4, 5, 'y'); p.px(5, 4, 'y'); p.px(3, 7, 'y');
  },
  iron_mail: (p) => {
    p.rect(4, 3, 8, 11, 'x');
    p.rect(2, 3, 2, 6, 'x'); p.rect(12, 3, 2, 6, 'x');
    p.clear(6, 3, 4, 2);
    for (let y = 4; y < 14; y += 2) for (let x = 4 + (y % 4 ? 1 : 0); x < 12; x += 2) p.px(x, y, 's');
    p.rect(4, 3, 1, 10, 'c');
    p.rect(4, 12, 8, 2, 'o');
  },
  cart: (p) => {
    p.rect(2, 4, 11, 5, 'o');
    p.hline(2, 4, 11, 'y');
    p.vline(5, 5, 4, 'r'); p.vline(9, 5, 4, 'r');
    p.circle(5, 11, 2, 'r'); p.px(5, 11, 'y');
    p.circle(11, 11, 2, 'r'); p.px(11, 11, 'y');
    p.hline(13, 6, 3, 'o');
  },
  rally_banner: (p) => {
    p.vline(3, 1, 14, 'o');
    p.rect(4, 2, 9, 7, 'r');
    p.rect(4, 2, 9, 1, 'o');
    p.px(12, 9, 'r'); p.px(10, 9, 'r'); p.px(8, 9, 'r'); p.px(6, 9, 'r');
    p.rect(7, 4, 3, 3, 'y'); p.px(8, 5, 'w');
    p.px(3, 0, 'y');
  },
  rations: (p) => {
    // a cloth bundle tied with cord
    p.ellipse(8, 9, 6, 4, 'w');
    p.ellipse(8, 9, 5, 3, 'y');
    p.rect(7, 3, 2, 4, 'y');
    p.rect(6, 6, 4, 1, 'r');
    p.px(5, 5, 'r'); p.px(10, 5, 'r');
    p.rect(3, 10, 10, 1, 'o');
  },
  gold: (p) => {
    p.ellipse(6, 10, 4, 3, 'y');
    p.ellipse(10, 7, 4, 3, 'y');
    p.ellipse(10, 7, 2, 1, 'o');
    p.px(8, 6, 'w'); p.px(4, 9, 'w');
  },
};
