import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { apiFetch } from "../lib/api";
import type { RootStackParamList } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "AddFeed">;

export function AddFeedScreen({ navigation, route }: Props) {
  const { farmId } = route.params;
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [received, setReceived] = useState("");
  const [used, setUsed] = useState("");
  const [remaining, setRemaining] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setMsg(null);
    try {
      await apiFetch(`/farms/${farmId}/feed`, {
        method: "POST",
        body: JSON.stringify({
          date,
          feed_received: parseFloat(received),
          feed_used: parseFloat(used),
          feed_remaining: parseFloat(remaining),
        }),
      });
      navigation.goBack();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.label}>Date</Text>
      <TextInput style={styles.input} value={date} onChangeText={setDate} />
      <Text style={styles.label}>Received (kg)</Text>
      <TextInput
        style={styles.input}
        value={received}
        onChangeText={setReceived}
        keyboardType="decimal-pad"
      />
      <Text style={styles.label}>Used (kg)</Text>
      <TextInput
        style={styles.input}
        value={used}
        onChangeText={setUsed}
        keyboardType="decimal-pad"
      />
      <Text style={styles.label}>Remaining (kg)</Text>
      <TextInput
        style={styles.input}
        value={remaining}
        onChangeText={setRemaining}
        keyboardType="decimal-pad"
      />
      {msg ? <Text style={styles.err}>{msg}</Text> : null}
      <Pressable style={styles.btn} onPress={save}>
        <Text style={styles.btnText}>Save</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#fafafa" },
  label: { marginTop: 12, fontSize: 13, color: "#52525b", fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 8,
    padding: 12,
    marginTop: 6,
    backgroundColor: "#fff",
  },
  err: { marginTop: 12, color: "#b91c1c" },
  btn: {
    marginTop: 20,
    backgroundColor: "#047857",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "600" },
});
