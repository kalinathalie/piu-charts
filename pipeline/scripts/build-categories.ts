/**
 * Derive each song's arcade song-selection category (genre tab):
 *   K-POP | ORIGINAL | WORLD | JMUSIC | XROSS
 *
 * The arcade groups its by-difficulty browsing by these tabs, in the order
 * K-Pop, Original, World Music, J-Music, XROSS (see the user-facing app).
 *
 * Sources (both cached under .cache/, fetched on demand if missing):
 *  - vgost.fandom.com per-version pages: their "Returning Songs" sections split
 *    the roster into the real 5 arcade categories (incl. J-Music). Authoritative
 *    for songs that returned to some version. Latest version wins on conflict.
 *  - en.namu.wiki Pump It Up song list: its PHOENIX section categorizes the
 *    Phoenix *new* songs (which never appear in a vgost "Returning" section).
 *    namu uses 4 buckets (it folds licensed J-vocal into "World License"), so we
 *    only trust it where vgost is silent, and JMUSIC fixes come from manual.
 *
 * Resolution per song (first hit wins):
 *   1. vgost exact (normalized title)         5-way, authoritative
 *   2. namu exact (normalized title)          new Phoenix songs
 *   3. namu by artist + close title           recovers namu's noisy/translated titles
 *   4. default "ORIGINAL"                      (correct for the in-house back-catalog)
 * Hand corrections live in catalog/categories-manual.json and win at build time
 * (see catalog.ts); this script never touches that file.
 *
 * Writes: catalog/categories.json  ({ "<songId>": "CATEGORY" })
 * Usage:  cd pipeline && npm run ingest:categories   (DRY=1 to preview only)
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { distance } from "fastest-levenshtein";
import { parseSonglist } from "../src/build/parseSonglist.js";
import { classifyVariant } from "../src/build/variant.js";
import type { SongMeta } from "../src/build/catalog.js";
import type { Genre } from "../src/model/types.js";

const pipelineRoot = join(import.meta.dirname, "..");
const cacheDir = join(pipelineRoot, ".cache");
const catalogDir = join(pipelineRoot, "catalog");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

// ---- shared text normalization ----
const EDITION_RE = /\b(short\s?cut|full\s?song|remix|full\s?ver|short\s?ver)\b/i;
function norm(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    // drop annotation parens like "(feat. …)", "(PIU Edit)", "(In Fiction)" so a
    // song collapses to its base — but KEEP "(Short Cut)"/"(Full Song)"/"(Remix)"
    // so an edition never collapses onto (and matches) its base's genre.
    .replace(/\(([^)]*)\)/g, (m, inner) => (EDITION_RE.test(inner) ? ` ${inner} ` : ""))
    .replace(/\bfeat\b.*/g, "")
    .replace(/\bft\b.*/g, "")
    .replace(/[^a-z0-9]+/g, "");
}
function normArtist(a: string): string {
  return a
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&amp;/g, "&")
    .replace(/[^a-z0-9]+/g, "");
}

// ---- vgost (MediaWiki wikitext via action=parse) ----
const VGOST_PAGES: { key: string; page: string }[] = [
  // priority order: latest version first (later versions win on conflict)
  { key: "phoenix", page: "Pump_It_Up_Phoenix" },
  { key: "xx", page: "Pump_It_Up_XX" },
  { key: "prime2", page: "Pump_It_Up_Prime_2" },
  { key: "prime", page: "Pump_It_Up_Prime" },
  { key: "fiesta2", page: "Pump_It_Up_Fiesta_2" },
  { key: "fiesta", page: "Pump_It_Up_Fiesta" },
  { key: "nxa", page: "Pump_It_Up_NX_Absolute" },
  { key: "zero", page: "Pump_It_Up_Zero" },
];

const VGOST_CAT: Record<string, Genre> = {
  "k-pop": "K-POP",
  "k-pop channel": "K-POP",
  "k-pop style": "K-POP",
  "original tunes": "ORIGINAL",
  "banya channel": "ORIGINAL",
  "pump it up original": "ORIGINAL",
  "world music": "WORLD",
  "pop channel": "WORLD",
  "pop style": "WORLD",
  "j-music": "JMUSIC",
  xross: "XROSS",
};

