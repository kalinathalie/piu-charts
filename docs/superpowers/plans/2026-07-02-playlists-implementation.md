# Playlists Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Playlists feature (create/edit/delete/reorder/share/import charts into named, colored playlists) to the PIU Charts Expo app, per `docs/superpowers/specs/2026-07-02-playlists-design.md`.

**Architecture:** Pure logic (share-string format, storage serialization, playlist mutations) lives in new, dependency-free `src/playlists/*.ts` modules with Jest unit tests. A thin `usePlaylists()` React hook wires that logic to AsyncStorage/localStorage and React state. Shared UI pieces currently private to `App.tsx` (`styles`, `Thumb`, `ChartRow`, `SongRow`, `modeRowStyle`) are extracted to `src/uiKit.tsx` so both `App.tsx` and the new playlist screens can use them without a circular import. New playlist screens are added as their own files under `src/playlists/` and wired into `App.tsx`'s existing `Screen` union / `Body` switch / `Home` menu.

**Tech Stack:** Expo 56, React Native 0.85, TypeScript (strict), Jest + ts-jest (new, for pure-logic unit tests only — no React Native component test runner is introduced, matching the fact that the codebase currently has zero component tests and adding `jest-expo`/RNTL is out of scope for this feature).

## Global Constraints

- Playlist name: max 50 characters.
- Playlist color: `#rrggbb` (6 hex digits), stored lowercase.
- Playlist size: max 100 chart entries, no duplicate chart entries (adding an existing entry is a no-op).
- A playlist entry is a **chart** (specific mode/level), identified by the numeric value of that chart's existing "Todas" placement `position` field (already a stable 1..chartCount index) — not a new ID scheme.
- Share string format: `"name" #rrggbb (id id id ...)`, name quotes escaped as `\"`.
- Import: reject the whole string if it doesn't match the structural pattern (quotes/color/parens); if it does match, apply best-effort content fixups (drop unknown/invalid chart ids, dedupe, truncate to 100, truncate name to 50 chars) and show a summary.
- Storage: `@react-native-async-storage/async-storage` on native (`Platform.OS !== "web"`), `localStorage` on web (`Platform.OS === "web"`). Single JSON blob under key `"playlists"`.
- Playlists list sorted by `modifiedAt` descending (newest first); any rename/recolor/add/remove/reorder bumps `modifiedAt`.
- Deleting a playlist requires an `Alert.alert` confirmation (no undo).
- New dependencies: `@react-native-async-storage/async-storage`, `react-native-svg`, `react-native-qrcode-svg`, `expo-camera` (native QR scanning), `jest` + `ts-jest` + `@types/jest` (dev, for pure-logic tests).

---

### Task 1: Chart index extraction + Jest infra

**Files:**
- Create: `src/chartIndex.ts`
- Create: `src/chartIndex.test.ts`
- Modify: `App.tsx:23-24, 48-54` (remove local `FlatChart`/`allCharts`/`songById`, import from `src/chartIndex.ts` instead)
- Create: `jest.config.js`
- Modify: `package.json` (add `"test": "jest"` script and devDependencies)

