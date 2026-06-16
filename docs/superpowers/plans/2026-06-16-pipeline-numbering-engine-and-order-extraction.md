# Pipeline: Numbering Engine + Order Extraction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and test the deterministic core of the data pipeline — the chart numbering engine — and prove that the canonical song order can be extracted from the official preview videos, all validated against a hand-built sample dataset.

**Architecture:** A Node + TypeScript project under `/pipeline`. Pure, deterministic modules (data model, text normalization, fuzzy matching, sort/tiebreak, category derivation, numbering engine) are built test-first. I/O modules (ffmpeg frame sampling, tesseract OCR, order extraction) wrap external tools and are proven with fixtures plus a runnable spike script against a real video clip. The numbering "position/total" is never stored — it is computed at runtime from each song's `releaseIndex`.

**Tech Stack:** TypeScript, Vitest (test runner), tsx (run TS scripts), `fastest-levenshtein` (fuzzy distance), `tesseract.js` (OCR, eng+kor), `ffmpeg-static` (frame sampling), `yt-dlp` (already installed via pip, called for the spike).

**Scope note:** This plan is the pipeline foundation. Out of scope here (separate future plans): full catalog scraping of all Phoenix songs/charts metadata; the Expo Android app (Phase 2); automatic type classification (Phase 3). This plan uses a small hand-built sample catalog to exercise and validate the engine end-to-end.

**Spec:** `docs/superpowers/specs/2026-06-16-pump-it-up-chart-search-app-design.md`

---

## File Structure

```
/pipeline
  package.json                     — deps + scripts
  tsconfig.json                    — TS config
  vitest.config.ts                 — test config
  src/
    model/
      types.ts                     — Song, Chart, Dataset, Category, Placement, enums + label helpers
    text/
      normalize.ts                 — normalizeTitle()
      normalize.test.ts
      fuzzy.ts                     — similarity(), bestMatch()
      fuzzy.test.ts
    numbering/
      sort.ts                      — compareCharts(), compareSongs()
      sort.test.ts
      categories.ts                — deriveCategories()
      categories.test.ts
      engine.ts                    — computePlacement(), computeAllPlacements()
      engine.test.ts
    order/
      frames.ts                    — sampleFrames() (ffmpeg wrapper)
      frames.test.ts
      ocr.ts                       — ocrImage() (tesseract wrapper)
      ocr.test.ts
      extractOrder.ts              — extractOrderFromOcr()
      extractOrder.test.ts
    build/
      assignOrder.ts               — assignReleaseIndex(), applyOrder()
      assignOrder.test.ts
  fixtures/
    sample-catalog.json            — hand-built sample (songs + charts, no releaseIndex yet)
    sample-order.json              — expected ordered songId list for the sample
    expected-placements.json       — expected placements for chosen charts (validation gate)
  scripts/
    spike-order.ts                 — Phase 0: run real extraction on a video clip, dump for QA
  data/
    .gitkeep                       — generated datasets land here (gitignored)
```

---

## Task 1: Project scaffolding

**Files:**
- Create: `pipeline/package.json`
- Create: `pipeline/tsconfig.json`
- Create: `pipeline/vitest.config.ts`
- Create: `pipeline/src/sanity.test.ts`
- Create: `pipeline/.gitignore`

- [ ] **Step 1: Create `pipeline/package.json`**

```json
{
  "name": "piu-pipeline",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "spike:order": "tsx scripts/spike-order.ts"
  },
  "dependencies": {
    "fastest-levenshtein": "^1.0.16",
    "ffmpeg-static": "^5.2.0",
    "tesseract.js": "^5.1.1"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `pipeline/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node"],
    "noEmit": true
  },
  "include": ["src", "scripts"]
}
```

- [ ] **Step 3: Create `pipeline/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    testTimeout: 120_000, // OCR/ffmpeg integration tests need headroom
  },
});
```

- [ ] **Step 4: Create `pipeline/.gitignore`**

```
node_modules/
data/*
!data/.gitkeep
*.log
```

- [ ] **Step 5: Create `pipeline/src/sanity.test.ts`**

```typescript
import { describe, it, expect } from "vitest";

describe("sanity", () => {
  it("runs the test toolchain", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Install deps and run the sanity test**

Run:
```bash
cd pipeline && npm install && npx vitest run src/sanity.test.ts
```
Expected: PASS (1 test passed).

- [ ] **Step 7: Commit**

```bash
git add pipeline/package.json pipeline/tsconfig.json pipeline/vitest.config.ts pipeline/.gitignore pipeline/src/sanity.test.ts
git commit -m "chore(pipeline): scaffold Node+TS project with Vitest"
```

---

## Task 2: Data model

**Files:**
- Create: `pipeline/src/model/types.ts`

No test (types + pure label helpers; exercised by later tasks). A typecheck run validates it.

- [ ] **Step 1: Create `pipeline/src/model/types.ts`**

```typescript
export type Mode = "Single" | "Double" | "CoOp" | "SinglePerf" | "DoublePerf";

export type ChartType =
  | "DRILL" | "RUN" | "TWIST" | "GIMMICK"
  | "HALF" | "JUMP" | "STAIR" | "BRACKET";

export type Version =
  | "1st" | "Zero" | "NX" | "NXA"
  | "Fiesta" | "Fiesta2" | "Prime" | "Prime2" | "XX" | "Phoenix";

export interface Song {
  id: string;
  title: string;
  titleKr?: string;
  titleNormalized: string;
  artist: string;
  bpmMin: number;
  bpmMax: number;
  debutVersion: Version;
  /** Global release ordinal (1-based). Assigned by the order pipeline. */
  releaseIndex: number;
}

