/**
 * Ingest Single/Double chart levels from piucenter (maxwshen/piu-app static/table.json)
 * and write them into catalog/metadata.json, keyed by our song slug.
 *
 * Source: https://raw.githubusercontent.com/maxwshen/piu-app/main/static/table.json
 *   Each row: { "Name (unique)": "<Title> - <Artist> <S|D><level> <variant>", "Pack", "URL" }
 *   This dataset is XX-era (last updated 2021); Phoenix-exclusive songs won't match and
 *   some levels may differ slightly from Phoenix. Best-effort, manual fixes expected.
 *
 * Matching is variant-aware: our songlist lists chart variants as separate songs
 * (e.g. "dignity" vs "dignity full song"), so we map our suffix to piucenter's
 * variant keyword and prefer the same variant, falling back to the arcade chart.
 *
 * Usage: cd pipeline && npm run ingest:piucenter
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseSonglist } from "../src/build/parseSonglist.js";
import { bestMatch, type Candidate } from "../src/text/fuzzy.js";
import type { SongMeta, ChartMeta } from "../src/build/catalog.js";

const TABLE_URL =
  "https://raw.githubusercontent.com/maxwshen/piu-app/main/static/table.json";

const pipelineRoot = join(import.meta.dirname, "..");
const cachePath = join(pipelineRoot, ".cache", "table.json");
const songlistPath = join(pipelineRoot, "catalog", "songlist.txt");
const metadataPath = join(pipelineRoot, "catalog", "metadata.json");

type Variant = "STANDARD" | "FULLSONG" | "SHORTCUT" | "REMIX";

/** Core text normalization (no variant-suffix logic). Keeps Unicode letters/digits. */
function normalizeBase(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Detect a chart variant from a raw title and return the variant-stripped base. */
function splitVariant(rawTitle: string): { base: string; variant: Variant } {
  let t = rawTitle.trim();
  const rules: [RegExp, Variant][] = [
    [/\s*-?\s*(full song|full ver\.?|fullsong)\s*$/i, "FULLSONG"],
    [/\s*-?\s*(short cut|short ver\.?|shortcut|s\.c\.)\s*$/i, "SHORTCUT"],
    [/\s*-?\s*remix\s*$/i, "REMIX"],
  ];
  let variant: Variant = "STANDARD";
  for (const [re, v] of rules) {
    if (re.test(t)) {
      t = t.replace(re, "");
      variant = v;
      break;
    }
  }
  return { base: normalizeBase(t), variant };
}

const PC_VARIANT: Record<string, Variant> = {
  arcade: "STANDARD",
  fullsong: "FULLSONG",
  shortcut: "SHORTCUT",
  remix: "REMIX",
};

interface PcEntry {
  artist: string;
  /** key `${mode}|${level}` -> chart */
  charts: Map<string, { mode: "Single" | "Double"; level: number }>;
}

async function loadTable(): Promise<{ "Name (unique)": string; Pack: string }[]> {
  if (!existsSync(cachePath)) {
    process.stderr.write(`Fetching ${TABLE_URL} ...\n`);
    const res = await fetch(TABLE_URL);
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    const text = await res.text();
    mkdirSync(join(pipelineRoot, ".cache"), { recursive: true });
    writeFileSync(cachePath, text);
  }
  return JSON.parse(readFileSync(cachePath, "utf8"));
}

// Only Single/Double arcade-style charts; anchored on a known trailing variant keyword.
const NAME_RE = /^(.*) - (.*?) (S|D)(\d+) (arcade|remix|fullsong|shortcut)\b/;

function buildIndex(rows: { "Name (unique)": string }[]) {
  // base -> variant -> PcEntry
  const index = new Map<string, Map<Variant, PcEntry>>();
  let parsed = 0;
  for (const row of rows) {
    const name = row["Name (unique)"];
    const m = name.match(NAME_RE);
    if (!m) continue;
    parsed++;
    const [, title, artist, modeChar, levelStr, variantKw] = m;
    const base = normalizeBase(title);
    const variant = PC_VARIANT[variantKw] ?? "STANDARD";
    const mode = modeChar === "S" ? "Single" : "Double";
    const level = Number(levelStr);

    let byVariant = index.get(base);
    if (!byVariant) {
      byVariant = new Map();
      index.set(base, byVariant);
    }
    let entry = byVariant.get(variant);
    if (!entry) {
      entry = { artist: artist.trim(), charts: new Map() };
      byVariant.set(variant, entry);
    }
    entry.charts.set(`${mode}|${level}`, { mode, level });
  }
  return { index, parsed };
}

function mergeEntries(entries: PcEntry[]): PcEntry {
  const merged: PcEntry = { artist: "", charts: new Map() };
  for (const e of entries) {
    if (!merged.artist) merged.artist = e.artist;
    for (const [k, v] of e.charts) merged.charts.set(k, v);
  }
  return merged;
}

/** Resolve the best entry for a base+variant within a variant map. */
function pickVariant(byVariant: Map<Variant, PcEntry>, variant: Variant): PcEntry {
  return (
    byVariant.get(variant) ??
    byVariant.get("STANDARD") ??
    mergeEntries([...byVariant.values()])
  );
}

async function main() {
  const rows = await loadTable();
  const { index, parsed } = buildIndex(rows);
  const baseCandidates: Candidate[] = [...index.keys()].map((b) => ({ id: b, normalized: b }));

  const songs = parseSonglist(readFileSync(songlistPath, "utf8"));

  const existing: Record<string, SongMeta> = existsSync(metadataPath)
    ? JSON.parse(readFileSync(metadataPath, "utf8"))
    : {};
  const out: Record<string, SongMeta> = { ...existing };

  const allBases = [...index.keys()];
  let matchedExact = 0;
  let matchedFuzzy = 0;
  let matchedPrefix = 0;
  let totalCharts = 0;
  const unmatched: string[] = [];
  const prefixMatches: string[] = [];

  for (const song of songs) {
    const { base, variant } = splitVariant(song.title);
    let byVariant = index.get(base);
    let how: "exact" | "fuzzy" | "prefix" | null = byVariant ? "exact" : null;

    if (!byVariant) {
      const fm = bestMatch(base, baseCandidates, 0.9);
      if (fm) {
        byVariant = index.get(fm.id);
        how = "fuzzy";
      }
    }
    // Stage 3: word-boundary prefix containment. Only the safe direction — the
    // piucenter title *extends* ours with trailing "feat. X"/"remix"/subtitle
    // markers (e.g. our "bad apple" -> "bad apple feat nomico"). We do NOT match
    // when our title is the longer one, since the extra word is usually meaningful
    // ("beautiful liar" != "beautiful"). Length-guarded against short titles.
    if (!byVariant && base.length >= 8) {
      let cand: string | null = null;
      for (const b of allBases) {
        if (b === base) continue;
        if (!b.startsWith(base + " ")) continue;
        if (cand === null || b.length < cand.length) cand = b;
      }
      if (cand) {
        byVariant = index.get(cand);
        how = "prefix";
        prefixMatches.push(`${base}  ->  ${cand}`);
      }
    }
    if (!byVariant) {
      unmatched.push(song.title);
      continue;
    }

    const entry = pickVariant(byVariant, variant);
    const charts: ChartMeta[] = [...entry.charts.values()]
      .sort((a, b) => (a.mode === b.mode ? a.level - b.level : a.mode === "Single" ? -1 : 1))
      .map((c) => ({ mode: c.mode, level: c.level, types: [], typesSource: "auto" as const }));

    if (charts.length === 0) {
      unmatched.push(song.title);
      continue;
    }

    if (how === "exact") matchedExact++;
    else if (how === "fuzzy") matchedFuzzy++;
    else matchedPrefix++;
    totalCharts += charts.length;

    const prev = out[song.id] ?? {};
    out[song.id] = {
      ...prev,
      artist: prev.artist || entry.artist,
      charts,
    };
  }

  const dry = process.env.DRY === "1";
  if (!dry) writeFileSync(metadataPath, JSON.stringify(out, null, 2) + "\n");

  process.stdout.write(
    JSON.stringify(
      {
        dryRun: dry,
        tableRows: rows.length,
        parsedSD: parsed,
        distinctBases: index.size,
        songs: songs.length,
        matchedExact,
        matchedFuzzy,
        matchedPrefix,
        matchedTotal: matchedExact + matchedFuzzy + matchedPrefix,
        unmatchedCount: unmatched.length,
        totalCharts,
        prefixMatches,
        unmatchedSample: unmatched.slice(0, 40),
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
