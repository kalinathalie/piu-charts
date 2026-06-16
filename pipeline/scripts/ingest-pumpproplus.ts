/**
 * Fill charts for songs NOT covered by piucenter (mostly Phoenix-era) using
 * pumpproplus.com, which has official Phoenix arcade data plus stepmakers.
 *
 * For each song in songlist.txt that has no charts in metadata.json yet, search
 * pumpproplus by title, match the right result (variant-aware), open its detail
 * page, and keep only OFFICIAL Single/Double charts (skipping Pro / UCS community
 * charts). Captures level and stepmaker.
 *
 * Usage: cd pipeline && npm run ingest:pumpproplus   (DRY=1 to preview without writing)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseSonglist } from "../src/build/parseSonglist.js";
import { normalizeBase, splitVariant, type Variant } from "../src/build/piucenter.js";
import type { SongMeta, ChartMeta } from "../src/build/catalog.js";

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

interface Tokens {
  cookie: string;
  vs: string;
  vg: string;
  ev: string;
}

async function getTokens(): Promise<Tokens> {
  const g = await fetch(PAGE);
  const cookie = (g.headers.get("set-cookie") || "").split(";")[0];
  const html = await g.text();
  return {
    cookie,
    vs: hidden(html, "__VIEWSTATE"),
    vg: hidden(html, "__VIEWSTATEGENERATOR"),
    ev: hidden(html, "__EVENTVALIDATION"),
  };
}

interface Row {
  id: string;
  name: string;
  artist: string;
}

async function search(tk: Tokens, query: string): Promise<Row[]> {
  const body = new URLSearchParams({
    __VIEWSTATE: tk.vs,
    __VIEWSTATEGENERATOR: tk.vg,
    __EVENTVALIDATION: tk.ev,
    "ctl00$cphContentBodyLeft$tbSongSearch": query,
    "ctl00$cphContentBodyLeft$btnSearch": "Search",
  });
  const r = await fetch(PAGE, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: tk.cookie },
    body,
  });
  const html = await r.text();
  return [
    ...html.matchAll(
      /<a href="song-details-piu\.aspx\?id=([0-9a-f-]+)">([^<]+)<\/a>\s*<\/td>\s*<td>\s*([^<]*?)\s*</gi,
    ),
  ].map((m) => ({ id: m[1], name: m[2].trim(), artist: m[3].trim() }));
}

interface PpChart {
  mode: "Single" | "Double";
  level: number;
  stepmaker?: string;
}

async function detail(tk: Tokens, id: string): Promise<PpChart[]> {
  const r = await fetch(BASE + "song-details-piu.aspx?id=" + id, { headers: { Cookie: tk.cookie } });
  const html = await r.text();
  const charts = new Map<string, PpChart>();
  for (const block of html.split("item-body item-body-chart").slice(1)) {
    const labels = [...block.matchAll(/class="label-[a-z]+[^"]*"[^>]*>\s*([^<]+?)\s*</g)].map((m) =>
      m[1].replace(/\s+/g, " ").trim(),
    );
    if (!labels.includes("Official")) continue; // skip Pro / UCS / community charts
    const modeRaw = (block.match(/<div class="mode">([^<]+)<\/div>/) || [])[1]?.trim();
    const ratingRaw = (block.match(/<div class="rating">([^<]+)<\/div>/) || [])[1]?.trim();
    if (modeRaw !== "Single" && modeRaw !== "Double") continue; // only S/D
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
    charts.set(`${modeRaw}|${level}`, { mode: modeRaw, level, stepmaker });
  }
  return [...charts.values()].sort((a, b) =>
    a.mode === b.mode ? a.level - b.level : a.mode === "Single" ? -1 : 1,
  );
}

async function main() {
  const songs = parseSonglist(readFileSync(songlistPath, "utf8"));
  const meta: Record<string, SongMeta> = existsSync(metadataPath)
    ? (JSON.parse(readFileSync(metadataPath, "utf8")) as Record<string, SongMeta>)
    : {};

  const toFill = songs.filter((s) => !meta[s.id]?.charts?.length);
  process.stderr.write(`songs needing charts: ${toFill.length}\n`);

  const tk = await getTokens();
  let matched = 0;
  let chartsAdded = 0;
  const stillMissing: string[] = [];

  for (const song of toFill) {
    const { base, variant } = splitVariant(song.title);
    let rows: Row[] = [];
    try {
      rows = await search(tk, base);
    } catch (e) {
      process.stderr.write(`search error "${song.title}": ${e}\n`);
    }
    await sleep(120);

    // exact base match, preferring same variant
    const cands = rows
      .map((r) => ({ r, ...ppVariant(r.name) }))
      .filter((c) => c.base === base);
    const pick = cands.find((c) => c.variant === variant) ?? (variant === "STANDARD" ? cands[0] : undefined);
    if (!pick) {
      stillMissing.push(song.title);
      continue;
    }

    let charts: PpChart[] = [];
    try {
      charts = await detail(tk, pick.r.id);
    } catch (e) {
      process.stderr.write(`detail error "${song.title}": ${e}\n`);
    }
    await sleep(120);
    if (charts.length === 0) {
      stillMissing.push(song.title);
      continue;
    }

    matched++;
    chartsAdded += charts.length;
    const chartMetas: ChartMeta[] = charts.map((c) => ({
      mode: c.mode,
      level: c.level,
      stepmaker: c.stepmaker,
      types: [],
      typesSource: "auto" as const,
    }));
    const prev = meta[song.id] ?? {};
    meta[song.id] = { ...prev, artist: prev.artist || pick.r.artist, charts: chartMetas };
  }

  const dry = process.env.DRY === "1";
  if (!dry) writeFileSync(metadataPath, JSON.stringify(meta, null, 2) + "\n");

  process.stdout.write(
    JSON.stringify(
      {
        dryRun: dry,
        needed: toFill.length,
        matched,
        chartsAdded,
        stillMissingCount: stillMissing.length,
        stillMissing,
      },
      null,
      2,
    ) + "\n",
  );
}

main().catch((e) => {
  process.stderr.write(String(e?.stack ?? e) + "\n");
  process.exit(1);
});
