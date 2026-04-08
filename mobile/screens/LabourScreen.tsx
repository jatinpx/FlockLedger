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
import { useFarm } from "../lib/farm-context";
import { apiFetch, type FarmLabourRow, type LabourLedgerRow, type Paginated } from "../lib/api";
import { withPagination } from "../lib/pagination";
import { PaginatedControls } from "../components/PaginatedControls";

const DEFAULT_LIMIT = 25;
const LEDGER_DEFAULT = 50;

const fmtInr = (n: number) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "INR" }).format(n);

export function LabourScreen() {
  const { farms, farmId } = useFarm();
  const current = farms.find((f) => f.id === farmId);
  const canManage = current?.my_role === "owner" || current?.my_role === "manager";
  const isWorker = current?.my_role === "worker";

  const [rows, setRows] = useState<FarmLabourRow[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [ledgerRows, setLedgerRows] = useState<LabourLedgerRow[]>([]);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [ledgerLimit, setLedgerLimit] = useState(LEDGER_DEFAULT);
  const [ledgerOffset, setLedgerOffset] = useState(0);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [personnelKind, setPersonnelKind] = useState<"labour" | "owner_pay">("labour");
  const [compensationType, setCompensationType] = useState<
    "daily" | "monthly" | "hourly" | "adhoc"
  >("monthly");
  const [defaultRate, setDefaultRate] = useState("");
  const [notes, setNotes] = useState("");
  const [hiredAt, setHiredAt] = useState(() => new Date().toISOString().slice(0, 10));

  const [lineType, setLineType] = useState<"earning" | "payment" | "adjustment">("earning");
  const [lineAmount, setLineAmount] = useState("");
  const [lineDate, setLineDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [lineDesc, setLineDesc] = useState("");
  const [forceInactive, setForceInactive] = useState(false);

  const refresh = useCallback(async () => {
    if (!farmId) return;
    setLoading(true);
    try {
      const res = await apiFetch<Paginated<FarmLabourRow>>(
        withPagination(`/farms/${farmId}/labour`, limit, offset)
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

  const refreshLedger = useCallback(async () => {
    if (!farmId || selectedId == null) return;
    try {
      const res = await apiFetch<Paginated<LabourLedgerRow>>(
        withPagination(`/farms/${farmId}/labour/${selectedId}/ledger`, ledgerLimit, ledgerOffset)
      );
      setLedgerRows(res.items);
      setLedgerTotal(res.total);
    } catch {
      setLedgerRows([]);
      setLedgerTotal(0);
    }
  }, [farmId, selectedId, ledgerLimit, ledgerOffset]);

  useEffect(() => {
    setOffset(0);
  }, [limit, farmId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (canManage || !isWorker) return;
    if (rows.length === 1 && selectedId == null) {
      setSelectedId(rows[0].id);
    }
  }, [canManage, isWorker, rows, selectedId]);

  useEffect(() => {
    setLedgerOffset(0);
  }, [selectedId, ledgerLimit]);

  useEffect(() => {
    if (selectedId == null) {
      setLedgerRows([]);
      setLedgerTotal(0);
      return;
    }
    refreshLedger();
  }, [selectedId, ledgerOffset, refreshLedger]);

  async function createPerson() {
    if (!farmId || !canManage) return;
    setSaving(true);
    try {
      await apiFetch(`/farms/${farmId}/labour`, {
        method: "POST",
        body: JSON.stringify({
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          personnel_kind: personnelKind,
          compensation_type: compensationType,
          default_rate: defaultRate.trim() ? parseFloat(defaultRate) : null,
          notes: notes.trim() || null,
          hired_at: hiredAt,
        }),
      });
      setFullName("");
      setPhone("");
      setNotes("");
      setDefaultRate("");
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(r: FarmLabourRow) {
    if (!farmId || !canManage) return;
    setSaving(true);
    try {
      await apiFetch(`/farms/${farmId}/labour/${r.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !r.is_active }),
      });
      await refresh();
      if (selectedId === r.id) await refreshLedger();
    } finally {
      setSaving(false);
    }
  }

  async function addLedgerLine() {
    if (!farmId || selectedId == null || !canManage) return;
    const amt = parseFloat(lineAmount);
    if (Number.isNaN(amt)) return;
    const sel = rows.find((x) => x.id === selectedId);
    const q = sel && !sel.is_active && forceInactive ? "?force=true" : "";
    setSaving(true);
    try {
      await apiFetch(`/farms/${farmId}/labour/${selectedId}/ledger${q}`, {
        method: "POST",
        body: JSON.stringify({
          line_type: lineType,
          amount: amt,
          line_date: lineDate,
          description: lineDesc.trim() || null,
        }),
      });
      setLineAmount("");
      setLineDesc("");
      await refresh();
      await refreshLedger();
    } finally {
      setSaving(false);
    }
  }

  async function deleteLedgerLine(lineId: number) {
    if (!farmId || selectedId == null || !canManage) return;
    setSaving(true);
    try {
      await apiFetch(`/farms/${farmId}/labour/${selectedId}/ledger/${lineId}`, {
        method: "DELETE",
      });
      await refresh();
      await refreshLedger();
    } finally {
      setSaving(false);
    }
  }

  if (!farmId) {
    return <Text style={styles.muted}>Select or create a farm in Settings.</Text>;
  }

  const selected = rows.find((r) => r.id === selectedId);

  return (
    <ScrollView
      style={styles.wrap}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
    >
      <View style={[styles.callout, isWorker && styles.calloutWorker]}>
        <Text style={[styles.calloutText, isWorker && styles.calloutTextWorker]}>
          {isWorker
            ? "This is your pay balance and ledger for this farm. If nothing appears, ask a manager to link your app login to your labour record."
            : "Positive balance = farm owes them. Earning adds debt; payment reduces it. Adjustment can be + or − for corrections."}
        </Text>
      </View>

      {isWorker && rows.length === 0 ? (
        <Text style={styles.mutedSm}>No labour record is linked to your account for this farm yet.</Text>
      ) : null}

      {canManage ? (
        <View style={styles.card}>
          <Text style={styles.h2}>Add person</Text>
          <Text style={styles.label}>Full name</Text>
          <TextInput style={styles.input} value={fullName} onChangeText={setFullName} />
          <Text style={styles.label}>Phone</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} />
          <Text style={styles.label}>Hired date (YYYY-MM-DD)</Text>
          <TextInput style={styles.input} value={hiredAt} onChangeText={setHiredAt} />
          <Text style={styles.label}>Role: labour or owner_pay</Text>
          <View style={styles.rowChips}>
            <Pressable
              style={[styles.chip, personnelKind === "labour" && styles.chipOn]}
              onPress={() => setPersonnelKind("labour")}
            >
              <Text style={styles.chipText}>Labour</Text>
            </Pressable>
            <Pressable
              style={[styles.chip, personnelKind === "owner_pay" && styles.chipOn]}
              onPress={() => setPersonnelKind("owner_pay")}
            >
              <Text style={styles.chipText}>Owner pay</Text>
            </Pressable>
          </View>
          <Text style={styles.label}>Compensation</Text>
          <View style={styles.rowChips}>
            {(["daily", "monthly", "hourly", "adhoc"] as const).map((c) => (
              <Pressable
                key={c}
                style={[styles.chip, compensationType === c && styles.chipOn]}
                onPress={() => setCompensationType(c)}
              >
                <Text style={styles.chipText}>{c}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Default rate (optional)</Text>
          <TextInput
            style={styles.input}
            value={defaultRate}
            onChangeText={setDefaultRate}
            keyboardType="decimal-pad"
          />
          <Text style={styles.label}>Notes</Text>
          <TextInput style={styles.input} value={notes} onChangeText={setNotes} />
          <Pressable
            style={[styles.btn, saving && styles.btnDis]}
            onPress={createPerson}
            disabled={saving || !fullName.trim()}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save</Text>}
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.h2}>{isWorker ? "Your record" : "People"}</Text>
      {loading && !rows.length ? <ActivityIndicator color="#047857" style={{ marginVertical: 16 }} /> : null}
      {rows.map((r) => (
        <Pressable
          key={r.id}
          style={[styles.row, selectedId === r.id && styles.rowSel]}
          onPress={() => setSelectedId(r.id)}
        >
          <Text style={styles.rowMain}>{r.full_name}</Text>
          <Text style={styles.rowSub}>
            {r.personnel_kind === "owner_pay" ? "Owner pay" : "Labour"} · {r.compensation_type} ·{" "}
            {fmtInr(r.balance_due)} · {r.is_active ? "Active" : "Inactive"}
          </Text>
          {canManage ? (
            <Pressable onPress={() => void toggleActive(r)} style={{ marginTop: 8 }}>
              <Text style={styles.link}>{r.is_active ? "Deactivate" : "Reactivate"}</Text>
            </Pressable>
          ) : null}
        </Pressable>
      ))}
      <PaginatedControls
        total={total}
        limit={limit}
        offset={offset}
        onLimitChange={setLimit}
        onOffsetChange={setOffset}
      />

      {selectedId != null && selected ? (
        <View style={styles.card}>
          <Text style={styles.h2}>Ledger — {selected.full_name}</Text>
          {canManage ? (
            <>
              <Text style={styles.label}>Type</Text>
              <View style={styles.rowChips}>
                {(
                  [
                    ["earning", "Earning"],
                    ["payment", "Payment"],
                    ["adjustment", "Adj"],
                  ] as const
                ).map(([v, label]) => (
                  <Pressable
                    key={v}
                    style={[styles.chip, lineType === v && styles.chipOn]}
                    onPress={() => setLineType(v)}
                  >
                    <Text style={styles.chipText}>{label}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.label}>Amount (INR)</Text>
              <TextInput
                style={styles.input}
                value={lineAmount}
                onChangeText={setLineAmount}
                keyboardType="decimal-pad"
              />
              <Text style={styles.label}>Date</Text>
              <TextInput style={styles.input} value={lineDate} onChangeText={setLineDate} />
              <Text style={styles.label}>Description</Text>
              <TextInput style={styles.input} value={lineDesc} onChangeText={setLineDesc} />
              {!selected.is_active ? (
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Post for inactive</Text>
                  <Switch value={forceInactive} onValueChange={setForceInactive} />
                </View>
              ) : null}
              <Pressable
                style={[styles.btn, saving && styles.btnDis]}
                onPress={addLedgerLine}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnText}>Add line</Text>
                )}
              </Pressable>
            </>
          ) : (
            <Text style={styles.mutedSm}>
              {isWorker
                ? "Your earnings and payments are listed below."
                : "Managers can post ledger lines."}
            </Text>
          )}

          {ledgerRows.map((L) => (
            <View key={L.id} style={styles.ledgerRow}>
              <Text style={styles.ledgerMain}>
                {L.line_date} · {L.line_type} · {fmtInr(L.amount)}
              </Text>
              {L.description ? <Text style={styles.rowSub}>{L.description}</Text> : null}
              {canManage ? (
                <Pressable onPress={() => void deleteLedgerLine(L.id)}>
                  <Text style={styles.dangerLink}>Remove</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
          {ledgerTotal > 0 ? (
            <PaginatedControls
              total={ledgerTotal}
              limit={ledgerLimit}
              offset={ledgerOffset}
              onLimitChange={setLedgerLimit}
              onOffsetChange={setLedgerOffset}
            />
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#fafafa", padding: 16 },
  muted: { padding: 16, color: "#71717a" },
  mutedSm: { fontSize: 13, color: "#71717a", marginBottom: 12 },
  callout: {
    backgroundColor: "#fffbeb",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  calloutText: { fontSize: 12, color: "#78350f" },
  calloutWorker: {
    backgroundColor: "#f4f4f5",
    borderColor: "#e4e4e7",
  },
  calloutTextWorker: { color: "#3f3f46" },
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
  },
  rowChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    backgroundColor: "#fafafa",
  },
  chipOn: { backgroundColor: "#ecfdf5", borderColor: "#6ee7b7" },
  chipText: { fontSize: 13, fontWeight: "600", color: "#3f3f46" },
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
  rowSel: { borderColor: "#047857", backgroundColor: "#f0fdf4" },
  rowMain: { fontWeight: "700", color: "#18181b" },
  rowSub: { fontSize: 13, color: "#52525b", marginTop: 4 },
  link: { color: "#047857", fontWeight: "600", fontSize: 13 },
  dangerLink: { color: "#b91c1c", fontWeight: "600", fontSize: 13, marginTop: 6 },
  ledgerRow: {
    borderTopWidth: 1,
    borderTopColor: "#f4f4f5",
    paddingTop: 12,
    marginTop: 12,
  },
  ledgerMain: { fontSize: 14, fontWeight: "600", color: "#18181b" },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  switchLabel: { fontSize: 14, color: "#3f3f46" },
});
