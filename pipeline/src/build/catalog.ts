import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseSonglist } from "./parseSonglist";
import { normalizeTitle } from "../text/normalize";
import type { Dataset, Song, Chart, Version } from "../model/types";

export interface ChartMeta {
  id?: string;
  mode?: Chart["mode"];
  level: number;
  stepmaker?: string;
  types?: Chart["types"];
  typesSource?: Chart["typesSource"];
  youtubeUrl?: string;
}

export interface SongMeta {
  artist?: string;
  titleKr?: string;
  bpmMin?: number;
  bpmMax?: number;
  debutVersion?: Version;
  charts?: ChartMeta[];
}

/** Build a normalized Dataset from the catalog files under `<root>/catalog`. */
export function buildDatasetFromCatalog(root: string): Dataset {
  const songlistPath = join(root, "catalog", "songlist.txt");
  const metadataPath = join(root, "catalog", "metadata.json");

  const parsed = parseSonglist(readFileSync(songlistPath, "utf8"));
  const metadata: Record<string, SongMeta> = existsSync(metadataPath)
    ? (JSON.parse(readFileSync(metadataPath, "utf8")) as Record<string, SongMeta>)
    : {};

  const songs: Song[] = parsed.map((p, i) => {
    const m = metadata[p.id] ?? {};
    return {
      id: p.id,
      title: p.title,
      titleKr: m.titleKr,
      titleNormalized: normalizeTitle(p.title),
      artist: m.artist ?? "",
      bpmMin: m.bpmMin ?? 0,
      bpmMax: m.bpmMax ?? m.bpmMin ?? 0,
      debutVersion: m.debutVersion ?? p.debutVersion,
      releaseIndex: i + 1,
    };
  });

  const charts: Chart[] = [];
  for (const p of parsed) {
    const m = metadata[p.id];
    if (!m?.charts) continue;
    m.charts.forEach((c, j) => {
      const mode = c.mode ?? "Single";
      charts.push({
        id: c.id ?? `${p.id}_${mode[0].toLowerCase()}${c.level}_${j}`,
        songId: p.id,
        mode,
        level: c.level,
        stepmaker: c.stepmaker,
        types: c.types ?? [],
        typesSource: c.typesSource ?? "manual",
        youtubeUrl: c.youtubeUrl,
      });
    });
  }

  return { songs, charts };
}