**Interfaces:**
- Produces: `export interface FlatChart { song: AppSong; chart: AppChart }`, `export const allCharts: FlatChart[]`, `export const songById: Map<string, AppSong>`, `export const chartByGlobalIndex: Map<number, FlatChart>` (keyed by each chart's "Todas" placement `position`).
- Consumes: `AppData`, `AppSong`, `AppChart` from `./appData` (already exist at `src/appData.ts`), `rawData` from `../assets/app-data.json`.

- [ ] **Step 1: Install Jest**

Run: `npm install --save-dev jest ts-jest @types/jest`
Expected: packages added to `devDependencies` in `package.json`.

- [ ] **Step 2: Add Jest config**

Create `jest.config.js`:

```js
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/*.test.ts"],
};
```

Add to `package.json` `"scripts"`: `"test": "jest"`.

- [ ] **Step 3: Write the failing test**

Create `src/chartIndex.test.ts`:

```ts
import { allCharts, chartByGlobalIndex, songById } from "./chartIndex";

describe("chartIndex", () => {
  it("builds one FlatChart per song/chart pair", () => {
    const total = allCharts.length;
    expect(total).toBeGreaterThan(0);
    expect(total).toBe(
      allCharts.reduce((sum, fc) => sum + (fc.song.charts.includes(fc.chart) ? 1 : 0), 0),
    );
  });

  it("maps chartByGlobalIndex using each chart's Todas placement position", () => {
    for (const fc of allCharts) {
      const todas = fc.chart.placements.find((p) => p.label === "Todas");
      if (!todas) continue;
      expect(chartByGlobalIndex.get(todas.position)).toBe(fc);
    }
  });

  it("indexes songs by id", () => {
    const first = allCharts[0].song;
    expect(songById.get(first.id)).toBe(first);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx jest src/chartIndex.test.ts`
Expected: FAIL — `Cannot find module './chartIndex'`

- [ ] **Step 5: Write the implementation**

Create `src/chartIndex.ts`:

```ts
import rawData from "../assets/app-data.json";
import type { AppData, AppChart, AppSong } from "./appData";

const data = rawData as AppData;

export interface FlatChart {
  song: AppSong;
  chart: AppChart;
}

export const songById = new Map(data.songs.map((s) => [s.id, s]));

export const allCharts: FlatChart[] = data.songs.flatMap((s) =>
  s.charts.map((chart) => ({ song: s, chart })),
);

export const chartByGlobalIndex: Map<number, FlatChart> = new Map();
for (const fc of allCharts) {
  const todas = fc.chart.placements.find((p) => p.label === "Todas");
  if (todas) chartByGlobalIndex.set(todas.position, fc);
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx jest src/chartIndex.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 7: Update App.tsx to use the extracted module**

In `App.tsx`, replace:

```ts
import rawData from "./assets/app-data.json";
import { normalizeQuery, type AppData, type AppSong, type AppChart, type AppTitle } from "./src/appData";
import { THUMBS } from "./src/thumbs";

const data = rawData as AppData;
const songById = new Map(data.songs.map((s) => [s.id, s]));
```

with:

```ts
import rawData from "./assets/app-data.json";
import { normalizeQuery, type AppData, type AppSong, type AppChart, type AppTitle } from "./src/appData";
import { THUMBS } from "./src/thumbs";
import { allCharts, songById, type FlatChart } from "./src/chartIndex";

const data = rawData as AppData;
```

Remove the now-duplicate lines further down:

```ts
interface FlatChart {
  song: AppSong;
  chart: AppChart;
}

// ---- derived datasets (computed once) ----
const allCharts: FlatChart[] = data.songs.flatMap((s) => s.charts.map((chart) => ({ song: s, chart })));
```

(Keep everything below that, e.g. `stdCharts`, unchanged — it already consumes `allCharts`.)

- [ ] **Step 8: Typecheck and confirm the app still builds**

Run: `npm run typecheck`
Expected: no errors.

---

### Task 2: UI kit extraction

**Files:**
- Create: `src/uiKit.tsx`
- Modify: `App.tsx` (remove `styles`, `Thumb`, `modeRowStyle`, `ChartRow`, `SongRow` definitions; import from `src/uiKit.tsx`; extend `ChartRow`/`SongRow` call sites are unaffected since props are additive)

**Interfaces:**
- Consumes: `FlatChart` from `./chartIndex`, `THUMBS` from `./thumbs`, `AppSong` from `./appData`.
- Produces: `export const styles` (the full `StyleSheet.create({...})` object, unchanged contents), `export function modeRowStyle(mode?: string)`, `export function Thumb({ id, size, radius }: { id: string; size: number; radius: number })`, `export function ChartRow({ item, push, badge, pick }: { item: FlatChart; push: (s: Screen) => void; badge: string; pick?: { active: boolean; onToggle: () => void } })`, `export function SongRow({ song, onPress, badge, pick }: { song: AppSong; onPress: () => void; badge?: string; pick?: { active: boolean; onToggle: () => void } })`.
- The `pick` prop (used by Task 8) is optional and additive: when present, the row renders a toggle button (✓ if `active`, + otherwise) calling `pick.onToggle()` on press *instead of* navigating; when absent, behavior is identical to today.

- [ ] **Step 1: Create `src/uiKit.tsx` with the moved code, extended for pick mode**

Move the entire `styles` object (`App.tsx:719-909`) and the functions `modeRowStyle` (`App.tsx:96-99`), `Thumb` (`App.tsx:633-638`), `ChartRow` (`App.tsx:499-517`), `SongRow` (`App.tsx:615-631`) verbatim into `src/uiKit.tsx`, with these adjustments:

```tsx
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { AppSong } from "./appData";
import type { FlatChart } from "./chartIndex";
import { THUMBS } from "./thumbs";

export interface PickToggle {
  active: boolean;
  onToggle: () => void;
}

export function modeRowStyle(mode?: string) {
  const m = (mode ?? "").toLowerCase();
  return m === "single" ? styles.rowSingle : m === "double" ? styles.rowDouble : styles.rowCoop;
}

export function Thumb({ id, size, radius }: { id: string; size: number; radius: number }) {
  const src = THUMBS[id];
  const style = { width: size, height: size, borderRadius: radius };
  if (src) return <Image source={src} style={style} resizeMode="cover" />;
  return <View style={[style, styles.thumbPlaceholder]} />;
}

export function ChartRow({
  item,
  push,
  badge,
  pick,
}: {
  item: FlatChart;
  push: (s: { k: "song"; id: string }) => void;
  badge: string;
  pick?: PickToggle;
}) {
  return (
    <Pressable
      style={styles.row}
      onPress={pick ? pick.onToggle : () => push({ k: "song", id: item.song.id })}
    >
      <Thumb id={item.song.id} size={48} radius={8} />
      <View style={[styles.flex, styles.rowText]}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {item.song.title}
        </Text>
        <Text style={styles.rowMeta}>
          {item.song.debutVersion}
          {item.chart.stepmaker ? ` · ${item.chart.stepmaker}` : ""}
        </Text>
      </View>
      {pick ? (
        <Text style={styles.pickToggle}>{pick.active ? "✓" : "+"}</Text>
      ) : (
        <View style={[styles.diffBadge, modeRowStyle(item.chart.mode)]}>
          <Text style={styles.diffBadgeText}>{badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function SongRow({
  song,
  onPress,
  badge,
  pick,
}: {
  song: AppSong;
  onPress: () => void;
  badge?: string;
  pick?: PickToggle;
}) {
  return (
    <Pressable style={styles.row} onPress={pick ? pick.onToggle : onPress}>
      <Thumb id={song.id} size={48} radius={8} />
      <View style={[styles.flex, styles.rowText]}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {song.title}
        </Text>
        <Text style={styles.rowMeta}>
          {song.debutVersion}
          {song.artist ? ` · ${song.artist}` : ""}
        </Text>
      </View>
      {pick ? (
        <Text style={styles.pickToggle}>{pick.active ? "✓" : "+"}</Text>
      ) : (
        <Text style={styles.badge}>{badge ?? `#${song.releaseIndex}`}</Text>
      )}
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  // ...moved verbatim from App.tsx's existing styles object...
  // (copy every key from App.tsx:719-909 unchanged)
  pickToggle: { color: "#5a6cff", fontSize: 22, fontWeight: "800", minWidth: 32, textAlign: "center" },
});
```

(The implementer copies the full existing `styles` body verbatim — every key from `App.tsx:719-909` — into this `StyleSheet.create({...})` call, then adds the one new `pickToggle` key shown above.)

- [ ] **Step 2: Update `App.tsx` to import from `uiKit.tsx`**

Replace the removed definitions in `App.tsx` with:

```ts
import { styles, modeRowStyle, Thumb, ChartRow, SongRow } from "./src/uiKit";
```

Delete from `App.tsx`: the `modeRowStyle` function (lines 96-99), the `ChartRow` function (lines 499-517), the `SongRow` function (lines 615-631), the `Thumb` function (lines 633-638), and the entire `const styles = StyleSheet.create({...})` block (lines 719-909). Remove `StyleSheet` and `Image` from the `react-native` import list in `App.tsx` if no longer used elsewhere in the file (check remaining usages first with `grep -n "StyleSheet\.\|<Image" App.tsx` before removing — `StyleSheet.hairlineWidth` is only used inside the moved `styles` object, so it should be safe to drop, but confirm).

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Manually verify the app still renders identically**

Run: `npm run web` and open the app in a browser. Confirm: Home menu renders, Search screen shows song rows with the `#releaseIndex` badge (not the pick toggle, since no `pick` prop is passed anywhere yet), a Difficulty chart list shows `ChartRow`s with their level badges. This confirms the extraction didn't change existing behavior.

---

### Task 3: Playlist domain types, id generator, share-string format

**Files:**
- Create: `src/playlists/types.ts`
- Create: `src/playlists/id.ts`
- Create: `src/playlists/format.ts`
- Create: `src/playlists/format.test.ts`

**Interfaces:**
- Produces: `export interface Playlist { id: string; name: string; color: string; chartIds: number[]; createdAt: number; modifiedAt: number }` (`types.ts`); `export function generateId(): string` (`id.ts`); `export function serializePlaylist(p: Pick<Playlist, "name" | "color" | "chartIds">): string`, `export interface ParsedPlaylist { name: string; color: string; chartIds: number[]; warnings: string[] }`, `export function parsePlaylistString(input: string, isValidChartId: (id: number) => boolean): ParsedPlaylist | { error: string }` (`format.ts`).
- Consumes: nothing outside this module (pure logic — `isValidChartId` is injected so `format.ts` has no dependency on `chartIndex.ts`, keeping it independently testable).

- [ ] **Step 1: Write `src/playlists/types.ts`**

```ts
export interface Playlist {
  id: string;
  name: string;
  color: string;
  chartIds: number[];
  createdAt: number;
  modifiedAt: number;
}

export const PLAYLIST_NAME_MAX = 50;
export const PLAYLIST_SONGS_MAX = 100;
```

- [ ] **Step 2: Write `src/playlists/id.ts`**

```ts
export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
```

- [ ] **Step 3: Write the failing tests for `format.ts`**

Create `src/playlists/format.test.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx jest src/playlists/format.test.ts`
Expected: FAIL — `Cannot find module './format'`

- [ ] **Step 5: Write `src/playlists/format.ts`**

```ts
import { PLAYLIST_NAME_MAX, PLAYLIST_SONGS_MAX } from "./types";

const PATTERN = /^"((?:[^"\\]|\\.)*)"\s*#([0-9a-fA-F]{6})\s*\(([\d\s]*)\)$/;

export function serializePlaylist(p: { name: string; color: string; chartIds: number[] }): string {
  const escapedName = p.name.replace(/"/g, '\\"');
  return `"${escapedName}" ${p.color} (${p.chartIds.join(" ")})`;
}

export interface ParsedPlaylist {
  name: string;
  color: string;
  chartIds: number[];
  warnings: string[];
}

export function parsePlaylistString(
  input: string,
  isValidChartId: (id: number) => boolean,
): ParsedPlaylist | { error: string } {
  const match = PATTERN.exec(input.trim());
  if (!match) return { error: "Not a valid playlist string." };

  const [, rawName, rawColor, rawIds] = match;
  const warnings: string[] = [];

  let name = rawName.replace(/\\"/g, '"');
  if (name.length > PLAYLIST_NAME_MAX) {
    name = name.slice(0, PLAYLIST_NAME_MAX);
    warnings.push(`name truncated to ${PLAYLIST_NAME_MAX} characters`);
  }

  const color = `#${rawColor.toLowerCase()}`;

  const parsedIds = rawIds
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => Number.parseInt(s, 10));

  const seen = new Set<number>();
  const validIds: number[] = [];
  let skippedUnknown = 0;
  for (const id of parsedIds) {
    if (!Number.isInteger(id) || !isValidChartId(id)) {
      skippedUnknown++;
      continue;
    }
    if (seen.has(id)) continue;
    seen.add(id);
    validIds.push(id);
  }
  if (skippedUnknown > 0) {
    warnings.push(`${skippedUnknown} chart${skippedUnknown === 1 ? "" : "s"} skipped (not found)`);
  }

  let chartIds = validIds;
  if (chartIds.length > PLAYLIST_SONGS_MAX) {
    const overflow = chartIds.length - PLAYLIST_SONGS_MAX;
    chartIds = chartIds.slice(0, PLAYLIST_SONGS_MAX);
    warnings.push(`${overflow} chart${overflow === 1 ? "" : "s"} skipped (playlist limit is ${PLAYLIST_SONGS_MAX})`);
  }

  return { name, color, chartIds, warnings };
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx jest src/playlists/format.test.ts`
Expected: PASS (all tests)

---

### Task 4: Playlist mutations (pure logic)

**Files:**
- Create: `src/playlists/mutations.ts`
- Create: `src/playlists/mutations.test.ts`

**Interfaces:**
- Consumes: `Playlist`, `PLAYLIST_NAME_MAX`, `PLAYLIST_SONGS_MAX` from `./types`; `generateId` from `./id`; `ParsedPlaylist` from `./format`.
- Produces: `export function createPlaylist(playlists: Playlist[], name: string, color: string): Playlist[]`, `export function renamePlaylist(playlists: Playlist[], id: string, name: string): Playlist[]`, `export function recolorPlaylist(playlists: Playlist[], id: string, color: string): Playlist[]`, `export function addChart(playlists: Playlist[], id: string, chartId: number): Playlist[]`, `export function removeChart(playlists: Playlist[], id: string, chartId: number): Playlist[]`, `export function reorderChart(playlists: Playlist[], id: string, fromIndex: number, toIndex: number): Playlist[]`, `export function deletePlaylist(playlists: Playlist[], id: string): Playlist[]`, `export function importPlaylist(playlists: Playlist[], parsed: ParsedPlaylist): Playlist[]`, `export function sortByModifiedDesc(playlists: Playlist[]): Playlist[]`. All functions are pure: they return a new array and never mutate the input.

- [ ] **Step 1: Write the failing tests**

Create `src/playlists/mutations.test.ts`:

```ts
import {
  createPlaylist,
  renamePlaylist,
  recolorPlaylist,
  addChart,
  removeChart,
  reorderChart,
  deletePlaylist,
  importPlaylist,
  sortByModifiedDesc,
} from "./mutations";
import type { Playlist } from "./types";

function makePlaylist(overrides: Partial<Playlist> = {}): Playlist {
  return {
    id: "p1",
    name: "warmup",
    color: "#ffffff",
    chartIds: [1, 2, 3],
    createdAt: 1000,
    modifiedAt: 1000,
    ...overrides,
  };
}

describe("createPlaylist", () => {
  it("appends a new playlist with the given name/color and no charts", () => {
    const result = createPlaylist([], "warmup", "#ffffff");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ name: "warmup", color: "#ffffff", chartIds: [] });
    expect(result[0].createdAt).toBe(result[0].modifiedAt);
  });

  it("truncates the name to 50 characters", () => {
    const result = createPlaylist([], "x".repeat(60), "#ffffff");
    expect(result[0].name).toHaveLength(50);
  });
});

describe("renamePlaylist / recolorPlaylist", () => {
  it("updates name and bumps modifiedAt", () => {
    const before = [makePlaylist()];
    const after = renamePlaylist(before, "p1", "new name");
    expect(after[0].name).toBe("new name");
    expect(after[0].modifiedAt).toBeGreaterThanOrEqual(before[0].modifiedAt);
    expect(before[0].name).toBe("warmup"); // original untouched
  });

  it("updates color and bumps modifiedAt", () => {
    const after = recolorPlaylist([makePlaylist()], "p1", "#000000");
    expect(after[0].color).toBe("#000000");
  });
});

describe("addChart / removeChart", () => {
  it("adds a new chart id", () => {
    const after = addChart([makePlaylist({ chartIds: [1] })], "p1", 2);
    expect(after[0].chartIds).toEqual([1, 2]);
  });

  it("is a no-op when the chart is already present", () => {
    const before = makePlaylist({ chartIds: [1, 2] });
    const after = addChart([before], "p1", 2);
    expect(after[0].chartIds).toEqual([1, 2]);
    expect(after[0].modifiedAt).toBe(before.modifiedAt);
  });

  it("refuses to add past the 100-chart cap", () => {
    const full = makePlaylist({ chartIds: Array.from({ length: 100 }, (_, i) => i + 1) });
    const after = addChart([full], "p1", 999);
    expect(after[0].chartIds).toHaveLength(100);
  });

  it("removes a chart id", () => {
    const after = removeChart([makePlaylist({ chartIds: [1, 2, 3] })], "p1", 2);
    expect(after[0].chartIds).toEqual([1, 3]);
  });
});

describe("reorderChart", () => {
  it("moves a chart id from one index to another", () => {
    const after = reorderChart([makePlaylist({ chartIds: [1, 2, 3] })], "p1", 0, 2);
    expect(after[0].chartIds).toEqual([2, 3, 1]);
  });
});

describe("deletePlaylist", () => {
  it("removes the playlist by id", () => {
    const after = deletePlaylist([makePlaylist(), makePlaylist({ id: "p2" })], "p1");
    expect(after.map((p) => p.id)).toEqual(["p2"]);
  });
});

describe("importPlaylist", () => {
  it("creates a new playlist from parsed data with a generated color-agnostic default", () => {
    const after = importPlaylist([], { name: "shared", color: "#123456", chartIds: [1, 2], warnings: [] });
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ name: "shared", color: "#123456", chartIds: [1, 2] });
  });
});

describe("sortByModifiedDesc", () => {
  it("sorts newest modifiedAt first", () => {
    const a = makePlaylist({ id: "a", modifiedAt: 100 });
    const b = makePlaylist({ id: "b", modifiedAt: 300 });
    const c = makePlaylist({ id: "c", modifiedAt: 200 });
    expect(sortByModifiedDesc([a, b, c]).map((p) => p.id)).toEqual(["b", "c", "a"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/playlists/mutations.test.ts`
Expected: FAIL — `Cannot find module './mutations'`

- [ ] **Step 3: Write `src/playlists/mutations.ts`**

```ts
import { generateId } from "./id";
import type { ParsedPlaylist } from "./format";
import { PLAYLIST_NAME_MAX, PLAYLIST_SONGS_MAX, type Playlist } from "./types";

function touch(p: Playlist): Playlist {
  return { ...p, modifiedAt: Date.now() };
}

function updateById(playlists: Playlist[], id: string, fn: (p: Playlist) => Playlist): Playlist[] {
  return playlists.map((p) => (p.id === id ? fn(p) : p));
}

export function createPlaylist(playlists: Playlist[], name: string, color: string): Playlist[] {
  const now = Date.now();
  const playlist: Playlist = {
    id: generateId(),
    name: name.slice(0, PLAYLIST_NAME_MAX),
    color,
    chartIds: [],
    createdAt: now,
    modifiedAt: now,
  };
  return [...playlists, playlist];
}

export function renamePlaylist(playlists: Playlist[], id: string, name: string): Playlist[] {
  return updateById(playlists, id, (p) => touch({ ...p, name: name.slice(0, PLAYLIST_NAME_MAX) }));
}

export function recolorPlaylist(playlists: Playlist[], id: string, color: string): Playlist[] {
  return updateById(playlists, id, (p) => touch({ ...p, color }));
}

export function addChart(playlists: Playlist[], id: string, chartId: number): Playlist[] {
  return updateById(playlists, id, (p) => {
    if (p.chartIds.includes(chartId) || p.chartIds.length >= PLAYLIST_SONGS_MAX) return p;
    return touch({ ...p, chartIds: [...p.chartIds, chartId] });
  });
}

export function removeChart(playlists: Playlist[], id: string, chartId: number): Playlist[] {
  return updateById(playlists, id, (p) => touch({ ...p, chartIds: p.chartIds.filter((c) => c !== chartId) }));
}

export function reorderChart(playlists: Playlist[], id: string, fromIndex: number, toIndex: number): Playlist[] {
  return updateById(playlists, id, (p) => {
    const chartIds = [...p.chartIds];
    const [moved] = chartIds.splice(fromIndex, 1);
    chartIds.splice(toIndex, 0, moved);
    return touch({ ...p, chartIds });
  });
}

export function deletePlaylist(playlists: Playlist[], id: string): Playlist[] {
  return playlists.filter((p) => p.id !== id);
}

export function importPlaylist(playlists: Playlist[], parsed: ParsedPlaylist): Playlist[] {
  const now = Date.now();
  const playlist: Playlist = {
    id: generateId(),
    name: parsed.name,
    color: parsed.color,
    chartIds: parsed.chartIds,
    createdAt: now,
    modifiedAt: now,
  };
  return [...playlists, playlist];
}

export function sortByModifiedDesc(playlists: Playlist[]): Playlist[] {
  return [...playlists].sort((a, b) => b.modifiedAt - a.modifiedAt);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/playlists/mutations.test.ts`
Expected: PASS (all tests)

---

### Task 5: Storage (serialize/deserialize + platform IO)

**Files:**
- Create: `src/playlists/storage.ts`
- Create: `src/playlists/storage.test.ts`

**Interfaces:**
- Consumes: `Playlist` from `./types`; `AsyncStorage` from `@react-native-async-storage/async-storage`; `Platform` from `react-native`.
- Produces: `export const STORAGE_KEY = "playlists"`, `export function decodePlaylists(raw: string | null): Playlist[]` (pure — returns `[]` on `null`/invalid JSON/non-array), `export function encodePlaylists(playlists: Playlist[]): string` (pure — `JSON.stringify`), `export async function loadPlaylists(): Promise<Playlist[]>`, `export async function savePlaylists(playlists: Playlist[]): Promise<void>` (both platform-branching IO, not unit tested — see Step 4 rationale).

- [ ] **Step 1: Install the AsyncStorage dependency**

Run: `npx expo install @react-native-async-storage/async-storage`
Expected: added to `package.json` `dependencies` at the Expo-compatible version.

- [ ] **Step 2: Write the failing tests for the pure encode/decode functions**

Create `src/playlists/storage.test.ts`:

```ts
import { decodePlaylists, encodePlaylists } from "./storage";
import type { Playlist } from "./types";

const sample: Playlist = {
  id: "p1",
  name: "warmup",
  color: "#ffffff",
  chartIds: [1, 2],
  createdAt: 1,
  modifiedAt: 2,
};

describe("encodePlaylists / decodePlaylists", () => {
  it("round-trips a list of playlists", () => {
    expect(decodePlaylists(encodePlaylists([sample]))).toEqual([sample]);
  });

  it("returns an empty array for null", () => {
    expect(decodePlaylists(null)).toEqual([]);
  });

  it("returns an empty array for invalid JSON", () => {
    expect(decodePlaylists("{not json")).toEqual([]);
  });

  it("returns an empty array for JSON that isn't an array", () => {
    expect(decodePlaylists('{"oops": true}')).toEqual([]);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx jest src/playlists/storage.test.ts`
Expected: FAIL — `Cannot find module './storage'`

- [ ] **Step 4: Write `src/playlists/storage.ts`**

```ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import type { Playlist } from "./types";

export const STORAGE_KEY = "playlists";

export function decodePlaylists(raw: string | null): Playlist[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Playlist[]) : [];
  } catch {
    return [];
  }
}

export function encodePlaylists(playlists: Playlist[]): string {
  return JSON.stringify(playlists);
}

// Platform IO wrappers are intentionally thin and not unit tested: the
// codebase has no React Native / browser test environment set up, and the
// only logic here is a two-way platform branch plus the already-tested
// encode/decode functions above. Verified manually in Task 9 by running the
// app on web (localStorage) and confirming playlists persist across reload.
export async function loadPlaylists(): Promise<Playlist[]> {
  const raw = Platform.OS === "web" ? window.localStorage.getItem(STORAGE_KEY) : await AsyncStorage.getItem(STORAGE_KEY);
  return decodePlaylists(raw);
}

export async function savePlaylists(playlists: Playlist[]): Promise<void> {
  const raw = encodePlaylists(playlists);
  if (Platform.OS === "web") {
    window.localStorage.setItem(STORAGE_KEY, raw);
  } else {
    await AsyncStorage.setItem(STORAGE_KEY, raw);
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest src/playlists/storage.test.ts`
Expected: PASS (all tests). Note: this file imports `react-native` and `@react-native-async-storage/async-storage` at module scope but the tested functions (`decodePlaylists`/`encodePlaylists`) don't execute any RN code, so plain `ts-jest` with `testEnvironment: "node"` can still load and test this module as long as those imports don't throw on load. If Step 5 fails with an import error from `react-native` or the AsyncStorage package, add this to `jest.config.js`: `moduleNameMapper: { "^react-native$": "<rootDir>/src/playlists/__mocks__/react-native-empty.js", "^@react-native-async-storage/async-storage$": "<rootDir>/src/playlists/__mocks__/react-native-empty.js" }`, and create `src/playlists/__mocks__/react-native-empty.js` containing `module.exports = { Platform: { OS: "node" }, default: {} };` — this stubs the native modules for the Jest environment only; the real modules are still used at runtime by Expo/Metro.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

---

### Task 6: usePlaylists hook

**Files:**
- Create: `src/playlists/usePlaylists.ts`

**Interfaces:**
- Consumes: everything from `./mutations`, `loadPlaylists`/`savePlaylists` from `./storage`, `sortByModifiedDesc` from `./mutations`, `Playlist` from `./types`, `ParsedPlaylist` from `./format`.
- Produces:

```ts
export function usePlaylists(): {
  playlists: Playlist[];      // already sorted newest-modified-first
  loaded: boolean;
  create: (name: string, color: string) => Playlist;
  rename: (id: string, name: string) => void;
  recolor: (id: string, color: string) => void;
  addChart: (id: string, chartId: number) => void;
  removeChart: (id: string, chartId: number) => void;
  reorderChart: (id: string, fromIndex: number, toIndex: number) => void;
  remove: (id: string) => void;
  importPlaylist: (parsed: ParsedPlaylist) => Playlist;
}
```

This hook is a thin wiring layer (React state + fire-and-forget persistence) with no branching logic of its own — all decision logic lives in the already-tested `mutations.ts`. It is verified manually (Task 9's manual QA pass), consistent with `storage.ts`'s IO wrappers.

- [ ] **Step 1: Write `src/playlists/usePlaylists.ts`**

```ts
import { useEffect, useState } from "react";
import type { ParsedPlaylist } from "./format";
import * as mutations from "./mutations";
import { loadPlaylists, savePlaylists } from "./storage";
import type { Playlist } from "./types";

export function usePlaylists() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadPlaylists().then((loadedPlaylists) => {
      setPlaylists(loadedPlaylists);
      setLoaded(true);
    });
  }, []);

  function apply(updater: (current: Playlist[]) => Playlist[]): Playlist[] {
    let next: Playlist[] = [];
    setPlaylists((current) => {
      next = updater(current);
      savePlaylists(next);
      return next;
    });
    return next;
  }

  return {
    playlists: mutations.sortByModifiedDesc(playlists),
    loaded,
    create(name: string, color: string): Playlist {
      const next = apply((current) => mutations.createPlaylist(current, name, color));
      return next[next.length - 1];
    },
    rename(id: string, name: string) {
      apply((current) => mutations.renamePlaylist(current, id, name));
    },
    recolor(id: string, color: string) {
      apply((current) => mutations.recolorPlaylist(current, id, color));
    },
    addChart(id: string, chartId: number) {
      apply((current) => mutations.addChart(current, id, chartId));
    },
    removeChart(id: string, chartId: number) {
      apply((current) => mutations.removeChart(current, id, chartId));
    },
    reorderChart(id: string, fromIndex: number, toIndex: number) {
      apply((current) => mutations.reorderChart(current, id, fromIndex, toIndex));
    },
    remove(id: string) {
      apply((current) => mutations.deletePlaylist(current, id));
    },
    importPlaylist(parsed: ParsedPlaylist): Playlist {
      const next = apply((current) => mutations.importPlaylist(current, parsed));
      return next[next.length - 1];
    },
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

---

### Task 7: Screen union + Home tile + Playlists list screen

**Files:**
- Modify: `App.tsx` (extend `Screen` union, `screenTitle`, `Body`, `Home`'s menu array, wire `usePlaylists()` into `Main`)
- Create: `src/playlists/PlaylistsListScreen.tsx`

**Interfaces:**
- Consumes: `usePlaylists` from `./src/playlists/usePlaylists`, `styles` from `./src/uiKit`, `Playlist` from `./src/playlists/types`.
- Produces: `Screen` gains `{ k: "playlists" }`. `PlaylistsListScreen` component: `export function PlaylistsListScreen({ playlists, push, bottom }: { playlists: Playlist[]; push: (s: Screen) => void; bottom: number })` (imports `type { Screen }` from `../screen` — see Step 1, which also extracts the `Screen` type so `PlaylistsListScreen.tsx` doesn't need to import from `App.tsx` and create a cycle).

- [ ] **Step 1: Extract the `Screen` type to its own module**

Create `src/screen.ts`:

```ts
export type Screen =
  | { k: "home" }
  | { k: "search" }
  | { k: "diffModes" }
  | { k: "diffLevels"; mode: string }
  | { k: "diffCharts"; mode: string; level: number }
  | { k: "versions" }
  | { k: "versionSongs"; version: string }
  | { k: "stepmakers" }
  | { k: "stepmakerCharts"; maker: string }
  | { k: "variants" }
  | { k: "variantSongs"; variant: string }
  | { k: "titles" }
  | { k: "titleList"; cat: string }
  | { k: "song"; id: string }
  | { k: "playlists" }
  | { k: "playlistDetail"; id: string }
  | { k: "playlistEdit"; id?: string }
  | { k: "playlistImport" }
  | { k: "playlistShare"; id: string };
```

In `App.tsx`, delete the local `type Screen = ...` block (lines 101-115) and add `import type { Screen } from "./src/screen";` near the other imports. Update `ChartRow`/`SongRow` usages in `src/uiKit.tsx` (Task 2) to import `type { Screen }` from `./screen` instead of the inline `{ k: "song"; id: string }` shape used there as a stopgap — change `push: (s: { k: "song"; id: string }) => void` to `push: (s: Screen) => void` and add `import type { Screen } from "./screen";` to `src/uiKit.tsx`.

- [ ] **Step 2: Add titles for the new screens**

In `App.tsx`'s `screenTitle`, add cases:

```ts
case "playlists":
  return "Playlists";
case "playlistDetail": {
  const playlist = playlistsRef.current.find((p) => p.id === s.id);
  return playlist?.name ?? "Playlist";
}
case "playlistEdit":
  return s.id ? "Editar playlist" : "Nova playlist";
case "playlistImport":
  return "Importar playlist";
case "playlistShare":
  return "Compartilhar playlist";
```

`playlistDetail`'s title needs the current playlist name, but `screenTitle` is a plain function outside `Main`'s component scope. Since this is display-only (used for the header), simplify instead to avoid threading extra state through a free function: change this case to a fixed generic label:

```ts
case "playlistDetail":
  return "Playlist";
case "playlistEdit":
  return s.id ? "Editar playlist" : "Nova playlist";
case "playlistImport":
  return "Importar playlist";
case "playlistShare":
  return "Compartilhar playlist";
```

(`PlaylistDetailScreen` itself will render the playlist's real name prominently in its own body, so the generic header title is sufficient and keeps `screenTitle` a pure function of `Screen` alone, consistent with every other case.)

- [ ] **Step 3: Wire `usePlaylists()` into `Main` and pass it down**

In `App.tsx`'s `Main` function, add:

```ts
const playlistsApi = usePlaylists();
```

and add the import:

```ts
import { usePlaylists } from "./src/playlists/usePlaylists";
```

Update the `<Body ... />` call to pass `playlistsApi`:

```tsx
<Body screen={cur} push={push} bottom={insets.bottom} playlists={playlistsApi} />
```

Update `Body`'s prop type and add a `playlists: ReturnType<typeof usePlaylists>` parameter, threading it only into the new cases added in the next step (existing cases ignore it).

- [ ] **Step 4: Add the `playlists` case to `Body` and create `PlaylistsListScreen`**

Create `src/playlists/PlaylistsListScreen.tsx`:

```tsx
import { FlatList, Pressable, Text, View } from "react-native";
import type { Screen } from "../screen";
import { styles } from "../uiKit";
import type { Playlist } from "./types";

export function PlaylistsListScreen({
  playlists,
  push,
  bottom,
}: {
  playlists: Playlist[];
  push: (s: Screen) => void;
  bottom: number;
}) {
  return (
    <View style={styles.flex}>
      <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
        <Pressable
          style={[styles.bigBtn, { flex: 1, paddingVertical: 14, backgroundColor: "#5a6cff" }]}
          onPress={() => push({ k: "playlistEdit" })}
        >
          <Text style={styles.bigBtnText}>+ Nova</Text>
        </Pressable>
        <Pressable
          style={[styles.bigBtn, { flex: 1, paddingVertical: 14, backgroundColor: "#247a4a" }]}
          onPress={() => push({ k: "playlistImport" })}
        >
          <Text style={styles.bigBtnText}>Importar</Text>
        </Pressable>
      </View>
      <FlatList
        data={playlists}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ paddingBottom: bottom + 12 }}
        ListEmptyComponent={<Text style={styles.empty}>Nenhuma playlist ainda.</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.listRow} onPress={() => push({ k: "playlistDetail", id: item.id })}>
            <View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: item.color, marginRight: 12 }} />
            <Text style={[styles.listRowTitle, styles.flex]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.listRowCount}>{item.chartIds.length}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}
```

In `App.tsx`'s `Body`, add:

```tsx
case "playlists":
  return <PlaylistsListScreen playlists={playlists.playlists} push={push} bottom={bottom} />;
```

and import `PlaylistsListScreen` from `./src/playlists/PlaylistsListScreen`.

- [ ] **Step 5: Add the Home menu tile**

In `App.tsx`'s `Home` function, append to the `menu` array:

```ts
{ screen: { k: "playlists" }, icon: "📃", label: "Playlists", sub: "Suas playlists de charts", accent: "#5a6cff" },
```

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Manually verify**

Run: `npm run web`. From Home, tap "Playlists" → should show an empty list with "+ Nova" and "Importar" buttons and "Nenhuma playlist ainda." (the next tasks make those buttons functional; for now confirm navigation and empty state render correctly, and that `npm run typecheck` has no unused-import errors from `screenTitle`'s `playlistDetail` case referencing `s`).

---

### Task 8: Playlist edit screen (create/rename/recolor)

**Files:**
- Create: `src/playlists/PlaylistEditScreen.tsx`
- Modify: `App.tsx` (`Body`'s `playlistEdit` case)

**Interfaces:**
- Consumes: `usePlaylists()`'s `create`/`rename`/`recolor` from the `playlists` prop threaded through `Body`; `Playlist` from `./types`; `PLAYLIST_NAME_MAX` from `./types`.
- Produces: `export function PlaylistEditScreen({ playlist, onDone, playlists }: { playlist?: Playlist; onDone: (id: string) => void; playlists: ReturnType<typeof usePlaylists> })`.

- [ ] **Step 1: Write `src/playlists/PlaylistEditScreen.tsx`**

```tsx
import { useState } from "react";
import { ScrollView, Text, TextInput, View, Pressable } from "react-native";
import { styles } from "../uiKit";
import { PLAYLIST_NAME_MAX, type Playlist } from "./types";
import type { usePlaylists } from "./usePlaylists";

const SWATCHES = [
  "#ebe721", "#ff5a5a", "#5affb0", "#5a9dff", "#c75aff",
  "#ff9d5a", "#5affe0", "#ff5ac7", "#9dff5a", "#ffffff",
];

export function PlaylistEditScreen({
  playlist,
  onDone,
  playlists,
}: {
  playlist?: Playlist;
  onDone: (id: string) => void;
  playlists: ReturnType<typeof usePlaylists>;
}) {
  const [name, setName] = useState(playlist?.name ?? "");
  const [color, setColor] = useState(playlist?.color ?? SWATCHES[0]);
  const [customHex, setCustomHex] = useState(playlist?.color ?? "");

  function save() {
    const trimmed = name.trim().slice(0, PLAYLIST_NAME_MAX);
    if (!trimmed) return;
    if (playlist) {
      playlists.rename(playlist.id, trimmed);
      playlists.recolor(playlist.id, color);
      onDone(playlist.id);
    } else {
      const created = playlists.create(trimmed, color);
      onDone(created.id);
    }
  }

  const validCustomHex = /^#[0-9a-fA-F]{6}$/.test(customHex);

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <Text style={styles.section}>Nome</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={(t) => setName(t.slice(0, PLAYLIST_NAME_MAX))}
        placeholder="Nome da playlist"
        placeholderTextColor="#7a7f8c"
        maxLength={PLAYLIST_NAME_MAX}
      />
      <Text style={styles.rowMeta}>
        {name.length}/{PLAYLIST_NAME_MAX}
      </Text>

      <Text style={[styles.section, { marginTop: 20 }]}>Cor</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {SWATCHES.map((sw) => (
          <Pressable
            key={sw}
            onPress={() => {
              setColor(sw);
              setCustomHex(sw);
            }}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: sw,
              borderWidth: color === sw ? 3 : 0,
              borderColor: "#fff",
            }}
          />
        ))}
      </View>
      <Text style={[styles.rowMeta, { marginTop: 12 }]}>Outra cor (hex)</Text>
      <TextInput
        style={styles.input}
        value={customHex}
        onChangeText={(t) => {
          setCustomHex(t);
          if (/^#[0-9a-fA-F]{6}$/.test(t)) setColor(t);
        }}
        placeholder="#rrggbb"
        placeholderTextColor="#7a7f8c"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {!validCustomHex && customHex.length > 0 && (
        <Text style={{ color: "#e05a5a", fontSize: 12, marginTop: 4 }}>Formato inválido, use #rrggbb.</Text>
      )}

      <Pressable
        style={[styles.bigBtn, { marginTop: 24, backgroundColor: color, opacity: name.trim() ? 1 : 0.5 }]}
        onPress={save}
        disabled={!name.trim()}
      >
        <Text style={styles.bigBtnText}>Salvar</Text>
      </Pressable>
    </ScrollView>
  );
}
```

- [ ] **Step 2: Wire it into `App.tsx`'s `Body`**

Add case:

```tsx
case "playlistEdit": {
  const editing = screen.id ? playlists.playlists.find((p) => p.id === screen.id) : undefined;
  return (
    <PlaylistEditScreen
      playlist={editing}
      playlists={playlists}
      onDone={(id) => push({ k: "playlistDetail", id })}
    />
  );
}
```

Import `PlaylistEditScreen` from `./src/playlists/PlaylistEditScreen`.

Also update `PlaylistsListScreen`'s "+ Nova" button destination is already `{ k: "playlistEdit" }` (Task 7) — no change needed there.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Manually verify**

Run: `npm run web`. Home → Playlists → "+ Nova" → enter a name, pick a swatch → Save. Confirm it navigates to `playlistDetail` (which won't render real content until Task 9 — a blank/placeholder screen is fine for now as long as no crash occurs and the header shows). Go back to the Playlists list and confirm the new playlist appears with the right name/color/count `0`.

---

### Task 9: Playlist detail screen (view, reorder, remove, delete)

**Files:**
- Create: `src/playlists/PlaylistDetailScreen.tsx`
- Modify: `App.tsx` (`Body`'s `playlistDetail` case)

**Interfaces:**
- Consumes: `ChartRow`, `styles` from `../uiKit`; `chartByGlobalIndex` from `../chartIndex`; `Playlist` from `./types`; `usePlaylists` return type.
- Produces: `export function PlaylistDetailScreen({ playlist, playlists, push, bottom }: { playlist: Playlist; playlists: ReturnType<typeof usePlaylists>; push: (s: Screen) => void; bottom: number })`. Reordering is done with two small up/down buttons per row rather than a drag gesture library — RN doesn't ship drag-and-drop for `FlatList` out of the box and adding a gesture-handler dependency for this is unjustified scope for a first version; up/down buttons deliver the same "manual reorder" requirement from the spec with no new dependency.

- [ ] **Step 1: Write `src/playlists/PlaylistDetailScreen.tsx`**

```tsx
import { Alert, FlatList, Pressable, Text, View } from "react-native";
import type { Screen } from "../screen";
import { ChartRow, styles } from "../uiKit";
import { chartByGlobalIndex } from "../chartIndex";
import type { Playlist } from "./types";
import type { usePlaylists } from "./usePlaylists";

export function PlaylistDetailScreen({
  playlist,
  playlists,
  push,
  bottom,
}: {
  playlist: Playlist;
  playlists: ReturnType<typeof usePlaylists>;
  push: (s: Screen) => void;
  bottom: number;
}) {
  const rows = playlist.chartIds
    .map((id, index) => ({ id, index, flat: chartByGlobalIndex.get(id) }))
    .filter((r): r is { id: number; index: number; flat: NonNullable<typeof r.flat> } => !!r.flat);

  function confirmDelete() {
    Alert.alert("Excluir playlist", `Excluir "${playlist.name}"? Essa ação não pode ser desfeita.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: () => {
          playlists.remove(playlist.id);
          push({ k: "playlists" });
        },
      },
    ]);
  }

  return (
    <View style={styles.flex}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
        <Text style={[styles.title, { color: playlist.color }]}>{playlist.name}</Text>
        <Text style={styles.rowMeta}>{playlist.chartIds.length}/100 charts</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
          <Pressable style={[styles.diffBadge, { backgroundColor: "#1b1d27" }]} onPress={() => push({ k: "playlistEdit", id: playlist.id })}>
            <Text style={styles.diffBadgeText}>Editar</Text>
          </Pressable>
          <Pressable style={[styles.diffBadge, { backgroundColor: "#1b1d27" }]} onPress={() => push({ k: "search" })}>
            <Text style={styles.diffBadgeText}>+ Adicionar</Text>
          </Pressable>
          <Pressable style={[styles.diffBadge, { backgroundColor: "#1b1d27" }]} onPress={() => push({ k: "playlistShare", id: playlist.id })}>
            <Text style={styles.diffBadgeText}>Compartilhar</Text>
          </Pressable>
          <Pressable style={[styles.diffBadge, { backgroundColor: "#5a1d1d" }]} onPress={confirmDelete}>
            <Text style={styles.diffBadgeText}>Excluir</Text>
          </Pressable>
        </View>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(r) => String(r.id)}
        contentContainerStyle={{ paddingBottom: bottom + 12 }}
        ListEmptyComponent={<Text style={styles.empty}>Nenhum chart nesta playlist ainda.</Text>}
        renderItem={({ item }) => (
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <ChartRow item={item.flat} push={push} badge={`#${item.id}`} />
            </View>
            <View style={{ paddingHorizontal: 8, gap: 4 }}>
              <Pressable
                disabled={item.index === 0}
                onPress={() => playlists.reorderChart(playlist.id, item.index, item.index - 1)}
                style={{ opacity: item.index === 0 ? 0.3 : 1 }}
              >
                <Text style={{ color: "#fff", fontSize: 18 }}>↑</Text>
              </Pressable>
              <Pressable
                disabled={item.index === rows.length - 1}
                onPress={() => playlists.reorderChart(playlist.id, item.index, item.index + 1)}
                style={{ opacity: item.index === rows.length - 1 ? 0.3 : 1 }}
              >
                <Text style={{ color: "#fff", fontSize: 18 }}>↓</Text>
              </Pressable>
              <Pressable onPress={() => playlists.removeChart(playlist.id, item.id)}>
                <Text style={{ color: "#e05a5a", fontSize: 16 }}>✕</Text>
              </Pressable>
            </View>
          </View>
        )}
      />
    </View>
  );
}
```

- [ ] **Step 2: Wire it into `App.tsx`'s `Body`**

Add case:

```tsx
case "playlistDetail": {
  const playlist = playlists.playlists.find((p) => p.id === screen.id);
  return playlist ? (
    <PlaylistDetailScreen playlist={playlist} playlists={playlists} push={push} bottom={bottom} />
  ) : null;
}
```

Import `PlaylistDetailScreen` from `./src/playlists/PlaylistDetailScreen`.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Manually verify**

Run: `npm run web`. Create a playlist (Task 8 flow), land on its detail screen: confirm name/color/count show, "Nenhum chart nesta playlist ainda." appears, and Delete asks for confirmation before removing the playlist and returning to the list. (Adding charts is wired in Task 10 — the "+ Adicionar" button already navigates to Search, but Search doesn't yet add anything to the playlist.)

---

### Task 10: Pick mode across chart-listing screens

**Files:**
- Modify: `App.tsx` (`SearchScreen`, `ChartList`, `Detail`, `Body`, `Screen` threading)
- Modify: `src/screen.ts` is unaffected — pick mode is separate `Main`-level state, not a `Screen` variant, so a screen like Search behaves identically whether reached normally or while picking.

**Interfaces:**
- `Main` gains `const [pickingFor, setPickingFor] = useState<string | null>(null)` (a playlist id) and passes `pickingFor`/`setPickingFor` down through `Body` to `SearchScreen`, `ChartList`, and `Detail`.
- Each of those screens accepts an optional `pick?: { playlistId: string; chartIds: number[]; onToggle: (chartId: number) => void }` and passes a `pick={{ active, onToggle }}` object to each `ChartRow`/`SongRow` it renders (looking up each row's global chart id via `chartByGlobalIndex`'s inverse — see Step 1).

- [ ] **Step 1: Add a reverse lookup for a chart's global id**

In `src/chartIndex.ts`, add after `chartByGlobalIndex`:

```ts
export const globalIndexByChartId: Map<string, number> = new Map(
  [...chartByGlobalIndex.entries()].map(([globalId, fc]) => [fc.chart.id, globalId]),
);
```

- [ ] **Step 2: Add pick-mode state to `Main` and a footer bar**

In `App.tsx`'s `Main`:

```ts
const [pickingFor, setPickingFor] = useState<string | null>(null);
```

When `pop()` returns to `playlistDetail` (i.e., the stack's new top after popping is a `playlistDetail` screen) or when the stack's current screen becomes `playlistDetail`, clear `pickingFor`. Simplify by clearing `pickingFor` whenever `push` is called with `{ k: "playlistDetail" }`:

```ts
const push = (s: Screen) => {
  if (s.k === "playlistDetail") setPickingFor(null);
  setStack((st) => [...st, s]);
};
```

Set `pickingFor` when "+ Adicionar" is tapped: in `src/playlists/PlaylistDetailScreen.tsx`, change the `+ Adicionar` button's props to accept an `onAdd: () => void` prop instead of pushing directly:

```tsx
// replace this prop in PlaylistDetailScreen's function signature:
push,
onAdd,
// ...
<Pressable style={[styles.diffBadge, { backgroundColor: "#1b1d27" }]} onPress={onAdd}>
```

and in `App.tsx`'s `Body`'s `playlistDetail` case:

```tsx
case "playlistDetail": {
  const playlist = playlists.playlists.find((p) => p.id === screen.id);
  return playlist ? (
    <PlaylistDetailScreen
      playlist={playlist}
      playlists={playlists}
      push={push}
      bottom={bottom}
      onAdd={() => {
        setPickingFor(playlist.id);
        push({ k: "search" });
      }}
    />
  ) : null;
}
```

Add a floating footer rendered in `Main` (below `Body`, above the safe-area bottom padding) when `pickingFor` is set:

```tsx
{pickingFor && (
  <Pressable
    style={{ position: "absolute", left: 16, right: 16, bottom: insets.bottom + 16, backgroundColor: "#5a6cff", borderRadius: 14, padding: 16, alignItems: "center" }}
    onPress={() => push({ k: "playlistDetail", id: pickingFor })}
  >
    <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>
      Concluído ({playlistsApi.playlists.find((p) => p.id === pickingFor)?.chartIds.length ?? 0} na playlist)
    </Text>
  </Pressable>
)}
```

(Place this `Pressable` as a sibling after the `<Body ... />` element, inside the same wrapping `View` that already has `flex: 1`, so it overlays the screen content via `position: "absolute"`.)

- [ ] **Step 3: Thread `pick` into `SearchScreen`**

Change `SearchScreen`'s signature and `SongRow` call:

```tsx
function SearchScreen({
  push,
  bottom,
  pick,
}: {
  push: (s: Screen) => void;
  bottom: number;
  pick?: { playlist: Playlist; onToggle: (chartId: number) => void };
}) {
  // ...unchanged query/results logic...
  return (
    <View style={styles.flex}>
      {/* ...unchanged TextInput... */}
      <FlatList
        data={results}
        keyExtractor={(s) => s.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: bottom + 12 }}
        renderItem={({ item }) => {
          // Search lists songs, not individual charts; picking a song with
          // multiple charts adds its first chart (the common case: most
          // songs the user searches for by name have one chart per
          // mode/level they care about, and full per-chart picking is
          // still available from Difficulty/Version/Stepmaker/Song-detail
          // screens which list individual charts).
          const firstChart = item.charts[0];
          const globalId = firstChart ? globalIndexByChartId.get(firstChart.id) : undefined;
          return (
            <SongRow
              song={item}
              onPress={() => push({ k: "song", id: item.id })}
              pick={
                pick && globalId != null
                  ? { active: pick.playlist.chartIds.includes(globalId), onToggle: () => pick.onToggle(globalId) }
                  : undefined
              }
            />
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>Nenhuma música encontrada.</Text>}
      />
    </View>
  );
}
```

Add the import `import { globalIndexByChartId } from "./src/chartIndex";` and `import type { Playlist } from "./src/playlists/types";` to `App.tsx`.

- [ ] **Step 4: Thread `pick` into `ChartList` (covers Difficulty and Stepmaker screens) and `Detail` (Song detail)**

In `ChartList`, add a `pick?: { playlist: Playlist; onToggle: (chartId: number) => void }` prop, and in both `renderItem` call sites (the `SectionList` branch and the plain `FlatList` branch), pass:

```tsx
renderItem={({ item }) => {
  const globalId = globalIndexByChartId.get(item.chart.id);
  return (
    <ChartRow
      item={item}
      push={push}
      badge={showLabel ? item.chart.label : `#${levelPos(item.chart)}`}
      pick={pick && globalId != null ? { active: pick.playlist.chartIds.includes(globalId), onToggle: () => pick.onToggle(globalId) } : undefined}
    />
  );
}}
```

(apply the equivalent change to the `SectionList`'s `renderItem`, which currently passes `badge={`#${item.seq}`}`).

In `Detail` (song detail screen), add a `pick` prop with the same shape. Change its signature and the per-chart row block to:

```tsx
function Detail({
  song,
  bottom,
  pick,
}: {
  song: AppSong;
  bottom: number;
  pick?: { playlist: Playlist; onToggle: (chartId: number) => void };
}) {
  // ...unchanged bpm computation...

  return (
    <ScrollView contentContainerStyle={[styles.detail, { paddingBottom: bottom + 32 }]}>
      {/* ...unchanged detailHead and placements card... */}

      {song.charts.length === 0 ? (
        <Text style={styles.note}>Charts (S16/D20…) ainda não cadastrados para esta música.</Text>
      ) : (
        song.charts.map((c) => {
          const level = c.placements.find((p) => p.label.startsWith("Nível"));
          const globalId = globalIndexByChartId.get(c.id);
          const toggle = pick && globalId != null ? { active: pick.playlist.chartIds.includes(globalId), onToggle: () => pick.onToggle(globalId) } : undefined;
          return (
            <View key={c.id} style={[styles.chartRow, modeRowStyle(c.mode)]}>
              <View style={styles.flex}>
                <View style={styles.chartHeader}>
                  <Text style={styles.chartLabel}>{c.label}</Text>
                  {c.types.length > 0 && <Text style={styles.types}>{c.types.join(" · ")}</Text>}
                </View>
                {c.stepmaker ? <Text style={styles.stepmaker}>por {c.stepmaker}</Text> : null}
              </View>
              {toggle ? (
                <Pressable onPress={toggle.onToggle} hitSlop={10}>
                  <Text style={{ color: "#fff", fontSize: 22, fontWeight: "800", minWidth: 32, textAlign: "center" }}>
                    {toggle.active ? "✓" : "+"}
                  </Text>
                </Pressable>
              ) : (
                <>
                  {c.youtubeUrl ? <YouTubeButton url={c.youtubeUrl} /> : null}
                  {level && (
                    <Text style={styles.chartValue}>
                      {level.position}
                      <Text style={styles.chartTotal}>/{level.total}</Text>
                    </Text>
                  )}
                </>
              )}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}
```

(The YouTube button and level badge are hidden while picking, since the toggle takes their place in the row — they return once `pick` is undefined again.)

- [ ] **Step 5: Pass `pickingFor`-derived `pick` props from `Body`**

In `App.tsx`'s `Body`, compute once:

```ts
const pick = pickingFor
  ? { playlist: playlists.playlists.find((p) => p.id === pickingFor)!, onToggle: (chartId: number) => playlists.addChart(pickingFor, chartId) }
  : undefined;
```

guarded by `pickingFor && playlists.playlists.some((p) => p.id === pickingFor)` to avoid a crash if the playlist was deleted mid-pick, and pass `pick={pick}` to the `SearchScreen`, `ChartList` (both cases), and `Detail` (via `song` case) invocations. `Body` needs `pickingFor` added to its prop list, passed from `Main`.

Note: `pick.onToggle` always calls `addChart` (never `removeChart`) even when the row is already active, because `addChart` is a documented no-op when the chart is already present (Task 4) — so tapping an already-added row currently does nothing rather than removing it. Change `onToggle` to branch:

```ts
onToggle: (chartId: number) => {
  const current = playlists.playlists.find((p) => p.id === pickingFor);
  if (current?.chartIds.includes(chartId)) playlists.removeChart(pickingFor, chartId);
  else playlists.addChart(pickingFor, chartId);
},
```

so pick mode toggles add/remove as its name implies.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Manually verify**

Run: `npm run web`. Create a playlist, tap "+ Adicionar" from its detail screen (lands on Search in pick mode), tap a couple of songs (rows show `+` becoming `✓`), tap the floating "Concluído" footer, confirm the playlist detail now lists those charts, and that going to Difficulty → a level → toggling a chart there also updates the same playlist (open its detail screen again to confirm). Also confirm normal (non-picking) navigation through Search/Difficulty/Song-detail is unaffected (tapping a row still opens the song detail as before) when no playlist is being edited.

---

### Task 11: Import screen (paste string + QR scan)

**Files:**
- Create: `src/playlists/PlaylistImportScreen.tsx`
- Modify: `App.tsx` (`Body`'s `playlistImport` case)

**Interfaces:**
- Consumes: `parsePlaylistString` from `./format`, `chartByGlobalIndex` from `../chartIndex` (used to build the `isValidChartId` predicate), `usePlaylists`'s `importPlaylist`.
- Produces: `export function PlaylistImportScreen({ playlists, push }: { playlists: ReturnType<typeof usePlaylists>; push: (s: Screen) => void })`.

- [ ] **Step 1: Install the camera dependency**

Run: `npx expo install expo-camera`
Expected: added to `package.json` at the Expo-compatible version. Add the camera permission plugin entry to `app.json`'s `"plugins"` array (create the array if absent): `"expo-camera"`.

- [ ] **Step 2: Write `src/playlists/PlaylistImportScreen.tsx`**

```tsx
import { useState } from "react";
import { Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { styles } from "../uiKit";
import { chartByGlobalIndex } from "../chartIndex";
import { parsePlaylistString } from "./format";
import type { Screen } from "../screen";
import type { usePlaylists } from "./usePlaylists";

function isValidChartId(id: number): boolean {
  return chartByGlobalIndex.has(id);
}

export function PlaylistImportScreen({
  playlists,
  push,
}: {
  playlists: ReturnType<typeof usePlaylists>;
  push: (s: Screen) => void;
}) {
  const [text, setText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  function runImport(raw: string) {
    const result = parsePlaylistString(raw.trim(), isValidChartId);
    if ("error" in result) {
      setMessage(result.error);
      return;
    }
    const created = playlists.importPlaylist(result);
    setMessage(
      result.warnings.length > 0
        ? `Importado "${result.name}" — ${result.warnings.join(", ")}`
        : `Importado "${result.name}" com sucesso.`,
    );
    setScanning(false);
    push({ k: "playlistDetail", id: created.id });
  }

  if (scanning) {
    if (!permission?.granted) {
      return (
        <View style={[styles.pad, { alignItems: "center" }]}>
          <Text style={styles.rowMeta}>Precisamos da câmera para ler o QR code.</Text>
          <Pressable style={[styles.bigBtn, { marginTop: 16 }]} onPress={requestPermission}>
            <Text style={styles.bigBtnText}>Permitir câmera</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <CameraView
        style={styles.flex}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={({ data }) => runImport(data)}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <Text style={styles.section}>Colar código da playlist</Text>
      <TextInput
        style={[styles.input, { minHeight: 80 }]}
        value={text}
        onChangeText={setText}
        placeholder='"nome" #rrggbb (1 2 3)'
        placeholderTextColor="#7a7f8c"
        multiline
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Pressable style={[styles.bigBtn, { marginTop: 12, backgroundColor: "#247a4a" }]} onPress={() => runImport(text)}>
        <Text style={styles.bigBtnText}>Importar</Text>
      </Pressable>

      {Platform.OS !== "web" && (
        <Pressable style={[styles.bigBtn, { marginTop: 12, backgroundColor: "#5a6cff" }]} onPress={() => setScanning(true)}>
          <Text style={styles.bigBtnText}>Ler QR code</Text>
        </Pressable>
      )}

      {message && <Text style={[styles.rowMeta, { marginTop: 16 }]}>{message}</Text>}
    </ScrollView>
  );
}
```

- [ ] **Step 3: Wire it into `App.tsx`'s `Body`**

Add case:

```tsx
case "playlistImport":
  return <PlaylistImportScreen playlists={playlists} push={push} />;
```

Import `PlaylistImportScreen` from `./src/playlists/PlaylistImportScreen`.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Manually verify**

Run: `npm run web`. Home → Playlists → Importar. Paste `"warmup" #ebe721 (1 2 999999)` and tap Importar: confirm it navigates to the new playlist's detail screen showing 2 charts and a message mentioning 1 chart skipped. Paste an invalid string (e.g. `not a playlist`) and confirm an error message shows without creating a playlist. Confirm the "Ler QR code" button is hidden on web (`Platform.OS === "web"`).

---

### Task 12: Share screen (QR code + copy + OS share)

**Files:**
- Create: `src/playlists/PlaylistShareScreen.tsx`
- Modify: `App.tsx` (`Body`'s `playlistShare` case)

**Interfaces:**
- Consumes: `serializePlaylist` from `./format`, `chartByGlobalIndex`/`globalIndexByChartId` are not needed here (the playlist already stores `chartIds` directly).
- Produces: `export function PlaylistShareScreen({ playlist }: { playlist: Playlist })`.

- [ ] **Step 1: Install the QR rendering dependencies**

Run: `npx expo install react-native-svg` then `npm install react-native-qrcode-svg`.
Expected: both added to `package.json` `dependencies`.

- [ ] **Step 2: Write `src/playlists/PlaylistShareScreen.tsx`**

```tsx
import { useState } from "react";
import { Platform, Pressable, Share, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { styles } from "../uiKit";
import { serializePlaylist } from "./format";
import type { Playlist } from "./types";

export function PlaylistShareScreen({ playlist }: { playlist: Playlist }) {
  const [copied, setCopied] = useState(false);
  const shareString = serializePlaylist(playlist);

  async function copy() {
    if (Platform.OS === "web") {
      await navigator.clipboard.writeText(shareString);
    } else {
      const Clipboard = await import("expo-clipboard");
      await Clipboard.setStringAsync(shareString);
    }
    setCopied(true);
  }

  return (
    <View style={[styles.pad, { alignItems: "center" }]}>
      <View style={{ backgroundColor: "#fff", padding: 16, borderRadius: 16, marginTop: 12 }}>
        <QRCode value={shareString} size={220} />
      </View>
      <Text selectable style={[styles.rowMeta, { marginTop: 20, textAlign: "center" }]}>
        {shareString}
      </Text>
      <Pressable style={[styles.bigBtn, { marginTop: 20, width: "100%", backgroundColor: "#5a6cff" }]} onPress={copy}>
        <Text style={styles.bigBtnText}>{copied ? "Copiado!" : "Copiar"}</Text>
      </Pressable>
      {Platform.OS !== "web" && (
        <Pressable
          style={[styles.bigBtn, { marginTop: 12, width: "100%", backgroundColor: "#247a4a" }]}
          onPress={() => Share.share({ message: shareString })}
        >
          <Text style={styles.bigBtnText}>Compartilhar</Text>
        </Pressable>
      )}
    </View>
  );
}
```

- [ ] **Step 3: Install `expo-clipboard` (native copy support)**

Run: `npx expo install expo-clipboard`
Expected: added to `package.json` at the Expo-compatible version.

- [ ] **Step 4: Wire it into `App.tsx`'s `Body`**

Add case:

```tsx
case "playlistShare": {
  const playlist = playlists.playlists.find((p) => p.id === screen.id);
  return playlist ? <PlaylistShareScreen playlist={playlist} /> : null;
}
```

Import `PlaylistShareScreen` from `./src/playlists/PlaylistShareScreen`.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Manually verify**

Run: `npm run web`. Open a playlist with at least one chart → Compartilhar. Confirm the QR code renders, the raw string below it matches the `"name" #color (ids...)` format, and tapping "Copiar" shows "Copiado!" (verify via browser devtools clipboard or by pasting into the Import screen's text field and re-importing it — should recreate an equivalent playlist).

---

### Task 13: Full regression pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all suites pass (`chartIndex`, `format`, `mutations`, `storage`).

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: End-to-end manual walkthrough on web**

Run: `npm run web`. Walk through: create playlist → add charts via Search pick mode and via a Difficulty chart list → reorder with ↑/↓ → remove one chart → rename + recolor via Edit → share (copy string) → go to Import, paste the copied string → confirm a second, equivalent playlist is created with a warning-free message → delete both playlists with confirmation → confirm the list returns to "Nenhuma playlist ainda." and reload the page to confirm `localStorage` persisted the empty state (no leftover playlists).

---

## Post-Implementation Amendments

After all 13 tasks were implemented and reviewed, two changes were made based on further user feedback (see the updated design spec for current behavior):

1. **Search pick-mode chart disambiguation.** Originally, tapping a multi-chart song in Search pick mode added only its first chart. This was changed: a song with exactly one chart still toggles directly (unambiguous); a song with multiple charts now opens that song's detail screen (still in pick mode) so the user picks the exact chart (song + difficulty), never just the song. Changed in `App.tsx`'s `SearchScreen`.
2. **Manual playlist-list reordering.** Originally out of scope (list order was `modifiedAt`-descending only). Added `reorderPlaylist` to `src/playlists/mutations.ts` and `usePlaylists.ts`, changed `createPlaylist`/`importPlaylist` to prepend (new/imported playlists land at the top) instead of append, removed the now-unused `sortByModifiedDesc` (the stored array order is the display order), and added up/down reorder buttons to `PlaylistsListScreen.tsx`, mirroring the existing chart-reorder buttons in `PlaylistDetailScreen.tsx`.
