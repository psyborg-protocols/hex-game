// chime.js
// The sound of finding something. Synthesised, so there is no asset to ship:
// a few sine partials with a quick attack and a long tail, like a struck glass.
// Better finds ring more notes. Quiet by design; it is a cue, not a fanfare.

// Browsers refuse to start audio before the player has touched the page, and
// complain if asked. So nothing is made until the first click or key; a find
// in the first seconds after loading simply goes unheard.
let ac = null;
let allowed = false;
if (typeof window !== 'undefined') {
  const allow = () => { allowed = true; };
  window.addEventListener('pointerdown', allow, { once: true, capture: true });
  window.addEventListener('keydown', allow, { once: true, capture: true });
}

function audio() {
  if (ac || !allowed) return ac;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  ac = new Ctx();
  return ac;
}

// A pentatonic run upward from A4, so any subset sounds intended.
const SCALE = [440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66];

const PHRASES = {
  tick: [[5]],
  copper: [[2], [4]],
  silver: [[2], [4], [6]],
  gold: [[0], [2], [4], [7, 5]],
  achievement: [[1], [4, 6]],
  village: [[0], [3]],
  // Low and falling: something is wrong.
  raid: [[3], [1], [0]],
};

function bell(ctx, freq, at, gain) {
  const out = ctx.createGain();
  out.gain.setValueAtTime(0, at);
  out.gain.linearRampToValueAtTime(gain, at + 0.01);
  out.gain.exponentialRampToValueAtTime(0.0001, at + 1.4);
  out.connect(ctx.destination);
  // A fundamental and a quiet inharmonic partial: the partial is what makes it
  // read as a bell rather than a beep.
  for (const [mult, amp] of [[1, 1], [2.76, 0.18]]) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq * mult;
    g.gain.value = amp;
    o.connect(g).connect(out);
    o.start(at);
    o.stop(at + 1.5);
  }
}

/** Play the phrase for a kind of moment. Silently does nothing without audio. */
export function chime(kind, volume = 0.08) {
  try {
    const ctx = audio();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const phrase = PHRASES[kind] || PHRASES.copper;
    const t0 = ctx.currentTime + 0.02;
    phrase.forEach((notes, i) => {
      for (const n of notes) bell(ctx, SCALE[n], t0 + i * 0.11, volume / notes.length);
    });
  } catch { /* sound is a nicety; never let it break the game */ }
}
