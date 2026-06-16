import { describe, it, expect } from "vitest";
import { similarity, bestMatch } from "./fuzzy";

describe("similarity", () => {
  it("is 1 for identical strings", () => {
    expect(similarity("overdive", "overdive")).toBe(1);
  });

  it("is high for one-character OCR errors", () => {
    expect(similarity("overdlve", "overdive")).toBeGreaterThan(0.8);
  });
});

describe("bestMatch", () => {
  const candidates = [
    { id: "s1", normalized: "overdive" },
    { id: "s2", normalized: "bee" },
    { id: "s3", normalized: "love is a danger zone pt 2" },
  ];

  it("returns the closest candidate above threshold", () => {
    const m = bestMatch("0verdlve", candidates, 0.6);
    expect(m?.id).toBe("s1");
  });

  it("returns null when nothing clears the threshold", () => {
    expect(bestMatch("zzzzzzzz", candidates, 0.6)).toBeNull();
  });
});
