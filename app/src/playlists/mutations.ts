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
  return [playlist, ...playlists];
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

export function reorderPlaylist(playlists: Playlist[], fromIndex: number, toIndex: number): Playlist[] {
  const next = [...playlists];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
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
  return [playlist, ...playlists];
}
