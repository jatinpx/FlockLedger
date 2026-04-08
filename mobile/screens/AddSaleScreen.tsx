import { useState } from "react";
import {
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { apiFetch } from "../lib/api";
import type { RootStackParamList } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "AddSale">;

export function AddSaleScreen({ navigation, route }: Props) {
  const { farmId } = route.params;
  const [buyer, setBuyer] = useState("");
  const [trays, setTrays] = useState("");
  const [rate, setRate] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setMsg(null);
    setSaving(true);
    const t = parseInt(trays, 10);
    const r = parseFloat(rate);
    const total = t * r;
    try {
      await apiFetch(`/farms/${farmId}/sales`, {
        method: "POST",
        body: JSON.stringify({
          buyer_name: buyer,
          trays_sold: t,
          rate_per_tray: r,
          total_amount: total,
          date,
        }),
      });
      navigation.goBack();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.label}>Buyer</Text>
      <TextInput style={styles.input} value={buyer} onChangeText={setBuyer} />
      <Text style={styles.label}>Trays sold</Text>
      <TextInput
        style={styles.input}
        value={trays}
        onChangeText={setTrays}
        keyboardType="number-pad"
      />
      <Text style={styles.label}>Rate per tray</Text>
      <TextInput
        style={styles.input}
        value={rate}
        onChangeText={setRate}
        keyboardType="decimal-pad"
      />
      <Text style={styles.label}>Date</Text>
      <TextInput style={styles.input} value={date} onChangeText={setDate} />
      {msg ? <Text style={styles.err}>{msg}</Text> : null}
      <Pressable style={[styles.btn, saving && styles.btnDisabled]} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save</Text>}
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
    minHeight: 48,
    justifyContent: "center",
  },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: "#fff", fontWeight: "600" },
});
