import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useIsFocused } from "@react-navigation/native";
import { useFarm } from "../lib/farm-context";
import { apiFetch, type Paginated, type SaleRow } from "../lib/api";
import { useAppTheme, type AppColors } from "../lib/theme";
import { withPagination } from "../lib/pagination";
import { PaginatedControls } from "../components/PaginatedControls";

const DEFAULT_LIMIT = 50;
const EGGS_PER_TRAY = 30;

type RateBasis = "tray" | "egg";

const roundMoney2 = (n: number) => Math.round(n * 100) / 100;

const eggFromRow = (r: SaleRow) => r.rate_per_egg ?? r.rate_per_tray / EGGS_PER_TRAY;

const fmtInr = (n: number) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "INR" }).format(n);

export function SalesScreen() {
  const { farmId } = useFarm();
  const isFocused = useIsFocused();
  const colors = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
    if (!isFocused) return;
    refresh();
  }, [isFocused, refresh]);

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
    const detectedBasis: RateBasis = r.rate_per_egg != null ? "egg" : "tray";
    setEditRateBasis(detectedBasis);
    setEditRateInput(String(detectedBasis === "egg" ? r.rate_per_egg : r.rate_per_tray));
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
      <View style={styles.headerCard}>
        <Text style={styles.screenTitle}>Sales</Text>
        <Text style={styles.screenSub}>Track tray sales and pricing quickly</Text>
      </View>

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
            <Text style={styles.editTitle}>Edit sale</Text>
            <Text style={styles.label}>Buyer</Text>
            <TextInput style={styles.inputSm} value={editBuyer} onChangeText={setEditBuyer} />
            <Text style={styles.label}>Trays sold</Text>
            <TextInput style={styles.inputSm} value={editTrays} onChangeText={setEditTrays} keyboardType="number-pad" />
            <Text style={styles.label}>Price basis</Text>
            <View style={styles.readonlyPill}>
              <Text style={styles.readonlyPillText}>{editRateBasis === "tray" ? "₹ / tray" : "₹ / egg"}</Text>
            </View>
            <Text style={styles.infoText}>Price basis is fixed for existing entries.</Text>
            <Text style={styles.label}>{editRateBasis === "tray" ? "Rate per tray (₹)" : "Rate per egg (₹)"}</Text>
            <TextInput style={styles.inputSm} value={editRateInput} onChangeText={setEditRateInput} keyboardType="decimal-pad" />
            <Text style={styles.label}>Date</Text>
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
          <View key={r.id} style={styles.rowCompact}>
            <View style={styles.rowTop}>
              <View style={styles.recordHeadLeft}>
                <Text style={styles.recordTitle} numberOfLines={1}>{r.buyer_name}</Text>
                <Text style={styles.recordDate}>{r.date}</Text>
              </View>
              <Pressable style={styles.editPill} onPress={() => startEdit(r)}>
                <Text style={styles.link}>Edit</Text>
              </Pressable>
            </View>
            <View style={styles.recordStatsCompact}>
              <Text style={[styles.statInline, styles.statTrays]}>T {r.trays_sold}</Text>
              <Text style={[styles.statInline, styles.statRateTray]}>R {fmtInr(r.rate_per_tray)}</Text>
              <Text style={[styles.statInline, styles.statRateEgg]}>E {fmtInr(roundMoney2(eggFromRow(r)))}</Text>
              <Text style={[styles.statInline, styles.accentText]}>Amt {fmtInr(r.total_amount)}</Text>
            </View>
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

const createStyles = (colors: AppColors) => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background, padding: 16 },
  headerCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  screenTitle: { fontSize: 22, fontWeight: "800", color: colors.text },
  screenSub: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  muted: { padding: 16, color: colors.textMuted },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  h2: { fontSize: 17, fontWeight: "700", color: colors.textStrong, marginBottom: 8 },
  hint: { fontSize: 12, color: colors.textMuted, marginBottom: 12 },
  label: { fontSize: 12, color: colors.textSoft, fontWeight: "600", marginTop: 8 },
  basisRow: { flexDirection: "row", gap: 8, marginTop: 6 },
  basisChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  basisChipOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  basisChipText: { fontSize: 13, fontWeight: "600", color: colors.textSoft },
  basisChipTextOn: { color: colors.accentText },
  basisChipSm: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  basisChipTextSm: { fontSize: 12, fontWeight: "600", color: colors.textSoft },
  derive: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
    backgroundColor: colors.inputBg,
    color: colors.inputText,
  },
  inputSm: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
    fontSize: 13,
    backgroundColor: colors.inputBg,
    color: colors.inputText,
  },
  editTitle: { fontSize: 14, fontWeight: "800", color: colors.text, marginBottom: 4 },
  readonlyPill: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceMuted,
  },
  readonlyPillText: { fontSize: 12, fontWeight: "700", color: colors.textSoft },
  infoText: { fontSize: 11, color: colors.textMuted, marginTop: 6, marginBottom: 2 },
  btn: {
    marginTop: 16,
    backgroundColor: colors.accent,
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
  },
  btnDis: { opacity: 0.7 },
  btnText: { color: colors.inverseText, fontWeight: "600" },
  row: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 8,
  },
  rowCompact: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
    gap: 8,
  },
  recordHeadLeft: { flex: 1, paddingRight: 8 },
  rowEdit: { backgroundColor: colors.surfaceAlt },
  recordTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  recordDate: { fontSize: 11, color: colors.textMuted, fontWeight: "600", marginTop: 1 },
  recordStatsCompact: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
  },
  statInline: { fontSize: 12, fontWeight: "700", color: colors.inputText },
  statTrays: { color: "#2563eb" },
  statRateTray: { color: "#7c3aed" },
  statRateEgg: { color: "#b45309" },
  editPill: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surface,
  },
  rowActions: { flexDirection: "row", gap: 16, marginTop: 8 },
  link: { color: colors.accent, fontWeight: "700", fontSize: 13 },
  linkMuted: { color: colors.textMuted, fontWeight: "600", fontSize: 13 },
  accentText: { color: colors.accent },
});
