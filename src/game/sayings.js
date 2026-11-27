// sayings.js
// What comes to mind when you sit somewhere beautiful and let it settle.
//
// Old wisdom from Pirkei Avot, Kohelet and Mishlei, put plainly in the
// Wanderer's quiet voice. They are paraphrases, not translations: short,
// simple, and true to the source. Verses use the Hebrew numbering (as on
// Sefaria); Avot follows the standard mishnah numbering.
//
// Each sitting draws one you have not heard lately, so they cycle through
// before any comes round again.

export const SAYINGS = [
  // Pirkei Avot
  { text: 'Think slowly before you judge...', ref: 'Avot 1:1' },
  { text: 'The world stands on three things: learning, devotion, and kindness to one another...', ref: 'Avot 1:2' },
  { text: 'Let your door stand open, and let the poor sit at your table...', ref: 'Avot 1:5' },
  { text: 'Find yourself a teacher, make yourself a friend, and give everyone the benefit of the doubt...', ref: 'Avot 1:6' },
  { text: 'Love work...', ref: 'Avot 1:10' },
  { text: 'Love peace, and go out looking for it...', ref: 'Avot 1:12' },
  { text: 'If I am not for myself, who will be? If I am only for myself, what am I? And if not now, when?', ref: 'Avot 1:14' },
  { text: 'Say little, do much, and greet everyone with a kind face...', ref: 'Avot 1:15' },
  { text: 'I have found nothing better for a person than silence...', ref: 'Avot 1:17' },
  { text: 'It is not the talking that matters, but the doing...', ref: 'Avot 1:17' },
  { text: 'Learning goes well with a trade. Between the two, there is no room left for mischief...', ref: 'Avot 2:2' },
  { text: "Don't judge another until you have stood where they stand...", ref: 'Avot 2:4' },
  { text: "Don't say you will learn when you have time. You may never have the time...", ref: 'Avot 2:4' },
  { text: 'The shy cannot learn, and the short-tempered cannot teach...', ref: 'Avot 2:5' },
  { text: 'Where no one is acting rightly, be the one who does...', ref: 'Avot 2:5' },
  { text: "Hold your friend's good name as dear as your own, and be slow to anger...", ref: 'Avot 2:10' },
  { text: 'The day is short, and the work is great...', ref: 'Avot 2:15' },
  { text: "The job isn't yours to finish, but neither can you stop the work...", ref: 'Avot 2:16' },
  { text: 'One whose deeds are greater than their wisdom, their wisdom will last...', ref: 'Avot 3:9' },
  { text: 'Wisdom without deeds is a tree of many branches and few roots. The first wind blows it over...', ref: 'Avot 3:17' },
  { text: 'Who is wise? One who learns from everyone...', ref: 'Avot 4:1' },
  { text: 'Who is strong? One who masters their own desires...', ref: 'Avot 4:1' },
  { text: 'Who is rich? One who is glad of what they have...', ref: 'Avot 4:1' },
  { text: 'Who is honoured? One who honours others...', ref: 'Avot 4:1' },
  { text: 'Run to do a small good deed. One good deed brings on another...', ref: 'Avot 4:2' },
  { text: 'Look down on no one, and wave nothing aside. Everyone has their hour, and everything its place...', ref: 'Avot 4:3' },
  { text: 'Be the first to greet everyone you meet...', ref: 'Avot 4:15' },
  { text: "Don't look at the jug, but at what is in it...", ref: 'Avot 4:20' },
  { text: "The wise don't hurry to answer, and say “I don't know” when they don't...", ref: 'Avot 5:7' },
  { text: 'Turn it over, and turn it over again. Everything is in it...', ref: 'Avot 5:22' },
  { text: 'The reward is as great as the effort...', ref: 'Avot 5:23' },

  // Kohelet
  { text: 'One generation goes, another comes, and the earth stays as it is...', ref: 'Kohelet 1:4' },
  { text: 'All the rivers run to the sea, and still the sea is never full...', ref: 'Kohelet 1:7' },
  { text: 'There is nothing new under the sun...', ref: 'Kohelet 1:9' },
  { text: 'Wisdom is better than folly, as light is better than darkness...', ref: 'Kohelet 2:13' },
  { text: 'There is a time for everything, and a season for every purpose...', ref: 'Kohelet 3:1' },
  { text: 'A time to plant, and a time to pull up what was planted...', ref: 'Kohelet 3:2' },
  { text: 'Better one handful with quiet than two handfuls with toil, and chasing the wind...', ref: 'Kohelet 4:6' },
  { text: 'Two are better than one. If one falls, the other can help them up...', ref: 'Kohelet 4:9' },
  { text: 'A cord of three strands is not quickly broken...', ref: 'Kohelet 4:12' },
  { text: 'Sweet is the sleep of one who works, whether they ate little or much...', ref: 'Kohelet 5:11' },
  { text: 'A good name is better than fine oil...', ref: 'Kohelet 7:1' },
  { text: 'The end of a thing is better than its beginning, and patience is better than pride...', ref: 'Kohelet 7:8' },
  { text: 'Whatever your hand finds to do, do it with all your strength...', ref: 'Kohelet 9:10' },
  { text: 'Quiet words from the wise are heard better than a ruler shouting at fools...', ref: 'Kohelet 9:17' },
  { text: 'Wisdom is better than weapons of war...', ref: 'Kohelet 9:18' },
  { text: 'If the axe is blunt and the edge goes unsharpened, you must work all the harder...', ref: 'Kohelet 10:10' },
  { text: 'Send your bread out upon the waters. After many days, you will find it again...', ref: 'Kohelet 11:1' },
  { text: 'Whoever watches the wind will never sow, and whoever watches the clouds will never reap...', ref: 'Kohelet 11:4' },
  { text: 'Sow your seed in the morning, and in the evening, keep your hand at work...', ref: 'Kohelet 11:6' },
  { text: 'The light is sweet, and it is good for the eyes to see the sun...', ref: 'Kohelet 11:7' },

  // Mishlei
  { text: 'Above all else, guard your heart. Everything you do flows from it...', ref: 'Mishlei 4:23' },
  { text: 'Go and watch the ant, and learn from her ways...', ref: 'Mishlei 6:6' },
  { text: 'She gathers her food in the summer, and stores it at harvest...', ref: 'Mishlei 6:8' },
  { text: 'A lazy hand makes a poor house, and a busy hand makes a rich one...', ref: 'Mishlei 10:4' },
  { text: 'Whoever gives water to others will have water given to them...', ref: 'Mishlei 11:25' },
  { text: 'Whoever works their land will have plenty of bread...', ref: 'Mishlei 12:11' },
  { text: 'Walk with the wise, and you will grow wise...', ref: 'Mishlei 13:20' },
  { text: 'A calm heart is life to the body...', ref: 'Mishlei 14:30' },
  { text: 'A gentle answer turns anger away...', ref: 'Mishlei 15:1' },
  { text: 'Pride comes before a fall...', ref: 'Mishlei 16:18' },
  { text: 'Better to be slow to anger than to be mighty, and to master yourself than to take a city...', ref: 'Mishlei 16:32' },
  { text: 'A glad heart is good medicine...', ref: 'Mishlei 17:22' },
  { text: 'A good name is worth more than great riches...', ref: 'Mishlei 22:1' },
  { text: 'The just may fall seven times, and rise again...', ref: 'Mishlei 24:16' },
  { text: 'Ready your fields first, and afterwards build your house...', ref: 'Mishlei 24:27' },
  { text: 'A word spoken at the right time is like golden apples set in silver...', ref: 'Mishlei 25:11' },
  { text: 'Whoever digs a pit will fall into it...', ref: 'Mishlei 26:27' },
  { text: "Don't boast about tomorrow. You don't know what a day will bring...", ref: 'Mishlei 27:1' },
  { text: 'As iron sharpens iron, so one person sharpens another...', ref: 'Mishlei 27:17' },
  { text: 'Know your flocks well, and look after your herds...', ref: 'Mishlei 27:23' },
];

/**
 * The next saying for this player: a random one of those not heard lately.
 * Remembers the order in `state.sayings`, so the cycle survives a reload.
 */
export function nextSaying(state, random = Math.random) {
  const heard = (state.sayings ||= []);
  if (heard.length >= SAYINGS.length) heard.length = 0;
  const fresh = SAYINGS.map((_, i) => i).filter(i => !heard.includes(i));
  const i = fresh[Math.floor(random() * fresh.length)];
  heard.push(i);
  return SAYINGS[i];
}

/** As it is shown: the saying, then its source. */
export const sayingLine = s => `“${s.text}”  ~${s.ref}`;
