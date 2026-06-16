/**
 * Fill charts for songs NOT covered by piucenter (mostly Phoenix-era) using
 * pumpproplus.com, which has official Phoenix arcade data plus stepmakers.
 *
 * Strategy: enumerate the whole pumpproplus PIU catalog once (paginating the
 * ASP.NET GridView by chaining VIEWSTATE), build a title index, then match each
 * song that still lacks charts (exact normalized title, then fuzzy >= 0.86, with a
 * collision guard so each catalog entry is claimed once). For matches, open the
 * detail page and keep only OFFICIAL Single/Double charts (skipping Pro / UCS
 * community charts), capturing level + stepmaker + artist.
 *
 * Usage: cd pipeline && npm run ingest:pumpproplus   (DRY=1 previews + prints matches)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseSonglist } from "../src/build/parseSonglist.js";
import {
  normalizeBase,
  splitVariant,
  titleHasVariantMarker,
  VARIANT_LABEL,
  type Variant,
} from "../src/build/piucenter.js";
import { similarity } from "../src/text/fuzzy.js";
import type { SongMeta, ChartMeta } from "../src/build/catalog.js";

const HEADER_SEQUENCE = [
  "1ST TO ZERO",
  "NX TO NXA",
  "FIESTA TO FIESTA2",
  "PRIME",
  "PRIME2",
  "XX",
  "PHOENIX",
];

/** Strip pumpproplus' parenthetical variant to get the canonical display base. */
function ppDisplayBase(name: string): string {
  return name.replace(/\s*\((short cut|full song|full ver\.?|remix)\)\s*$/i, "").trim();
}

function canonicalTitle(name: string, variant: Variant): string {
  const base = ppDisplayBase(name);
  if (variant === "STANDARD" || titleHasVariantMarker(base)) return base;
  return `${base} ${VARIANT_LABEL[variant]}`;
}

const BASE = "https://www.pumpproplus.com/";
const PAGE = BASE + "song-search-piu.aspx";
const pipelineRoot = join(import.meta.dirname, "..");
const songlistPath = join(pipelineRoot, "catalog", "songlist.txt");
const metadataPath = join(pipelineRoot, "catalog", "metadata.json");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const hidden = (h: string, n: string) => {
  const m = h.match(new RegExp(`id="${n}"[^>]*value="([^"]*)"`));
  return m ? m[1] : "";
};
const decode = (s: string) =>
  s
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

/** pumpproplus encodes variants in parentheses, e.g. "Sarabande (Short Cut)". */
function ppVariant(name: string): { base: string; variant: Variant } {
  let t = name.trim();
  let variant: Variant = "STANDARD";
  const m = t.match(/\s*\((short cut|full song|full ver\.?|remix)\)\s*$/i);
  if (m) {
    const k = m[1].toLowerCase();
    variant = k.startsWith("short") ? "SHORTCUT" : k.startsWith("remix") ? "REMIX" : "FULLSONG";
    t = t.slice(0, m.index);
  }
  return { base: normalizeBase(t), variant };
}

interface Row {
  id: string;
  name: string;
  artist: string;
}

function parseRows(html: string): Row[] {
  return [
    ...html.matchAll(
      /<a href="song-details-piu\.aspx\?id=([0-9a-f-]+)">([^<]+)<\/a>\s*<\/td>\s*<td>\s*([^<]*?)\s*</gi,
    ),
  ].map((m) => ({ id: m[1], name: decode(m[2].trim()), artist: decode(m[3].trim()) }));
}

interface Tokens {
  cookie: string;
  vs: string;
  vg: string;
  ev: string;
}
function tokensFrom(html: string, cookie: string): Tokens {
  return {
    cookie,
    vs: hidden(html, "__VIEWSTATE"),
    vg: hidden(html, "__VIEWSTATEGENERATOR"),
    ev: hidden(html, "__EVENTVALIDATION"),
  };
}

