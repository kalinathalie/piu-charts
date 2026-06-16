import { describe, it, expect } from "vitest";
import { validateCatalog } from "./validateCatalog";
import type { Dataset } from "../model/types";

describe("validateCatalog", () => {
  it("flags duplicate song ids, dangling chart refs and bad levels", () => {
    const ds: Dataset = {
      songs: [
        { id: "a", title: "A", titleNormalized: "a", artist: "", bpmMin: 100, bpmMax: 100, debutVersion: "Prime", releaseIndex: 0 },
        { id: "a", title: "A2", titleNormalized: "a2", artist: "", bpmMin: 100, bpmMax: 100, debutVersion: "Prime", releaseIndex: 0 },
      ],
      charts: [
        { id: "c1", songId: "ghost", mode: "Single", level: 16, types: [], typesSource: "manual" },
        { id: "c2", songId: "a", mode: "Single", level: 0, types: [], typesSource: "manual" },
      ],
    };
    const errors = validateCatalog(ds);
    expect(errors.some((e) => e.includes("duplicate song id: a"))).toBe(true);
    expect(errors.some((e) => e.includes("unknown song ghost"))).toBe(true);
    expect(errors.some((e) => e.includes("invalid level"))).toBe(true);
  });

  it("returns no errors for a clean catalog", () => {
    const ds: Dataset = {
      songs: [{ id: "a", title: "A", titleNormalized: "a", artist: "", bpmMin: 100, bpmMax: 100, debutVersion: "Prime", releaseIndex: 0 }],
      charts: [{ id: "c1", songId: "a", mode: "Single", level: 16, types: [], typesSource: "manual" }],
    };
    expect(validateCatalog(ds)).toEqual([]);
  });
});
