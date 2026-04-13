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
import { apiFetch, type EggProduction, type Paginated, type Shed } from "../lib/api";
import { useAppTheme, type AppColors } from "../lib/theme";
import { withPagination } from "../lib/pagination";
import { PaginatedControls } from "../components/PaginatedControls";

const DEFAULT_LIMIT = 50;

export function ProductionScreen() {
  const { farmId } = useFarm();
  const isFocused = useIsFocused();
  const colors = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
    if (!isFocused) return;
    refresh();
  }, [isFocused, refresh]);

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

  const totalEggsOnPage = rows.reduce((sum, row) => sum + row.eggs_produced, 0);
  const totalBrokenOnPage = rows.reduce((sum, row) => sum + row.broken_eggs, 0);
  const totalUsableOnPage = rows.reduce((sum, row) => sum + row.usable_eggs, 0);
  const canSubmit = !!shedId && Number.isFinite(parseInt(eggs, 10));

  if (!farmId) {
    return (
      <Text style={styles.muted}>Select or create a farm in Settings.</Text>
    );
  }

  return (
    <ScrollView
      style={styles.wrap}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
      contentContainerStyle={styles.content}
    >
      <View style={styles.headerCard}>
        <Text style={styles.screenTitle}>Production</Text>
        <Text style={styles.screenSub}>Track daily eggs by shed and edit records quickly</Text>
      </View>

      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Records on page</Text>
          <Text style={styles.kpiValue}>{rows.length}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Produced</Text>
          <Text style={styles.kpiValue}>{totalEggsOnPage.toLocaleString()}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Usable</Text>
          <Text style={styles.kpiValueAccent}>{totalUsableOnPage.toLocaleString()}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Broken</Text>
          <Text style={styles.kpiValueWarn}>{totalBrokenOnPage.toLocaleString()}</Text>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Add Egg Production</Text>
        <Text style={styles.sectionSub}>Select shed, date, and quantities</Text>

        <Text style={styles.label}>Shed</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
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
        {sheds.length === 0 ? <Text style={styles.helpWarn}>Add a shed in Settings first.</Text> : null}

        <Text style={styles.label}>Date</Text>
        <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />

        <View style={styles.inputGrid}>
          <View style={styles.inputCol}>
            <Text style={styles.label}>Eggs produced</Text>
            <TextInput style={styles.input} value={eggs} onChangeText={setEggs} keyboardType="number-pad" />
          </View>
          <View style={styles.inputCol}>
            <Text style={styles.label}>Broken eggs</Text>
            <TextInput style={styles.input} value={broken} onChangeText={setBroken} keyboardType="number-pad" />
          </View>
        </View>

        <Pressable
          style={[styles.primaryBtn, (saving || !canSubmit || sheds.length === 0) && styles.btnDis]}
          onPress={submit}
          disabled={saving || !canSubmit || sheds.length === 0}
        >
          {saving ? <ActivityIndicator color={colors.inverseText} /> : <Text style={styles.primaryBtnText}>Save production</Text>}
        </Pressable>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Records</Text>
        <Text style={styles.sectionSub}>Tap Edit to modify any record</Text>
      </View>

      {loading && !rows.length ? (
        <ActivityIndicator style={{ marginVertical: 16 }} color={colors.accent} />
      ) : null}

      {rows.map((r) =>
        editingId === r.id ? (
          <View key={r.id} style={styles.editCard}>
            <Text style={styles.editTitle}>Editing #{r.id}</Text>

            <Text style={styles.label}>Date</Text>
            <TextInput style={styles.input} value={editDate} onChangeText={setEditDate} />

            <Text style={styles.label}>Shed</Text>
            <ScrollView horizontal style={styles.chipsRow} showsHorizontalScrollIndicator={false}>
              {sheds.map((s) => (
                <Pressable
                  key={s.id}
                  style={[styles.chip, editShedId === String(s.id) && styles.chipOn]}
                  onPress={() => setEditShedId(String(s.id))}
                >
                  <Text
                    style={[
                      styles.chipText,
                      editShedId === String(s.id) && styles.chipTextOn,
                    ]}
                  >
                    {s.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.inputGrid}>
              <View style={styles.inputCol}>
                <Text style={styles.label}>Eggs produced</Text>
                <TextInput style={styles.input} value={editEggs} onChangeText={setEditEggs} keyboardType="number-pad" />
              </View>
              <View style={styles.inputCol}>
                <Text style={styles.label}>Broken eggs</Text>
                <TextInput style={styles.input} value={editBroken} onChangeText={setEditBroken} keyboardType="number-pad" />
              </View>
            </View>

            <View style={styles.actionRow}>
              <Pressable style={[styles.primaryBtnSmall, saving && styles.btnDis]} onPress={saveEdit} disabled={saving}>
                <Text style={styles.primaryBtnText}>Save</Text>
              </Pressable>
              <Pressable style={styles.ghostBtn} onPress={() => setEditingId(null)}>
                <Text style={styles.ghostBtnText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View key={r.id} style={styles.recordRowCard}>
            <View style={styles.recordRowTop}>
              <View style={styles.recordRowHeadLeft}>
                <Text style={styles.recordTitle} numberOfLines={1}>
                  {sheds.find((s) => s.id === r.shed_id)?.name ?? `Shed ${r.shed_id}`}
                </Text>
                <Text style={styles.recordDate}>{r.date}</Text>
              </View>
              <Pressable style={styles.inlineActionCompact} onPress={() => startEdit(r)}>
                <Text style={styles.inlineActionText}>Edit</Text>
              </Pressable>
            </View>

            <View style={styles.recordStatsCompact}>
              <Text style={styles.statInline}>P {r.eggs_produced}</Text>
              <Text style={[styles.statInline, styles.accentText]}>U {r.usable_eggs}</Text>
              <Text style={[styles.statInline, styles.warnText]}>B {r.broken_eggs}</Text>
              <Text style={styles.statInline}>T {r.trays}</Text>
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
  wrap: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 28 },
  muted: { padding: 16, color: colors.textMuted, fontSize: 14 },

  headerCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  screenTitle: { fontSize: 24, fontWeight: "800", color: colors.text },
  screenSub: { fontSize: 13, color: colors.textMuted, marginTop: 4 },

  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  kpiCard: {
    width: "48%",
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  kpiLabel: { fontSize: 11, color: colors.textMuted, textTransform: "uppercase", fontWeight: "700" },
  kpiValue: { fontSize: 24, fontWeight: "800", color: colors.text, marginTop: 6 },
  kpiValueAccent: { fontSize: 24, fontWeight: "800", color: colors.accent, marginTop: 6 },
  kpiValueWarn: { fontSize: 24, fontWeight: "800", color: colors.warning, marginTop: 6 },

  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  sectionHeader: { marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  sectionSub: { fontSize: 12, color: colors.textMuted, marginTop: 3 },

  label: { fontSize: 12, color: colors.textSoft, fontWeight: "600", marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.inputBg,
    color: colors.inputText,
  },
  inputGrid: { flexDirection: "row", gap: 10, marginTop: 6 },
  inputCol: { flex: 1, gap: 4 },

  chipsRow: { marginBottom: 10 },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    marginRight: 8,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 12, fontWeight: "700", color: colors.textSoft },
  chipTextOn: { color: colors.inverseText },

  primaryBtn: {
    marginTop: 16,
    backgroundColor: colors.accent,
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
  },
  primaryBtnSmall: {
    flex: 1,
    backgroundColor: colors.accent,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  btnDis: { opacity: 0.7 },
  primaryBtnText: { color: colors.inverseText, fontWeight: "700" },
  ghostBtn: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  ghostBtnText: { color: colors.textSoft, fontWeight: "600" },

  recordRowCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  recordRowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  recordRowHeadLeft: { flex: 1, paddingRight: 8 },
  recordTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  recordDate: { fontSize: 11, color: colors.textMuted, fontWeight: "600", marginTop: 1 },

  recordStatsCompact: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
  },
  statInline: { fontSize: 12, fontWeight: "700", color: colors.inputText },

  inlineActionCompact: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  inlineActionText: { color: colors.accent, fontWeight: "700", fontSize: 13 },

  editCard: {
    backgroundColor: colors.warningSoft,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    padding: 12,
    marginBottom: 10,
    gap: 8,
  },
  editTitle: { fontSize: 14, fontWeight: "700", color: colors.warningStrong },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 4 },

  helpWarn: { marginTop: -2, marginBottom: 6, fontSize: 12, color: colors.warning },
  accentText: { color: colors.accent },
  warnText: { color: colors.warning },
});
