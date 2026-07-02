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
