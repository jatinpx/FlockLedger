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
  Switch,
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useFarm } from "../lib/farm-context";
import { apiFetch, type FeedRow, type Paginated } from "../lib/api";
import { withPagination } from "../lib/pagination";
import { PaginatedControls } from "../components/PaginatedControls";

const DEFAULT_LIMIT = 50;

const fmtInr = (n: number) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "INR" }).format(n);

export function FeedScreen() {
  const { farmId } = useFarm();
  const isFocused = useIsFocused();
  const [rows, setRows] = useState<FeedRow[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [offset, setOffset] = useState(0);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [received, setReceived] = useState("");
  const [used, setUsed] = useState("");
  const [openingPreview, setOpeningPreview] = useState<number | null>(null);
  const [overrideRemaining, setOverrideRemaining] = useState(false);
  const [remainingOverride, setRemainingOverride] = useState("");
  const [purchaseCost, setPurchaseCost] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editReceived, setEditReceived] = useState("");
  const [editUsed, setEditUsed] = useState("");
  const [editRemaining, setEditRemaining] = useState("");
  const [editOverride, setEditOverride] = useState(false);
  const [editPurchaseCost, setEditPurchaseCost] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!farmId) return;
    setLoading(true);
    try {
      const res = await apiFetch<Paginated<FeedRow>>(
        withPagination(`/farms/${farmId}/feed`, limit, offset)
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

  useEffect(() => {
    if (!farmId) {
      setOpeningPreview(null);
      return;
    }
    let cancelled = false;
    apiFetch<{ opening_balance_kg: number }>(
      `/farms/${farmId}/feed/preview-opening?date=${encodeURIComponent(date)}`
    )
      .then((r) => {
        if (!cancelled) setOpeningPreview(r.opening_balance_kg);
      })
      .catch(() => {
        if (!cancelled) setOpeningPreview(null);
      });
    return () => {
      cancelled = true;
    };
  }, [farmId, date]);

  const recvN = parseFloat(received) || 0;
  const usedN = parseFloat(used) || 0;
  const computedRemaining =
    openingPreview != null ? openingPreview + recvN - usedN : null;

  async function submit() {
    if (!farmId) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        date,
        feed_received: recvN,
        feed_used: usedN,
      };
      if (overrideRemaining) {
        body.feed_remaining = parseFloat(remainingOverride);
      }
      const pc = parseFloat(purchaseCost);
      if (purchaseCost.trim() !== "" && Number.isFinite(pc)) {
        body.purchase_cost_inr = pc;
      }
      await apiFetch(`/farms/${farmId}/feed`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setReceived("");
      setUsed("");
      setOverrideRemaining(false);
      setRemainingOverride("");
      setPurchaseCost("");
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  function startEdit(r: FeedRow) {
    setEditingId(r.id);
    setEditDate(r.date);
    setEditReceived(String(r.feed_received));
    setEditUsed(String(r.feed_used));
    setEditRemaining(String(r.feed_remaining));
    setEditOverride(r.remaining_auto === false);
    setEditPurchaseCost(
      r.purchase_cost_inr != null && r.purchase_cost_inr !== undefined
        ? String(r.purchase_cost_inr)
        : ""
    );
  }

  async function saveEdit() {
    if (!farmId || editingId == null) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        date: editDate,
        feed_received: parseFloat(editReceived),
        feed_used: parseFloat(editUsed),
      };
      if (editOverride) {
        body.feed_remaining = parseFloat(editRemaining);
      }
      const epc = parseFloat(editPurchaseCost);
      body.purchase_cost_inr =
        editPurchaseCost.trim() === "" ? null : Number.isFinite(epc) ? epc : null;
      await apiFetch(`/farms/${farmId}/feed/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
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
        <Text style={styles.screenTitle}>Feed</Text>
        <Text style={styles.screenSub}>Track stock movement and purchase cost</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.h2}>Add feed entry</Text>
        <Text style={styles.hint}>
          Remaining is opening + received − used unless you override with a physical count. Optional
          purchase cost (₹) counts toward profit and is also added to Expenses.
        </Text>
        <Text style={styles.label}>Date</Text>
        <TextInput style={styles.input} value={date} onChangeText={setDate} />
        {openingPreview != null ? (
          <Text style={styles.openingHint}>Opening stock: {openingPreview.toFixed(2)} kg</Text>
        ) : null}
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
        {!overrideRemaining && computedRemaining != null ? (
          <View style={styles.autoBox}>
            <Text style={styles.autoText}>
              Closing remaining (auto): {computedRemaining.toFixed(2)} kg
            </Text>
          </View>
        ) : null}
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Manual remaining</Text>
          <Switch value={overrideRemaining} onValueChange={setOverrideRemaining} />
        </View>
        {overrideRemaining ? (
          <>
            <Text style={styles.label}>Remaining (kg)</Text>
            <TextInput
              style={styles.input}
              value={remainingOverride}
              onChangeText={setRemainingOverride}
              keyboardType="decimal-pad"
            />
          </>
        ) : null}
        <Text style={styles.label}>Purchase cost (₹, optional)</Text>
        <TextInput
          style={styles.input}
          value={purchaseCost}
          onChangeText={setPurchaseCost}
          keyboardType="decimal-pad"
          placeholder="Feed bill for this receipt"
        />
        <Pressable style={[styles.btn, saving && styles.btnDis]} onPress={submit} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save</Text>}
        </Pressable>
      </View>

      <Text style={styles.h2}>Records</Text>
      {loading && !rows.length ? <ActivityIndicator style={{ marginVertical: 16 }} color="#047857" /> : null}
      {rows.map((r) =>
        editingId === r.id ? (
          <View key={r.id} style={[styles.row, styles.rowEdit]}>
            <Text style={styles.editTitle}>Edit feed entry</Text>
            <Text style={styles.editMeta}>
              Open {(r.opening_balance_kg ?? 0).toFixed(2)} kg
            </Text>
            <Text style={styles.label}>Date</Text>
            <TextInput style={styles.inputSm} value={editDate} onChangeText={setEditDate} />
            <View style={styles.editGrid}>
              <View style={styles.editCol}>
                <Text style={styles.label}>Received (kg)</Text>
                <TextInput
                  style={styles.inputSm}
                  value={editReceived}
                  onChangeText={setEditReceived}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.editCol}>
                <Text style={styles.label}>Used (kg)</Text>
                <TextInput
                  style={styles.inputSm}
                  value={editUsed}
                  onChangeText={setEditUsed}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
            <Text style={styles.label}>Remaining (kg)</Text>
            <TextInput
              style={[styles.inputSm, !editOverride && styles.inputDisabled]}
              value={editRemaining}
              onChangeText={setEditRemaining}
              keyboardType="decimal-pad"
              editable={editOverride}
            />
            <Text style={styles.infoText}>
              {editOverride
                ? "Manual remaining is enabled; this value will be saved."
                : "Remaining is auto-calculated from opening + received - used."}
            </Text>
            <Text style={styles.label}>Cost ₹ (optional)</Text>
            <TextInput
              style={styles.inputSm}
              value={editPurchaseCost}
              onChangeText={setEditPurchaseCost}
              keyboardType="decimal-pad"
              placeholder="Clear field to remove"
            />
            <View style={styles.switchRow}>
              <Text style={styles.switchLabelSm}>Manual remaining</Text>
              <Switch value={editOverride} onValueChange={setEditOverride} />
            </View>
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
                <Text style={styles.recordTitle}>Feed entry</Text>
                <Text style={styles.recordDate}>{r.date}</Text>
              </View>
              <Pressable style={styles.editPill} onPress={() => startEdit(r)}>
                <Text style={styles.link}>Edit</Text>
              </Pressable>
            </View>
            <View style={styles.recordStatsCompact}>
              <Text style={[styles.statInline, styles.statOpen]}>O {(r.opening_balance_kg ?? 0).toFixed(2)}</Text>
              <Text style={[styles.statInline, styles.statIn]}>In {r.feed_received.toFixed(2)}</Text>
              <Text style={[styles.statInline, styles.statUsed]}>U {r.feed_used.toFixed(2)}</Text>
              <Text style={[styles.statInline, styles.statRemain]}>R {r.feed_remaining.toFixed(2)}</Text>
              <Text style={[styles.statInline, styles.warnText]}>{r.remaining_auto !== false ? "Auto" : "Manual"}</Text>
              {r.purchase_cost_inr != null && r.purchase_cost_inr !== undefined ? (
                <Text style={[styles.statInline, styles.accentText]}>Cost {fmtInr(r.purchase_cost_inr)}</Text>
              ) : null}
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

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#f3f4f6", padding: 16 },
  headerCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
    marginBottom: 12,
  },
  screenTitle: { fontSize: 22, fontWeight: "800", color: "#0f172a" },
  screenSub: { fontSize: 13, color: "#6b7280", marginTop: 4 },
  muted: { padding: 16, color: "#71717a" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
    marginBottom: 12,
  },
  h2: { fontSize: 17, fontWeight: "700", color: "#18181b", marginBottom: 8 },
  hint: { fontSize: 12, color: "#71717a", marginBottom: 12 },
  openingHint: { fontSize: 12, color: "#52525b", marginTop: 4, marginBottom: 4 },
  label: { fontSize: 12, color: "#52525b", fontWeight: "600", marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
    backgroundColor: "#fff",
  },
  autoBox: {
    marginTop: 10,
    backgroundColor: "#ecfdf5",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  autoText: { fontSize: 13, color: "#065f46", fontWeight: "600" },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  switchLabel: { fontSize: 14, color: "#3f3f46", fontWeight: "600" },
  switchLabelSm: { fontSize: 13, color: "#52525b" },
  inputSm: {
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
    fontSize: 13,
  },
  inputDisabled: { backgroundColor: "#f9fafb", color: "#9ca3af" },
  editTitle: { fontSize: 14, fontWeight: "800", color: "#0f172a", marginBottom: 4 },
  editMeta: { fontSize: 12, color: "#71717a", marginBottom: 6 },
  editGrid: { flexDirection: "row", gap: 8 },
  editCol: { flex: 1 },
  infoText: { fontSize: 11, color: "#6b7280", marginTop: -2, marginBottom: 4 },
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
    borderColor: "#e5e7eb",
    padding: 12,
    marginBottom: 8,
  },
  rowCompact: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  recordHeadLeft: { flex: 1, paddingRight: 8 },
  rowEdit: { backgroundColor: "#fafafa" },
  recordTitle: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  recordDate: { fontSize: 11, color: "#6b7280", fontWeight: "600", marginTop: 1 },
  recordStatsCompact: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
  },
  statInline: { fontSize: 12, fontWeight: "700", color: "#111827" },
  statOpen: { color: "#2563eb" },
  statIn: { color: "#047857" },
  statUsed: { color: "#b45309" },
  statRemain: { color: "#0f766e" },
  editPill: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#ffffff",
  },
  rowActions: { flexDirection: "row", gap: 16, marginTop: 8 },
  link: { color: "#047857", fontWeight: "700", fontSize: 13 },
  linkMuted: { color: "#71717a", fontWeight: "600", fontSize: 13 },
  accentText: { color: "#047857" },
  warnText: { color: "#b45309" },
});
