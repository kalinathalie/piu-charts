import type { Dataset, Category, Mode, Version } from "../model/types";
import { modeLabel } from "../model/types";

export function deriveCategories(ds: Dataset): Category[] {
  const songById = new Map(ds.songs.map((s) => [s.id, s]));
  const cats: Category[] = [];

  // LEVEL categories per (mode, level)
  const levelKeys = new Set<string>();
  for (const c of ds.charts) levelKeys.add(`${c.mode}:${c.level}`);
  for (const key of [...levelKeys]) {
    const [mode, lvl] = key.split(":");
    const m = mode as Mode;
    const level = Number(lvl);
    cats.push({
      id: `LEVEL:${m}:${level}`,
      name: `Nível ${modeLabel(m)}${level}`,
      kind: "LEVEL",
      unit: "CHART",
      includesChart: (ch) => ch.mode === m && ch.level === level,
    });
  }

  // VERSION categories per debutVersion (unit SONG)
  const versions = new Set<Version>(ds.songs.map((s) => s.debutVersion));
  for (const v of [...versions]) {
    cats.push({
      id: `VERSION:${v}`,
      name: `Versão ${v}`,
      kind: "VERSION",
      unit: "SONG",
      includesChart: (ch) => songById.get(ch.songId)!.debutVersion === v,
    });
  }

  // ALL (unit CHART)
  cats.push({
    id: "ALL",
    name: "Todas",
    kind: "ALL",
    unit: "CHART",
    includesChart: () => true,
  });

  return cats;
}
