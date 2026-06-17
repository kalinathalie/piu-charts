export type Mode = "Single" | "Double" | "CoOp" | "SinglePerf" | "DoublePerf";

export type ChartType =
  | "DRILL" | "RUN" | "TWIST" | "GIMMICK"
  | "HALF" | "JUMP" | "STAIR" | "BRACKET";

export type Version =
  | "1st" | "Zero" | "NX" | "NXA"
  | "Fiesta" | "Fiesta2" | "Prime" | "Prime2" | "XX" | "Phoenix";

export interface Song {
  id: string;
  title: string;
  titleKr?: string;
  titleNormalized: string;
  artist: string;
  bpmMin: number;
  bpmMax: number;
  debutVersion: Version;
  /** Global release ordinal (1-based). Assigned by the order pipeline. */
  releaseIndex: number;
}

export interface Chart {
  id: string;
  songId: string;
  mode: Mode;
  level: number;
  stepmaker?: string;
  types: ChartType[];
  typesSource: "auto" | "manual" | "mixed";
  /** Link to a play video for this specific chart, if known. */
  youtubeUrl?: string;
}

export interface Dataset {
  songs: Song[];
  charts: Chart[];
}

export type CategoryKind = "LEVEL" | "VERSION" | "ALL";
export type CategoryUnit = "CHART" | "SONG";

export interface Category {
  id: string;
  name: string;
  kind: CategoryKind;
  unit: CategoryUnit;
  /** Membership test for a chart (song passed for convenience). */
  includesChart: (chart: Chart, song: Song) => boolean;
}

export interface Placement {
  categoryId: string;
  categoryName: string;
  position: number;
  total: number;
}

const MODE_PREFIX: Record<Mode, string> = {
  Single: "S",
  Double: "D",
  CoOp: "C",
  SinglePerf: "SP",
  DoublePerf: "DP",
};

export function modeLabel(mode: Mode): string {
  return MODE_PREFIX[mode];
}

export function chartLabel(chart: Chart): string {
  return `${MODE_PREFIX[chart.mode]}${chart.level}`;
}
