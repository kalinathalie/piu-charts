import { describe, it, expect } from "vitest";
import { deriveCategories } from "./categories";
import type { Dataset } from "../model/types";

const ds: Dataset = {
  songs: [
    { id: "x", title: "X", titleNormalized: "x", artist: "a", bpmMin: 100, bpmMax: 100, debutVersion: "Prime", releaseIndex: 1 },
    { id: "y", title: "Y", titleNormalized: "y", artist: "a", bpmMin: 100, bpmMax: 100, debutVersion: "XX", releaseIndex: 2 },
  ],
  charts: [
    { id: "c1", songId: "x", mode: "Single", level: 16, types: [], typesSource: "auto" },
    { id: "c2", songId: "x", mode: "Double", level: 20, types: [], typesSource: "auto" },
    { id: "c3", songId: "y", mode: "Single", level: 16, types: [], typesSource: "auto" },
  ],
};

describe("deriveCategories", () => {
  it("creates one LEVEL category per (mode, level)", () => {
    const ids = deriveCategories(ds).filter((c) => c.kind === "LEVEL").map((c) => c.id).sort();
    expect(ids).toEqual(["LEVEL:Double:20", "LEVEL:Single:16"]);
  });

  it("creates one VERSION category per debutVersion", () => {
    const ids = deriveCategories(ds).filter((c) => c.kind === "VERSION").map((c) => c.id).sort();
    expect(ids).toEqual(["VERSION:Prime", "VERSION:XX"]);
  });

  it("creates a single ALL category that includes everything", () => {
    const all = deriveCategories(ds).find((c) => c.kind === "ALL")!;
    expect(all.unit).toBe("CHART");
    expect(ds.charts.every((c) => all.includesChart(c, ds.songs.find((s) => s.id === c.songId)!))).toBe(true);
  });

  it("LEVEL:Single:16 membership matches only S16 charts", () => {
    const cat = deriveCategories(ds).find((c) => c.id === "LEVEL:Single:16")!;
    const members = ds.charts.filter((c) => cat.includesChart(c, ds.songs.find((s) => s.id === c.songId)!));
    expect(members.map((c) => c.id).sort()).toEqual(["c1", "c3"]);
  });
});
