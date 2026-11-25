// jobs.js
// Work in the villages: half a day at a master's side for a little money, the
// trade's know-how and a perk; errands with a borrowed tool and a deadline; and,
// for those who stay, the trade's own tool.
//
// Rank comes from time served, not XP: shifts worked and errands done at that
// village (JOB_RANKS). A job is an opening, not a career: XP from it stops at
// JOB_XP_CAP, and by then your own work earns more than the wage.
//
// state.jobs (personal; see shared.js):
//   lastShiftDay   the day you last worked (one shift a day, anywhere)
//   places         "q,r" -> { shifts, errandsDone, sinceErrand, firedUntil, rank }
//   gifts          job id -> true, once given
//   errand         { village, name, job, bring, lent, given, due, level } | null
//   owed           [{ village, name, items }]: lent tools kept past a deadline
//   bedDay         the day whose night you sleep free at the inn you worked

import {
  VILLAGE_JOBS, JOB_RANKS, JOB_XP_CAP, JOB_SHIFT_TURNS, JOB_XP_PER_SHIFT,
} from '../../data/game_data.js';
import { DAY_TURNS, TURNS_PER_DAY, dayOf, moonOf, itemName } from './state.js';
import { addXp, levelOf } from './skills.js';
import { addItem, removeItem, countItem, hasRoomFor, lentCount } from './inventory.js';
import { villageKey, isRaided, sellPrice, kindOf } from './economy.js';

export { JOB_SHIFT_TURNS };

/** Turns you have to bring an errand back: two days. */
export const ERRAND_TURNS = 2 * TURNS_PER_DAY;
/** Let go for missing a deadline: no work there for three days. */
export const FIRED_TURNS = 3 * TURNS_PER_DAY;
/** Once an apprentice, the chance a finished shift ends with an errand. */
export const ERRAND_CHANCE = 0.4;
/** ...and it is certain after this many shifts there without one. */
export const ERRAND_EVERY = 3;
/** What a Journeyman pays for the village's own goods. */
export const STAFF_PRICE = 0.75;
/** The inn's evening shift starts in the last turns of the afternoon (turn in day). */
export const INN_FROM = DAY_TURNS - 3;
export const INN_TO = DAY_TURNS - 1;
/** A day shift needs this many daylight turns left to start. */
const DAY_START_BY = DAY_TURNS - JOB_SHIFT_TURNS;

export function ensureJobs(state) {
  state.jobs ||= {};
  const j = state.jobs;
  j.places ||= {};
  j.gifts ||= {};
  j.owed ||= [];
  if (j.errand === undefined) j.errand = null;
  return j;
}

/** The job a village offers, if any (herbalists don't hire). */
export const jobOf = feature => (feature?.type === 'village' ? VILLAGE_JOBS[feature.kind] || null : null);

function place(state, key) {
  const j = ensureJobs(state);
  j.places[key] ||= { shifts: 0, errandsDone: 0, sinceErrand: 0, firedUntil: -1 };
  return j.places[key];
}

/** 'hand' | 'apprentice' | 'journeyman' at the village at `key`. */
export function rankAt(state, key) {
  const p = ensureJobs(state).places[key];
  if (!p) return 'hand';
  const jm = JOB_RANKS.journeyman;
  if (p.shifts >= jm.shifts && p.errandsDone >= (jm.errands || 0)) return 'journeyman';
  if (p.shifts >= JOB_RANKS.apprentice.shifts) return 'apprentice';
  return 'hand';
}

export const RANK_NAMES = { hand: 'Hand', apprentice: 'Apprentice', journeyman: 'Journeyman' };

/** Gold for a full shift at this rank. */
export const payFor = (job, rank) => job.pay + (rank === 'apprentice' ? 1 : rank === 'journeyman' ? 2 : 0);

/** Does the work still teach you? Not past the cap. */
export const teaches = (state, job) => !!job.skill && levelOf(state, job.skill) < JOB_XP_CAP;

/** A Journeyman's price for one of the village's own goods. */
export function staffPrice(state, col, itemId, price) {
  if (rankAt(state, villageKey(col.q, col.r)) !== 'journeyman') return price;
  if (!kindOf(col.feature).sells.includes(itemId)) return price;
  return Math.max(1, Math.floor(price * STAFF_PRICE));
}

