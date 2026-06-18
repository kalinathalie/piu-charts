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
  category: "K-POP" | "ORIGINAL" | "WORLD" | "JMUSIC" | "XROSS";
  releaseIndex: number;
  variant?: "REMIX" | "SHORTCUT" | "FULLSONG";
  placements: AppPlacement[];
  charts: AppChart[];
}

export interface AppTitle {
  name: string;
  songId?: string;
  songTitle: string;
  chartLabel: string;
  requirement: string;
}

export interface AppTitleCategory {
  key: string;
  label: string;
  titles: AppTitle[];
}

export interface AppData {
  songCount: number;
  chartCount: number;
  songs: AppSong[];
  titles: AppTitleCategory[];
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
