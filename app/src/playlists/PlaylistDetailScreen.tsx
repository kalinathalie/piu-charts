import { Alert, FlatList, Platform, Pressable, Text, View } from "react-native";
import type { Screen } from "../screen";
import { Thumb, modeRowStyle, styles } from "../uiKit";
import { chartByGlobalIndex, type FlatChart } from "../chartIndex";
import type { Playlist } from "./types";
import type { usePlaylists } from "./usePlaylists";

// A playlist entry is a specific chart (song + difficulty), so unlike the
// generic ChartRow (used when browsing by song, where the song is the
// primary thing being looked at), the difficulty is shown as the primary
// text here and the song title as secondary — otherwise two entries for
// the same song at different difficulties would look identical at a
// glance.
function PlaylistChartRow({ item, push }: { item: FlatChart; push: (s: Screen) => void }) {
  return (
    <Pressable style={styles.row} onPress={() => push({ k: "song", id: item.song.id })}>
      <Thumb id={item.song.id} size={48} radius={8} />
      <View style={[styles.flex, styles.rowText]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={[styles.diffBadge, modeRowStyle(item.chart.mode)]}>
            <Text style={styles.diffBadgeText}>{item.chart.label}</Text>
          </View>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {item.song.title}
          </Text>
        </View>
        <Text style={styles.rowMeta}>
          {item.song.debutVersion}
          {item.chart.stepmaker ? ` · ${item.chart.stepmaker}` : ""}
        </Text>
      </View>
    </Pressable>
  );
}

export function PlaylistDetailScreen({
  playlist,
  playlists,
  push,
  bottom,
  onAdd,
}: {
  playlist: Playlist;
  playlists: ReturnType<typeof usePlaylists>;
  push: (s: Screen) => void;
  bottom: number;
  onAdd: () => void;
}) {
  const rows = playlist.chartIds
    .map((id, index) => ({ id, index, flat: chartByGlobalIndex.get(id) }))
    .filter((r): r is { id: number; index: number; flat: NonNullable<typeof r.flat> } => !!r.flat);

  function confirmDelete() {
    const message = `Excluir "${playlist.name}"? Essa ação não pode ser desfeita.`;
    const doDelete = () => {
      playlists.remove(playlist.id);
      push({ k: "playlists" });
    };
    // react-native-web's Alert.alert is a no-op stub (it renders nothing
    // and never calls back), so the native multi-button dialog only works
    // on iOS/Android. On web, window.confirm is the equivalent blocking
    // confirmation dialog.
    if (Platform.OS === "web") {
      if (window.confirm(message)) doDelete();
      return;
    }
    Alert.alert("Excluir playlist", message, [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: doDelete },
    ]);
  }

  return (
    <View style={styles.flex}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
        <Text style={[styles.title, { color: playlist.color }]}>{playlist.name}</Text>
        <Text style={styles.rowMeta}>{playlist.chartIds.length} charts</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
          <Pressable style={[styles.diffBadge, { backgroundColor: "#1b1d27" }]} onPress={() => push({ k: "playlistEdit", id: playlist.id })}>
            <Text style={styles.diffBadgeText}>Editar</Text>
          </Pressable>
          <Pressable style={[styles.diffBadge, { backgroundColor: "#1b1d27" }]} onPress={onAdd}>
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
              <PlaylistChartRow item={item.flat} push={push} />
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