/** Can you work a shift here now? { ok, job, key } or { ok: false, reason }. */
export function canWork(state, col) {
  const job = jobOf(col?.feature);
  if (!job) return { ok: false, reason: 'Nobody here is hiring.' };
  const key = villageKey(col.q, col.r);
  const j = ensureJobs(state);
  const p = j.places[key];
  const turn = Math.floor(state.turn || 0);
  if (p && p.firedUntil > turn) {
    return { ok: false, reason: `The ${job.master} turns away from you. You will not be taken on here again for some days yet.` };
  }
  if (isRaided(state, col.q, col.r)) return { ok: false, reason: 'The raiders have been through. Nobody is working today.' };
  const { day, turnInDay } = dayOf(state);
  if (j.lastShiftDay === day) return { ok: false, reason: 'You have worked your half-day. The rest of it is your own.' };
  if (job.shift === 'evening') {
    const m = moonOf(state);
    if (m.phase !== 'fair') return { ok: false, reason: 'Not tonight. The whole village is barring its doors against the raid.' };
    if (turnInDay < INN_FROM) return { ok: false, reason: 'The supper trade starts late in the afternoon. Come back then.' };
    if (turnInDay > INN_TO) return { ok: false, reason: 'The supper trade is already under way. Come back tomorrow afternoon.' };
  } else if (turnInDay > DAY_START_BY) {
    return { ok: false, reason: turnInDay >= DAY_TURNS
      ? 'The workshop is shut for the night. Come back in the morning.'
      : 'Too little daylight left for a half-day\'s work. Come back in the morning.' };
  }
  return { ok: true, job, key };
}

/** Clock in: the day's shift is spent, whether you finish it or not. */
export function startShift(state, col) {
  const check = canWork(state, col);
  if (!check.ok) return check;
  ensureJobs(state).lastShiftDay = dayOf(state).day;
  return {
    ok: true,
    shift: { key: check.key, job: check.job, name: col.feature.name, turns: JOB_SHIFT_TURNS, done: 0, hp: state.hp },
  };
}

/**
 * Clock out. A full shift (`shift.done >= shift.turns`) pays in full and counts
 * for rank, trust, the gift and errands; a cut-short one pays for the turns put in.
 * Returns what happened, for the UI to say.
 */
export function endShift(state, col, shift, rng = Math.random) {
  const { job, key } = shift;
  const full = shift.done >= shift.turns;
  const p = place(state, key);
  const before = rankAt(state, key);
  const out = { full, job, gold: 0, goods: [], xp: 0, levels: [], trusted: false, rank: before, promoted: null, gift: null, errand: null, bed: false };

  out.gold = full ? payFor(job, before) : Math.floor(payFor(job, before) * shift.done / shift.turns);
  state.gold = (state.gold || 0) + out.gold;
  if (!full) return out;

  for (const [id, qty] of Object.entries(job.goods || {})) {
    const n = addItem(state, id, qty);
    if (n) out.goods.push({ id, qty: n });
  }
  if (teaches(state, job)) {
    out.xp = JOB_XP_PER_SHIFT;
    out.levels = addXp(state, job.skill, JOB_XP_PER_SHIFT);
  }
  // A finished shift is as good as a favour: they trust you now.
  state.trust ||= {};
  if (!state.trust[key]?.done) {
    state.trust[key] = { ...(state.trust[key] || {}), done: true };
    out.trusted = true;
  }
  if (job.bed) {
    ensureJobs(state).bedDay = dayOf(state).day;
    ensureJobs(state).bedAt = key;
    out.bed = true;
  }

  p.shifts += 1;
  p.sinceErrand += 1;
  Object.assign(out, promote(state, key, job, before));

  // An apprentice is sent on errands now and then; never two at once.
  const j = ensureJobs(state);
  if (out.rank !== 'hand' && !j.errand && (p.sinceErrand >= ERRAND_EVERY || rng() < ERRAND_CHANCE)) {
    out.errand = giveErrand(state, col, job);
  }
  return out;
}

/** Rank up if the time served says so, with the gift at Journeyman. */
function promote(state, key, job, before) {
  const rank = rankAt(state, key);
  const res = { rank, promoted: rank !== before ? rank : null, gift: null };
  const j = ensureJobs(state);
  if (rank === 'journeyman' && job.gift && !j.gifts[job.id]) {
    j.gifts[job.id] = true;
    // The pack may be full; the master waits for you to make room.
    if (addItem(state, job.gift, 1)) res.gift = job.gift;
    else { j.gifts[job.id] = false; res.giftWaiting = job.gift; }
  }
  return res;
}