/** Walk every page of the unfiltered catalog, chaining VIEWSTATE page to page. */
async function enumerateCatalog(): Promise<Row[]> {
  const g = await fetch(PAGE);
  const cookie = (g.headers.get("set-cookie") || "").split(";")[0];
  let html = await g.text();
  let tk = tokensFrom(html, cookie);

  const byId = new Map<string, Row>();
  for (const r of parseRows(html)) byId.set(r.id, r);

  let page = 1;
  for (let guard = 0; guard < 200; guard++) {
    const body = new URLSearchParams({
      __EVENTTARGET: "ctl00$cphContentBodyLeft$gvSongSearch",
      __EVENTARGUMENT: "Page$" + (page + 1),
      __VIEWSTATE: tk.vs,
      __VIEWSTATEGENERATOR: tk.vg,
      __EVENTVALIDATION: tk.ev,
      "ctl00$cphContentBodyLeft$tbSongSearch": "",
    });
    const r = await fetch(PAGE, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie },
      body,
    });
    if (r.status !== 200) break;
    const h = await r.text();
    const rows = parseRows(h);
    if (rows.length === 0) break;
    const before = byId.size;
    for (const row of rows) byId.set(row.id, row);
    tk = tokensFrom(h, cookie);
    page++;
    if (byId.size === before) break; // no new songs -> reached the end
    await sleep(80);
  }
  process.stderr.write(`catalog pages walked: ${page}, songs: ${byId.size}\n`);
  return [...byId.values()];
}

interface PpChart {
  mode: "Single" | "Double";
  level: number;
  stepmaker?: string;
}

async function detail(cookie: string, id: string): Promise<PpChart[]> {
  const r = await fetch(BASE + "song-details-piu.aspx?id=" + id, { headers: { Cookie: cookie } });
  const html = await r.text();
  const charts = new Map<string, PpChart>();
  for (const block of html.split("item-body item-body-chart").slice(1)) {
    const labels = [...block.matchAll(/class="label-[a-z]+[^"]*"[^>]*>\s*([^<]+?)\s*</g)].map((m) =>
      m[1].replace(/\s+/g, " ").trim(),
    );
    if (!labels.includes("Official")) continue;
    const mode = (block.match(/<div class="mode">([^<]+)<\/div>/) || [])[1]?.trim();
    const ratingRaw = (block.match(/<div class="rating">([^<]+)<\/div>/) || [])[1]?.trim();
    if (mode !== "Single" && mode !== "Double") continue;
    const level = parseInt(ratingRaw ?? "", 10);
    if (!(level > 0)) continue;
    const stepmaker = labels.find(
      (l) =>
        l &&
        l !== "Official" &&
        !/^Phoenix\b/i.test(l) &&
        !/^Arcade\b/i.test(l) &&
        !/^Pro\b/i.test(l) &&
        !/^UCS$/i.test(l) &&
        !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(l),
    );
    charts.set(`${mode}|${level}`, { mode, level, stepmaker });
  }
  return [...charts.values()].sort((a, b) =>
    a.mode === b.mode ? a.level - b.level : a.mode === "Single" ? -1 : 1,
  );
}

