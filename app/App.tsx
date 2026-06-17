import { useEffect, useMemo, useState } from "react";
import {
  BackHandler,
  FlatList,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import rawData from "./assets/app-data.json";
import { normalizeQuery, type AppData, type AppSong } from "./src/appData";

const data = rawData as AppData;

export default function App() {
  return (
    <SafeAreaProvider>
      <Main />
    </SafeAreaProvider>
  );
}

function Main() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<AppSong | null>(null);

  // Hardware/gesture back: when viewing a chart, go back to the list instead of
  // exiting the app. On the list, let the system handle it (exit).
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (selected) {
        setSelected(null);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [selected]);

  const results = useMemo(() => {
    const q = normalizeQuery(query);
    if (!q) return data.songs.slice(0, 60);
    return data.songs
      .filter(
        (s) =>
          s.titleNormalized.includes(q) ||
          normalizeQuery(s.artist).includes(q) ||
          (s.titleKr ? normalizeQuery(s.titleKr).includes(q) : false),
      )
      .slice(0, 200);
  }, [query]);

  return (
    <View
      style={[
        styles.safe,
        { paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right },
      ]}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      {selected ? (
        <Detail song={selected} onBack={() => setSelected(null)} bottomInset={insets.bottom} />
      ) : (
        <View style={styles.flex}>
          <Text style={styles.header}>PIU Charts</Text>
          <Text style={styles.sub}>
            {data.songCount} músicas · Pump It Up Phoenix
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Buscar música, artista…"
            placeholderTextColor="#7a7f8c"
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
          />
          <FlatList
            data={results}
            keyExtractor={(s) => s.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: insets.bottom + 12 }}
            renderItem={({ item }) => (
              <Pressable style={styles.row} onPress={() => setSelected(item)}>
                <View style={styles.flex}>
                  <Text style={styles.rowTitle}>{item.title}</Text>
                  <Text style={styles.rowMeta}>
                    {item.debutVersion}
                    {item.artist ? ` · ${item.artist}` : ""}
                  </Text>
                </View>
                <Text style={styles.badge}>#{item.releaseIndex}</Text>
              </Pressable>
            )}
            ListEmptyComponent={
              <Text style={styles.empty}>Nenhuma música encontrada.</Text>
            }
          />
        </View>
      )}
    </View>
  );
}

function Detail({
  song,
  onBack,
  bottomInset,
}: {
  song: AppSong;
  onBack: () => void;
  bottomInset: number;
}) {
  const bpm =
    song.bpmMin > 0
      ? song.bpmMin === song.bpmMax
        ? `${song.bpmMin} BPM`
        : `${song.bpmMin}–${song.bpmMax} BPM`
      : null;

  return (
    <ScrollView contentContainerStyle={[styles.detail, { paddingBottom: bottomInset + 32 }]}>
      <Pressable onPress={onBack} style={styles.back}>
        <Text style={styles.backText}>‹ Voltar</Text>
      </Pressable>

      <Text style={styles.title}>{song.title}</Text>
      <Text style={styles.meta}>
        {song.debutVersion}
        {song.artist ? ` · ${song.artist}` : ""}
        {bpm ? ` · ${bpm}` : ""}
      </Text>

      <Text style={styles.section}>Onde achar no arcade</Text>
      <View style={styles.card}>
        {song.placements.map((p) => (
          <PlacementRow key={p.label} label={p.label} position={p.position} total={p.total} />
        ))}
      </View>

      {song.charts.length === 0 ? (
        <Text style={styles.note}>
          Charts (S16/D20…) ainda não cadastrados para esta música.
        </Text>
      ) : (
        song.charts.map((c) => {
          // Per-chart we only show the difficulty-level placement; the song's
          // version/total placements are already shown once in the card above.
          const level = c.placements.find((p) => p.label.startsWith("Nível"));
          return (
            <View key={c.id} style={styles.chartRow}>
              <View style={styles.flex}>
                <View style={styles.chartHeader}>
                  <Text style={styles.chartLabel}>{c.label}</Text>
                  {c.types.length > 0 && (
                    <Text style={styles.types}>{c.types.join(" · ")}</Text>
                  )}
                </View>
                {c.stepmaker ? (
                  <Text style={styles.stepmaker}>por {c.stepmaker}</Text>
                ) : null}
              </View>
              {level && (
                <Text style={styles.chartValue}>
                  {level.position}
                  <Text style={styles.placementTotal}>/{level.total}</Text>
                </Text>
              )}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

function PlacementRow({
  label,
  position,
  total,
}: {
  label: string;
  position: number;
  total: number;
}) {
  return (
    <View style={styles.placement}>
      <Text style={styles.placementLabel}>{label}</Text>
      <Text style={styles.placementValue}>
        {position}
        <Text style={styles.placementTotal}>/{total}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0e0f14" },
  flex: { flex: 1 },
  header: { color: "#fff", fontSize: 28, fontWeight: "800", paddingHorizontal: 16, paddingTop: 8 },
  sub: { color: "#7a7f8c", fontSize: 13, paddingHorizontal: 16, paddingBottom: 8 },
  input: {
    backgroundColor: "#1b1d27",
    color: "#fff",
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    fontSize: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#22242f",
  },
  rowTitle: { color: "#fff", fontSize: 16, fontWeight: "600" },
  rowMeta: { color: "#8b90a0", fontSize: 13, marginTop: 2 },
  badge: { color: "#5a6cff", fontSize: 13, fontWeight: "700" },
  empty: { color: "#7a7f8c", textAlign: "center", marginTop: 40 },

  detail: { padding: 16 },
  back: { paddingVertical: 8 },
  backText: { color: "#5a6cff", fontSize: 16, fontWeight: "600" },
  title: { color: "#fff", fontSize: 26, fontWeight: "800", marginTop: 4 },
  meta: { color: "#8b90a0", fontSize: 14, marginTop: 4, marginBottom: 16 },
  section: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 8 },
  card: { backgroundColor: "#1b1d27", borderRadius: 12, paddingHorizontal: 14, marginBottom: 16 },
  placement: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#22242f",
  },
  placementLabel: { color: "#c7ccda", fontSize: 15 },
  placementValue: { color: "#fff", fontSize: 18, fontWeight: "800" },
  placementTotal: { color: "#7a7f8c", fontSize: 14, fontWeight: "600" },
  note: { color: "#8b90a0", fontSize: 13, lineHeight: 19, fontStyle: "italic" },

  chartRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1b1d27",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 8,
  },
  chartHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  chartLabel: { color: "#fff", fontSize: 18, fontWeight: "800" },
  types: { color: "#5a6cff", fontSize: 13, fontWeight: "700" },
  stepmaker: { color: "#8b90a0", fontSize: 12, marginTop: 3 },
  chartValue: { color: "#fff", fontSize: 18, fontWeight: "800" },
});