/** The errand for your level in the trade. */
export function errandFor(state, job) {
  const skill = job.errandSkill || job.skill;
  let level = Math.max(1, Math.min(3, levelOf(state, skill)));
  // Ore wants Lore; without it, the errand a level down.
  while (level > 1 && job.errands[level]?.needs) {
    const [, s, l] = job.errands[level].needs.split(':');
    if (levelOf(state, s) >= Number(l)) break;
    level -= 1;
  }
  return { level, ...job.errands[level] };
}

/** Do you carry one of these (any-of list)? Your own, not something already lent. */
const hasAny = (state, ids) => ids.some(id => countItem(state, id) - lentCount(state, id) > 0);

/** Send the apprentice out. Lends the tools you don't have. Null if there's no room for them. */
export function giveErrand(state, col, job) {
  const e = errandFor(state, job);
  const lend = [];
  for (const entry of e.lend || []) {
    const ids = Array.isArray(entry) ? entry : [entry];
    if (!hasAny(state, ids)) lend.push(ids[0]);
  }
  if (lend.some(id => !hasRoomFor(state, id, 1))) return null;
  for (const id of lend) addItem(state, id, 1);
  const turn = Math.floor(state.turn || 0);
  const errand = {
    village: villageKey(col.q, col.r), name: col.feature.name, job: job.id, kind: col.feature.kind,
    bring: { ...e.bring }, lent: lend, given: turn, due: turn + ERRAND_TURNS, level: e.level,
  };
  ensureJobs(state).errand = errand;
  place(state, errand.village).sinceErrand = 0;
  return errand;
}

/** "4 Log, 2 Ore". */
export const bringText = bring => Object.entries(bring).map(([id, n]) => `${n} ${itemName(id)}`).join(', ');

// ----------------------------------------------------------- how people say it

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
/** Goods as a person would ask for them: [singular, plural]. */
const SPOKEN = {
  log: ['log', 'logs'], plank: ['plank', 'planks'], block: ['dressed stone', 'dressed stones'],
  stone: ['stone', 'stones'], ore: ['lump of ore', 'lumps of ore'], berries: ['handful of berries', 'handfuls of berries'],
  grain: ['sheaf of grain', 'sheaves of grain'], bread: ['loaf', 'loaves'], fish: ['fish', 'fish'],
  meat: ['cut of meat', 'cuts of meat'], meal: ['hot meal', 'hot meals'], bow: ['bow', 'bows'],
};

/** "four logs", "a loaf", "two cuts of meat". */
export function spokenGoods(bring) {
  const parts = Object.entries(bring).map(([id, n]) => {
    const [one, many] = SPOKEN[id] || [itemName(id).toLowerCase(), `${itemName(id).toLowerCase()}s`];
    if (n === 1) return `${/^[aeiou]/.test(one) ? 'an' : 'a'} ${one}`;
    return `${NUMBER_WORDS[n] || n} ${many}`;
  });
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0] || '';
}

/** A turn, said as a time of day: "first light", "midday", "nightfall"... */
function partOfDay(turnInDay) {
  if (turnInDay < 2) return 'first light';
  if (turnInDay < 5) return 'mid-morning';
  if (turnInDay < 8) return 'midday';
  if (turnInDay < DAY_TURNS) return 'late afternoon';
  if (turnInDay < DAY_TURNS + 2) return 'nightfall';
  if (turnInDay < DAY_TURNS + 7) return 'the dead of night';
  return 'the small hours';
}

/** When something is due, as a person would say it: "the day after tomorrow, around midday". */
export function dueText(state, due) {
  const now = Math.floor(state.turn || 0);
  if (due <= now) return 'now';
  const today = dayOf(state).day;
  const then = dayOf({ turn: due });
  const days = then.day - today;
  const when = partOfDay(then.turnInDay);
  const at = when === 'first light' || when === 'nightfall' ? `at ${when}` : `around ${when}`;
  if (days <= 0) return `today, ${at}`;
  if (days === 1) return `tomorrow, ${at}`;
  if (days === 2) return `the day after tomorrow, ${at}`;
  return `in ${NUMBER_WORDS[days] || days} days`;
}