export interface Chart {
  id: string;
  songId: string;
  mode: Mode;
  level: number;
  stepmaker?: string;
  types: ChartType[];
  typesSource: "auto" | "manual" | "mixed";
}

export interface Dataset {
  songs: Song[];
  charts: Chart[];
}

export type CategoryKind = "LEVEL" | "VERSION" | "ALL";
export type CategoryUnit = "CHART" | "SONG";

export interface Category {
  id: string;
  name: string;
  kind: CategoryKind;
  unit: CategoryUnit;
  /** Membership test for a chart (song passed for convenience). */
  includesChart: (chart: Chart, song: Song) => boolean;
}

export interface Placement {
  categoryId: string;
  categoryName: string;
  position: number;
  total: number;
}

const MODE_PREFIX: Record<Mode, string> = {
  Single: "S",
  Double: "D",
  CoOp: "C",
  SinglePerf: "SP",
  DoublePerf: "DP",
};

export function modeLabel(mode: Mode): string {
  return MODE_PREFIX[mode];
}

export function chartLabel(chart: Chart): string {
  return `${MODE_PREFIX[chart.mode]}${chart.level}`;
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
cd pipeline && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add pipeline/src/model/types.ts
git commit -m "feat(pipeline): add data model types and label helpers"
```

---

## Task 3: Text normalization

**Files:**
- Create: `pipeline/src/text/normalize.ts`
- Test: `pipeline/src/text/normalize.test.ts`

Normalization makes OCR titles comparable to catalog titles: strip common video suffixes, strip Latin diacritics, lowercase, drop punctuation/symbols (keeping Unicode letters incl. Hangul + digits), collapse whitespace.

- [ ] **Step 1: Write the failing test**

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd pipeline && npx vitest run src/text/normalize.test.ts`
Expected: FAIL ("Failed to resolve import './normalize'").

- [ ] **Step 3: Write minimal implementation**

```typescript
const SUFFIX_RE = /\s*-\s*(short cut|full song|short ver\.?|remix)\s*$/i;

export function normalizeTitle(input: string): string {
  return input
    .replace(SUFFIX_RE, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip Latin combining diacritics
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ") // keep Unicode letters/digits + space
    .replace(/\s+/g, " ")
    .trim();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd pipeline && npx vitest run src/text/normalize.test.ts`
Expected: PASS (5 tests). Note the Hangul case compares against `.normalize("NFD")` because NFD decomposes Hangul into jamo — consistent on both sides, which is all the matcher needs.

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/text/normalize.ts pipeline/src/text/normalize.test.ts
git commit -m "feat(pipeline): add title normalization"
```

---

## Task 4: Fuzzy matching

**Files:**
- Create: `pipeline/src/text/fuzzy.ts`
- Test: `pipeline/src/text/fuzzy.test.ts`

Maps a noisy OCR title to the best catalog candidate using normalized Levenshtein similarity, with a confidence threshold.

- [ ] **Step 1: Write the failing test**

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd pipeline && npx vitest run src/text/fuzzy.test.ts`
Expected: FAIL ("Failed to resolve import './fuzzy'").

- [ ] **Step 3: Write minimal implementation**

```typescript
import { distance } from "fastest-levenshtein";

export interface Candidate {
  id: string;
  normalized: string;
}

export interface MatchResult {
  id: string;
  score: number;
}

export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - distance(a, b) / maxLen;
}

export function bestMatch(
  query: string,
  candidates: Candidate[],
  threshold = 0.6,
): MatchResult | null {
  let best: MatchResult | null = null;
  for (const c of candidates) {
    const score = similarity(query, c.normalized);
    if (!best || score > best.score) best = { id: c.id, score };
  }
  return best && best.score >= threshold ? best : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd pipeline && npx vitest run src/text/fuzzy.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/text/fuzzy.ts pipeline/src/text/fuzzy.test.ts
git commit -m "feat(pipeline): add fuzzy title matching"
```

---

## Task 5: Sort comparators

**Files:**
- Create: `pipeline/src/numbering/sort.ts`
- Test: `pipeline/src/numbering/sort.test.ts`

Defines the canonical ordering: by song `releaseIndex`, with a deterministic tiebreak `(mode order, level, id)` for charts and `(id)` for songs.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { compareCharts, compareSongs } from "./sort";
import type { Song, Chart } from "../model/types";

const song = (id: string, releaseIndex: number): Song => ({
  id, title: id, titleNormalized: id, artist: "a",
  bpmMin: 100, bpmMax: 100, debutVersion: "Prime", releaseIndex,
});

const chart = (id: string, songId: string, mode: Chart["mode"], level: number): Chart => ({
  id, songId, mode, level, types: [], typesSource: "auto",
});

describe("compareSongs", () => {
  it("orders by releaseIndex ascending", () => {
    const arr = [song("b", 5), song("a", 2)];
    arr.sort(compareSongs);
    expect(arr.map((s) => s.id)).toEqual(["a", "b"]);
  });
});

describe("compareCharts", () => {
  it("orders by song releaseIndex, then mode, then level", () => {
    const songs = new Map([
      ["x", song("x", 1)],
      ["y", song("y", 2)],
    ]);
    const charts = [
      chart("c4", "y", "Single", 20),
      chart("c2", "x", "Double", 16),
      chart("c1", "x", "Single", 16),
      chart("c3", "x", "Single", 20),
    ];
    charts.sort((a, b) => compareCharts(a, b, songs));
    expect(charts.map((c) => c.id)).toEqual(["c1", "c3", "c2", "c4"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd pipeline && npx vitest run src/numbering/sort.test.ts`
Expected: FAIL ("Failed to resolve import './sort'").

- [ ] **Step 3: Write minimal implementation**

```typescript
import type { Chart, Song, Mode } from "../model/types";

const MODE_ORDER: Record<Mode, number> = {
  Single: 0,
  SinglePerf: 1,
  Double: 2,
  DoublePerf: 3,
  CoOp: 4,
};

export function compareSongs(a: Song, b: Song): number {
  if (a.releaseIndex !== b.releaseIndex) return a.releaseIndex - b.releaseIndex;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function compareCharts(
  a: Chart,
  b: Chart,
  songById: Map<string, Song>,
): number {
  const sa = songById.get(a.songId)!;
  const sb = songById.get(b.songId)!;
  if (sa.releaseIndex !== sb.releaseIndex) return sa.releaseIndex - sb.releaseIndex;
  if (MODE_ORDER[a.mode] !== MODE_ORDER[b.mode]) return MODE_ORDER[a.mode] - MODE_ORDER[b.mode];
  if (a.level !== b.level) return a.level - b.level;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd pipeline && npx vitest run src/numbering/sort.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/numbering/sort.ts pipeline/src/numbering/sort.test.ts
git commit -m "feat(pipeline): add deterministic sort comparators"
```

---

## Task 6: Category derivation

**Files:**
- Create: `pipeline/src/numbering/categories.ts`
- Test: `pipeline/src/numbering/categories.test.ts`

Derives the navigable categories from a dataset: one LEVEL category per `(mode, level)` (unit = CHART), one VERSION category per `debutVersion` (unit = SONG), and one ALL category (unit = CHART).

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { deriveCategories } from "./categories";
import type { Dataset, Song, Chart } from "../model/types";

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd pipeline && npx vitest run src/numbering/categories.test.ts`
Expected: FAIL ("Failed to resolve import './categories'").

- [ ] **Step 3: Write minimal implementation**

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd pipeline && npx vitest run src/numbering/categories.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/numbering/categories.ts pipeline/src/numbering/categories.test.ts
git commit -m "feat(pipeline): derive navigable categories from dataset"
```

---

## Task 7: Numbering engine (the core)

**Files:**
- Create: `pipeline/src/numbering/engine.ts`
- Test: `pipeline/src/numbering/engine.test.ts`

`computePlacement` returns `{position, total}` for a chart in a category. CHART-unit categories rank charts; SONG-unit categories rank the chart's song among member songs. `computeAllPlacements` returns the placements across every category the chart belongs to. Includes the stability edge case: appending a newer song must not shift an earlier chart's position.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { computePlacement, computeAllPlacements } from "./engine";
import { deriveCategories } from "./categories";
import type { Dataset, Song, Chart } from "../model/types";

const song = (id: string, releaseIndex: number, debutVersion: Song["debutVersion"] = "Prime"): Song => ({
  id, title: id, titleNormalized: id, artist: "a", bpmMin: 100, bpmMax: 100, debutVersion, releaseIndex,
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd pipeline && npx vitest run src/numbering/engine.test.ts`
Expected: FAIL ("Failed to resolve import './engine'").

- [ ] **Step 3: Write minimal implementation**

```typescript
import type { Dataset, Chart, Category, Placement } from "../model/types";
import { compareCharts, compareSongs } from "./sort";

function songMap(ds: Dataset) {
  return new Map(ds.songs.map((s) => [s.id, s]));
}

export function computePlacement(chart: Chart, category: Category, ds: Dataset): Placement {
  const songById = songMap(ds);

  if (category.unit === "CHART") {
    const members = ds.charts.filter((c) => category.includesChart(c, songById.get(c.songId)!));
    members.sort((x, y) => compareCharts(x, y, songById));
    const idx = members.findIndex((c) => c.id === chart.id);
    return { categoryId: category.id, categoryName: category.name, position: idx + 1, total: members.length };
  }

  // SONG unit: rank the chart's song among distinct member songs
  const memberSongIds = new Set(
    ds.charts.filter((c) => category.includesChart(c, songById.get(c.songId)!)).map((c) => c.songId),
  );
  const memberSongs = ds.songs.filter((s) => memberSongIds.has(s.id));
  memberSongs.sort(compareSongs);
  const idx = memberSongs.findIndex((s) => s.id === chart.songId);
  return { categoryId: category.id, categoryName: category.name, position: idx + 1, total: memberSongs.length };
}

export function computeAllPlacements(chart: Chart, ds: Dataset, categories: Category[]): Placement[] {
  const song = ds.songs.find((s) => s.id === chart.songId)!;
  return categories
    .filter((cat) => cat.includesChart(chart, song))
    .map((cat) => computePlacement(chart, cat, ds));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd pipeline && npx vitest run src/numbering/engine.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/numbering/engine.ts pipeline/src/numbering/engine.test.ts
git commit -m "feat(pipeline): add numbering engine (position/total per category)"
```

---

## Task 8: Frame sampling (ffmpeg wrapper)

**Files:**
- Create: `pipeline/src/order/frames.ts`
- Test: `pipeline/src/order/frames.test.ts`

Wraps `ffmpeg` (from `ffmpeg-static`) to sample frames at a given fps into a directory. The test generates a 2-second synthetic video with ffmpeg, samples it at 1 fps, and asserts at least 2 frames are produced.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";
import { sampleFrames } from "./frames";

let dir: string;
let video: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "piu-frames-"));
  video = join(dir, "test.mp4");
  // 2s synthetic test video, 1 fps source
  execFileSync(ffmpegPath as string, [
    "-y", "-loglevel", "error",
    "-f", "lavfi", "-i", "testsrc=duration=2:size=320x180:rate=1",
    video,
  ]);
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("sampleFrames", () => {
  it("extracts frames at the requested fps", () => {
    const outDir = join(dir, "frames");
    const frames = sampleFrames(video, outDir, { ffmpegPath: ffmpegPath as string, fps: 1 });
    expect(frames.length).toBeGreaterThanOrEqual(2);
    expect(frames[0].path.endsWith(".png")).toBe(true);
    expect(frames[0].timestamp).toBeCloseTo(0, 1);
    expect(frames[1].timestamp).toBeCloseTo(1, 1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd pipeline && npx vitest run src/order/frames.test.ts`
Expected: FAIL ("Failed to resolve import './frames'").

- [ ] **Step 3: Write minimal implementation**

```typescript
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface FrameSamplingOptions {
  ffmpegPath: string;
  fps: number;
}

export interface SampledFrame {
  path: string;
  /** Seconds from the start of the input, derived from frame index / fps. */
  timestamp: number;
}

export function sampleFrames(
  videoPath: string,
  outDir: string,
  opts: FrameSamplingOptions,
): SampledFrame[] {
  mkdirSync(outDir, { recursive: true });
  execFileSync(opts.ffmpegPath, [
    "-y", "-loglevel", "error",
    "-i", videoPath,
    "-vf", `fps=${opts.fps}`,
    join(outDir, "frame_%05d.png"),
  ]);

  const files = readdirSync(outDir).filter((f) => f.endsWith(".png")).sort();
  return files.map((f, i) => ({ path: join(outDir, f), timestamp: i / opts.fps }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd pipeline && npx vitest run src/order/frames.test.ts`
Expected: PASS (1 test). (Requires the synthetic video step to succeed via `ffmpeg-static`.)

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/order/frames.ts pipeline/src/order/frames.test.ts
git commit -m "feat(pipeline): add ffmpeg frame sampling"
```

---

## Task 9: OCR wrapper (tesseract.js)

**Files:**
- Create: `pipeline/src/order/ocr.ts`
- Test: `pipeline/src/order/ocr.test.ts`

Wraps `tesseract.js`. The test renders an image with known text using ffmpeg's `drawtext` filter, OCRs it, and asserts the recognized text contains the word (normalized, case-insensitive).

> Note: `tesseract.js` downloads language traineddata on first run (network required once; it is then cached under the worker's cache dir). The test uses English only to keep it fast and deterministic.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";
import { ocrImage } from "./ocr";

let dir: string;
let image: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "piu-ocr-"));
  image = join(dir, "text.png");
  // White background with large black text "OVERDIVE"
  execFileSync(ffmpegPath as string, [
    "-y", "-loglevel", "error",
    "-f", "lavfi", "-i", "color=c=white:s=640x160",
    "-vf", "drawtext=text='OVERDIVE':fontcolor=black:fontsize=72:x=(w-text_w)/2:y=(h-text_h)/2",
    "-frames:v", "1", image,
  ]);
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("ocrImage", () => {
  it("reads rendered text", async () => {
    const text = await ocrImage(image, "eng");
    expect(text.toUpperCase().replace(/[^A-Z]/g, "")).toContain("OVERDIVE");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd pipeline && npx vitest run src/order/ocr.test.ts`
Expected: FAIL ("Failed to resolve import './ocr'").

- [ ] **Step 3: Write minimal implementation**

```typescript
import { createWorker } from "tesseract.js";

export async function ocrImage(path: string, langs = "eng+kor"): Promise<string> {
  const worker = await createWorker(langs);
  try {
    const { data } = await worker.recognize(path);
    return data.text.trim();
  } finally {
    await worker.terminate();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd pipeline && npx vitest run src/order/ocr.test.ts`
Expected: PASS (1 test). First run may take longer while traineddata downloads.

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/order/ocr.ts pipeline/src/order/ocr.test.ts
git commit -m "feat(pipeline): add tesseract OCR wrapper"
```

---

## Task 10: Order extraction logic

**Files:**
- Create: `pipeline/src/order/extractOrder.ts`
- Test: `pipeline/src/order/extractOrder.test.ts`

Pure logic that turns a list of `{timestamp, text}` OCR frames into an ordered list of matched songs. It normalizes each frame, fuzzy-matches against catalog candidates (English + Korean titles), drops non-matches, dedupes consecutive repeats, and records each song once at its first appearance. This is unit-tested by injecting OCR text directly (no video needed) so it is fully deterministic.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { extractOrderFromOcr, type OcrFrame } from "./extractOrder";
import type { Song } from "../model/types";

const song = (id: string, title: string, titleKr?: string): Song => ({
  id, title, titleNormalized: title.toLowerCase(), titleKr,
  artist: "a", bpmMin: 100, bpmMax: 100, debutVersion: "Prime", releaseIndex: 0,
});

const songs = [
  song("s1", "Overdive"),
  song("s2", "Bee"),
  song("s3", "Cherry Blossom", "벚꽃"),
];

describe("extractOrderFromOcr", () => {
  it("produces an ordered, deduped song sequence from noisy frames", () => {
    const frames: OcrFrame[] = [
      { timestamp: 0.0, text: "NEXT" },          // junk, no match
      { timestamp: 0.5, text: "0verdlve" },        // OCR error -> s1
      { timestamp: 1.0, text: "Overdive" },        // dup of s1
      { timestamp: 1.5, text: "Bee" },             // s2
      { timestamp: 2.0, text: "벚꽃" },             // s3 via Korean title
    ];
    const order = extractOrderFromOcr(frames, songs, 0.6);
    expect(order.map((o) => o.songId)).toEqual(["s1", "s2", "s3"]);
    expect(order[0].firstSeen).toBeCloseTo(0.5, 2);
  });

  it("does not re-add a song that reappears after others", () => {
    const frames: OcrFrame[] = [
      { timestamp: 0, text: "Overdive" },
      { timestamp: 1, text: "Bee" },
      { timestamp: 2, text: "Overdive" }, // jitter; must be ignored
    ];
    const order = extractOrderFromOcr(frames, songs, 0.6);
    expect(order.map((o) => o.songId)).toEqual(["s1", "s2"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd pipeline && npx vitest run src/order/extractOrder.test.ts`
Expected: FAIL ("Failed to resolve import './extractOrder'").

- [ ] **Step 3: Write minimal implementation**

```typescript
import type { Song } from "../model/types";
import { normalizeTitle } from "../text/normalize";
import { bestMatch, type Candidate } from "../text/fuzzy";

export interface OcrFrame {
  timestamp: number;
  text: string;
}

export interface OrderedEntry {
  songId: string;
  firstSeen: number;
  score: number;
}

function buildCandidates(songs: Song[]): Candidate[] {
  const out: Candidate[] = [];
  for (const s of songs) {
    out.push({ id: s.id, normalized: s.titleNormalized });
    if (s.titleKr) out.push({ id: s.id, normalized: normalizeTitle(s.titleKr) });
  }
  return out;
}

export function extractOrderFromOcr(
  frames: OcrFrame[],
  songs: Song[],
  threshold = 0.6,
): OrderedEntry[] {
  const candidates = buildCandidates(songs);
  const seen = new Set<string>();
  const result: OrderedEntry[] = [];
  let lastId: string | null = null;

  for (const f of frames) {
    const q = normalizeTitle(f.text);
    if (!q) continue;
    const m = bestMatch(q, candidates, threshold);
    if (!m) continue;
    if (m.id === lastId) continue; // consecutive duplicate
    lastId = m.id;
    if (seen.has(m.id)) continue; // reappearance jitter
    seen.add(m.id);
    result.push({ songId: m.id, firstSeen: f.timestamp, score: m.score });
  }

  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd pipeline && npx vitest run src/order/extractOrder.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/order/extractOrder.ts pipeline/src/order/extractOrder.test.ts
git commit -m "feat(pipeline): add order extraction from OCR frames"
```

---

## Task 11: Assign release index + apply order

**Files:**
- Create: `pipeline/src/build/assignOrder.ts`
- Test: `pipeline/src/build/assignOrder.test.ts`

Turns an ordered list of `songId`s into 1-based `releaseIndex` values and applies them to a dataset's songs. Songs not present in the order list keep `releaseIndex = 0` and are reported so they can be fixed via overrides.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { assignReleaseIndex, applyOrder } from "./assignOrder";
import type { Dataset, Song } from "../model/types";

const song = (id: string): Song => ({
  id, title: id, titleNormalized: id, artist: "a",
  bpmMin: 100, bpmMax: 100, debutVersion: "Prime", releaseIndex: 0,
});

describe("assignReleaseIndex", () => {
  it("maps ordered ids to 1-based indices", () => {
    const m = assignReleaseIndex(["b", "a", "c"]);
    expect(m.get("b")).toBe(1);
    expect(m.get("a")).toBe(2);
    expect(m.get("c")).toBe(3);
  });
});

describe("applyOrder", () => {
  it("sets releaseIndex and reports unordered songs", () => {
    const ds: Dataset = { songs: [song("a"), song("b"), song("z")], charts: [] };
    const { dataset, missing } = applyOrder(ds, ["b", "a"]);
    const byId = new Map(dataset.songs.map((s) => [s.id, s.releaseIndex]));
    expect(byId.get("b")).toBe(1);
    expect(byId.get("a")).toBe(2);
    expect(byId.get("z")).toBe(0);
    expect(missing).toEqual(["z"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd pipeline && npx vitest run src/build/assignOrder.test.ts`
Expected: FAIL ("Failed to resolve import './assignOrder'").

- [ ] **Step 3: Write minimal implementation**

```typescript
import type { Dataset } from "../model/types";

export function assignReleaseIndex(orderedSongIds: string[]): Map<string, number> {
  const m = new Map<string, number>();
  orderedSongIds.forEach((id, i) => m.set(id, i + 1));
  return m;
}

export function applyOrder(
  ds: Dataset,
  orderedSongIds: string[],
): { dataset: Dataset; missing: string[] } {
  const index = assignReleaseIndex(orderedSongIds);
  const songs = ds.songs.map((s) => ({ ...s, releaseIndex: index.get(s.id) ?? 0 }));
  const missing = songs.filter((s) => s.releaseIndex === 0).map((s) => s.id);
  return { dataset: { songs, charts: ds.charts }, missing };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd pipeline && npx vitest run src/build/assignOrder.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/build/assignOrder.ts pipeline/src/build/assignOrder.test.ts
git commit -m "feat(pipeline): assign releaseIndex from ordered song list"
```

---

## Task 12: Sample fixtures + validation gate

**Files:**
- Create: `pipeline/fixtures/sample-catalog.json`
- Create: `pipeline/fixtures/sample-order.json`
- Create: `pipeline/fixtures/expected-placements.json`
- Create: `pipeline/src/numbering/validation.test.ts`

A small hand-built sample wires every module together and locks the expected numbering. This is the automatable half of the validation gate; comparison against the real arcade stays manual (Task 13).

- [ ] **Step 1: Create `pipeline/fixtures/sample-catalog.json`**

```json
{
  "songs": [
    { "id": "love_danger_2", "title": "Love is a Danger Zone pt.2", "titleNormalized": "love is a danger zone pt 2", "artist": "BanYa", "bpmMin": 200, "bpmMax": 200, "debutVersion": "Prime", "releaseIndex": 0 },
    { "id": "overdive", "title": "Overdive", "titleNormalized": "overdive", "artist": "SHK", "bpmMin": 150, "bpmMax": 150, "debutVersion": "Prime", "releaseIndex": 0 },
    { "id": "bee", "title": "BEE", "titleNormalized": "bee", "artist": "BanYa", "bpmMin": 165, "bpmMax": 165, "debutVersion": "Prime", "releaseIndex": 0 }
  ],
  "charts": [
    { "id": "love2_s16", "songId": "love_danger_2", "mode": "Single", "level": 16, "stepmaker": "AOA", "types": ["DRILL"], "typesSource": "manual" },
    { "id": "love2_d20", "songId": "love_danger_2", "mode": "Double", "level": 20, "stepmaker": "AOA", "types": ["RUN"], "typesSource": "manual" },
    { "id": "overdive_s16", "songId": "overdive", "mode": "Single", "level": 16, "stepmaker": "SHK", "types": ["RUN"], "typesSource": "manual" },
    { "id": "bee_s16", "songId": "bee", "mode": "Single", "level": 16, "stepmaker": "BanYa", "types": ["DRILL"], "typesSource": "manual" }
  ]
}
```

- [ ] **Step 2: Create `pipeline/fixtures/sample-order.json`**

```json
["bee", "overdive", "love_danger_2"]
```

- [ ] **Step 3: Create `pipeline/fixtures/expected-placements.json`**

These are the placements after applying `sample-order.json` (release order: bee=1, overdive=2, love_danger_2=3). S16 charts sorted by song order: bee_s16(1), overdive_s16(2), love2_s16(3).

```json
{
  "bee_s16": [
    { "categoryId": "LEVEL:Single:16", "position": 1, "total": 3 },
    { "categoryId": "VERSION:Prime", "position": 1, "total": 3 },
    { "categoryId": "ALL", "position": 1, "total": 4 }
  ],
  "love2_s16": [
    { "categoryId": "LEVEL:Single:16", "position": 3, "total": 3 },
    { "categoryId": "VERSION:Prime", "position": 3, "total": 3 },
    { "categoryId": "ALL", "position": 4, "total": 4 }
  ],
  "love2_d20": [
    { "categoryId": "LEVEL:Double:20", "position": 1, "total": 1 },
    { "categoryId": "VERSION:Prime", "position": 3, "total": 3 },
    { "categoryId": "ALL", "position": 3, "total": 4 }
  ]
}
```

Note ALL is CHART-unit, so positions follow chart sort: bee_s16(1), overdive_s16(2), then love_danger_2's charts in mode order — love2_s16 (Single) before love2_d20 (Double). So love2_s16=ALL 4? Recompute: charts sorted by (releaseIndex, mode, level): bee_s16(rel1)=1, overdive_s16(rel2)=2, love2_s16(rel3,Single)=3, love2_d20(rel3,Double)=4. Therefore love2_s16 ALL=3 and love2_d20 ALL=4. Fix the JSON accordingly:

```json
{
  "bee_s16": [
    { "categoryId": "LEVEL:Single:16", "position": 1, "total": 3 },
    { "categoryId": "VERSION:Prime", "position": 1, "total": 3 },
    { "categoryId": "ALL", "position": 1, "total": 4 }
  ],
  "love2_s16": [
    { "categoryId": "LEVEL:Single:16", "position": 3, "total": 3 },
    { "categoryId": "VERSION:Prime", "position": 3, "total": 3 },
    { "categoryId": "ALL", "position": 3, "total": 4 }
  ],
  "love2_d20": [
    { "categoryId": "LEVEL:Double:20", "position": 1, "total": 1 },
    { "categoryId": "VERSION:Prime", "position": 3, "total": 3 },
    { "categoryId": "ALL", "position": 4, "total": 4 }
  ]
}
```

Write this corrected version to `pipeline/fixtures/expected-placements.json`.

- [ ] **Step 4: Write the failing validation test**

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Dataset } from "../model/types";
import { applyOrder } from "../build/assignOrder";
import { deriveCategories } from "./categories";
import { computeAllPlacements } from "./engine";

const root = join(__dirname, "..", "..", "fixtures");
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
```

- [ ] **Step 5: Run test to verify behavior**

Run: `cd pipeline && npx vitest run src/numbering/validation.test.ts`
Expected: PASS (4 tests: the missing-index check + one per expected chart). If a placement mismatches, fix `expected-placements.json` only if the engine is correct per the spec's sort rules — otherwise fix the engine.

- [ ] **Step 6: Commit**

```bash
git add pipeline/fixtures/ pipeline/src/numbering/validation.test.ts
git commit -m "test(pipeline): add sample fixtures and numbering validation gate"
```

---

## Task 13: Phase 0 spike — real order extraction + manual validation

**Files:**
- Create: `pipeline/scripts/spike-order.ts`
- Create: `pipeline/scripts/SPIKE.md`

This is the empirical de-risking step. The script downloads a short clip from the real video, samples frames, OCRs them, runs `extractOrderFromOcr` against the sample catalog, and prints the recovered sequence with timestamps and match scores for manual inspection. `SPIKE.md` records the runbook and the manual arcade-validation checklist.

> This task is investigative: thresholds, fps, and the title-crop region are tuned by running the script and reading output. The code below is the complete harness; tuning means editing the constants at the top and re-running, then recording findings in `SPIKE.md`.

- [ ] **Step 1: Create `pipeline/scripts/spike-order.ts`**

```typescript
/**
 * Phase 0 spike: prove order extraction on a real clip.
 *
 * Usage:
 *   cd pipeline
 *   npx tsx scripts/spike-order.ts <youtubeUrl> <startSec> <durationSec>
 *
 * Requires: yt-dlp on PATH (or `python -m yt_dlp`), ffmpeg via ffmpeg-static.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";
import { sampleFrames } from "../src/order/frames.js";
import { ocrImage } from "../src/order/ocr.js";
import { extractOrderFromOcr, type OcrFrame } from "../src/order/extractOrder.js";
import type { Dataset } from "../src/model/types.js";

const FPS = 2; // tune: higher catches fast transitions, slower to OCR
const THRESHOLD = 0.55; // tune: fuzzy-match confidence floor

async function main() {
  const [url, startSec, durSec] = process.argv.slice(2);
  if (!url || !startSec || !durSec) {
    console.error("usage: tsx scripts/spike-order.ts <url> <startSec> <durationSec>");
    process.exit(1);
  }

  const dir = mkdtempSync(join(tmpdir(), "piu-spike-"));
  const clip = join(dir, "clip.mp4");
  const section = `*${startSec}-${Number(startSec) + Number(durSec)}`;

  console.log("Downloading clip...");
  // Try yt-dlp on PATH; fall back to python module.
  const ytArgs = ["-q", "--no-warnings", "-f", "135",
    "--ffmpeg-location", ffmpegPath as string,
    "--download-sections", section, "-o", clip, url];
  try {
    execFileSync("yt-dlp", ytArgs, { stdio: "inherit" });
  } catch {
    execFileSync("python", ["-m", "yt_dlp", ...ytArgs], { stdio: "inherit" });
  }

  console.log("Sampling frames...");
  const frames = sampleFrames(clip, join(dir, "frames"), { ffmpegPath: ffmpegPath as string, fps: FPS });

  console.log(`OCR on ${frames.length} frames...`);
  const ocrFrames: OcrFrame[] = [];
  for (const f of frames) {
    const text = await ocrImage(f.path, "eng+kor");
    ocrFrames.push({ timestamp: Number(startSec) + f.timestamp, text });
  }

  const catalog = JSON.parse(
    readFileSync(join(import.meta.dirname, "..", "fixtures", "sample-catalog.json"), "utf8"),
  ) as Dataset;

  const order = extractOrderFromOcr(ocrFrames, catalog.songs, THRESHOLD);

  console.log("\n=== Raw OCR per frame ===");
  for (const f of ocrFrames) console.log(`${f.timestamp.toFixed(1)}s: ${JSON.stringify(f.text)}`);

  console.log("\n=== Recovered order ===");
  for (const o of order) {
    const s = catalog.songs.find((x) => x.id === o.songId)!;
    console.log(`${o.firstSeen.toFixed(1)}s  ${s.title}  (score ${o.score.toFixed(2)})`);
  }

  rmSync(dir, { recursive: true, force: true });
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run the spike against a real clip**

Run (English video, a slice where the sample songs appear — adjust timestamps after a first look):
```bash
cd pipeline && npx tsx scripts/spike-order.ts "https://www.youtube.com/watch?v=VkntM4p7-yA" 420 30
```
Expected: prints raw OCR per frame and a recovered order. Success = at least some sample songs are recovered in the right relative order. If recall is poor, tune `FPS`/`THRESHOLD` at the top of the script and/or add a title-region crop (see Step 3) and re-run.

- [ ] **Step 3: Record findings and runbook in `pipeline/scripts/SPIKE.md`**

```markdown
# Phase 0 Spike — Order Extraction

## How to run
cd pipeline
npx tsx scripts/spike-order.ts <youtubeUrl> <startSec> <durationSec>

Videos:
- English (1st→XX): https://www.youtube.com/watch?v=VkntM4p7-yA
- Full incl. Phoenix (2.11.0): https://www.youtube.com/watch?v=5wIJuYuhvkw

## Tuning knobs (top of spike-order.ts)
- FPS: frames sampled per second (start 2).
- THRESHOLD: fuzzy match floor (start 0.55).
- Title-region crop: if full-frame OCR is noisy, add an ffmpeg `crop` filter in
  sampleFrames input (the song title sits in the lower third of the frame).

## Findings (fill in after running)
- Best FPS: ___
- Best THRESHOLD: ___
- OCR quality at 360p: ___
- Korean titles (video 2) recall: ___
- Notable failures / titles needing overrides: ___

## Manual arcade validation checklist (numbering correctness)
Pick 5 charts spanning versions and levels. For each, on the real Phoenix machine,
browse the category and record the on-screen position/total, then compare to the app:

| Chart | Category | Arcade position/total | App position/total | Match? |
|-------|----------|-----------------------|--------------------|--------|
|       |          |                       |                    |        |

Decision gate: the numbering is "validated" only when the sampled charts match the
machine. Discrepancies feed back into sort/tiebreak rules or order overrides.
```

- [ ] **Step 4: Commit**

```bash
git add pipeline/scripts/spike-order.ts pipeline/scripts/SPIKE.md
git commit -m "feat(pipeline): add Phase 0 order-extraction spike + validation runbook"
```

---

## Task 14: Full test run + plan completion

**Files:** none (verification only)

- [ ] **Step 1: Run the full suite**

Run: `cd pipeline && npm test`
Expected: all unit/integration tests pass (sanity, normalize, fuzzy, sort, categories, engine, frames, ocr, extractOrder, assignOrder, validation).

- [ ] **Step 2: Typecheck**

Run: `cd pipeline && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit any cleanup**

```bash
git add -A
git commit -m "chore(pipeline): green test suite for numbering engine + order extraction" || echo "nothing to commit"
```

---

## Self-Review (completed during authoring)

**Spec coverage:**
- Data model (spec §5) → Task 2.
- Numbering engine + categories + sort/tiebreak + stability (spec §6) → Tasks 5, 6, 7, 12.
- Order from official videos via OCR + fuzzy-match to catalog (spec §10) → Tasks 3, 4, 8, 9, 10, 11, 13.
- Validation gate + manual arcade check (spec §12) → Tasks 12, 13.
- Korean title matching (spec §13 risk) → Tasks 3, 10.
- Stability-on-append property (spec §2) → Task 7.
- NOT in this plan (separate future plans, by design): full catalog scraping/metadata, the Expo app (Phase 2), type classification (Phase 3). Search (spec §7) and screens (spec §8) belong to the app plan.

**Placeholder scan:** No "TBD"/"add error handling"/"similar to" — all code steps contain full code. The Task 13 tuning is explicitly an empirical step with a complete harness, not a placeholder.

**Type consistency:** `Song`, `Chart`, `Dataset`, `Category`, `Placement`, `Mode`, `ChartType`, `Version` defined in Task 2 and used unchanged. `sampleFrames`/`SampledFrame`, `ocrImage`, `extractOrderFromOcr`/`OcrFrame`/`OrderedEntry`, `assignReleaseIndex`/`applyOrder`, `computePlacement`/`computeAllPlacements`, `deriveCategories`, `compareCharts`/`compareSongs`, `similarity`/`bestMatch`/`Candidate`, `normalizeTitle` — signatures match across tasks.
