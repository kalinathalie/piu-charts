# Playlists — Design Spec

Date: 2026-07-02

## Summary

Add a Playlists feature to the PIU Charts app: users create named, colored
playlists of specific charts, editable and deletable, sharable via a compact
structured text string and (on mobile) a QR code, with local-only persistence
(AsyncStorage on native, localStorage on web).

## Data Model

```ts
interface Playlist {
  id: string;          // uuid, generated on creation
  name: string;         // <= 50 chars
  color: string;        // "#rrggbb", lowercase
  chartIds: number[];   // global chart rank numbers (1..chartCount), order = playback/display order
  createdAt: number;    // epoch ms
  modifiedAt: number;   // epoch ms; bumped on rename, recolor, add/remove/reorder song
}
```

A playlist entry identifies one **chart** (a specific mode/level within a
song), not a whole song. The numeric chart ID reuses the chart's existing
"Todas" placement `position` field from `assets/app-data.json`, which is
already a stable 1..chartCount index equal to the chart's position in the
flattened song→charts order (verified: no mismatches across all 4579
charts). No new ID scheme is introduced. At app load, a
`chartByGlobalIndex: Map<number, FlatChart>` is built once alongside the
existing `songById`/chart maps for O(1) lookup by this number.

Playlists are capped at 100 chart entries. Duplicate chart entries are not
allowed — adding a chart already present in a playlist (via picker or
import) is a no-op.

## Storage

A `playlistStorage.ts` module stores all playlists as a single JSON blob
under the key `"playlists"`:

- Native (`Platform.OS !== "web"`): `@react-native-async-storage/async-storage`
  (`AsyncStorage.getItem` / `setItem`), backed by the device's internal
  storage.
- Web (`Platform.OS === "web"`): `localStorage.getItem` / `setItem`.

This mirrors the existing `Platform.OS` branching pattern already used
elsewhere in `App.tsx`.

A `usePlaylists()` hook loads the blob once, holds `Playlist[]` in React
state, and exposes mutators (`create`, `rename`, `recolor`, `addChart`,
`removeChart`, `reorder`, `remove`, `importFromString`) that update state
and persist the full blob back to storage. Screens receive `playlists` and
the mutators as props, following the app's existing prop-drilling style
(no new Context is introduced).

## Share String Format

Example: `"playlist name" #ebe721 (1 2 10 20 30 123 456 1234 1303 1428)`

**Serialize:**
```
`"${name.replace(/"/g, '\\"')}" #${hexColor} (${chartIds.join(" ")})`
```

**Parse**, using
`^"((?:[^"\\]|\\.)*)"\s*#([0-9a-fA-F]{6})\s*\(([\d\s]*)\)$`:

- If the string does not match this structural pattern at all (bad quoting,
  missing/invalid color, missing parens), the import is **rejected**
  outright with an error message — no partial import.
- If it matches structurally, the *contents* are handled best-effort:
  - Name: unescape `\"` -> `"`, then truncate to 50 chars.
  - Color: normalized to lowercase `#rrggbb`.
  - Chart IDs: split on whitespace, parse as integers; drop any that are
    not valid integers or not present in `chartByGlobalIndex`; dedupe;
    truncate to the first 100 remaining.
- After a best-effort import, show a result banner summarizing any
  adjustments, e.g. "Imported 'playlist name' — 2 charts skipped (not
  found)". If nothing was dropped/truncated, show a plain success message.

## Screens & Navigation

New `Screen` union variants added in `App.tsx`:

```ts
| { k: "playlists" }
| { k: "playlistDetail"; id: string }
| { k: "playlistEdit"; id?: string }        // no id = create, id = rename/recolor
| { k: "playlistImport" }
```

Pick mode (adding charts to a playlist by browsing) is not a distinct
`Screen` variant; it's a `pickPlaylistId?: string` value threaded alongside
`screen`/`push` through `Body` and down into chart-listing screens.

- **Home**: a new "Playlists" tile is added to the existing menu grid,
  pushing `{k: "playlists"}`. Same visual pattern as Search/Difficulty/etc.
- **Playlists list**: manually reorderable via up/down buttons per card
  (the stored array order is the display order). New/imported playlists
  are inserted at the top. Each card shows name, color swatch, and song
  count. "+ New" and "Import" actions at the top. Tapping a card pushes
  `playlistDetail`.
- **Playlist detail**: shows name/color header and the playlist's charts
  as rows (reusing the existing `ChartRow` component), each with up/down
  buttons for manual reordering and a remove (X) button. Actions: Edit
  (name/color) -> `playlistEdit`, Add songs (enters pick mode), Share,
  Delete (confirmation dialog via `Alert.alert`, no undo).
  (Up/down buttons instead of a drag handle: no new gesture/animation
  dependency, works identically on web and native.)
- **Playlist edit** (create or rename/recolor): name text input with a
  live 50-character counter, a preset color swatch palette (~8-12 colors)
  plus an "Other..." option opening a full RGB/hex picker, Save/Cancel.
- **Pick mode**: while `pickPlaylistId` is set, every chart-listing screen
  that renders `ChartRow` (Difficulty-level chart lists, Version/Stepmaker
  chart lists, Song detail's own chart list) shows an add/remove toggle on
  each row instead of navigating to chart detail on tap — always a
  specific chart (song + difficulty), never just the song. Search lists
  songs rather than individual charts: a song with exactly one chart
  toggles that chart directly (unambiguous); a song with multiple charts
  opens that song's detail screen (still in pick mode) so the exact chart
  can be chosen there, rather than guessing which one the user meant. A
  floating footer shows "Done adding (N in playlist)" to return to
  `playlistDetail`. Reaching the 100-chart cap disables further adds with
  a toast/message.
- **Import screen**: multiline text input + "Import" button running the
  parser and showing the result banner described above. On native only, a
  "Scan QR" button opens the camera (`expo-camera` barcode scanning) and
  feeds the decoded payload through the same parser.
- **Share screen** (from playlist detail): displays a QR code
  (`react-native-qrcode-svg`, requires `react-native-svg`) encoding the
  share string, the raw string with a "Copy" button, and an OS share sheet
  button (`Share.share`). On web, the QR code still renders (SVG works via
  react-native-web); `Share.share` is unavailable there, so only
  copy-to-clipboard is offered.

## New Dependencies

- `@react-native-async-storage/async-storage` — native/web key-value
  storage (web uses browser localStorage directly instead).
- `react-native-svg` + `react-native-qrcode-svg` — QR code rendering.
- `expo-camera` — QR code scanning (native only; the barcode-scanning API
  built into `expo-camera`, no separate `expo-barcode-scanner`).

## Out of Scope

- Cloud sync / cross-device sync of playlists.
- Undo for deleted playlists.
