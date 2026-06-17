/**
 * Authoritative chart data from base.txt (official piugame.com export). Replaces
 * each matched song's charts with the correct Phoenix levels + stepmaker + per-chart
 * YouTube link, and refreshes artist/BPM. Run LAST — it overrides the scraped data.
 *
 * Matches our songs to base.txt by normalized English title (exact, then fuzzy).
 * Only Single/Double charts are imported (Co-Op skipped).
 *
 * Usage: cd pipeline && npm run ingest:base   (DRY=1 to preview without writing)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseSonglist } from "../src/build/parseSonglist.js";
import { normalizeBase } from "../src/build/piucenter.js";
import { similarity } from "../src/text/fuzzy.js";
import type { SongMeta, ChartMeta } from "../src/build/catalog.js";

/**
 * base.txt's titleEn often embeds the original-language name (e.g.
 * "Kasou Shinja仮装信者") or a "feat. …" credit with CJK. Strip those for matching
 * so the romanized part lines up with our titles.
 */
function matchKey(s: string): string {
  const stripped = s
    .replace(/\s*[([]?\s*(feat\.?|ft\.?)\b.*$/i, "")
    .replace(/[　-鿿가-힯＀-￯]/g, " ");
  return normalizeBase(stripped) || normalizeBase(s);
}

const pipelineRoot = join(import.meta.dirname, "..");
const repoRoot = join(pipelineRoot, "..");
const basePath = join(repoRoot, "base.txt");
const songlistPath = join(pipelineRoot, "catalog", "songlist.txt");
const metadataPath = join(pipelineRoot, "catalog", "metadata.json");

interface BaseRow {
  songId: number;
  titleEn: string;
  artistEn?: string;
  artist?: string;
  difficulty: string;
  stepArtist?: string;
  bpmMin?: number;
  bpmMax?: number;
  youtubeUrl?: string | null;
  youtubeUrl3rd?: string | null;
}

interface BaseSong {
  title: string;
  artist: string;
  bpmMin?: number;
  bpmMax?: number;
  charts: ChartMeta[];
}

function buildBaseIndex(): Map<string, BaseSong> {
  const rows = (JSON.parse(readFileSync(basePath, "utf8")).list as BaseRow[]) ?? [];
  const bySong = new Map<number, BaseSong>();
  const chartSeen = new Map<number, Set<string>>();

  for (const r of rows) {
    const m = /^([SD])(\d+)$/.exec(r.difficulty?.trim() ?? "");
    if (!m) continue; // skip Co-Op (C…) and anything non S/D
    const mode = m[1] === "S" ? "Single" : "Double";
    const level = Number(m[2]);
    const youtubeUrl = r.youtubeUrl3rd || r.youtubeUrl || undefined;

    let song = bySong.get(r.songId);
    if (!song) {
      song = {
        title: r.titleEn,
        artist: r.artistEn || r.artist || "",
        bpmMin: r.bpmMin,
        bpmMax: r.bpmMax,
        charts: [],
      };
      bySong.set(r.songId, song);
      chartSeen.set(r.songId, new Set());
    }
    const key = `${mode}|${level}`;
    const seen = chartSeen.get(r.songId)!;
    if (seen.has(key)) continue;
    seen.add(key);
    song.charts.push({
      mode,
      level,
      stepmaker: r.stepArtist || undefined,
      youtubeUrl,
      types: [],
      typesSource: "auto",
    });
  }

  // index by normalized English title
  const index = new Map<string, BaseSong>();
  for (const song of bySong.values()) {
    song.charts.sort((a, b) =>
      a.mode === b.mode ? a.level - b.level : a.mode === "Single" ? -1 : 1,
    );
    const key = matchKey(song.title);
    if (!index.has(key)) index.set(key, song);
  }
  return index;
}

function main() {
  const index = buildBaseIndex();
  const keys = [...index.keys()];
  const songs = parseSonglist(readFileSync(songlistPath, "utf8"));
  const meta: Record<string, SongMeta> = existsSync(metadataPath)
    ? (JSON.parse(readFileSync(metadataPath, "utf8")) as Record<string, SongMeta>)
    : {};

  let exact = 0;
  let fuzzy = 0;
  let withYt = 0;
  let charts = 0;
  const unmatched: string[] = [];

  for (const song of songs) {
    const norm = matchKey(song.title);
    let hit = index.get(norm);
    if (hit) exact++;
    else {
      let best = "";
      let bestS = 0;
      for (const k of keys) {
        const s = similarity(norm, k);
        if (s > bestS) {
          bestS = s;
          best = k;
        }
      }
      if (bestS >= 0.85) {
        hit = index.get(best);
        fuzzy++;
      }
    }
    if (!hit || hit.charts.length === 0) {
      unmatched.push(song.title);
      continue;
    }

    charts += hit.charts.length;
    withYt += hit.charts.filter((c) => c.youtubeUrl).length;
    const prev = meta[song.id] ?? {};
    meta[song.id] = {
      ...prev,
      artist: hit.artist || prev.artist,
      bpmMin: hit.bpmMin ?? prev.bpmMin,
      bpmMax: hit.bpmMax ?? prev.bpmMax,
      charts: hit.charts.map((c) => ({ ...c })),
    };
  }

  const dry = process.env.DRY === "1";
  if (!dry) writeFileSync(metadataPath, JSON.stringify(meta, null, 2) + "\n");

  process.stdout.write(
    JSON.stringify(
      {
        dryRun: dry,
        baseSongs: index.size,
        ourSongs: songs.length,
        matchedExact: exact,
        matchedFuzzy: fuzzy,
        matchedTotal: exact + fuzzy,
        chartsWritten: charts,
        chartsWithYoutube: withYt,
        unmatchedCount: unmatched.length,
        unmatchedSample: unmatched.slice(0, 40),
      },
      null,
      2,
    ) + "\n",
  );
}

main();