async function vgostWikitext(key: string, page: string): Promise<string> {
  const file = join(cacheDir, `vgost_${key}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8")).parse.wikitext;
  const url = `https://vgost.fandom.com/api.php?action=parse&page=${page}&prop=wikitext&format=json`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  const json: any = await res.json();
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(file, JSON.stringify(json));
  return json.parse.wikitext as string;
}

function cleanWikiCell(c: string): string {
  return c
    .replace(/<ref.*?<\/ref>/gs, "")
    .replace(/<ref[^>]*\/>/gs, "")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/'''?/g, "")
    .replace(/<br\s*\/?>/g, " ")
    .replace(/\[version[^\]]*\]/gi, "")
    .trim();
}

/** Song titles = 2nd cell of each row in the section's first wikitable. */
function wikiTableSongs(body: string): string[] {
  const ti = body.indexOf("{|");
  if (ti < 0) return [];
  const te = body.indexOf("|}", ti);
  const tbl = body.slice(ti, te < 0 ? body.length : te);
  const out: string[] = [];
  for (const block of tbl.split(/\n\|-/).slice(1)) {
    const cells: string[] = [];
    let cur: string | null = null;
    for (const ln of block.split("\n")) {
      if (ln.startsWith("|")) {
        if (cur !== null) cells.push(cur);
        cur = ln.slice(1);
      } else if (ln.startsWith("!")) {
        continue;
      } else if (cur !== null) {
        cur += "\n" + ln;
      }
    }
    if (cur !== null) cells.push(cur);
    if (cells.length >= 2) {
      const s = cleanWikiCell(cells[1]);
      if (s) out.push(s);
    }
  }
  return out;
}

async function buildVgostMap(): Promise<Map<string, Genre>> {
  const map = new Map<string, Genre>();
  for (const { key, page } of VGOST_PAGES) {
    const wt = await vgostWikitext(key, page);
    const headers = [...wt.matchAll(/^(={2,4})\s*(.+?)\s*\1\s*$/gm)];
    for (let i = 0; i < headers.length; i++) {
      const cat = VGOST_CAT[headers[i][2].trim().toLowerCase()];
      if (!cat) continue;
      const start = headers[i].index! + headers[i][0].length;
      const end = i + 1 < headers.length ? headers[i + 1].index! : wt.length;
      for (const song of wikiTableSongs(wt.slice(start, end))) {
        const k = norm(song);
        if (k && !map.has(k)) map.set(k, cat);
      }
    }
  }
  return map;
}

type Variant = "REMIX" | "FULLSONG" | "SHORTCUT";

// vgost section headers that list special-edition songs.
const VGOST_VARIANT: Record<string, Variant> = {
  remix: "REMIX",
  "remix songs": "REMIX",
  "new remix songs": "REMIX",
  "full songs": "FULLSONG",
  "new full songs": "FULLSONG",
  "shortcut songs": "SHORTCUT",
  shortcut: "SHORTCUT",
  "new shortcut songs": "SHORTCUT",
};

/**
 * Songs that vgost lists in a Remix/Full/Shortcut section. NOTE: these sections
 * list the *base* title that has an edition, so a normal song (e.g. "Dignity")
 * shows up here too. The caller must only treat a hit as an edition when the
 * song has NO genre category (a normal song always lands in a genre section).
 */
async function buildVgostVariantMap(): Promise<Map<string, Variant>> {
  const map = new Map<string, Variant>();
  for (const { key, page } of VGOST_PAGES) {
    const wt = await vgostWikitext(key, page);
    const headers = [...wt.matchAll(/^(={2,4})\s*(.+?)\s*\1\s*$/gm)];
    for (let i = 0; i < headers.length; i++) {
      const v = VGOST_VARIANT[headers[i][2].trim().toLowerCase()];
      if (!v) continue;
      const start = headers[i].index! + headers[i][0].length;
      const end = i + 1 < headers.length ? headers[i + 1].index! : wt.length;
      for (const song of wikiTableSongs(wt.slice(start, end))) {
        const k = norm(song);
        if (k && !map.has(k)) map.set(k, v);
      }
    }
  }
  return map;
}

// ---- namu (rendered HTML) ----
const NAMU_URL =
  "https://en.namu.wiki/w/%ED%8E%8C%ED%94%84%20%EC%9E%87%20%EC%97%85/%EC%88%98%EB%A1%9D%EA%B3%A1";

async function namuHtml(): Promise<string> {
  const file = join(cacheDir, "namu_songlist.html");
  if (existsSync(file)) return readFileSync(file, "utf8");
  const res = await fetch(NAMU_URL, { headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" } });
  const html = await res.text();
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(file, html);
  return html;
}

function htmlText(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x([0-9a-f]+);/gi, (_m, c) => String.fromCharCode(parseInt(c, 16)))
    .replace(/&#(\d+);/g, (_m, c) => String.fromCharCode(+c))
    .replace(/\s+/g, " ")
    .trim();
}

function namuCat(label: string): Genre | null {
  const u = label.toUpperCase();
  if (u.includes("ORIGINAL TUNES")) return "ORIGINAL";
  if (u.includes("(K-POP)") || /\bK-POP\b/.test(u)) return "K-POP";
  if (u.includes("WORLD MUSIC") || u.includes("WORLD LICENSE")) return "WORLD";
  if (u.includes("J-MUSIC") || u.includes("JAPAN")) return "JMUSIC";
  if (u.includes("XROSS") || u.includes("COLLABORATION")) return "XROSS";
  return null;
}

interface NamuRow {
  title: string;
  artist: string;
  cat: Genre;
}

/** Slice a namu section's body by its TOC heading number (e.g. "8.1", "7.3.1"). */
function namuSection(html: string, tocNumber: string, titleRe: RegExp): string | null {
  const heads = [...html.matchAll(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/g)];
  const esc = tocNumber.replace(/\./g, "\\.");
  const re = new RegExp(`^${esc}\\.`);
  const idx = heads.findIndex((m) => {
    const t = m[1].replace(/<[^>]+>/g, "").trim();
    return re.test(t) && titleRe.test(t);
  });
  if (idx < 0) return null;
  return html.slice(heads[idx].index! + heads[idx][0].length, heads[idx + 1].index!);
}

/** Parse the PHOENIX section's category-tagged table into {title, artist, cat}. */
async function parseNamuPhoenix(): Promise<NamuRow[]> {
  const html = await namuHtml();
  const seg = namuSection(html, "8.1", /PHOENIX(?!\s*2)/);
  if (!seg) return [];
  const table = seg.match(/<table[\s\S]*?<\/table>/)?.[0];
  if (!table) return [];
  const rows = [...table.matchAll(/<tr[\s\S]*?<\/tr>/g)].map((m) => m[0]);
  const out: NamuRow[] = [];
  let cur: Genre | null = null;
  for (const r of rows) {
    const cells = [...r.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((m) => htmlText(m[1]));
    if (!cells.length) continue;
    const bpmIdx = cells.findIndex((c) => /^\d{2,3}(\s*~\s*\d{2,3})?$/.test(c.replace(/\[[^\]]*\]/g, "").trim()));
    if (bpmIdx < 0) {
      const c = cells.map(namuCat).find(Boolean);
      if (c) cur = c as Genre;
      continue;
    }
    const title = cells[0];
    if (!title || /^(SONG NAME|ARTIST|VISUAL|BPM|NOTE)$/i.test(title) || !cur) continue;
    out.push({ title, artist: bpmIdx >= 2 ? cells[1] : "", cat: cur });
  }
  return out;
}

// ---- resolve ----
async function main() {
  const songlist = readFileSync(join(catalogDir, "songlist.txt"), "utf8");
  const songs = parseSonglist(songlist);
  const metaPath = join(catalogDir, "metadata.json");
  const meta: Record<string, SongMeta> = existsSync(metaPath)
    ? JSON.parse(readFileSync(metaPath, "utf8"))
    : {};

  const vgost = await buildVgostMap();
  const vgostVariant = await buildVgostVariantMap();
  const namu = await parseNamuPhoenix();
  const namuByTitle = new Map<string, Genre>();
  for (const r of namu) {
    const k = norm(r.title);
    if (k && !namuByTitle.has(k)) namuByTitle.set(k, r.cat);
  }
  const out: Record<string, Genre> = {};
  const variants: Record<string, Variant> = {};
  const stat = { vgost: 0, namu: 0, namuArtist: 0, titleVar: 0, untitled: 0, def: 0 };
  const defaulted: string[] = [];

  for (const s of songs) {
    const k = norm(s.title);
    const artist = normArtist(meta[s.id]?.artist ?? "");
    const titleVar = classifyVariant(s.title);

    // 1. Exact genre match wins, even for an edition-named original (e.g. the
    //    wiki lists "Le Nozze di Figaro ~Celebrazione Remix~" in Original).
    if (vgost.has(k)) {
      out[s.id] = vgost.get(k)!;
      stat.vgost++;
      continue;
    }
    if (namuByTitle.has(k)) {
      out[s.id] = namuByTitle.get(k)!;
      stat.namu++;
      continue;
    }

    // 2. A titled edition with NO exact genre is a special edition. (Checked
    //    before the fuzzy step so a "(Short Cut)" isn't matched to its base.)
    if (titleVar) {
      variants[s.id] = titleVar;
      stat.titleVar++;
      continue;
    }

    // 3. Non-edition fallback: same artist + a close title recovers namu's
    //    translated/typo'd titles (e.g. "amor party" → "Amor Fati").
    if (artist) {
      let cat: Genre | undefined;
      for (const r of namu) {
        const ra = normArtist(r.artist);
        if (!ra || !(ra.includes(artist) || artist.includes(ra))) continue;
        if (distance(k, norm(r.title)) <= Math.max(3, Math.floor(k.length / 2))) {
          cat = r.cat;
          break;
        }
      }
      if (cat) {
        out[s.id] = cat;
        stat.namuArtist++;
        continue;
      }
    }

    // 4. Untitled edition (medley) that vgost lists in a Remix/Full/Shortcut section.
    const sectionVar = vgostVariant.get(k);
    if (sectionVar) {
      variants[s.id] = sectionVar;
      stat.untitled++;
      continue;
    }

    out[s.id] = "ORIGINAL";
    stat.def++;
    defaulted.push(`${s.id} | [${s.debutVersion}] ${s.title} | ${meta[s.id]?.artist ?? ""}`);
  }

  const counts: Record<string, number> = {};
  for (const v of Object.values(out)) counts[v] = (counts[v] ?? 0) + 1;

  console.log("category counts:", JSON.stringify(counts));
  console.log(
    `resolved: vgost=${stat.vgost} namu=${stat.namu} namuArtist=${stat.namuArtist} ` +
      `editions(title=${stat.titleVar} untitled=${stat.untitled}) default(ORIGINAL)=${stat.def}`,
  );
  console.log(`\n${defaulted.length} songs defaulted to ORIGINAL (verify non-in-house ones in categories-manual.json):`);
  for (const d of defaulted) console.log("  " + d);

  const variantIds = Object.keys(variants);
  console.log(`\n${variantIds.length} special editions (hidden from genre views).`);

  if (process.env.DRY) {
    console.log("\nDRY=1 — not writing files");
    return;
  }
  // stable, sorted-by-id output for clean diffs
  const sortById = <T>(o: Record<string, T>): Record<string, T> => {
    const r: Record<string, T> = {};
    for (const id of Object.keys(o).sort()) r[id] = o[id];
    return r;
  };
  writeFileSync(join(catalogDir, "categories.json"), JSON.stringify(sortById(out), null, 2) + "\n");
  console.log(`\nWrote ${Object.keys(out).length} categories -> catalog/categories.json`);
  writeFileSync(join(catalogDir, "variants.json"), JSON.stringify(sortById(variants), null, 2) + "\n");
  console.log(`Wrote ${variantIds.length} editions -> catalog/variants.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
