import { useState } from "react";
import { ScrollView, Text, TextInput, View, Pressable } from "react-native";
import ColorPicker, { Panel1, HueSlider, Preview, Swatches } from "reanimated-color-picker";
import { styles } from "../uiKit";
import { PLAYLIST_NAME_MAX, type Playlist } from "./types";
import type { usePlaylists } from "./usePlaylists";

const SWATCHES = [
  "#ebe721", "#ff5a5a", "#5affb0", "#5a9dff", "#c75aff",
  "#ff9d5a", "#5affe0", "#ff5ac7", "#9dff5a", "#ffffff",
];

export function PlaylistEditScreen({
  playlist,
  onDone,
  playlists,
}: {
  playlist?: Playlist;
  onDone: (id: string) => void;
  playlists: ReturnType<typeof usePlaylists>;
}) {
  const [name, setName] = useState(playlist?.name ?? "");
  const [color, setColor] = useState(playlist?.color ?? SWATCHES[0]);
  const [customHex, setCustomHex] = useState(playlist?.color ?? "");

  function save() {
    const trimmed = name.trim().slice(0, PLAYLIST_NAME_MAX);
    if (!trimmed) return;
    if (playlist) {
      playlists.rename(playlist.id, trimmed);
      playlists.recolor(playlist.id, color);
      onDone(playlist.id);
    } else {
      const created = playlists.create(trimmed, color);
      onDone(created.id);
    }
  }

  const validCustomHex = /^#[0-9a-fA-F]{6}$/.test(customHex);

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <Text style={styles.section}>Nome</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={(t) => setName(t.slice(0, PLAYLIST_NAME_MAX))}
        placeholder="Nome da playlist"
        placeholderTextColor="#7a7f8c"
        maxLength={PLAYLIST_NAME_MAX}
      />
      <Text style={styles.rowMeta}>
        {name.length}/{PLAYLIST_NAME_MAX}
      </Text>

      <Text style={[styles.section, { marginTop: 20 }]}>Cor</Text>
      <ColorPicker
        value={color}
        onChangeJS={(colors) => {
          setColor(colors.hex);
          setCustomHex(colors.hex);
        }}
        style={{ gap: 14 }}
      >
        <Panel1 style={{ borderRadius: 12, height: 200 }} />
        <HueSlider style={{ borderRadius: 8 }} />
        <Preview style={{ borderRadius: 8, height: 40 }} hideInitialColor />
        <Swatches colors={SWATCHES} style={{ marginTop: 4 }} />
      </ColorPicker>

      <Text style={[styles.rowMeta, { marginTop: 16 }]}>Outra cor (hex)</Text>
      <TextInput
        style={styles.input}
        value={customHex}
        onChangeText={(t) => {
          setCustomHex(t);
          if (/^#[0-9a-fA-F]{6}$/.test(t)) setColor(t);
        }}
        placeholder="#rrggbb"
        placeholderTextColor="#7a7f8c"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {!validCustomHex && customHex.length > 0 && (
        <Text style={{ color: "#e05a5a", fontSize: 12, marginTop: 4 }}>Formato inválido, use #rrggbb.</Text>
      )}

      <Pressable
        style={[styles.bigBtn, { marginTop: 24, backgroundColor: color, opacity: name.trim() ? 1 : 0.5 }]}
        onPress={save}
        disabled={!name.trim()}
      >
        <Text style={styles.bigBtnText}>Salvar</Text>
      </Pressable>
    </ScrollView>
  );
}