/** What you still need for the errand: [{ id, need, have }]. */
export function errandShort(state) {
  const e = ensureJobs(state).errand;
  if (!e) return [];
  return Object.entries(e.bring).map(([id, need]) => {
    // A lent tool you are carrying back is not part of the goods.
    const have = Math.max(0, countItem(state, id) - lentCount(state, id));
    return { id, need, have };
  }).filter(x => x.have < x.need);
}

/**
 * Hand the errand in at its village: the goods go, the lent tools go back, and
 * you are paid what the goods would fetch there, plus a little.
 */
export function handIn(state, col) {
  const j = ensureJobs(state);
  const e = j.errand;
  const key = villageKey(col.q, col.r);
  if (!e || e.village !== key) return { ok: false, reason: 'You have no errand for this village.' };
  const short = errandShort(state);
  if (short.length) return { ok: false, reason: `You are still short: ${spokenGoods(Object.fromEntries(short.map(s => [s.id, s.need - s.have])))}.` };
  const job = VILLAGE_JOBS[e.kind] || jobOf(col.feature);
  let worth = 0;
  for (const [id, n] of Object.entries(e.bring)) {
    removeItem(state, id, n);
    worth += sellPrice(col.feature, id) * n;
  }
  j.errand = null;          // the tools are no longer lent...
  for (const id of e.lent) removeItem(state, id, 1); // ...because they go back
  const gold = worth + 3;
  state.gold = (state.gold || 0) + gold;
  const out = { ok: true, gold, xp: 0, levels: [], returned: e.lent, thanks: [] };
  if (job && teaches(state, job)) { out.xp = 3; out.levels = addXp(state, job.skill, 3); }
  for (const [id, qty] of Object.entries(job?.thanks || {})) {
    const n = addItem(state, id, qty);
    if (n) out.thanks.push({ id, qty: n });
  }
  const p = place(state, key);
  const before = rankAt(state, key);
  p.errandsDone += 1;
  if (job) Object.assign(out, promote(state, key, job, before));
  return out;
}

/**
 * Called as turns pass: an errand past its deadline costs you the job, and the
 * tool is owed. Returns the lapsed errand, or null.
 */
export function checkErrandDeadline(state) {
  const j = ensureJobs(state);
  const e = j.errand;
  if (!e || Math.floor(state.turn || 0) <= e.due) return null;
  j.errand = null;
  place(state, e.village).firedUntil = Math.floor(state.turn || 0) + FIRED_TURNS;
  if (e.lent.length) j.owed.push({ village: e.village, name: e.name, items: [...e.lent] });
  return e;
}

/** Take back, from pack, worn gear or stash, what you kept past a deadline. */
export function confiscate(state, col) {
  const j = ensureJobs(state);
  const key = villageKey(col.q, col.r);
  const debts = j.owed.filter(o => o.village === key);
  if (!debts.length) return [];
  j.owed = j.owed.filter(o => o.village !== key);
  const taken = [];
  for (const d of debts) {
    for (const id of d.items) {
      if (removeItem(state, id, 1)) { taken.push(id); continue; }
      const i = (state.stash || []).findIndex(s => s?.id === id);
      if (i >= 0) {
        state.stash[i].qty -= 1;
        if (state.stash[i].qty <= 0) state.stash[i] = null;
        taken.push(id);
      }
    }
  }
  return taken;
}

/** A free bed tonight: you worked the inn's evening shift today. */
export const freeBedTonight = (state, key) => {
  const j = ensureJobs(state);
  return j.bedDay === dayOf(state).day && dayOf(state).isNight && (key == null || j.bedAt === key);
};

/** Is anything you carry lent? For the pack's tags. */
export const isLentOut = (state, id) => lentCount(state, id) > 0 && countItem(state, id) <= lentCount(state, id);

// ------------------------------------------------------------- the masters

