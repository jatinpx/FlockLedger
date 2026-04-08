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
import { apiFetch, type Paginated, type SaleRow } from "../lib/api";
import { withPagination } from "../lib/pagination";
import { PaginatedControls } from "../components/PaginatedControls";

const DEFAULT_LIMIT = 25;

const fmtInr = (n: number) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "INR" }).format(n);

export function SalesScreen() {
  const { farmId } = useFarm();
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [offset, setOffset] = useState(0);
  const [buyer, setBuyer] = useState("");
  const [trays, setTrays] = useState("");
  const [rate, setRate] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editBuyer, setEditBuyer] = useState("");
  const [editTrays, setEditTrays] = useState("");
  const [editRate, setEditRate] = useState("");
  const [editDate, setEditDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!farmId) return;
    setLoading(true);
    try {
      const res = await apiFetch<Paginated<SaleRow>>(
        withPagination(`/farms/${farmId}/sales`, limit, offset)
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
    const t = parseInt(trays, 10);
    const r = parseFloat(rate);
    const totalAmt = t * r;
    setSaving(true);
    try {
      await apiFetch(`/farms/${farmId}/sales`, {
        method: "POST",
        body: JSON.stringify({
          buyer_name: buyer,
          trays_sold: t,
          rate_per_tray: r,
          total_amount: totalAmt,
          date,
        }),
      });
      setBuyer("");
      setTrays("");
      setRate("");
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  function startEdit(r: SaleRow) {
    setEditingId(r.id);
    setEditBuyer(r.buyer_name);
    setEditTrays(String(r.trays_sold));
    setEditRate(String(r.rate_per_tray));
    setEditDate(r.date);
  }

  async function saveEdit() {
    if (!farmId || editingId == null) return;
    const t = parseInt(editTrays, 10);
    const r = parseFloat(editRate);
    const totalAmt = t * r;
    setSaving(true);
    try {
      await apiFetch(`/farms/${farmId}/sales/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify({
          buyer_name: editBuyer,
          trays_sold: t,
          rate_per_tray: r,
          total_amount: totalAmt,
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
      <View style={styles.card}>
        <Text style={styles.h2}>Record sale</Text>
        <Text style={styles.label}>Buyer</Text>
        <TextInput style={styles.input} value={buyer} onChangeText={setBuyer} />
        <Text style={styles.label}>Trays sold</Text>
        <TextInput style={styles.input} value={trays} onChangeText={setTrays} keyboardType="number-pad" />
        <Text style={styles.label}>Rate per tray (₹)</Text>
        <TextInput style={styles.input} value={rate} onChangeText={setRate} keyboardType="decimal-pad" />
        <Text style={styles.label}>Date</Text>
        <TextInput style={styles.input} value={date} onChangeText={setDate} />
        <Pressable style={[styles.btn, saving && styles.btnDis]} onPress={submit} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save</Text>}
        </Pressable>
      </View>

      <Text style={styles.h2}>Sales</Text>
      {loading && !rows.length ? <ActivityIndicator style={{ marginVertical: 16 }} color="#047857" /> : null}
      {rows.map((r) =>
        editingId === r.id ? (
          <View key={r.id} style={[styles.row, styles.rowEdit]}>
            <TextInput style={styles.inputSm} value={editBuyer} onChangeText={setEditBuyer} />
            <TextInput style={styles.inputSm} value={editTrays} onChangeText={setEditTrays} keyboardType="number-pad" />
            <TextInput style={styles.inputSm} value={editRate} onChangeText={setEditRate} keyboardType="decimal-pad" />
            <TextInput style={styles.inputSm} value={editDate} onChangeText={setEditDate} />
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
              {r.buyer_name} · {r.date}
            </Text>
            <Text style={styles.rowSub}>
              {r.trays_sold} trays @ {fmtInr(r.rate_per_tray)} → {fmtInr(r.total_amount)}
            </Text>
            <Pressable onPress={() => startEdit(r)}>
              <Text style={styles.link}>Edit</Text>
            </Pressable>
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
  h2: { fontSize: 17, fontWeight: "700", color: "#18181b", marginBottom: 12 },
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
  rowSub: { fontSize: 13, color: "#52525b", marginTop: 4 },
  rowActions: { flexDirection: "row", gap: 16, marginTop: 8 },
  link: { marginTop: 8, color: "#047857", fontWeight: "600", fontSize: 13 },
  linkMuted: { color: "#71717a", fontWeight: "600", fontSize: 13 },
});
