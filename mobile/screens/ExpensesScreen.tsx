import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useFarm } from "../lib/farm-context";
import { apiFetch, type ExpenseRow, type Paginated } from "../lib/api";
import { withPagination } from "../lib/pagination";
import { PaginatedControls } from "../components/PaginatedControls";

const DEFAULT_LIMIT = 25;

const fmtInr = (n: number) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "INR" }).format(n);

export function ExpensesScreen() {
  const { farmId, farms } = useFarm();
  const current = farms.find((f) => f.id === farmId);
  const canManage = current?.my_role === "owner" || current?.my_role === "manager";

  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [offset, setOffset] = useState(0);
  const [category, setCategory] = useState("feed");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editCategory, setEditCategory] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDate, setEditDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!farmId) return;
    setLoading(true);
    try {
      const res = await apiFetch<Paginated<ExpenseRow>>(
        withPagination(`/farms/${farmId}/expenses`, limit, offset)
      );
      setRows(res.items);
      setTotal(res.total);
    } catch {
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [farmId, limit, offset]);

  useEffect(() => {
    setOffset(0);
  }, [limit, farmId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function submit() {
    if (!farmId) return;
    setSaving(true);
    try {
      await apiFetch(`/farms/${farmId}/expenses`, {
        method: "POST",
        body: JSON.stringify({
          category,
          amount: parseFloat(amount),
          description: description.trim() || null,
          date,
        }),
      });
      setAmount("");
      setDescription("");
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  function startEdit(r: ExpenseRow) {
    setEditingId(r.id);
    setEditCategory(r.category);
    setEditAmount(String(r.amount));
    setEditDescription(r.description ?? "");
    setEditDate(r.date);
  }

  async function saveEdit() {
    if (!farmId || editingId == null) return;
    setSaving(true);
    try {
      await apiFetch(`/farms/${farmId}/expenses/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify({
          category: editCategory,
          amount: parseFloat(editAmount),
          description: editDescription.trim() || null,
          date: editDate,
        }),
      });
      setEditingId(null);
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!farmId) {
    return <Text style={styles.muted}>Select or create a farm in Settings.</Text>;
  }

  return (
    <ScrollView
      style={styles.wrap}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
    >
      {canManage ? (
        <View style={styles.card}>
          <Text style={styles.h2}>Add expense</Text>
          <Text style={styles.hint}>
            Managers and owners can add expenses. Workers can view the list.
          </Text>
          <Text style={styles.label}>Category</Text>
          <TextInput style={styles.input} value={category} onChangeText={setCategory} />
          <Text style={styles.label}>Amount (₹)</Text>
          <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
          <Text style={styles.label}>Description</Text>
          <TextInput style={styles.input} value={description} onChangeText={setDescription} />
          <Text style={styles.label}>Date</Text>
          <TextInput style={styles.input} value={date} onChangeText={setDate} />
          <Pressable style={[styles.btn, saving && styles.btnDis]} onPress={submit} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save</Text>}
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.h2}>Expenses</Text>
      {loading && !rows.length ? <ActivityIndicator style={{ marginVertical: 16 }} color="#047857" /> : null}
      {rows.map((r) =>
        editingId === r.id && canManage ? (
          <View key={r.id} style={[styles.row, styles.rowEdit]}>
            <TextInput style={styles.inputSm} value={editDate} onChangeText={setEditDate} />
            <TextInput style={styles.inputSm} value={editCategory} onChangeText={setEditCategory} />
            <TextInput style={styles.inputSm} value={editAmount} onChangeText={setEditAmount} keyboardType="decimal-pad" />
            <TextInput style={styles.inputSm} value={editDescription} onChangeText={setEditDescription} />
            <View style={styles.rowActions}>
              <Pressable onPress={saveEdit} disabled={saving}>
                <Text style={styles.link}>Save</Text>
              </Pressable>
              <Pressable onPress={() => setEditingId(null)}>
                <Text style={styles.linkMuted}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View key={r.id} style={styles.row}>
            <Text style={styles.rowMain}>
              {r.date} · {r.category}
            </Text>
            <Text style={styles.rowSub}>{fmtInr(r.amount)}</Text>
            <Text style={styles.note}>{r.description ?? "—"}</Text>
            {canManage ? (
              <Pressable onPress={() => startEdit(r)}>
                <Text style={styles.link}>Edit</Text>
              </Pressable>
            ) : null}
          </View>
        )
      )}
      <PaginatedControls
        total={total}
        limit={limit}
        offset={offset}
        onLimitChange={setLimit}
        onOffsetChange={setOffset}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#fafafa", padding: 16 },
  muted: { padding: 16, color: "#71717a" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    padding: 16,
    marginBottom: 20,
  },
  h2: { fontSize: 17, fontWeight: "700", color: "#18181b", marginBottom: 8 },
  hint: { fontSize: 13, color: "#71717a", marginBottom: 12 },
  label: { fontSize: 12, color: "#52525b", fontWeight: "600", marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
    backgroundColor: "#fff",
  },
  inputSm: {
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
    fontSize: 13,
  },
  btn: {
    marginTop: 16,
    backgroundColor: "#047857",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
  },
  btnDis: { opacity: 0.7 },
  btnText: { color: "#fff", fontWeight: "600" },
  row: {
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    padding: 12,
    marginBottom: 8,
  },
  rowEdit: { backgroundColor: "#fafafa" },
  rowMain: { fontWeight: "700", color: "#18181b" },
  rowSub: { fontSize: 15, color: "#047857", fontWeight: "600", marginTop: 4 },
  note: { fontSize: 13, color: "#52525b", marginTop: 4 },
  rowActions: { flexDirection: "row", gap: 16, marginTop: 8 },
  link: { marginTop: 8, color: "#047857", fontWeight: "600", fontSize: 13 },
  linkMuted: { color: "#71717a", fontWeight: "600", fontSize: 13 },
});
