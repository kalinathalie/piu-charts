import { describe, expect, it } from "vitest";
import { classifyVariant } from "./variant";

describe("classifyVariant", () => {
  it("detects Full Song in various spellings", () => {
    expect(classifyVariant("Dignity FULL SONG")).toBe("FULLSONG");
    expect(classifyVariant("Teddy Bear (Full Song)")).toBe("FULLSONG");
    expect(classifyVariant("Bad Apple!! (feat. Nomico) FULL SONG")).toBe("FULLSONG");
  });

  it("detects Short Cut in various spellings", () => {
    expect(classifyVariant("Final Audition 3 SHORT CUT")).toBe("SHORTCUT");
    expect(classifyVariant("K.O.A: Alice in Wonderworld (Short Cut)")).toBe("SHORTCUT");
    expect(classifyVariant("Euphorianic -Short Cut-")).toBe("SHORTCUT");
    expect(classifyVariant("XX Opening (Short Cut)")).toBe("SHORTCUT");
  });

  it("detects Remix, including framed/wrapped forms", () => {
    expect(classifyVariant("Banya Classic Remix")).toBe("REMIX");
    expect(classifyVariant("BANYA HIPHOP REMIX")).toBe("REMIX");
    expect(classifyVariant("Stardream -Eurobeat Remix-")).toBe("REMIX");
    expect(classifyVariant("Le Nozze di Figaro ~Celebrazione Remix~")).toBe("REMIX");
    expect(classifyVariant("Banya-P Classic Mix REMIX")).toBe("REMIX");
  });

  it("leaves ordinary titles unclassified", () => {
    expect(classifyVariant("Overblow2")).toBeUndefined();
    expect(classifyVariant("Bee")).toBeUndefined();
    expect(classifyVariant("Love is a Danger Zone 2")).toBeUndefined();
    expect(classifyVariant("Ignis Fatuus(DM Ashura Mix)")).toBeUndefined();
    expect(classifyVariant("Final Audition")).toBeUndefined();
  });
});
