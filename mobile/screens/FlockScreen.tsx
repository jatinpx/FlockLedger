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
  Alert,
} from "react-native";
import { useFarm } from "../lib/farm-context";
import {
  apiFetch,
  type FlockEventRow,
  type FlockSummary,
  type Paginated,
  type Shed,
} from "../lib/api";
import { withPagination } from "../lib/pagination";
import { PaginatedControls } from "../components/PaginatedControls";

const DEFAULT_LIMIT = 50;

const EVENT_KINDS = [
  { value: "mortality", label: "Mortality" },
  { value: "cull", label: "Cull" },
  { value: "live_sale", label: "Live sale" },
  { value: "transfer_out", label: "Transfer out" },
  { value: "purchase", label: "Purchase" },
  { value: "transfer_in", label: "Transfer in" },
  { value: "count_adjust", label: "Count ±" },
] as const;

function kindLabel(k: string): string {
  return EVENT_KINDS.find((x) => x.value === k)?.label ?? k;
}

export function FlockScreen() {
  const { farms, farmId } = useFarm();
  const current = farms.find((f) => f.id === farmId);
  const canManage = current?.my_role === "owner" || current?.my_role === "manager";
  const canPost =
    current?.my_role === "owner" ||
    current?.my_role === "manager" ||
    current?.my_role === "worker";

  const [summary, setSummary] = useState<FlockSummary | null>(null);
  const [sheds, setSheds] = useState<Shed[]>([]);
  const [events, setEvents] = useState<FlockEventRow[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [shedId, setShedId] = useState<number | null>(null);
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [eventKind, setEventKind] =
    useState<(typeof EVENT_KINDS)[number]["value"]>("mortality");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");

  const shedNameById = useMemo(() => {
    const m = new Map<number, string>();
    for (const s of sheds) m.set(s.id, s.name);
    return m;
  }, [sheds]);

  const refreshSummary = useCallback(async () => {
    if (!farmId) return;
    try {
      const [sum, shedRes] = await Promise.all([
        apiFetch<FlockSummary>(`/farms/${farmId}/flock/summary`),
        apiFetch<Paginated<Shed>>(withPagination(`/farms/${farmId}/sheds`, 200, 0)),
      ]);
      setSummary(sum);
      setSheds(shedRes.items);
    } catch {
      setSummary(null);
      setSheds([]);
    }
  }, [farmId]);

  const refreshEvents = useCallback(async () => {
    if (!farmId) return;
    try {
      const res = await apiFetch<Paginated<FlockEventRow>>(
        withPagination(`/farms/${farmId}/flock/events`, limit, offset)
      );
      setEvents(res.items);
      setTotal(res.total);
    } catch {
      setEvents([]);
      setTotal(0);
    }
  }, [farmId, limit, offset]);

  async function pullRefresh() {
    setLoading(true);
    try {
      await refreshSummary();
      await refreshEvents();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setOffset(0);
  }, [limit, farmId]);

  useEffect(() => {
    if (!farmId) return;
    setLoading(true);
    refreshSummary().finally(() => setLoading(false));
  }, [farmId, refreshSummary]);

  useEffect(() => {
    if (!farmId) return;
    refreshEvents();
  }, [farmId, limit, offset, refreshEvents]);

  useEffect(() => {
    if (shedId == null && sheds.length > 0) {
      setShedId(sheds[0].id);
    }
  }, [sheds, shedId]);

  async function submitEvent() {
    if (!farmId || !canPost || shedId == null) return;
    const qRaw = quantity.trim();
    const q = parseInt(qRaw, 10);
    if (Number.isNaN(q) || (eventKind !== "count_adjust" && q <= 0)) return;
    if (eventKind === "count_adjust" && q === 0) return;
    setSaving(true);
    try {
      await apiFetch(`/farms/${farmId}/flock/events`, {
        method: "POST",
        body: JSON.stringify({
          shed_id: shedId,
          event_date: eventDate,
          event_kind: eventKind,
          quantity: q,
          note: note.trim() || null,
        }),
      });
      setQuantity("");
      setNote("");
      await refreshSummary();
      await refreshEvents();
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(id: number) {
    if (!canManage) return;
    Alert.alert(
      "Delete event?",
      "Shed counts will be reversed. This fails if a count would go negative.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => void deleteEvent(id),
        },
      ]
    );
  }

  async function deleteEvent(id: number) {
    if (!farmId) return;
    setSaving(true);
    try {
      await apiFetch(`/farms/${farmId}/flock/events/${id}`, { method: "DELETE" });
      await refreshSummary();
      await refreshEvents();
    } finally {
      setSaving(false);
    }
  }

  if (!farmId) {
    return <Text style={styles.muted}>Select or create a farm in Settings.</Text>;
  }

  const removalsTotal = summary
    ? (summary.by_kind.mortality ?? 0) +
      (summary.by_kind.cull ?? 0) +
      (summary.by_kind.live_sale ?? 0) +
      (summary.by_kind.transfer_out ?? 0)
    : 0;
  const additionsTotal = summary
    ? (summary.by_kind.purchase ?? 0) + (summary.by_kind.transfer_in ?? 0)
    : 0;

  return (
    <ScrollView
      style={styles.wrap}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={pullRefresh} />}
    >
      <View style={styles.headerCard}>
        <Text style={styles.screenTitle}>Flock</Text>
        <Text style={styles.screenSub}>Bird counts, movement and event tracking</Text>
      </View>

      {summary ? (
        <View style={styles.grid}>
          <View style={styles.tile}>
            <Text style={styles.tileLabel}>Live head count</Text>
            <Text style={styles.tileValEm}>{summary.birds_alive_total.toLocaleString()}</Text>
          </View>
          <View style={styles.tile}>
            <Text style={styles.tileLabel}>Mortality</Text>
            <Text style={styles.tileVal}>{(summary.by_kind.mortality ?? 0).toLocaleString()}</Text>
          </View>
          <View style={styles.tile}>
            <Text style={styles.tileLabel}>Removals</Text>
            <Text style={styles.tileVal}>{removalsTotal.toLocaleString()}</Text>
          </View>
          <View style={styles.tile}>
            <Text style={styles.tileLabel}>Additions</Text>
            <Text style={styles.tileValEm}>{additionsTotal.toLocaleString()}</Text>
          </View>
        </View>
      ) : loading ? (
        <ActivityIndicator color="#047857" style={{ marginVertical: 24 }} />
      ) : null}

      {summary && Object.keys(summary.by_kind).length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.h2}>By event type</Text>
          <View style={styles.chipWrap}>
            {Object.entries(summary.by_kind).map(([k, v]) => (
              <View key={k} style={styles.statChip}>
                <Text style={styles.statChipText}>
                  {kindLabel(k)}: {v.toLocaleString()}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {summary?.by_shed?.length ? (
        <View style={styles.card}>
          <Text style={styles.h2}>By shed</Text>
          {summary.by_shed.map((row) => (
            <View key={row.shed_id} style={styles.shedRow}>
              <Text style={styles.shedName}>{row.name}</Text>
              <Text style={styles.shedCount}>{row.bird_count.toLocaleString()}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {canPost ? (
        <View style={styles.card}>
          <Text style={styles.h2}>Log event</Text>
          <Text style={styles.hint}>Removals: positive count. Count adjust: use + or −.</Text>
          <Text style={styles.label}>Shed</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
            {sheds.map((s) => (
              <Pressable
                key={s.id}
                style={[styles.chip, shedId === s.id && styles.chipOn]}
                onPress={() => setShedId(s.id)}
              >
                <Text style={[styles.chipText, shedId === s.id && styles.chipTextOn]}>
                  {s.name} ({s.bird_count})
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          {sheds.length === 0 ? (
            <Text style={styles.warn}>Add sheds in Settings first.</Text>
          ) : null}
          <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
          <TextInput style={styles.input} value={eventDate} onChangeText={setEventDate} />
          <Text style={styles.label}>Event</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
            {EVENT_KINDS.map((k) => (
              <Pressable
                key={k.value}
                style={[styles.chip, eventKind === k.value && styles.chipOn]}
                onPress={() => setEventKind(k.value)}
              >
                <Text style={[styles.chipText, eventKind === k.value && styles.chipTextOn]}>
                  {k.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={styles.label}>Quantity (birds)</Text>
          <TextInput
            style={styles.input}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType={eventKind === "count_adjust" ? "default" : "number-pad"}
          />
          <Text style={styles.label}>Note</Text>
          <TextInput style={styles.input} value={note} onChangeText={setNote} />
          <Pressable
            style={[styles.btn, (saving || sheds.length === 0) && styles.btnDis]}
            onPress={submitEvent}
            disabled={saving || sheds.length === 0}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save</Text>}
          </Pressable>
        </View>
      ) : (
        <Text style={styles.muted}>You cannot log flock events.</Text>
      )}

      <Text style={styles.h2}>Recent events</Text>
      {events.map((ev) => (
        <View key={ev.id} style={styles.rowCompact}>
          <View style={styles.rowTop}>
            <View style={styles.recordHeadLeft}>
              <Text style={styles.recordTitle} numberOfLines={1}>{kindLabel(ev.event_kind)}</Text>
              <Text style={styles.recordDate}>{ev.event_date}</Text>
            </View>
            {canManage ? (
              <Pressable style={styles.deletePill} onPress={() => confirmDelete(ev.id)}>
                <Text style={styles.danger}>Delete</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.recordStatsCompact}>
            <Text style={styles.statInline}>{shedNameById.get(ev.shed_id) ?? `#${ev.shed_id}`}</Text>
            <Text style={styles.statInline}>Q {ev.quantity}</Text>
            <Text style={[styles.statInline, ev.birds_delta > 0 ? styles.accentText : styles.warnText]}>
              Δ {ev.birds_delta > 0 ? "+" : ""}{ev.birds_delta}
            </Text>
            {ev.note ? <Text style={styles.statInline} numberOfLines={1}>Note {ev.note}</Text> : null}
          </View>
        </View>
      ))}
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
  muted: { fontSize: 14, color: "#71717a", marginBottom: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  tile: {
    width: "47%",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    padding: 14,
  },
  tileLabel: { fontSize: 10, fontWeight: "700", color: "#71717a", textTransform: "uppercase" },
  tileVal: { fontSize: 22, fontWeight: "700", color: "#18181b", marginTop: 6 },
  tileValEm: { fontSize: 22, fontWeight: "700", color: "#047857", marginTop: 6 },
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
  label: { fontSize: 12, color: "#52525b", fontWeight: "600", marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
  },
  chipsScroll: { marginTop: 8, flexGrow: 0 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    marginRight: 8,
    backgroundColor: "#fafafa",
  },
  chipOn: { backgroundColor: "#047857", borderColor: "#047857" },
  chipText: { fontSize: 13, fontWeight: "600", color: "#3f3f46" },
  chipTextOn: { color: "#fff" },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statChip: {
    backgroundColor: "#f4f4f5",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statChipText: { fontSize: 13, color: "#3f3f46" },
  shedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#f4f4f5",
    paddingVertical: 10,
  },
  shedName: { fontSize: 14, color: "#18181b", fontWeight: "600" },
  shedCount: { fontSize: 14, color: "#047857", fontWeight: "700" },
  warn: { color: "#b45309", fontSize: 13, marginTop: 8 },
  btn: {
    marginTop: 16,
    backgroundColor: "#047857",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
  },
  btnDis: { opacity: 0.6 },
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
    gap: 8,
  },
  recordHeadLeft: { flex: 1, paddingRight: 8 },
  recordTitle: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  recordDate: { fontSize: 11, color: "#6b7280", fontWeight: "600", marginTop: 1 },
  recordStatsCompact: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
  },
  statInline: { fontSize: 12, fontWeight: "700", color: "#111827" },
  deletePill: {
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#fff",
  },
  danger: { color: "#b91c1c", fontWeight: "700", fontSize: 13 },
  accentText: { color: "#047857" },
  warnText: { color: "#b45309" },
});
