import { serializePlaylist, parsePlaylistString } from "./format";

const allValid = () => true;

describe("serializePlaylist", () => {
  it("formats name, color, and chart ids", () => {
    expect(serializePlaylist({ name: "warmup", color: "#ebe721", chartIds: [1, 2, 10] })).toBe(
      '"warmup" #ebe721 (1 2 10)',
    );
  });

  it("escapes double quotes in the name", () => {
    expect(serializePlaylist({ name: 'my "best" mixes', color: "#ffffff", chartIds: [1] })).toBe(
      '"my \\"best\\" mixes" #ffffff (1)',
    );
  });

  it("round-trips a name with a trailing backslash", () => {
    const serialized = serializePlaylist({ name: "back\\slash", color: "#ffffff", chartIds: [1] });
    const result = parsePlaylistString(serialized, allValid) as { name: string };
    expect("error" in result).toBe(false);
    expect(result.name).toBe("back\\slash");
  });
});

describe("parsePlaylistString", () => {
  it("parses a well-formed string", () => {
    const result = parsePlaylistString('"warmup" #EBE721 (1 2 10)', allValid);
    expect(result).toEqual({ name: "warmup", color: "#ebe721", chartIds: [1, 2, 10], warnings: [] });
  });

  it("unescapes quotes in the name", () => {
    const result = parsePlaylistString('"my \\"best\\" mixes" #ffffff (1)', allValid);
    expect("error" in result).toBe(false);
    expect((result as { name: string }).name).toBe('my "best" mixes');
  });

  it("rejects structurally invalid input", () => {
    expect("error" in parsePlaylistString("not a playlist string", allValid)).toBe(true);
    expect("error" in parsePlaylistString('"no color" (1 2)', allValid)).toBe(true);
    expect("error" in parsePlaylistString('"no parens" #ffffff', allValid)).toBe(true);
  });

  it("drops unknown chart ids as a warning, best-effort", () => {
    const isValid = (id: number) => id !== 99;
    const result = parsePlaylistString('"warmup" #ffffff (1 99 2)', isValid) as {
      chartIds: number[];
      warnings: string[];
    };
    expect(result.chartIds).toEqual([1, 2]);
    expect(result.warnings).toEqual(["1 chart skipped (not found)"]);
  });

  it("dedupes chart ids", () => {
    const result = parsePlaylistString('"warmup" #ffffff (1 1 2)', allValid) as { chartIds: number[] };
    expect(result.chartIds).toEqual([1, 2]);
  });

  it("truncates chart ids past 100 with a warning", () => {
    const ids = Array.from({ length: 105 }, (_, i) => i + 1);
    const result = parsePlaylistString(`"warmup" #ffffff (${ids.join(" ")})`, allValid) as {
      chartIds: number[];
      warnings: string[];
    };
    expect(result.chartIds).toHaveLength(100);
    expect(result.warnings).toEqual(["5 charts skipped (playlist limit is 100)"]);
  });

  it("truncates an over-long name with a warning", () => {
    const longName = "x".repeat(60);
    const result = parsePlaylistString(`"${longName}" #ffffff (1)`, allValid) as {
      name: string;
      warnings: string[];
    };
    expect(result.name).toHaveLength(50);
    expect(result.warnings).toContain("name truncated to 50 characters");
  });
});
