import { describe, it, expect } from "vitest";
import { toAppData } from "./appData";
import type { Dataset } from "../model/types";

const ds: Dataset = {
  songs: [
    { id: "a", title: "A", titleNormalized: "a", artist: "", bpmMin: 100, bpmMax: 100, debutVersion: "Prime", releaseIndex: 1 },
    { id: "b", title: "B", titleNormalized: "b", artist: "", bpmMin: 100, bpmMax: 100, debutVersion: "Prime", releaseIndex: 2 },
    { id: "c", title: "C", titleNormalized: "c", artist: "", bpmMin: 100, bpmMax: 100, debutVersion: "XX", releaseIndex: 3 },
  ],
  charts: [
    { id: "b_s16", songId: "b", mode: "Single", level: 16, types: ["RUN"], typesSource: "manual" },
    { id: "a_s16", songId: "a", mode: "Single", level: 16, types: ["DRILL"], typesSource: "manual" },
  ],
};

describe("toAppData", () => {
  const data = toAppData(ds);

  it("computes song-level placements (all songs + version)", () => {
    const b = data.songs.find((s) => s.id === "b")!;
    expect(b.placements).toEqual([
      { label: "Todas as músicas", position: 2, total: 3 },
      { label: "Versão Prime", position: 2, total: 2 },
    ]);
    const c = data.songs.find((s) => s.id === "c")!;
    expect(c.placements).toContainEqual({ label: "Versão XX", position: 1, total: 1 });
  });

  it("attaches per-chart placements via the engine", () => {
    const b = data.songs.find((s) => s.id === "b")!;
    expect(b.charts).toHaveLength(1);
    const levelPlacement = b.charts[0].placements.find((p) => p.label === "Nível S16");
    // S16 charts ordered by song release: a_s16 (rel 1) then b_s16 (rel 2)
    expect(levelPlacement).toEqual({ label: "Nível S16", position: 2, total: 2 });
  });

  it("reports counts and is sorted by releaseIndex", () => {
    expect(data.songCount).toBe(3);
    expect(data.chartCount).toBe(2);
    expect(data.songs.map((s) => s.id)).toEqual(["a", "b", "c"]);
  });
});
