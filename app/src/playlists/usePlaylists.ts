import { useEffect, useRef, useState } from "react";
import type { ParsedPlaylist } from "./format";
import * as mutations from "./mutations";
import { loadPlaylists, savePlaylists } from "./storage";
import type { Playlist } from "./types";

export function usePlaylists() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loaded, setLoaded] = useState(false);
  const playlistsRef = useRef<Playlist[]>(playlists);

  useEffect(() => {
    loadPlaylists().then((loadedPlaylists) => {
      playlistsRef.current = loadedPlaylists;
      setPlaylists(loadedPlaylists);
      setLoaded(true);
    });
  }, []);

  function apply(updater: (current: Playlist[]) => Playlist[]): Playlist[] {
    const next = updater(playlistsRef.current);
    playlistsRef.current = next;
    setPlaylists(next);
    savePlaylists(next);
    return next;
  }

  return {
    // Display order is the stored array order itself (manually reorderable
    // via reorderPlaylist), not an automatic modifiedAt sort. New/imported
    // playlists are inserted at the front (index 0).
    playlists,
    loaded,
    create(name: string, color: string): Playlist {
      const next = apply((current) => mutations.createPlaylist(current, name, color));
      return next[0];
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
    reorderPlaylist(fromIndex: number, toIndex: number) {
      apply((current) => mutations.reorderPlaylist(current, fromIndex, toIndex));
    },
    remove(id: string) {
      apply((current) => mutations.deletePlaylist(current, id));
    },
    importPlaylist(parsed: ParsedPlaylist): Playlist {
      const next = apply((current) => mutations.importPlaylist(current, parsed));
      return next[0];
    },
  };
}
