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
