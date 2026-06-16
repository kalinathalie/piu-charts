import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Dataset } from "../model/types";
import { applyOrder } from "../build/assignOrder";
import { deriveCategories } from "./categories";
import { computeAllPlacements } from "./engine";

const root = join(import.meta.dirname, "..", "..", "fixtures");
const catalog = JSON.parse(readFileSync(join(root, "sample-catalog.json"), "utf8")) as Dataset;
const order = JSON.parse(readFileSync(join(root, "sample-order.json"), "utf8")) as string[];
const expected = JSON.parse(readFileSync(join(root, "expected-placements.json"), "utf8")) as Record<
  string,
  { categoryId: string; position: number; total: number }[]
>;

describe("validation gate (sample dataset)", () => {
  const { dataset, missing } = applyOrder(catalog, order);
  const cats = deriveCategories(dataset);

  it("every catalog song received a releaseIndex", () => {
    expect(missing).toEqual([]);
  });

  for (const [chartId, exp] of Object.entries(expected)) {
    it(`placements for ${chartId} match expectations`, () => {
      const chart = dataset.charts.find((c) => c.id === chartId)!;
      const got = computeAllPlacements(chart, dataset, cats);
      for (const e of exp) {
        const p = got.find((x) => x.categoryId === e.categoryId);
        expect(p, `missing category ${e.categoryId}`).toBeTruthy();
        expect(p).toMatchObject({ position: e.position, total: e.total });
      }
    });
  }
});
