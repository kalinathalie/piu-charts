import { useEffect, useMemo, useState } from "react";
import {
  BackHandler,
  FlatList,
  Image,
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
import { THUMBS } from "./src/thumbs";

const data = rawData as AppData;

/** Cover thumbnail for a song, or a neutral placeholder when none is bundled. */
function Thumb({ id, size, radius }: { id: string; size: number; radius: number }) {
  const src = THUMBS[id];
  const style = { width: size, height: size, borderRadius: radius };
  if (src) return <Image source={src} style={style} resizeMode="cover" />;
  return <View style={[style, styles.thumbPlaceholder]} />;
}

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
        {
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      {selected ? (
        <Detail song={selected} onBack={() => setSelected(null)} />
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
            contentContainerStyle={{ paddingBottom: 12 }}
            renderItem={({ item }) => (
              <Pressable style={styles.row} onPress={() => setSelected(item)}>
                <Thumb id={item.id} size={48} radius={8} />
                <View style={[styles.flex, styles.rowText]}>
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

function Detail({ song, onBack }: { song: AppSong; onBack: () => void }) {
  const bpm =
    song.bpmMin > 0
      ? song.bpmMin === song.bpmMax
        ? `${song.bpmMin} BPM`
        : `${song.bpmMin}–${song.bpmMax} BPM`
      : null;

  return (
    <ScrollView contentContainerStyle={styles.detail}>
      <Pressable onPress={onBack} style={styles.back}>
        <Text style={styles.backText}>‹ Voltar</Text>
      </Pressable>

      <View style={styles.detailHead}>
        <Thumb id={song.id} size={96} radius={14} />
        <View style={styles.detailHeadText}>
          <Text style={styles.title}>{song.title}</Text>
          <Text style={styles.metaHead}>
            {song.debutVersion}
            {song.artist ? ` · ${song.artist}` : ""}
            {bpm ? ` · ${bpm}` : ""}
          </Text>
        </View>
      </View>

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
            <View
              key={c.id}
              style={[
                styles.chartRow,
                c.mode?.toLowerCase() === "single" ? styles.chartRowSingle : styles.chartRowDouble,
              ]}
            >
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
                  <Text style={styles.chartTotal}>/{level.total}</Text>
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
  rowText: { marginLeft: 12 },
  rowTitle: { color: "#fff", fontSize: 16, fontWeight: "600" },
  rowMeta: { color: "#8b90a0", fontSize: 13, marginTop: 2 },
  badge: { color: "#5a6cff", fontSize: 13, fontWeight: "700" },
  empty: { color: "#7a7f8c", textAlign: "center", marginTop: 40 },
  thumbPlaceholder: { backgroundColor: "#22242f" },

  detail: { padding: 16, paddingBottom: 32 },
  back: { paddingVertical: 8 },
  backText: { color: "#5a6cff", fontSize: 16, fontWeight: "600" },
  detailHead: { flexDirection: "row", alignItems: "center", marginTop: 6, marginBottom: 18 },
  detailHeadText: { flex: 1, marginLeft: 14 },
  title: { color: "#fff", fontSize: 22, fontWeight: "800" },
  metaHead: { color: "#8b90a0", fontSize: 14, marginTop: 4 },
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
  chartRowSingle: { backgroundColor: "#9e3340" },
  chartRowDouble: { backgroundColor: "#247a4a" },
  chartHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  chartLabel: { color: "#fff", fontSize: 18, fontWeight: "800" },
  types: { color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: "700" },
  stepmaker: { color: "rgba(255,255,255,0.8)", fontSize: 12, marginTop: 3 },
  chartValue: { color: "#fff", fontSize: 18, fontWeight: "800" },
  chartTotal: { color: "rgba(255,255,255,0.65)", fontSize: 14, fontWeight: "600" },
});
