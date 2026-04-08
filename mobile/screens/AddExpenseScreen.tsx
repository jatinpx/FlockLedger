import { useState } from "react";
import {
  View,
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

type Props = NativeStackScreenProps<RootStackParamList, "AddExpense">;

export function AddExpenseScreen({ navigation, route }: Props) {
  const { farmId } = route.params;
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setMsg(null);
    setSaving(true);
    try {
      await apiFetch(`/farms/${farmId}/expenses`, {
        method: "POST",
        body: JSON.stringify({
          category: category.trim(),
          amount: parseFloat(amount),
          description: description.trim() || null,
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
      <Text style={styles.label}>Category</Text>
      <TextInput style={styles.input} value={category} onChangeText={setCategory} />
      <Text style={styles.label}>Amount (₹)</Text>
      <TextInput
        style={styles.input}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
      />
      <Text style={styles.label}>Description (optional)</Text>
      <TextInput style={styles.input} value={description} onChangeText={setDescription} />
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
