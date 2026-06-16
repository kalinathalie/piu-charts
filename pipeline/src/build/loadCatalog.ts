import { readFileSync } from "node:fs";
import type { Dataset, Song, Chart, Version, Mode, ChartType } from "../model/types";
import { normalizeTitle } from "../text/normalize";

/** Hand-editable song row (titleNormalized + releaseIndex are derived by the build). */
export interface RawSong {
  id: string;
  title: string;
  titleKr?: string;
  artist?: string;
  bpmMin?: number;
  bpmMax?: number;
  debutVersion?: Version;
}

/** Hand-editable chart row (types/typesSource default if omitted). */
export interface RawChart {
  id: string;
  songId: string;
  mode?: Mode;
  level?: number;
  stepmaker?: string;
  types?: ChartType[];
  typesSource?: Chart["typesSource"];
}

export interface RawCatalog {
  songs: RawSong[];
  charts: RawChart[];
}

export function parseCatalog(raw: RawCatalog): Dataset {
  const songs: Song[] = raw.songs.map((s) => ({
    id: s.id,
    title: s.title,
    titleKr: s.titleKr,
    titleNormalized: normalizeTitle(s.title),
    artist: s.artist ?? "",
    bpmMin: s.bpmMin ?? 0,
    bpmMax: s.bpmMax ?? s.bpmMin ?? 0,
    debutVersion: s.debutVersion ?? "Phoenix",
    releaseIndex: 0,
  }));

  const charts: Chart[] = raw.charts.map((c) => ({
    id: c.id,
    songId: c.songId,
    mode: c.mode ?? "Single",
    level: c.level ?? 0,
    stepmaker: c.stepmaker,
    types: c.types ?? [],
    typesSource: c.typesSource ?? "manual",
  }));

  return { songs, charts };
}

export function loadCatalog(path: string): Dataset {
  const raw = JSON.parse(readFileSync(path, "utf8"));
  if (!raw || !Array.isArray(raw.songs) || !Array.isArray(raw.charts)) {
    throw new Error(`catalog at ${path} must be an object with songs[] and charts[]`);
  }
  return parseCatalog(raw as RawCatalog);
}
