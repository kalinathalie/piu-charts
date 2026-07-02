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
