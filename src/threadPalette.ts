import {t} from './i18n.js';
// The thread colours the picker offers, with the names shown for them, and the recently used ones.
// The React thread picker and the thread selects read these; app.js no longer keeps its own copy.
export const THREAD_PALETTE: Array<[string, string]> = [['White','#ffffff'],['Ivory','#f3ead7'],['Cream','#efe0b9'],['Light grey','#c9cccf'],['Silver','#a4a8ae'],['Grey','#7a7f87'],['Charcoal','#3f4349'],['Black','#111111'],
 ['Pale pink','#f6cbd4'],['Pink','#ec8fa7'],['Hot pink','#d9467f'],['Coral','#d9897e'],['Red','#c8281e'],['Cherry','#9c1b25'],['Burgundy','#6a1a2a'],['Rust','#a8452b'],
 ['Peach','#f4b183'],['Orange','#ec7a1c'],['Honey','#d3ad61'],['Gold','#c9962b'],['Yellow','#f2d21b'],['Lemon','#f7ec7a'],['Mustard','#b88a14'],['Tan','#c8a679'],
 ['Mint','#bfe3c9'],['Sage','#89a377'],['Lime','#9ccb3b'],['Green','#3f9b4f'],['Forest','#527461'],['Emerald','#1f7a52'],['Olive','#7a7a2d'],['Dark green','#1f4a33'],
 ['Baby blue','#bcd8ec'],['Sky','#6fb1e0'],['Turquoise','#28a7b0'],['Teal','#1f7f86'],['Blue','#2f6fc4'],['Royal','#2347a8'],['Navy','#17275c'],['Denim','#4a6a94'],
 ['Lavender','#c6b3e0'],['Lilac','#a37fcf'],['Purple','#6d3aa8'],['Plum','#5a2a58'],['Brown','#7a4a2a'],['Chocolate','#4a2c1b'],['Beige','#d9c3a0'],['Skin','#e8b894']];

/** The name of a thread colour: the palette name for a colour in it, the nearest palette name for a close one, else the hex. */
export function threadName(hex: string | null | undefined): string {
  const h = String(hex || '').toLowerCase(), exact = THREAD_PALETTE.find(([, x]) => x === h);
  if (exact) return t(exact[0]);
  const rgb = (v: string) => [1, 3, 5].map(i => parseInt(v.slice(i, i + 2), 16));
  if (!/^#[0-9a-f]{6}$/.test(h)) return h;
  const a = rgb(h);
  let best = '', bd = 1e9;
  for (const [n, x] of THREAD_PALETTE) {
    const b = rgb(x), d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    if (d < bd) { bd = d; best = n; }
  }
  return bd < 28 ? t(best) : h;
}

/** The recently used thread colours, newest first, at most eight. */
export function recents(): string[] {
  try {
    return JSON.parse(localStorage.getItem('welcome.threads.recent') || '[]').filter((h: string) => /^#[0-9a-f]{6}$/i.test(h)).slice(0, 8);
  } catch {
    return [];
  }
}

/** Remembers a thread colour as the most recent one. */
export function remember(hex: string): void {
  try {
    localStorage.setItem('welcome.threads.recent', JSON.stringify([hex, ...recents().filter(h => h.toLowerCase() !== hex.toLowerCase())].slice(0, 8)));
  } catch {}
}
