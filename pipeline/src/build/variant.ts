import type { SongVariant } from "../model/types";

/**
 * Detect whether a song title marks a special edition (Remix / Short Cut /
 * Full Song). The marker sits at the very end of the title and may be wrapped
 * in parens/brackets or framed by dashes/tildes, e.g.
 *   "Teddy Bear (Full Song)", "Euphorianic -Short Cut-",
 *   "Le Nozze di Figaro ~Celebrazione Remix~", "Banya Classic Remix".
 * Returns undefined for ordinary (arcade) songs.
 */
const TAIL = "[)\\]~\\-\\s]*$";
const RULES: [RegExp, SongVariant][] = [
  [new RegExp(`\\bfull\\s?song\\b${TAIL}`, "i"), "FULLSONG"],
  [new RegExp(`\\bfull\\s?ver\\.?${TAIL}`, "i"), "FULLSONG"],
  [new RegExp(`\\bshort\\s?cut\\b${TAIL}`, "i"), "SHORTCUT"],
  [new RegExp(`\\bshort\\s?ver\\.?${TAIL}`, "i"), "SHORTCUT"],
  [new RegExp(`\\bremix\\b${TAIL}`, "i"), "REMIX"],
];

export function classifyVariant(title: string): SongVariant | undefined {
  const t = title.trim();
  for (const [re, v] of RULES) if (re.test(t)) return v;
  return undefined;
}
