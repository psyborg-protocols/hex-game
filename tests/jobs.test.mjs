// jobs.test.mjs — work in the villages: shifts, ranks, the gift, errands and lent tools.

import { test, eq, ok, run } from './_harness.mjs';
import { createState, TURNS_PER_DAY, DAY_TURNS, moonOf } from '../src/game/state.js';
import { addItem, countItem, canPart, takeFromPack, lentCount } from '../src/game/inventory.js';
import { levelOf } from '../src/game/skills.js';
import { sell, buy, ensureVillage, isTrusted, giveFavour, FAVOUR_REWARD } from '../src/game/economy.js';
import { sleepContext } from '../src/game/sleep.js';
import {
  canWork, startShift, endShift, rankAt, handIn, checkErrandDeadline, confiscate, ensureJobs,
  giveErrand, jobOf, errandFor, staffPrice, ERRAND_TURNS,
} from '../src/game/jobs.js';
import { VILLAGE_JOBS, JOB_SHIFT_TURNS } from '../data/game_data.js';
import { WorldMap } from '../src/world/mapformat.js';

const village = (kind, q = 3, r = 3, name = 'Ashford') => ({ q, r, feature: { type: 'village', kind, name } });
const never = () => 0.99;   // no errand by chance
const always = () => 0;     // an errand whenever one can come

/** Morning of day `d` (from 1), `t` turns in. */
const at = (state, d, t = 0) => { state.turn = (d - 1) * TURNS_PER_DAY + t; };

/** A whole shift, start to finish. */
function work(state, col, rng = never) {
  const s = startShift(state, col);
  if (!s.ok) return s;
  s.shift.done = s.shift.turns;
  state.turn += s.shift.turns;
  return endShift(state, col, s.shift, rng);
}

test('five villages hire, herbalists do not', () => {
  eq(Object.keys(VILLAGE_JOBS).sort(), ['farmers', 'fishers', 'masons', 'smiths', 'woodcutters']);
  eq(jobOf(village('herbalists').feature), null);
  eq(canWork(createState(), village('herbalists')).ok, false);
});

test('a shift pays, teaches, earns trust, and is one a day', () => {
  const s = createState();
  const col = village('woodcutters');
  at(s, 1, 0);
  const gold = s.gold;
  const res = work(s, col);
  ok(res.full);
  eq(res.gold, 3, 'a Hand earns 3g');
  eq(s.gold, gold + 3);
  eq(res.xp, 3);
  ok(res.trusted && isTrusted(s, col.q, col.r), 'a finished shift earns the village\'s trust');
  eq(canWork(s, col).ok, false, 'once a day');
  at(s, 2, 0);
  ok(canWork(s, col).ok, 'tomorrow again');
});

test('day shifts need daylight; the inn works the evening', () => {
  const s = createState();
  at(s, 1, DAY_TURNS - JOB_SHIFT_TURNS + 1);
  eq(canWork(s, village('masons')).ok, false, 'not enough daylight left');
  const inn = village('fishers');
  at(s, 1, 2);
  eq(canWork(s, inn).ok, false, 'the supper rush is later');
  at(s, 1, DAY_TURNS - 2);
  ok(canWork(s, inn).ok, 'late afternoon');
  const res = work(s, inn);
  ok(res.bed, 'a bed tonight');
  eq(res.goods.length, 0);
  const map = new WorldMap({});
  map.place(3, 3, 'meadow', 1);
  map.get(3, 3).feature = inn.feature;
  const ctx = sleepContext(map, s, { q: 3, r: 3 });
  eq(ctx.cost, 0, 'the inn worker sleeps free');
  ok(ctx.freeBed);
  at(s, 2, DAY_TURNS + 1);
  eq(sleepContext(map, s, { q: 3, r: 3 }).cost, 5, 'any other night costs 5g');
  // No inn shift on the raid's day.
  at(s, 1 + 2, DAY_TURNS - 2);
  eq(moonOf(s).phase, 'omens');
  eq(canWork(s, inn).ok, false, 'not on a raid night');
});

test('the free bed is at the inn you worked, even with another village next door', () => {
  const s = createState();
  const inn = village('fishers', 3, 4, 'Reedwater');
  const map = new WorldMap({});
  for (let q = 2; q <= 6; q++) map.place(q, 4, 'meadow', 1);
  map.get(3, 4).feature = inn.feature;
  map.get(5, 4).feature = { type: 'village', kind: 'woodcutters', name: 'Ashford' };
  at(s, 1, DAY_TURNS - 2);
  ok(work(s, inn).bed);
  const ctx = sleepContext(map, s, { q: 4, r: 4 });   // between the two
  eq(ctx.village.feature.name, 'Reedwater', 'you sleep at the inn');
  eq(ctx.cost, 0);
});

test('the bakery pays in bread too', () => {
  const s = createState();
  at(s, 1, 0);
  const res = work(s, village('farmers'));
  eq(res.goods, [{ id: 'bread', qty: 2 }]);
  eq(res.xp, 0, 'a goods job, not a teacher');
});

