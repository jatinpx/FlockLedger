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
import { apiFetch, type EggProduction, type Paginated, type Shed } from "../lib/api";
import { withPagination } from "../lib/pagination";
import { PaginatedControls } from "../components/PaginatedControls";

const DEFAULT_LIMIT = 25;

export function ProductionScreen() {
  const { farmId } = useFarm();
  const [sheds, setSheds] = useState<Shed[]>([]);
  const [rows, setRows] = useState<EggProduction[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [offset, setOffset] = useState(0);
  const [shedId, setShedId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [eggs, setEggs] = useState("");
  const [broken, setBroken] = useState("0");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editShedId, setEditShedId] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editEggs, setEditEggs] = useState("");
  const [editBroken, setEditBroken] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!farmId) return;
    setLoading(true);
    try {
      const [shedRes, eggRes] = await Promise.all([
        apiFetch<Paginated<Shed>>(withPagination(`/farms/${farmId}/sheds`, 200, 0)),
        apiFetch<Paginated<EggProduction>>(
          withPagination(`/farms/${farmId}/production/eggs`, limit, offset)
        ),
      ]);
      setSheds(shedRes.items);
      setRows(eggRes.items);
      setTotal(eggRes.total);
      setShedId((prev) => prev || (shedRes.items.length ? String(shedRes.items[0].id) : ""));
    } catch {
      setSheds([]);
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
      await apiFetch(`/farms/${farmId}/production/eggs`, {
        method: "POST",
        body: JSON.stringify({
          shed_id: parseInt(shedId, 10),
          date,
          eggs_produced: parseInt(eggs, 10),
          broken_eggs: parseInt(broken, 10) || 0,
        }),
      });
      setEggs("");
      setBroken("0");
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  function startEdit(r: EggProduction) {
    setEditingId(r.id);
    setEditShedId(String(r.shed_id));
    setEditDate(r.date);
    setEditEggs(String(r.eggs_produced));
    setEditBroken(String(r.broken_eggs));
  }

  async function saveEdit() {
    if (!farmId || editingId == null) return;
    setSaving(true);
    try {
      await apiFetch(`/farms/${farmId}/production/eggs/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify({
          shed_id: parseInt(editShedId, 10),
          date: editDate,
          eggs_produced: parseInt(editEggs, 10),
          broken_eggs: parseInt(editBroken, 10) || 0,
        }),
      });
      setEditingId(null);
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!farmId) {
    return (
      <Text style={styles.muted}>Select or create a farm in Settings.</Text>
    );
  }

  return (
    <ScrollView
      style={styles.wrap}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
    >
      <View style={styles.card}>
        <Text style={styles.h2}>Add egg production</Text>
        <Text style={styles.label}>Shed</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
          {sheds.map((s) => (
            <Pressable
              key={s.id}
              style={[styles.chip, shedId === String(s.id) && styles.chipOn]}
              onPress={() => setShedId(String(s.id))}
            >
              <Text style={[styles.chipText, shedId === String(s.id) && styles.chipTextOn]}>
                {s.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <Text style={styles.label}>Date</Text>
        <TextInput style={styles.input} value={date} onChangeText={setDate} />
        <Text style={styles.label}>Eggs produced</Text>
        <TextInput style={styles.input} value={eggs} onChangeText={setEggs} keyboardType="number-pad" />
        <Text style={styles.label}>Broken eggs</Text>
        <TextInput style={styles.input} value={broken} onChangeText={setBroken} keyboardType="number-pad" />
        <Pressable style={[styles.btn, saving && styles.btnDis]} onPress={submit} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save</Text>}
        </Pressable>
      </View>

      <Text style={styles.h2}>Recent records</Text>
      {loading && !rows.length ? (
        <ActivityIndicator style={{ marginVertical: 16 }} color="#047857" />
      ) : null}
      {rows.map((r) =>
        editingId === r.id ? (
          <View key={r.id} style={[styles.row, styles.rowEdit]}>
            <TextInput style={styles.inputSm} value={editDate} onChangeText={setEditDate} />
            <ScrollView horizontal style={styles.chips}>
              {sheds.map((s) => (
                <Pressable
                  key={s.id}
                  style={[styles.chipSm, editShedId === String(s.id) && styles.chipOn]}
                  onPress={() => setEditShedId(String(s.id))}
                >
                  <Text
                    style={[
                      styles.chipTextSm,
                      editShedId === String(s.id) && styles.chipTextOn,
                    ]}
                  >
                    {s.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <TextInput style={styles.inputSm} value={editEggs} onChangeText={setEditEggs} keyboardType="number-pad" />
            <TextInput style={styles.inputSm} value={editBroken} onChangeText={setEditBroken} keyboardType="number-pad" />
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
              {r.date} · {sheds.find((s) => s.id === r.shed_id)?.name ?? r.shed_id}
            </Text>
            <Text style={styles.rowSub}>
              {r.eggs_produced} prod · {r.broken_eggs} broken · {r.usable_eggs} usable · {r.trays} trays
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
  chips: { marginTop: 6, marginBottom: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    marginRight: 8,
    backgroundColor: "#fff",
  },
  chipSm: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    marginRight: 6,
  },
  chipOn: { backgroundColor: "#047857", borderColor: "#047857" },
  chipText: { fontSize: 13, fontWeight: "600", color: "#3f3f46" },
  chipTextSm: { fontSize: 12, color: "#3f3f46" },
  chipTextOn: { color: "#fff" },
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