async function main() {
  const originalText = readFileSync(songlistPath, "utf8");
  const oldSongs = parseSonglist(originalText);
  const meta: Record<string, SongMeta> = existsSync(metadataPath)
    ? (JSON.parse(readFileSync(metadataPath, "utf8")) as Record<string, SongMeta>)
    : {};
  // order index of each song that still needs charts
  const toFill = oldSongs
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => !meta[s.id]?.charts?.length);
  process.stderr.write(`songs needing charts: ${toFill.length}\n`);

  const catalog = await enumerateCatalog();
  // index: base -> variant -> Row
  const index = new Map<string, Map<Variant, Row>>();
  for (const row of catalog) {
    const { base, variant } = ppVariant(row.name);
    let byV = index.get(base);
    if (!byV) index.set(base, (byV = new Map()));
    if (!byV.has(variant)) byV.set(variant, row);
  }
  const allBases = [...index.keys()];

  interface Pre {
    ord: number;
    title: string;
    key: string;
    variant: Variant;
    row: Row;
    how: "exact" | "fuzzy";
    score: number;
  }
  const pre: Pre[] = [];
  for (const { s, i } of toFill) {
    const { base, variant } = splitVariant(s.title);
    let key = index.has(base) ? base : "";
    let how: "exact" | "fuzzy" = "exact";
    let score = 1;
    if (!key) {
      let best = "";
      let bestS = 0;
      for (const b of allBases) {
        const sim = similarity(base, b);
        if (sim > bestS) {
          bestS = sim;
          best = b;
        }
      }
      if (bestS >= 0.86) {
        key = best;
        how = "fuzzy";
        score = bestS;
      }
    }
    if (!key) continue;
    const byV = index.get(key)!;
    const row = byV.get(variant) ?? (variant === "STANDARD" ? byV.values().next().value : undefined);
    if (!row) continue;
    pre.push({ ord: i, title: s.title, key, variant, row, how, score });
  }
  // collision guard on (key + variant): keep the highest-confidence claimant
  const best = new Map<string, Pre>();
  for (const p of pre) {
    const g = `${p.key} ${p.variant}`;
    const cur = best.get(g);
    if (!cur || p.score > cur.score) best.set(g, p);
  }
  const winners = pre.filter((p) => best.get(`${p.key} ${p.variant}`) === p);

  // fetch charts; keep order-indexed results
  const result = new Map<number, { title: string; charts: PpChart[]; artist: string }>();
  const renames: string[] = [];
  for (const p of winners) {
    let charts: PpChart[] = [];
    try {
      charts = await detail("", p.row.id);
    } catch (e) {
      process.stderr.write(`detail error "${p.title}": ${e}\n`);
    }
    await sleep(80);
    if (charts.length === 0) continue;
    const newTitle = canonicalTitle(p.row.name, p.variant);
    result.set(p.ord, { title: newTitle, charts, artist: p.row.artist });
    if (newTitle !== p.title) renames.push(`${p.title}  ->  ${newTitle}${p.how === "fuzzy" ? `  (fuzzy ${p.score.toFixed(2)})` : ""}`);
  }

  // rewrite songlist with canonical titles for matched songs (preserve headers/blanks/order)
  const lines = originalText.split(/\r?\n/);
  const outLines: string[] = [];
  let headerIdx = -1;
  let songOrd = -1;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      outLines.push(raw);
      continue;
    }
    const norm = line.toUpperCase().replace(/\s+/g, " ");
    const hIdx = HEADER_SEQUENCE.findIndex((h, idx) => idx > headerIdx && h === norm);
    if (hIdx !== -1) {
      headerIdx = hIdx;
      outLines.push(raw);
      continue;
    }
    songOrd++;
    const r = result.get(songOrd);
    outLines.push(r ? r.title : line);
  }
  const newText = outLines.join("\n");
  const newSongs = parseSonglist(newText);
  if (newSongs.length !== oldSongs.length) {
    throw new Error(`song count changed ${oldSongs.length} -> ${newSongs.length}; aborting`);
  }

  // rebuild metadata mapped by ORDER INDEX (robust to slug/dedup shifts)
  const newMeta: Record<string, SongMeta> = {};
  let chartsAdded = 0;
  newSongs.forEach((ns, i) => {
    const r = result.get(i);
    if (r) {
      const prev = meta[oldSongs[i].id] ?? {};
      newMeta[ns.id] = {
        ...prev,
        artist: prev.artist || r.artist,
        charts: r.charts.map((c) => ({
          mode: c.mode,
          level: c.level,
          stepmaker: c.stepmaker,
          types: [],
          typesSource: "auto" as const,
        })),
      };
      chartsAdded += r.charts.length;
    } else {
      const prev = meta[oldSongs[i].id];
      if (prev) newMeta[ns.id] = prev;
    }
  });

  const stillMissing = toFill.filter(({ i }) => !result.has(i)).map(({ s }) => s.title);

  const dry = process.env.DRY === "1";
  if (!dry) {
    writeFileSync(songlistPath, newText);
    writeFileSync(metadataPath, JSON.stringify(newMeta, null, 2) + "\n");
  }

  process.stdout.write(
    `\n=== renames (${renames.length}) ===\n` +
      renames.join("\n") +
      "\n\n" +
      JSON.stringify(
        {
          dryRun: dry,
          needed: toFill.length,
          catalog: catalog.length,
          matched: result.size,
          chartsAdded,
          stillMissingCount: stillMissing.length,
          stillMissing,
        },
        null,
        2,
      ) +
      "\n",
  );
}

main().catch((e) => {
  process.stderr.write(String(e?.stack ?? e) + "\n");
  process.exit(1);
});
