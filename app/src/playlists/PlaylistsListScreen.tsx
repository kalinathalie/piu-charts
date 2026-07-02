import { FlatList, Pressable, Text, View } from "react-native";
import type { Screen } from "../screen";
import { styles } from "../uiKit";
import type { Playlist } from "./types";

export function PlaylistsListScreen({
  playlists,
  push,
  bottom,
  reorderPlaylist,
}: {
  playlists: Playlist[];
  push: (s: Screen) => void;
  bottom: number;
  reorderPlaylist: (fromIndex: number, toIndex: number) => void;
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
        renderItem={({ item, index }) => (
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Pressable style={[styles.listRow, styles.flex]} onPress={() => push({ k: "playlistDetail", id: item.id })}>
              <View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: item.color, marginRight: 12 }} />
              <Text style={[styles.listRowTitle, styles.flex]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.listRowCount}>{item.chartIds.length}</Text>
            </Pressable>
            <View style={{ paddingHorizontal: 8, gap: 4 }}>
              <Pressable
                disabled={index === 0}
                onPress={() => reorderPlaylist(index, index - 1)}
                style={{ opacity: index === 0 ? 0.3 : 1 }}
              >
                <Text style={{ color: "#fff", fontSize: 18 }}>↑</Text>
              </Pressable>
              <Pressable
                disabled={index === playlists.length - 1}
                onPress={() => reorderPlaylist(index, index + 1)}
                style={{ opacity: index === playlists.length - 1 ? 0.3 : 1 }}
              >
                <Text style={{ color: "#fff", fontSize: 18 }}>↓</Text>
              </Pressable>
            </View>
          </View>
        )}
      />
    </View>
  );
}
