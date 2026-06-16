// Mirrors the shape produced by pipeline/src/build/appData.ts (toAppData).

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
  releaseIndex: number;
  placements: AppPlacement[];
  charts: AppChart[];
}

export interface AppData {
  songCount: number;
  chartCount: number;
  songs: AppSong[];
}

export function normalizeQuery(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
