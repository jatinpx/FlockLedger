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
  Alert,
} from "react-native";
import { useFarm } from "../lib/farm-context";
import {
  apiFetch,
  type FarmMemberRow,
  type FarmLabourRow,
  type LabourLedgerRow,
  type Paginated,
  type PayrollListResponse,
} from "../lib/api";
import { withPagination } from "../lib/pagination";
import { PaginatedControls } from "../components/PaginatedControls";

const DEFAULT_LIMIT = 50;
const LEDGER_DEFAULT = 50;

const fmtInr = (n: number) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "INR" }).format(n);

function ymNow(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function lastDayOfMonthLocal(ym: string): string {
  const [ys, ms] = ym.split("-");
  const y = Number(ys);
  const m = Number(ms);
  const d = new Date(y, m, 0);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function workerMembersFreeForCreate(rows: FarmLabourRow[], members: FarmMemberRow[]) {
  const taken = new Set(
    rows.map((r) => r.linked_user_id).filter((id): id is number => id != null)
  );
  return members.filter((m) => !taken.has(m.user_id));
}

function membersAvailableForRow(row: FarmLabourRow, rows: FarmLabourRow[], members: FarmMemberRow[]) {
  const taken = new Set(
    rows
      .filter((x) => x.id !== row.id && x.linked_user_id != null)
      .map((x) => x.linked_user_id as number)
  );
  return members.filter((m) => !taken.has(m.user_id) || m.user_id === row.linked_user_id);
}

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
  const [linkUserId, setLinkUserId] = useState("");
  const [workerMembers, setWorkerMembers] = useState<FarmMemberRow[]>([]);

  const [lineType, setLineType] = useState<"earning" | "payment" | "adjustment">("earning");
  const [lineAmount, setLineAmount] = useState("");
  const [lineDate, setLineDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [lineDesc, setLineDesc] = useState("");
  const [forceInactive, setForceInactive] = useState(false);

  const [payrollMonth, setPayrollMonth] = useState(ymNow);
  const [payroll, setPayroll] = useState<PayrollListResponse | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [monthlySalaryInput, setMonthlySalaryInput] = useState("");
  const [accrueAmountInput, setAccrueAmountInput] = useState("");
  const [payoutAmountInput, setPayoutAmountInput] = useState("");
  const [payoutDateInput, setPayoutDateInput] = useState(() => lastDayOfMonthLocal(ymNow()));

  const loadPayroll = useCallback(async () => {
    if (!farmId) return;
    try {
      const res = await apiFetch<PayrollListResponse>(
        `/farms/${farmId}/labour/payroll?month=${encodeURIComponent(payrollMonth)}`
      );
      setPayroll(res);
    } catch {
      setPayroll(null);
    }
  }, [farmId, payrollMonth]);

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
    await loadPayroll();
  }, [farmId, limit, offset, loadPayroll]);

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
    setPayoutDateInput(lastDayOfMonthLocal(payrollMonth));
  }, [payrollMonth]);

  useEffect(() => {
    if (canManage || !isWorker) return;
    if (rows.length === 1 && selectedId == null) {
      setSelectedId(rows[0].id);
    }
  }, [canManage, isWorker, rows, selectedId]);

  useEffect(() => {
    if (!farmId || !canManage) {
      setWorkerMembers([]);
      return;
    }
    apiFetch<Paginated<FarmMemberRow>>(withPagination(`/farms/${farmId}/members`, 500, 0))
      .then((res) => setWorkerMembers(res.items.filter((m) => m.role === "worker")))
      .catch(() => setWorkerMembers([]));
  }, [farmId, canManage]);

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

  useEffect(() => {
    const sel = rows.find((r) => r.id === selectedId);
    if (sel?.default_rate != null) {
      setMonthlySalaryInput(String(sel.default_rate));
    } else {
      setMonthlySalaryInput("");
    }
  }, [selectedId, rows]);

  async function saveMonthlySalary() {
    if (!farmId || selectedId == null || !canManage) return;
    const v = monthlySalaryInput.trim();
    const num = v === "" ? null : parseFloat(v);
    if (num !== null && (Number.isNaN(num) || num < 0)) return;
    setSaving(true);
    try {
      await apiFetch(`/farms/${farmId}/labour/${selectedId}`, {
        method: "PATCH",
        body: JSON.stringify({ default_rate: num }),
      });
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function bookPayrollAccrual() {
    if (!farmId || selectedId == null || !canManage) return;
    const raw = accrueAmountInput.trim();
    const body: Record<string, unknown> = { labour_id: selectedId, month: payrollMonth };
    if (raw !== "") {
      const amt = parseFloat(raw);
      if (Number.isNaN(amt) || amt <= 0) return;
      body.amount = amt;
    }
    const sel = rows.find((x) => x.id === selectedId);
    const q = sel && !sel.is_active ? "?force=true" : "";
    setSaving(true);
    try {
      await apiFetch(`/farms/${farmId}/labour/payroll/accrue${q}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setAccrueAmountInput("");
      await refresh();
      await refreshLedger();
    } finally {
      setSaving(false);
    }
  }

  async function recordPayrollPayout() {
    if (!farmId || selectedId == null || !canManage) return;
    const amt = parseFloat(payoutAmountInput);
    if (Number.isNaN(amt) || amt <= 0) return;
    const sel = rows.find((x) => x.id === selectedId);
    const q = sel && !sel.is_active ? "?force=true" : "";
    setSaving(true);
    try {
      await apiFetch(`/farms/${farmId}/labour/payroll/payout${q}`, {
        method: "POST",
        body: JSON.stringify({
          labour_id: selectedId,
          month: payrollMonth,
          amount: amt,
          line_date: payoutDateInput,
          description: null,
        }),
      });
      setPayoutAmountInput("");
      await refresh();
      await refreshLedger();
    } finally {
      setSaving(false);
    }
  }

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
          linked_user_id: linkUserId.trim() ? parseInt(linkUserId, 10) : null,
        }),
      });
      setFullName("");
      setPhone("");
      setNotes("");
      setDefaultRate("");
      setLinkUserId("");
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function patchLabourLink(labourId: number, raw: string) {
    if (!farmId || !canManage) return;
    const linked_user_id = raw === "" ? null : Number(raw);
    if (linked_user_id !== null && Number.isNaN(linked_user_id)) return;
    setSaving(true);
    try {
      await apiFetch(`/farms/${farmId}/labour/${labourId}`, {
        method: "PATCH",
        body: JSON.stringify({ linked_user_id }),
      });
      await refresh();
      await loadPayroll();
      if (selectedId === labourId) await refreshLedger();
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

  function confirmDeleteLedgerLine(lineId: number) {
    Alert.alert("Remove ledger line?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => void deleteLedgerLine(lineId),
      },
    ]);
  }

  if (!farmId) {
    return <Text style={styles.muted}>Select or create a farm in Settings.</Text>;
  }

  const selected = rows.find((r) => r.id === selectedId);
  const selectedPayroll = payroll?.workers.find((w) => w.labour_id === selectedId) ?? null;

  return (
    <ScrollView
      style={styles.wrap}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
    >
      <View style={styles.headerCard}>
        <Text style={styles.screenTitle}>Labour</Text>
        <Text style={styles.screenSub}>Payroll, balances and ledger controls</Text>
      </View>

      <View style={[styles.callout, isWorker && styles.calloutWorker]}>
        <Text style={[styles.calloutText, isWorker && styles.calloutTextWorker]}>
          {isWorker
            ? "Your pay balance for this farm. Worker accounts get a labour row automatically when you are added as a worker."
            : "Running balance = all-time ledger total. Use the month field for salary accrual and payouts; open Advanced for raw ledger lines. Dashboard labour due uses running balances."}
        </Text>
      </View>

      <Text style={styles.label}>Payroll month (YYYY-MM)</Text>
      <TextInput
        style={styles.input}
        value={payrollMonth}
        onChangeText={setPayrollMonth}
        placeholder="2026-04"
        autoCapitalize="none"
      />
      {payroll ? (
        <Text style={styles.mutedSm}>{payroll.labour_due_definition}</Text>
      ) : null}

      {isWorker && rows.length === 0 ? (
        <Text style={styles.mutedSm}>No labour record is linked to your account for this farm yet.</Text>
      ) : null}

      {canManage ? (
        <View style={styles.card}>
          <Text style={styles.h2}>Add off-roll payee</Text>
          <Text style={styles.mutedSm}>
            Workers with app logins are added automatically when invited as a worker. Use this for
            casual staff without accounts or owner-pay lines.
          </Text>
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
          <Text style={styles.label}>Link worker app login (optional)</Text>
          <View style={styles.rowChips}>
            <Pressable
              style={[styles.chip, linkUserId === "" && styles.chipOn]}
              onPress={() => setLinkUserId("")}
            >
              <Text style={styles.chipText}>Not linked</Text>
            </Pressable>
            {workerMembersFreeForCreate(rows, workerMembers).map((m) => (
              <Pressable
                key={m.user_id}
                style={[styles.chip, linkUserId === String(m.user_id) && styles.chipOn]}
                onPress={() => setLinkUserId(String(m.user_id))}
              >
                <Text style={styles.chipText}>{m.name}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.mutedSm}>Lets that worker see only their own row and ledger.</Text>
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
          style={[styles.rowCompact, selectedId === r.id && styles.rowSel]}
          onPress={() => setSelectedId(r.id)}
        >
          <View style={styles.rowTop}>
            <View style={styles.recordHeadLeft}>
              <Text style={styles.recordTitle} numberOfLines={1}>{r.full_name}</Text>
              <Text style={styles.recordDate}>
                {r.personnel_kind === "owner_pay" ? "Owner pay" : "Labour"} · {r.compensation_type}
              </Text>
            </View>
            {canManage ? (
              <Pressable onPress={() => void toggleActive(r)} style={styles.inlinePill}>
                <Text style={styles.link}>{r.is_active ? "Deactivate" : "Reactivate"}</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.recordStatsCompact}>
            <Text style={[styles.statInline, styles.accentText]}>{fmtInr(r.balance_due)}</Text>
            <Text style={[styles.statInline, r.is_active ? styles.accentText : styles.warnText]}>
              {r.is_active ? "Active" : "Inactive"}
            </Text>
            {r.linked_user_id != null ? <Text style={styles.statInline}>linked #{r.linked_user_id}</Text> : null}
          </View>
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
          <Text style={styles.h2}>Payroll — {selected.full_name}</Text>
          {canManage ? (
            <>
              <Text style={styles.label}>Linked app worker</Text>
              <View style={styles.rowChips}>
                <Pressable
                  style={[styles.chip, selected.linked_user_id == null && styles.chipOn]}
                  onPress={() => void patchLabourLink(selected.id, "")}
                  disabled={saving}
                >
                  <Text style={styles.chipText}>Not linked</Text>
                </Pressable>
                {membersAvailableForRow(selected, rows, workerMembers).map((m) => (
                  <Pressable
                    key={m.user_id}
                    style={[styles.chip, selected.linked_user_id === m.user_id && styles.chipOn]}
                    onPress={() => void patchLabourLink(selected.id, String(m.user_id))}
                    disabled={saving}
                  >
                    <Text style={styles.chipText}>{m.name}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}
          {selectedPayroll ? (
            <>
              <Text style={styles.rowSub}>
                Month {selectedPayroll.month}: accrued {fmtInr(selectedPayroll.month_accrued)} · paid{" "}
                {fmtInr(selectedPayroll.month_paid)} · net {fmtInr(selectedPayroll.month_net)}
              </Text>
              <Text style={styles.rowSub}>
                Booked accrual:{" "}
                {selectedPayroll.payroll_accrual_posted
                  ? fmtInr(selectedPayroll.payroll_accrual_amount ?? 0)
                  : "no"}
              </Text>
              <Text style={styles.rowMain}>Running balance: {fmtInr(selectedPayroll.balance_due)}</Text>
            </>
          ) : null}
          {canManage ? (
            <>
              <Text style={styles.label}>Monthly salary (INR)</Text>
              <TextInput
                style={styles.input}
                value={monthlySalaryInput}
                onChangeText={setMonthlySalaryInput}
                keyboardType="decimal-pad"
              />
              <Pressable
                style={[styles.btnSecondary, saving && styles.btnDis]}
                onPress={() => void saveMonthlySalary()}
                disabled={saving}
              >
                <Text style={styles.btnSecondaryText}>Save monthly salary</Text>
              </Pressable>
              <Text style={styles.label}>Accrual override (optional)</Text>
              <TextInput
                style={styles.input}
                value={accrueAmountInput}
                onChangeText={setAccrueAmountInput}
                keyboardType="decimal-pad"
                placeholder="Uses salary if empty"
              />
              <Pressable
                style={[styles.btn, saving && styles.btnDis]}
                onPress={() => void bookPayrollAccrual()}
                disabled={saving}
              >
                <Text style={styles.btnText}>Book salary accrual</Text>
              </Pressable>
              <Text style={styles.label}>Payout amount</Text>
              <TextInput
                style={styles.input}
                value={payoutAmountInput}
                onChangeText={setPayoutAmountInput}
                keyboardType="decimal-pad"
              />
              <Text style={styles.label}>Payment date (in month)</Text>
              <TextInput style={styles.input} value={payoutDateInput} onChangeText={setPayoutDateInput} />
              <Pressable
                style={[styles.btn, saving && styles.btnDis]}
                onPress={() => void recordPayrollPayout()}
                disabled={saving}
              >
                <Text style={styles.btnText}>Record payment</Text>
              </Pressable>
            </>
          ) : (
            <Text style={styles.mutedSm}>Open Advanced to see all ledger lines.</Text>
          )}
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Advanced ledger</Text>
            <Switch value={showAdvanced} onValueChange={setShowAdvanced} />
          </View>
          {showAdvanced ? (
            <>
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
              {lineType === "payment" ? (
                <Text style={styles.mutedSm}>
                  Payments are always added to the expense log for profit. To pay someone not listed
                  here, use Expenses → Labour &amp; wages and select them there.
                </Text>
              ) : null}
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
                <Text style={styles.mutedSm}>Your ledger lines are listed below.</Text>
              )}

          {ledgerRows.map((L) => (
            <View key={L.id} style={styles.ledgerRow}>
              <Text style={styles.ledgerMain}>
                {L.line_date} · {L.line_type} · {fmtInr(L.amount)}
                {L.linked_expense_id != null ? " · P&L linked" : ""}
              </Text>
              {L.description ? <Text style={styles.rowSub}>{L.description}</Text> : null}
              {canManage ? (
                <Pressable onPress={() => confirmDeleteLedgerLine(L.id)}>
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
            </>
          ) : null}
        </View>
      ) : null}
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
    borderColor: "#e5e7eb",
    padding: 14,
    marginBottom: 12,
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
  btnSecondary: {
    marginTop: 8,
    backgroundColor: "#27272a",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  btnSecondaryText: { color: "#fff", fontWeight: "600", fontSize: 14 },
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
  rowSel: { borderColor: "#047857", backgroundColor: "#f0fdf4" },
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
  inlinePill: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#ffffff",
  },
  link: { color: "#047857", fontWeight: "700", fontSize: 13 },
  dangerLink: { color: "#b91c1c", fontWeight: "600", fontSize: 13, marginTop: 6 },
  accentText: { color: "#047857" },
  warnText: { color: "#b45309" },
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