test('rank is time served: Apprentice at 3 shifts, Journeyman needs 6 and an errand', () => {
  const s = createState();
  const col = village('woodcutters');
  const key = '3,3';
  at(s, 1); eq(work(s, col).errand, null, 'a Hand is not sent on errands');
  at(s, 2); work(s, col);
  at(s, 3);
  const third = work(s, col);
  eq(rankAt(s, key), 'apprentice');
  ok(third.errand, 'an apprentice\'s errand, certain by now');
  ok(s.jobs.errand.lent.includes('stone_axe'), 'the carpenter lends an axe to someone with none');
  eq(lentCount(s, 'stone_axe'), 1, 'and it is lent, not given');
  addItem(s, 'log', 4);
  const back = handIn(s, col);
  ok(back.ok);
  eq(back.promoted, null, 'an errand alone is not enough');
  eq(countItem(s, 'stone_axe'), 0, 'the axe went back');
  for (let d = 4; d <= 5; d++) { at(s, d); work(s, col); }
  eq(rankAt(s, key), 'apprentice');
  at(s, 6);
  const sixth = work(s, col);
  eq(sixth.promoted, 'journeyman', 'six shifts and an errand');
  eq(sixth.gift, 'stone_axe', 'the gift comes with the rank');
  eq(countItem(s, 'stone_axe'), 1, 'your own axe');
  eq(lentCount(s, 'stone_axe'), 0);
  // Time served is not enough without an errand done.
  const t = createState();
  ensureJobs(t).places['3,3'] = { shifts: 8, errandsDone: 0, sinceErrand: 0, firedUntil: -1 };
  eq(rankAt(t, key), 'apprentice', 'eight shifts but no errand: still an apprentice');
  eq(staffPrice(s, col, 'plank', 4), 3, 'a Journeyman pays staff price for the village\'s goods');
  eq(staffPrice(s, col, 'ore', 8), 8, 'but not for what it doesn\'t make');
});

test('pacing: one shift a day, nobody is a Journeyman before day 6', () => {
  const s = createState();
  const col = village('masons');
  let journeymanDay = null;
  for (let d = 1; d <= 20 && !journeymanDay; d++) {
    at(s, d);
    work(s, col, always);
    if (s.jobs.errand) {
      addItem(s, 'stone', 20); addItem(s, 'block', 10);
      handIn(s, col);
    }
    if (rankAt(s, '3,3') === 'journeyman') journeymanDay = d;
  }
  ok(journeymanDay >= 6, `Journeyman on day ${journeymanDay}`);
});

test('the job teaches up to level 3 and no further', () => {
  const s = createState();
  const col = village('smiths');
  for (let d = 1; d <= 40; d++) { at(s, d); work(s, col); }
  eq(levelOf(s, 'metalworking'), 3);
  at(s, 41);
  eq(work(s, col).xp, 0, 'the rest you learn by making');
});

test('errands are sized to your level, and only missing tools are lent', () => {
  const s = createState();
  const smithy = VILLAGE_JOBS.smiths;
  eq(errandFor(s, smithy).level, 1);
  s.skills.metalworking.level = 3;
  eq(errandFor(s, smithy).level, 2, 'ore wants Lore: without Mind 3, the level-2 errand');
  s.skills.mind.level = 3;
  eq(errandFor(s, smithy).level, 3);
  const carp = village('woodcutters');
  addItem(s, 'stone_axe', 1);
  giveErrand(s, carp, VILLAGE_JOBS.woodcutters);
  eq(s.jobs.errand.lent, [], 'you have an axe: nothing lent');
  s.jobs.errand = null;
  const t = createState();
  giveErrand(t, village('smiths'), VILLAGE_JOBS.smiths);
  eq(t.jobs.errand.lent, ['iron_axe'], 'the smith lends iron');
});

test('a lent tool is not yours to sell, drop, toss or trade', () => {
  const s = createState();
  const col = village('smiths');
  ensureVillage(s, col.feature, col.q, col.r);
  s.trust['3,3'].done = true;
  giveErrand(s, col, VILLAGE_JOBS.smiths);
  ok(!canPart(s, 'iron_axe'), 'held back');
  eq(sell(s, col, 'iron_axe').ok, false, 'cannot sell it');
  const idx = s.inventory.findIndex(x => x?.id === 'iron_axe');
  if (idx >= 0) eq(takeFromPack(s, idx).ok, false, 'cannot drop or toss it');
  else ok(s.worn.hand === 'iron_axe', 'or it went straight into your hand');
});

test('miss the deadline: lose the job, and the tool is taken next visit', () => {
  const s = createState();
  const col = village('smiths');
  at(s, 1);
  giveErrand(s, col, VILLAGE_JOBS.smiths);
  ok(countItem(s, 'iron_axe') === 1);
  s.turn += ERRAND_TURNS + 1;
  const lapsed = checkErrandDeadline(s);
  ok(lapsed, 'the errand lapsed');
  eq(s.jobs.errand, null);
  eq(canWork(s, col).ok, false, 'let go');
  ok(!canPart(s, 'iron_axe'), 'still owed');
  const taken = confiscate(s, col);
  eq(taken, ['iron_axe'], 'taken back');
  eq(countItem(s, 'iron_axe'), 0);
  s.turn += 3 * TURNS_PER_DAY;
  at(s, Math.floor(s.turn / TURNS_PER_DAY) + 2, 0);
  ok(canWork(s, col).ok, 'hired again after three days');
});

test('a favour earns trust and no gold', () => {
  eq(FAVOUR_REWARD, 0);
  const s = createState();
  const col = village('farmers');
  ensureVillage(s, col.feature, col.q, col.r);
  addItem(s, 'berries', 10);
  const gold = s.gold;
  ok(giveFavour(s, col).ok);
  eq(s.gold, gold);
  ok(isTrusted(s, col.q, col.r));
});

test('the staff price applies when buying', () => {
  const s = createState();
  const col = village('woodcutters');
  ensureVillage(s, col.feature, col.q, col.r);
  s.trust['3,3'].done = true;
  const listed = s.prices['3,3'].plank;
  ensureJobs(s).places['3,3'] = { shifts: 6, errandsDone: 1, sinceErrand: 0, firedUntil: -1 };
  s.gold = 100;
  const res = buy(s, col, 'plank');
  ok(res.ok);
  eq(res.price, Math.max(1, Math.floor(listed * 0.75)));
});

run('jobs');
