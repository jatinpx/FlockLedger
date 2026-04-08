import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { apiFetch, type Shed } from "../lib/api";
import type { RootStackParamList } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "AddEgg">;

export function AddEggScreen({ navigation, route }: Props) {
  const { farmId } = route.params;
  const [sheds, setSheds] = useState<Shed[]>([]);
  const [shedId, setShedId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [eggs, setEggs] = useState("");
  const [broken, setBroken] = useState("0");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Shed[]>(`/farms/${farmId}/sheds`)
      .then((s) => {
        setSheds(s);
        if (s.length) setShedId(String(s[0].id));
      })
      .catch(() => {});
  }, [farmId]);

  async function save() {
    setMsg(null);
    try {
      await apiFetch(`/farms/${farmId}/production/eggs`, {
        method: "POST",
        body: JSON.stringify({
          shed_id: parseInt(shedId, 10),
          date,
          eggs_produced: parseInt(eggs, 10),
          broken_eggs: parseInt(broken, 10) || 0,
        }),
      });
      setMsg("Saved");
      navigation.goBack();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.label}>Shed ID (from list)</Text>
      <TextInput
        style={styles.input}
        value={shedId}
        onChangeText={setShedId}
        keyboardType="number-pad"
      />
      <Text style={styles.hint}>
        Sheds: {sheds.map((s) => `${s.name} (#${s.id})`).join(", ") || "none"}
      </Text>
      <Text style={styles.label}>Date</Text>
      <TextInput style={styles.input} value={date} onChangeText={setDate} />
      <Text style={styles.label}>Eggs produced</Text>
      <TextInput
        style={styles.input}
        value={eggs}
        onChangeText={setEggs}
        keyboardType="number-pad"
      />
      <Text style={styles.label}>Broken</Text>
      <TextInput
        style={styles.input}
        value={broken}
        onChangeText={setBroken}
        keyboardType="number-pad"
      />
      {msg ? <Text style={styles.msg}>{msg}</Text> : null}
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
  hint: { marginTop: 6, fontSize: 12, color: "#71717a" },
  msg: { marginTop: 12, color: "#047857" },
  btn: {
    marginTop: 20,
    backgroundColor: "#047857",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "600" },
});
