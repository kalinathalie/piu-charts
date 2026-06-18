/**
 * Parse `catalog/titles.txt` (PIU Phoenix titles / achievements) into the grouped
 * shape the app renders, resolving each title's chart to a catalog song id so the
 * app can open the song detail ("where to find this chart").
 *
 * Source format: pairs of non-blank, non-`#` lines —
 *   <title header>            e.g. "[BRACKET] Lv.10"  /  "[XX] Double Boss breaker"  /  "Perfect breaker"
 *   [<Song> <S|D><level>] <requirement>   e.g. "[Phalanx D24] SSS Grade or more"
 */
import type { Song } from "../model/types";

export interface AppTitle {
  /** Display name within the category (e.g. "Lv.10", "XX · Double Boss breaker"). */
  name: string;
  /** Resolved catalog song id (omitted when the song isn't in the catalog). */
  songId?: string;
  /** Raw song name from the source (shown when unresolved). */
  songTitle: string;
  /** Chart label, e.g. "S22" / "D24". */
  chartLabel: string;
  /** How to earn the title, e.g. "SSS Grade or more". */
  requirement: string;
}

export interface AppTitleCategory {
  key: string;
  label: string;
  titles: AppTitle[];
}

const SKILL: Record<string, string> = {
  BRACKET: "Bracket",
  HALF: "Half",
  GIMMICK: "Gimmick",
  DRILL: "Drill",
  RUN: "Run",
  TWIST: "Twist",
};
const CATEGORY_LABEL: Record<string, string> = { ...SKILL, BOSS: "Boss Breaker", SPECIAL: "Especiais" };

/** Song names that don't match the catalog by normalized title → explicit id. */
const SONG_ALIAS: Record<string, string> = {
  phalanx: "phalanx_rs2018_edit",
  meteo5cience: "meteo5cience_gadget_mix",
  ignisfatuus: "ignis_fatuus_dm_ashura_mix",
  radetzkycancan: "radezky_can_can",
  loveisadangerzone2trytobpm: "try_to_bpm_love_is_a_danger_zone",
};

/** Normalize a song title for matching: drop diacritics, `#1`, `(feat …)`, punctuation. */
function norm(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/#\d+/g, "")
    .replace(/\(feat[^)]*\)/g, "")
    .replace(/\bfeat\b.*/g, "")
    .replace(/\bft\b.*/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

export function parseTitles(text: string, songs: Pick<Song, "id" | "title">[]): AppTitleCategory[] {
  const byNorm = new Map<string, string>();
  for (const s of songs) {
    const k = norm(s.title);
    if (k && !byNorm.has(k)) byNorm.set(k, s.id);
  }

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  const order: string[] = [];
  const byCat = new Map<string, AppTitle[]>();
  const add = (cat: string, t: AppTitle) => {
    if (!byCat.has(cat)) {
      byCat.set(cat, []);
      order.push(cat);
    }
    byCat.get(cat)!.push(t);
  };

  for (let i = 0; i + 1 < lines.length; i += 2) {
    const header = lines[i];
    const reqLine = lines[i + 1];

    const hm = header.match(/^\[([^\]]+)\]\s*(.*)$/);
    const tag = hm ? hm[1].trim() : null;
    const rest = hm ? hm[2].trim() : header;

    let category: string;
    let name: string;
    if (tag && SKILL[tag.toUpperCase()]) {
      category = tag.toUpperCase();
      name = rest;
    } else if (/boss breaker/i.test(rest)) {
      category = "BOSS";
      name = tag ? `${tag} · ${rest}` : rest;
    } else {
      category = "SPECIAL";
      name = header;
    }

    const rm = reqLine.match(/^\[(.+)\]\s*(.+)$/);
    if (!rm) continue;
    const chartStr = rm[1].trim();
    const requirement = rm[2].trim();
    const cm = chartStr.match(/^(.*?)\s*([SsDd])\s*(\d+)\s*$/);
    if (!cm) continue;
    const songTitle = cm[1].trim();
    const chartLabel = `${cm[2].toUpperCase()}${cm[3]}`;

    const k = norm(songTitle);
    const songId = SONG_ALIAS[k] ?? byNorm.get(k);

    add(category, { name, songId, songTitle, chartLabel, requirement });
  }

  return order.map((key) => ({ key, label: CATEGORY_LABEL[key] ?? key, titles: byCat.get(key)! }));
}
