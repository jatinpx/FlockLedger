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
  Modal,
  Alert,
} from "react-native";
import { useFarm } from "../lib/farm-context";
import {
  apiFetch,
  fetchExpenseCategories,
  LABOUR_WAGES_CATEGORY,
  MISCELLANEOUS_EXPENSE_CATEGORY,
  type ExpenseRow,
  type FarmLabourRow,
  type Paginated,
} from "../lib/api";
import { pageQuery, withPagination } from "../lib/pagination";
import { PaginatedControls } from "../components/PaginatedControls";

const DEFAULT_LIMIT = 25;

function expenseIsLinked(r: ExpenseRow): boolean {
  return r.labour_ledger_line_id != null || r.feed_inventory_id != null;
}

const fmtInr = (n: number) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "INR" }).format(n);

function categoryOptionsWithLegacy(predefined: string[], current: string): string[] {
  if (current && !predefined.includes(current)) {
    return [current, ...predefined];
  }
  return predefined;
}

export function ExpensesScreen() {
  const { farmId, farms } = useFarm();
  const current = farms.find((f) => f.id === farmId);
  const canManage = current?.my_role === "owner" || current?.my_role === "manager";

  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [offset, setOffset] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState("Feed & fodder");
  const [catPicker, setCatPicker] = useState<null | "add" | "edit">(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [activeLabour, setActiveLabour] = useState<FarmLabourRow[]>([]);
  const [wageLabourId, setWageLabourId] = useState<number | null>(null);
  const [labourPicker, setLabourPicker] = useState(false);
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

  useEffect(() => {
    fetchExpenseCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (!categories.length) return;
    setCategory((prev) => (categories.includes(prev) ? prev : categories[0]));
  }, [categories]);

  useEffect(() => {
    if (category !== LABOUR_WAGES_CATEGORY) setWageLabourId(null);
  }, [category]);

  useEffect(() => {
    if (!farmId) {
      setActiveLabour([]);
      return;
    }
    let cancelled = false;
    apiFetch<Paginated<FarmLabourRow>>(
      `/farms/${farmId}/labour?${pageQuery(500, 0)}&active_only=true`
    )
      .then((res) => {
        if (!cancelled) setActiveLabour(res.items.filter((r) => r.is_active));
      })
      .catch(() => {
        if (!cancelled) setActiveLabour([]);
      });
    return () => {
      cancelled = true;
    };
  }, [farmId]);

  const miscNeedsDescription = category === MISCELLANEOUS_EXPENSE_CATEGORY;
  const editMiscNeedsDescription = editCategory === MISCELLANEOUS_EXPENSE_CATEGORY;

  async function submit() {
    if (!farmId) return;
    const descTrim = description.trim();
    if (miscNeedsDescription && !descTrim) {
      Alert.alert(
        "Description required",
        "Please describe this Miscellaneous expense before saving."
      );
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        category,
        amount: parseFloat(amount),
        description: descTrim ? descTrim : null,
        date,
      };
      if (category === LABOUR_WAGES_CATEGORY && wageLabourId != null) {
        body.labour_id = wageLabourId;
      }
      await apiFetch(`/farms/${farmId}/expenses`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setAmount("");
      setDescription("");
      setWageLabourId(null);
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  function startEdit(r: ExpenseRow) {
    if (expenseIsLinked(r)) {
      Alert.alert(
        "Linked expense",
        "This entry is tied to labour or feed. Change it from Labour/Feed or remove the ledger line."
      );
      return;
    }
    setEditingId(r.id);
    setEditCategory(r.category);
    setEditAmount(String(r.amount));
    setEditDescription(r.description ?? "");
    setEditDate(r.date);
  }

  async function saveEdit() {
    if (!farmId || editingId == null) return;
    const editDescTrim = editDescription.trim();
    if (editMiscNeedsDescription && !editDescTrim) {
      Alert.alert(
        "Description required",
        "Please describe this Miscellaneous expense before saving."
      );
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/farms/${farmId}/expenses/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify({
          category: editCategory,
          amount: parseFloat(editAmount),
          description: editDescTrim ? editDescTrim : null,
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

  const pickerList =
    catPicker === "edit"
      ? categoryOptionsWithLegacy(categories, editCategory)
      : categories;

  const wagePayLabel =
    wageLabourId == null
      ? "Not linked (e.g. contractor)"
      : activeLabour.find((x) => x.id === wageLabourId)?.full_name ?? `Worker #${wageLabourId}`;

  return (
    <ScrollView
      style={styles.wrap}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
    >
      <Modal
        visible={catPicker !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setCatPicker(null)}
      >
        <View style={styles.modalRoot}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Choose category</Text>
            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
              {pickerList.map((c) => (
                <Pressable
                  key={c}
                  style={styles.modalRow}
                  onPress={() => {
                    if (catPicker === "add") setCategory(c);
                    if (catPicker === "edit") setEditCategory(c);
                    setCatPicker(null);
                  }}
                >
                  <Text style={styles.modalRowText}>{c}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.modalCancel} onPress={() => setCatPicker(null)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={labourPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setLabourPicker(false)}
      >
        <View style={styles.modalRoot}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Pay to (active workers)</Text>
            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <Pressable
                style={styles.modalRow}
                onPress={() => {
                  setWageLabourId(null);
                  setLabourPicker(false);
                }}
              >
                <Text style={styles.modalRowText}>— Not linked —</Text>
              </Pressable>
              {activeLabour.map((L) => (
                <Pressable
                  key={L.id}
                  style={styles.modalRow}
                  onPress={() => {
                    setWageLabourId(L.id);
                    setLabourPicker(false);
                  }}
                >
                  <Text style={styles.modalRowText}>
                    {L.full_name}
                    {L.personnel_kind === "owner_pay" ? " (owner pay)" : ""}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.modalCancel} onPress={() => setLabourPicker(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {canManage ? (
        <View style={styles.card}>
          <Text style={styles.h2}>Add expense</Text>
          <Text style={styles.hint}>
            Labour payments can sync from the Labour screen; feed bills can use purchase cost on Feed.
            Linked rows cannot be edited here.
          </Text>
          <Text style={styles.label}>Category</Text>
          <Pressable
            style={[styles.input, styles.selectLike]}
            onPress={() => categories.length && setCatPicker("add")}
          >
            <Text style={styles.selectLikeText}>
              {!categories.length ? "Loading categories…" : category}
            </Text>
          </Pressable>
          <Text style={styles.label}>Amount (₹)</Text>
          <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
          <Text style={styles.label}>
            Description
            {miscNeedsDescription ? <Text style={styles.reqMark}> (required)</Text> : null}
          </Text>
          <TextInput
            style={styles.input}
            value={description}
            onChangeText={setDescription}
            placeholder={
              miscNeedsDescription ? "What was this expense for?" : "Optional note"
            }
          />
          <Text style={styles.label}>Date</Text>
          <TextInput style={styles.input} value={date} onChangeText={setDate} />
          {category === LABOUR_WAGES_CATEGORY ? (
            <>
              <Text style={styles.label}>Pay to</Text>
              <Pressable
                style={[styles.input, styles.selectLike]}
                onPress={() => setLabourPicker(true)}
              >
                <Text style={styles.selectLikeText}>{wagePayLabel}</Text>
              </Pressable>
              <Text style={styles.hint}>
                Choosing a worker records a labour payment and links this expense.
              </Text>
            </>
          ) : null}
          <Pressable
            style={[styles.btn, (saving || !categories.length) && styles.btnDis]}
            onPress={submit}
            disabled={saving || !categories.length}
          >
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
            <Text style={styles.label}>Category</Text>
            <Pressable
              style={[styles.inputSm, styles.selectLike]}
              onPress={() => setCatPicker("edit")}
            >
              <Text style={styles.selectLikeText}>{editCategory}</Text>
            </Pressable>
            <Text style={styles.label}>Amount (₹)</Text>
            <TextInput style={styles.inputSm} value={editAmount} onChangeText={setEditAmount} keyboardType="decimal-pad" />
            <Text style={styles.label}>
              Description
              {editMiscNeedsDescription ? <Text style={styles.reqMark}> (required)</Text> : null}
            </Text>
            <TextInput
              style={styles.inputSm}
              value={editDescription}
              onChangeText={setEditDescription}
              placeholder={
                editMiscNeedsDescription ? "Required for Miscellaneous" : "Note"
              }
            />
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
            {r.linked_labour_name ? (
              <Text style={styles.linkTag}>Worker: {r.linked_labour_name}</Text>
            ) : r.labour_ledger_line_id != null ? (
              <Text style={styles.linkTag}>Linked: labour payment</Text>
            ) : r.feed_inventory_id != null ? (
              <Text style={styles.linkTag}>Linked: feed entry</Text>
            ) : null}
            {canManage ? (
              <Pressable onPress={() => startEdit(r)} disabled={expenseIsLinked(r)}>
                <Text style={[styles.link, expenseIsLinked(r) && styles.linkDis]}>Edit</Text>
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
  hint: { fontSize: 12, color: "#71717a", marginBottom: 12 },
  selectLike: { justifyContent: "center" },
  selectLikeText: { fontSize: 15, color: "#18181b" },
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
  linkDis: { color: "#a1a1aa" },
  linkTag: { marginTop: 6, fontSize: 11, color: "#6366f1", fontWeight: "600" },
  linkMuted: { color: "#71717a", fontWeight: "600", fontSize: 13 },
  reqMark: { color: "#dc2626", fontWeight: "700" },
  modalRoot: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    maxHeight: "78%",
    paddingBottom: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#18181b",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  modalScroll: { maxHeight: 360 },
  modalRow: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e4e4e7",
  },
  modalRowText: { fontSize: 15, color: "#18181b" },
  modalCancel: {
    marginTop: 4,
    paddingVertical: 14,
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e4e4e7",
  },
  modalCancelText: { fontSize: 15, fontWeight: "600", color: "#52525b" },
});