/** What the masters say while you work, a line every couple of turns. */
export const MASTER_LINES = {
  bakery: [
    'Knead it like you mean it. The dough can tell.',
    'Keep the oven fed, but not greedy: an even heat makes an even crust.',
    'That loaf has a good shape to it. You have the hands for this.',
    "Flour on your nose already. You'll do.",
    'Whole village eats what comes out of this oven. That is a fine thing to be part of.',
    'Turn the trays, mind the back corner: it always runs hot.',
    'You are quicker than yesterday. I noticed.',
    'Smell that? That is what an honest morning smells like.',
  ],
  inn: [
    'Mugs to the long table, stew to the fire side. You have it.',
    'Smile at the fishermen. They tip in stories, and the stories are worth it.',
    'Mind the third stair, it creaks. Every guest hears it.',
    'Keep the hearth bright. A warm room fills itself.',
    'You carry a tray better than my last three hands put together.',
    'Watch how the old cook seasons the pot. That is half of homesteading, right there.',
    'Rooms swept, beds turned. You will sleep well in one of them tonight.',
    "Nobody leaves here hungry. That's the whole of the trade.",
  ],
  carpenter: [
    'Follow the grain, not the line you drew. The wood knows better.',
    'Measure twice. Then once more, because it is cheap.',
    'Good. Let the tool do the work; you only steer it.',
    'Every peg you cut today holds up somebody\'s roof tomorrow.',
    'That joint is snug. I have seen journeymen do worse.',
    'Sweep the shavings, they make the best kindling in the valley.',
    'Keep that edge keen. A dull blade is how fingers go missing.',
    'You are getting a feel for it. Wood talks, if you listen.',
  ],
  mason: [
    'Strike where the stone wants to split. Find the line first.',
    'A wall is only as good as its lowest course. Set it true.',
    'Steady hammer, steady hand. There, see how clean it breaks?',
    'Square it, then square it again. Raiders find the crooked stone.',
    'You are learning to read rock. That is most of the craft.',
    'Lift with the legs. Masons who forget that do not stay masons.',
    'Fine dust on everything. That is how you know it was a good day.',
    'That block would sit in a castle wall. Well done.',
  ],
  smithy: [
    'Watch the colour, not the clock. Cherry red, then strike.',
    'Work the bellows steady. Fire is a creature that likes rhythm.',
    'Iron forgives nothing and remembers everything. Strike true.',
    'Quench it now. Hear it sing? That is a good temper.',
    'Keep the tongs firm. Hot metal goes where it pleases otherwise.',
    'You have a smith\'s patience. Most do not.',
    'Every axe in this valley started as a lump of rock in somebody\'s hand.',
    'Sweat and soot, the two marks of an honest smith. You wear them well.',
  ],
};

/** A line from the master, now and then. */
export function masterLine(job, i, rng = Math.random) {
  const lines = MASTER_LINES[job.id] || [];
  return lines.length ? lines[Math.floor(rng() * lines.length)] : '';
}

/** What the master says at the moments that matter. */
export function milestoneLine(job, what, extra = {}) {
  const m = job.master;
  switch (what) {
    case 'first': return `The ${m} looks you over. "I don't know you, but I can use another pair of hands. Show me what yours can do."`;
    case 'trusted': return `"You'll do. Our stalls are open to you now, and so is our door."`;
    case 'apprentice': return `"You keep coming back, and you keep getting better. From today, you are my apprentice."`;
    case 'journeyman': return `"You have earned the name of journeyman.${extra.gift ? ` This ${itemName(extra.gift).toLowerCase()} is yours now. Make good things with it."` : ' From now on you pay at our stalls what our own people pay."'}`;
    case 'capped': return `"There is little more I can teach you at this bench. The rest comes from your own hands."`;
    case 'errand': {
      const tools = (extra.lent || []).map(id => itemName(id).toLowerCase()).join(' and ');
      const one = Object.values(extra.bring || {}).reduce((a, b) => a + b, 0) === 1;
      return `"Bring me ${spokenGoods(extra.bring)}. I need ${one ? 'it' : 'them'} here ${extra.when ? `by ${extra.when}` : 'soon'}.${tools ? ` Take my ${tools}, and see that ${extra.lent.length > 1 ? 'they come' : 'it comes'} back to me."` : '"'}`;
    }
    case 'handed': return `"Just what I needed. Here, this is yours."`;
    case 'fired': return `"I asked for them in good time, and you never came. Find your work elsewhere for a while."`;
    case 'taken': return `"You kept my ${extra.items.map(id => itemName(id).toLowerCase()).join(' and ')}. I will have ${extra.items.length > 1 ? 'those' : 'that'} back."`;
    default: return '';
  }
}
