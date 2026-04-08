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
const EGGS_PER_TRAY = 30;

type RateBasis = "tray" | "egg";

const roundMoney2 = (n: number) => Math.round(n * 100) / 100;

const eggFromRow = (r: SaleRow) => r.rate_per_egg ?? r.rate_per_tray / EGGS_PER_TRAY;

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
  const [rateBasis, setRateBasis] = useState<RateBasis>("tray");
  const [rateInput, setRateInput] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editBuyer, setEditBuyer] = useState("");
  const [editTrays, setEditTrays] = useState("");
  const [editRateBasis, setEditRateBasis] = useState<RateBasis>("tray");
  const [editRateInput, setEditRateInput] = useState("");
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
    const r = parseFloat(rateInput);
    if (!Number.isFinite(r) || r < 0) return;
    const ratePerTray = rateBasis === "tray" ? r : roundMoney2(r * EGGS_PER_TRAY);
    const totalAmt = roundMoney2(t * ratePerTray);
    const payload =
      rateBasis === "egg"
        ? {
            buyer_name: buyer,
            trays_sold: t,
            rate_per_egg: roundMoney2(r),
            total_amount: totalAmt,
            date,
          }
        : {
            buyer_name: buyer,
            trays_sold: t,
            rate_per_tray: roundMoney2(r),
            total_amount: totalAmt,
            date,
          };
    setSaving(true);
    try {
      await apiFetch(`/farms/${farmId}/sales`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setBuyer("");
      setTrays("");
      setRateInput("");
      setRateBasis("tray");
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  function startEdit(r: SaleRow) {
    setEditingId(r.id);
    setEditBuyer(r.buyer_name);
    setEditTrays(String(r.trays_sold));
    setEditRateBasis("tray");
    setEditRateInput(String(r.rate_per_tray));
    setEditDate(r.date);
  }

  async function saveEdit() {
    if (!farmId || editingId == null) return;
    const t = parseInt(editTrays, 10);
    const r = parseFloat(editRateInput);
    if (!Number.isFinite(r) || r < 0) return;
    const ratePerTray = editRateBasis === "tray" ? r : roundMoney2(r * EGGS_PER_TRAY);
    const totalAmt = roundMoney2(t * ratePerTray);
    const payload =
      editRateBasis === "egg"
        ? {
            buyer_name: editBuyer,
            trays_sold: t,
            rate_per_egg: roundMoney2(r),
            total_amount: totalAmt,
            date: editDate,
          }
        : {
            buyer_name: editBuyer,
            trays_sold: t,
            rate_per_tray: roundMoney2(r),
            total_amount: totalAmt,
            date: editDate,
          };
    setSaving(true);
    try {
      await apiFetch(`/farms/${farmId}/sales/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
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
        <Text style={styles.hint}>1 tray = {EGGS_PER_TRAY} eggs. Choose ₹/tray or ₹/egg.</Text>
        <Text style={styles.label}>Buyer</Text>
        <TextInput style={styles.input} value={buyer} onChangeText={setBuyer} />
        <Text style={styles.label}>Trays sold</Text>
        <TextInput style={styles.input} value={trays} onChangeText={setTrays} keyboardType="number-pad" />
        <Text style={styles.label}>Price basis</Text>
        <View style={styles.basisRow}>
          <Pressable
            onPress={() => setRateBasis("tray")}
            style={[styles.basisChip, rateBasis === "tray" && styles.basisChipOn]}
          >
            <Text style={[styles.basisChipText, rateBasis === "tray" && styles.basisChipTextOn]}>₹ / tray</Text>
          </Pressable>
          <Pressable
            onPress={() => setRateBasis("egg")}
            style={[styles.basisChip, rateBasis === "egg" && styles.basisChipOn]}
          >
            <Text style={[styles.basisChipText, rateBasis === "egg" && styles.basisChipTextOn]}>₹ / egg</Text>
          </Pressable>
        </View>
        <Text style={styles.label}>{rateBasis === "tray" ? "Rate per tray (₹)" : "Rate per egg (₹)"}</Text>
        <TextInput style={styles.input} value={rateInput} onChangeText={setRateInput} keyboardType="decimal-pad" />
        {rateInput !== "" && !Number.isNaN(parseFloat(rateInput)) && parseFloat(rateInput) >= 0 ? (
          <Text style={styles.derive}>
            {rateBasis === "tray"
              ? `≈ ${fmtInr(roundMoney2(parseFloat(rateInput) / EGGS_PER_TRAY))} per egg`
              : `≈ ${fmtInr(roundMoney2(parseFloat(rateInput) * EGGS_PER_TRAY))} per tray`}
          </Text>
        ) : null}
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
            <View style={styles.basisRow}>
              <Pressable
                onPress={() => setEditRateBasis("tray")}
                style={[styles.basisChipSm, editRateBasis === "tray" && styles.basisChipOn]}
              >
                <Text style={[styles.basisChipTextSm, editRateBasis === "tray" && styles.basisChipTextOn]}>Tray</Text>
              </Pressable>
              <Pressable
                onPress={() => setEditRateBasis("egg")}
                style={[styles.basisChipSm, editRateBasis === "egg" && styles.basisChipOn]}
              >
                <Text style={[styles.basisChipTextSm, editRateBasis === "egg" && styles.basisChipTextOn]}>Egg</Text>
              </Pressable>
            </View>
            <TextInput style={styles.inputSm} value={editRateInput} onChangeText={setEditRateInput} keyboardType="decimal-pad" />
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
              {r.trays_sold} trays @ {fmtInr(r.rate_per_tray)}/tray ({fmtInr(roundMoney2(eggFromRow(r)))}/egg) →{" "}
              {fmtInr(r.total_amount)}
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
  h2: { fontSize: 17, fontWeight: "700", color: "#18181b", marginBottom: 8 },
  hint: { fontSize: 12, color: "#71717a", marginBottom: 12 },
  label: { fontSize: 12, color: "#52525b", fontWeight: "600", marginTop: 8 },
  basisRow: { flexDirection: "row", gap: 8, marginTop: 6 },
  basisChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    alignItems: "center",
  },
  basisChipOn: { borderColor: "#047857", backgroundColor: "#ecfdf5" },
  basisChipText: { fontSize: 13, fontWeight: "600", color: "#52525b" },
  basisChipTextOn: { color: "#065f46" },
  basisChipSm: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e4e4e7",
  },
  basisChipTextSm: { fontSize: 12, fontWeight: "600", color: "#52525b" },
  derive: { fontSize: 12, color: "#71717a", marginTop: 4 },
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
