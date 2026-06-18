import { describe, it, expect } from "vitest";
import { computePlacement, computeAllPlacements } from "./engine";
import { deriveCategories } from "./categories";
import type { Dataset, Song, Chart } from "../model/types";

const song = (id: string, releaseIndex: number, debutVersion: Song["debutVersion"] = "Prime"): Song => ({
  id, title: id, titleNormalized: id, artist: "a", category: "ORIGINAL", bpmMin: 100, bpmMax: 100, debutVersion, releaseIndex,
});
const chart = (id: string, songId: string, mode: Chart["mode"], level: number): Chart => ({
  id, songId, mode, level, types: [], typesSource: "auto",
});

const base: Dataset = {
  songs: [song("s1", 1), song("s2", 2), song("s3", 3)],
  charts: [
    chart("a", "s1", "Single", 16),
    chart("b", "s2", "Single", 16),
    chart("c", "s3", "Single", 16),
  ],
};

describe("computePlacement (CHART unit)", () => {
  it("ranks a chart within its level list", () => {
    const cat = deriveCategories(base).find((c) => c.id === "LEVEL:Single:16")!;
    const target = base.charts.find((c) => c.id === "b")!;
    expect(computePlacement(target, cat, base)).toMatchObject({ position: 2, total: 3 });
  });
});

describe("computePlacement (SONG unit)", () => {
  it("ranks the chart's song within its version list", () => {
    const cat = deriveCategories(base).find((c) => c.id === "VERSION:Prime")!;
    const target = base.charts.find((c) => c.id === "c")!;
    expect(computePlacement(target, cat, base)).toMatchObject({ position: 3, total: 3 });
  });
});

describe("stability", () => {
  it("appending a newer song does not shift earlier positions", () => {
    const cat = deriveCategories(base).find((c) => c.id === "LEVEL:Single:16")!;
    const target = base.charts.find((c) => c.id === "b")!;
    const before = computePlacement(target, cat, base);

    const withNew: Dataset = {
      songs: [...base.songs, song("s4", 4)],
      charts: [...base.charts, chart("d", "s4", "Single", 16)],
    };
    const catNew = deriveCategories(withNew).find((c) => c.id === "LEVEL:Single:16")!;
    const after = computePlacement(target, catNew, withNew);

    expect(after.position).toBe(before.position); // still 2
    expect(after.total).toBe(before.total + 1); // 3 -> 4
  });
});

describe("computeAllPlacements", () => {
  it("returns placements for every category the chart belongs to", () => {
    const cats = deriveCategories(base);
    const target = base.charts.find((c) => c.id === "a")!;
    const ids = computeAllPlacements(target, base, cats).map((p) => p.categoryId).sort();
    expect(ids).toEqual(["ALL", "LEVEL:Single:16", "VERSION:Prime"]);
  });
});
