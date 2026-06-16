import { describe, it, expect } from "vitest";
import { normalizeTitle } from "./normalize";

describe("normalizeTitle", () => {
  it("lowercases and trims", () => {
    expect(normalizeTitle("  Bee  ")).toBe("bee");
  });

  it("strips Latin diacritics", () => {
    expect(normalizeTitle("Café")).toBe("cafe");
  });

  it("removes the SHORT CUT / FULL SONG suffix", () => {
    expect(normalizeTitle("Overdive - SHORT CUT")).toBe("overdive");
    expect(normalizeTitle("Bad Apple!! - FULL SONG")).toBe("bad apple");
  });

  it("drops punctuation and collapses spaces", () => {
    expect(normalizeTitle("Love is a Danger Zone pt.2")).toBe("love is a danger zone pt 2");
  });

  it("keeps Hangul characters", () => {
    expect(normalizeTitle("벚꽃")).toBe("벚꽃".normalize("NFD"));
  });
});
