import type { Dataset, Song, Chart } from "../model/types";
import { chartLabel } from "../model/types";
import { deriveCategories } from "../numbering/categories";
import { computeAllPlacements } from "../numbering/engine";
import type { AppTitleCategory } from "./titles";

export interface AppPlacement {
  label: string;
  position: number;
  total: number;
}

export interface AppChart {
  id: string;
  label: string;
  mode: string;
  level: number;
  stepmaker?: string;
  types: string[];
  youtubeUrl?: string;
  placements: AppPlacement[];
}

export interface AppSong {
  id: string;
  title: string;
  titleKr?: string;
  titleNormalized: string;
  artist: string;
  bpmMin: number;
  bpmMax: number;
  debutVersion: string;
  /** Arcade song-selection category (genre tab): K-POP | ORIGINAL | WORLD | JMUSIC | XROSS. */
  category: string;
  releaseIndex: number;
  /** "REMIX" | "SHORTCUT" | "FULLSONG" for special editions; omitted otherwise. */
  variant?: string;
  /** Song-level placements (all songs, by version). */
  placements: AppPlacement[];
  charts: AppChart[];
}

export interface AppData {
  songCount: number;
  chartCount: number;
  songs: AppSong[];
  titles: AppTitleCategory[];
}

/**
 * Pre-compute everything the app renders: per-song placements (all songs + version)
 * and per-chart placements (via the numbering engine). The app stays a thin viewer.
 */
export function toAppData(ds: Dataset, titles: AppTitleCategory[] = []): AppData {
  const cats = deriveCategories(ds);

  const songsSorted = [...ds.songs].sort((a, b) => a.releaseIndex - b.releaseIndex);
  const total = songsSorted.length;

  const allPos = new Map<string, number>();
  songsSorted.forEach((s, i) => allPos.set(s.id, i + 1));

  const byVersion = new Map<string, Song[]>();
  for (const s of songsSorted) {
    const arr = byVersion.get(s.debutVersion) ?? [];
    arr.push(s);
    byVersion.set(s.debutVersion, arr);
  }
  const versionPos = new Map<string, { position: number; total: number }>();
  for (const arr of byVersion.values()) {
    arr.forEach((s, i) => versionPos.set(s.id, { position: i + 1, total: arr.length }));
  }

  const chartsBySong = new Map<string, Chart[]>();
  for (const c of ds.charts) {
    const arr = chartsBySong.get(c.songId) ?? [];
    arr.push(c);
    chartsBySong.set(c.songId, arr);
  }

  const songs: AppSong[] = songsSorted.map((s) => {
    const vp = versionPos.get(s.id)!;
    const placements: AppPlacement[] = [
      { label: "Todas as músicas", position: allPos.get(s.id)!, total },
      { label: `Versão ${s.debutVersion}`, position: vp.position, total: vp.total },
    ];

    const charts: AppChart[] = (chartsBySong.get(s.id) ?? []).map((c) => ({
      id: c.id,
      label: chartLabel(c),
      mode: c.mode,
      level: c.level,
      stepmaker: c.stepmaker,
      types: c.types,
      youtubeUrl: c.youtubeUrl,
      placements: computeAllPlacements(c, ds, cats).map((p) => ({
        label: p.categoryName,
        position: p.position,
        total: p.total,
      })),
    }));

    return {
      id: s.id,
      title: s.title,
      titleKr: s.titleKr,
      titleNormalized: s.titleNormalized,
      artist: s.artist,
      bpmMin: s.bpmMin,
      bpmMax: s.bpmMax,
      debutVersion: s.debutVersion,
      category: s.category,
      releaseIndex: s.releaseIndex,
      variant: s.variant,
      placements,
      charts,
    };
  });

  return { songCount: songs.length, chartCount: ds.charts.length, songs, titles };
}
