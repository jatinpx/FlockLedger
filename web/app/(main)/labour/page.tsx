"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { PaginationFooter, withPagination } from "@/components/PaginationFooter";
import { useFarm } from "@/lib/farm-context";
import { useAsyncLoader } from "@/lib/loading-context";
import {
  apiFetch,
  type FarmMemberRow,
  type FarmLabourRow,
  type LabourLedgerRow,
  type Paginated,
  type PayrollListResponse,
} from "@/lib/api";
import { pageQuery } from "@/lib/pagination";
import { toastError, toastSuccess } from "@/lib/toast";

const DEFAULT_LIMIT = 25;
const LEDGER_LIMIT = 50;

const fmtInr = (n: number) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "INR" }).format(n);

function currentMonthYm(): string {
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

function maxDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function LabourPage() {
  const { farms, farmId } = useFarm();
  const runLoaded = useAsyncLoader();
  const currentFarm = farms.find((f) => f.id === farmId);
  const canManage =
    currentFarm?.my_role === "owner" || currentFarm?.my_role === "manager";
  const isWorker = currentFarm?.my_role === "worker";

  const [rows, setRows] = useState<FarmLabourRow[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [offset, setOffset] = useState(0);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [ledgerRows, setLedgerRows] = useState<LabourLedgerRow[]>([]);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [ledgerLimit, setLedgerLimit] = useState(LEDGER_LIMIT);
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
  const [linkUserId, setLinkUserId] = useState("");
  const [workerMembers, setWorkerMembers] = useState<FarmMemberRow[]>([]);

  const [payrollMonth, setPayrollMonth] = useState(currentMonthYm);
  const [payroll, setPayroll] = useState<PayrollListResponse | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [monthlySalaryInput, setMonthlySalaryInput] = useState("");
  const [accrueAmountInput, setAccrueAmountInput] = useState("");
  const [payoutAmountInput, setPayoutAmountInput] = useState("");
  const [payoutDateInput, setPayoutDateInput] = useState(() => lastDayOfMonthLocal(currentMonthYm()));

  const refresh = useCallback(async () => {
    if (!farmId) return;
    await runLoaded(async () => {
      const res = await apiFetch<Paginated<FarmLabourRow>>(
        withPagination(`/farms/${farmId}/labour`, limit, offset)
      );
      setRows(res.items);
      setTotal(res.total);
    });
  }, [farmId, limit, offset]);

  const refreshPayroll = useCallback(async () => {
    if (!farmId) return;
    await runLoaded(async () => {
      const res = await apiFetch<PayrollListResponse>(
        `/farms/${farmId}/labour/payroll?month=${encodeURIComponent(payrollMonth)}`
      );
      setPayroll(res);
    });
  }, [farmId, payrollMonth]);

  const refreshLedger = useCallback(async () => {
    if (!farmId || selectedId == null) return;
    await runLoaded(async () => {
      const res = await apiFetch<Paginated<LabourLedgerRow>>(
        withPagination(
          `/farms/${farmId}/labour/${selectedId}/ledger`,
          ledgerLimit,
          ledgerOffset
        )
      );
      setLedgerRows(res.items);
      setLedgerTotal(res.total);
    });
  }, [farmId, selectedId, ledgerLimit, ledgerOffset]);

  useLayoutEffect(() => {
    setOffset(0);
  }, [limit, farmId]);

  useEffect(() => {
    refresh().catch((e) => toastError(e));
  }, [refresh]);

  useEffect(() => {
    setPayoutDateInput(lastDayOfMonthLocal(payrollMonth));
  }, [payrollMonth]);

  useEffect(() => {
    if (!farmId) {
      setPayroll(null);
      return;
    }
    refreshPayroll().catch((e) => toastError(e));
  }, [farmId, refreshPayroll]);

  useEffect(() => {
    if (!farmId || !canManage) {
      setWorkerMembers([]);
      return;
    }
    apiFetch<Paginated<FarmMemberRow>>(`/farms/${farmId}/members?${pageQuery(500, 0)}`)
      .then((res) => setWorkerMembers(res.items.filter((m) => m.role === "worker")))
      .catch(() => setWorkerMembers([]));
  }, [farmId, canManage]);

  useEffect(() => {
    if (canManage || !isWorker) return;
    if (rows.length === 1 && selectedId == null) {
      setSelectedId(rows[0].id);
    }
  }, [canManage, isWorker, rows, selectedId]);

  useLayoutEffect(() => {
    setLedgerOffset(0);
  }, [selectedId, ledgerLimit]);

  useEffect(() => {
    if (selectedId == null) {
      setLedgerRows([]);
      setLedgerTotal(0);
      return;
    }
    refreshLedger().catch((e) => toastError(e));
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
    if (num !== null && (Number.isNaN(num) || num < 0)) {
      toastError(new Error("Enter a valid non-negative salary or leave empty."));
      return;
    }
    try {
      await runLoaded(async () => {
        await apiFetch(`/farms/${farmId}/labour/${selectedId}`, {
          method: "PATCH",
          body: JSON.stringify({ default_rate: num }),
        });
      });
      toastSuccess("Monthly salary saved.");
      await refresh();
      await refreshPayroll();
    } catch (err) {
      toastError(err);
    }
  }

  async function bookPayrollAccrual() {
    if (!farmId || selectedId == null || !canManage) return;
    const raw = accrueAmountInput.trim();
    const body: Record<string, unknown> = {
      labour_id: selectedId,
      month: payrollMonth,
    };
    if (raw !== "") {
      const amt = parseFloat(raw);
      if (Number.isNaN(amt) || amt <= 0) {
        toastError(new Error("Accrual amount must be positive."));
        return;
      }
      body.amount = amt;
    }
    const sel = rows.find((x) => x.id === selectedId);
    const q = sel && !sel.is_active ? "?force=true" : "";
    try {
      await runLoaded(async () => {
        await apiFetch(`/farms/${farmId}/labour/payroll/accrue${q}`, {
          method: "POST",
          body: JSON.stringify(body),
        });
      });
      toastSuccess("Salary booked for this month.");
      setAccrueAmountInput("");
      await refresh();
      await refreshPayroll();
      await refreshLedger();
    } catch (err) {
      toastError(err);
    }
  }

  async function recordPayrollPayout(e: React.FormEvent) {
    e.preventDefault();
    if (!farmId || selectedId == null || !canManage) return;
    const amt = parseFloat(payoutAmountInput);
    if (Number.isNaN(amt) || amt <= 0) {
      toastError(new Error("Enter a valid payout amount."));
      return;
    }
    const sel = rows.find((x) => x.id === selectedId);
    const q = sel && !sel.is_active ? "?force=true" : "";
    try {
      await runLoaded(async () => {
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
      });
      toastSuccess("Payment recorded.");
      setPayoutAmountInput("");
      await refresh();
      await refreshPayroll();
      await refreshLedger();
    } catch (err) {
      toastError(err);
    }
  }

  async function createPerson(e: React.FormEvent) {
    e.preventDefault();
    if (!farmId || !canManage) return;
    try {
      await runLoaded(async () => {
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
      });
      toastSuccess("Off-roll payee added.");
      setFullName("");
      setPhone("");
      setNotes("");
      setDefaultRate("");
      setLinkUserId("");
      await refresh();
      await refreshPayroll();
    } catch (err) {
      toastError(err);
    }
  }

  async function toggleActive(r: FarmLabourRow) {
    if (!farmId || !canManage) return;
    try {
      await runLoaded(async () => {
        await apiFetch(`/farms/${farmId}/labour/${r.id}`, {
          method: "PATCH",
          body: JSON.stringify({ is_active: !r.is_active }),
        });
      });
      toastSuccess(r.is_active ? "Marked inactive." : "Reactivated.");
      await refresh();
      await refreshPayroll();
      if (selectedId === r.id) await refreshLedger();
    } catch (err) {
      toastError(err);
    }
  }

  async function deleteLabour(r: FarmLabourRow) {
    if (!farmId || !canManage) return;
    if (!window.confirm(`Delete ${r.full_name}? This will remove all their ledger lines.`)) {
      return;
    }
    try {
      await runLoaded(async () => {
        await apiFetch(`/farms/${farmId}/labour/${r.id}`, { method: "DELETE" });
      });
      toastSuccess("Person deleted.");
      if (selectedId === r.id) {
        setSelectedId(null);
        setLedgerRows([]);
        setLedgerTotal(0);
      }
      await refresh();
      await refreshPayroll();
    } catch (err) {
      toastError(err);
    }
  }

  async function addLedgerLine(e: React.FormEvent) {
    e.preventDefault();
    if (!farmId || selectedId == null || !canManage) return;
    const amt = parseFloat(lineAmount);
    if (Number.isNaN(amt)) {
      toastError(new Error("Enter a valid amount."));
      return;
    }
    const selected = rows.find((x) => x.id === selectedId);
    const q =
      selected && !selected.is_active && forceInactive ? "?force=true" : "";
    try {
      await runLoaded(async () => {
        await apiFetch(`/farms/${farmId}/labour/${selectedId}/ledger${q}`, {
          method: "POST",
          body: JSON.stringify({
            line_type: lineType,
            amount: amt,
            line_date: lineDate,
            description: lineDesc.trim() || null,
          }),
        });
      });
      toastSuccess("Ledger line saved.");
      setLineAmount("");
      setLineDesc("");
      await refresh();
      await refreshPayroll();
      await refreshLedger();
    } catch (err) {
      toastError(err);
    }
  }

  function membersAvailableForRow(r: FarmLabourRow): FarmMemberRow[] {
    const taken = new Set(
      rows
        .filter((x) => x.id !== r.id && x.linked_user_id != null)
        .map((x) => x.linked_user_id as number)
    );
    return workerMembers.filter(
      (m) => !taken.has(m.user_id) || m.user_id === r.linked_user_id
    );
  }

  async function patchLabourLink(labourId: number, raw: string) {
    if (!farmId || !canManage) return;
    const linked_user_id = raw === "" ? null : Number(raw);
    if (linked_user_id !== null && Number.isNaN(linked_user_id)) return;
    try {
      await runLoaded(async () => {
        await apiFetch(`/farms/${farmId}/labour/${labourId}`, {
          method: "PATCH",
          body: JSON.stringify({ linked_user_id }),
        });
      });
      toastSuccess("Link updated.");
      await refresh();
      await refreshPayroll();
    } catch (err) {
      toastError(err);
    }
  }

  async function deleteLedgerLine(lineId: number) {
    if (!farmId || selectedId == null || !canManage) return;
    if (!window.confirm("Remove this ledger line? Balances will update.")) return;
    try {
      await runLoaded(async () => {
        await apiFetch(
          `/farms/${farmId}/labour/${selectedId}/ledger/${lineId}`,
          { method: "DELETE" }
        );
      });
      toastSuccess("Line removed.");
      await refresh();
      await refreshPayroll();
      await refreshLedger();
    } catch (err) {
      toastError(err);
    }
  }

  if (!farmId) {
    return <p className="text-zinc-500 dark:text-zinc-400">Select or create a farm in Settings.</p>;
  }

  const selected = rows.find((r) => r.id === selectedId);
  const selectedPayroll = payroll?.workers.find((w) => w.labour_id === selectedId) ?? null;
  const activeCount = rows.filter((r) => r.is_active).length;
  const totalDue = rows.reduce((sum, r) => sum + r.balance_due, 0);

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-white to-emerald-50/30 p-6 shadow-sm dark:border-zinc-800 dark:from-zinc-900 dark:to-emerald-950/20">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Labour</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Manage workers, monthly payroll, and detailed ledger balances in one place.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">People</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{rows.length}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Active</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{activeCount}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Total due</p>
          <p className="mt-2 text-xl font-semibold text-amber-700 dark:text-amber-400">{fmtInr(totalDue)}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Month</p>
          <p className="mt-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">{payrollMonth}</p>
        </div>
      </section>

      {isWorker ? (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
          This page shows <strong>your</strong> pay balance for this farm. Worker accounts are
          provisioned automatically when you are added as a farm worker.
        </div>
      ) : (
        <div className="rounded-xl border border-amber-100 bg-amber-50/80 p-4 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/35 dark:text-amber-100">
          <strong>Balances:</strong> positive means the farm still owes that person (running total on
          the ledger). Use the month view to book a fixed salary and payouts;{" "}
          <strong>Advanced</strong> has full ledger lines. Dashboard &quot;labour due&quot; uses
          running balances, not a single month&apos;s accrual minus paid.
        </div>
      )}

      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div>
          <label className="text-sm text-zinc-600 dark:text-zinc-400">Payroll month</label>
          <input
            type="month"
            className="mt-1 block rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            value={payrollMonth}
            onChange={(e) => setPayrollMonth(e.target.value)}
          />
        </div>
        {payroll ? (
          <p className="max-w-xl text-xs text-zinc-500 dark:text-zinc-400">{payroll.labour_due_definition}</p>
        ) : null}
      </div>

      {isWorker && rows.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No labour record is linked to your account for this farm yet.
        </p>
      ) : null}

      {canManage ? (
        <form
          onSubmit={createPerson}
          className="max-w-xl space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Add off-roll payee or owner-pay line
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Farm workers get a labour row automatically when invited as a worker. Use this for casual
            staff without logins or owner compensation lines.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-sm text-zinc-600 dark:text-zinc-400">Full name</label>
              <input
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-sm text-zinc-600 dark:text-zinc-400">Phone (optional)</label>
              <input
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-zinc-600 dark:text-zinc-400">Hired / start date</label>
              <input
                type="date"
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                value={hiredAt}
                onChange={(e) => setHiredAt(e.target.value)}
                max={maxDateStr()}
                required
              />
            </div>
            <div>
              <label className="text-sm text-zinc-600 dark:text-zinc-400">Role</label>
              <select
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                value={personnelKind}
                onChange={(e) => setPersonnelKind(e.target.value as "labour" | "owner_pay")}
              >
                <option value="labour">Field labour</option>
                <option value="owner_pay">Owner / partner pay</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-zinc-600 dark:text-zinc-400">Compensation</label>
              <select
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                value={compensationType}
                onChange={(e) =>
                  setCompensationType(e.target.value as typeof compensationType)
                }
              >
                <option value="daily">Daily</option>
                <option value="monthly">Monthly</option>
                <option value="hourly">Hourly</option>
                <option value="adhoc">Ad hoc</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-zinc-600 dark:text-zinc-400">Default rate (optional)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                value={defaultRate}
                onChange={(e) => setDefaultRate(e.target.value)}
                placeholder="Reference only"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm text-zinc-600 dark:text-zinc-400">Notes</label>
              <input
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm text-zinc-600 dark:text-zinc-400">
                Link worker app login (optional)
              </label>
              <select
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                value={linkUserId}
                onChange={(e) => setLinkUserId(e.target.value)}
              >
                <option value="">Not linked</option>
                {workerMembersFreeForCreate(rows, workerMembers).map((m) => (
                  <option key={m.user_id} value={String(m.user_id)}>
                    {m.name} ({m.email})
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Lets that user see only this row and its ledger in the app.
              </p>
            </div>
          </div>
          <button
            type="submit"
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            Save person
          </button>
        </form>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-100 bg-zinc-50 dark:bg-zinc-900 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/50">
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            {isWorker ? "Your record" : "People"}
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {isWorker
              ? "Your balance and payment history."
              : "Select a row to view or post ledger lines."}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-100 text-xs uppercase text-zinc-500 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Kind</th>
                <th className="px-4 py-3">Pay</th>
                <th className="px-4 py-3">Balance</th>
                <th className="px-4 py-3">Active</th>
                {canManage ? <th className="px-4 py-3">App link</th> : null}
                {canManage ? <th className="px-4 py-3" /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className={`cursor-pointer border-b border-zinc-50 dark:border-zinc-800/80 ${
                    selectedId === r.id ? "bg-emerald-50 dark:bg-emerald-950/40/60 dark:bg-emerald-950/30" : "hover:bg-zinc-50 dark:hover:bg-zinc-800/80 dark:hover:bg-zinc-800/80 dark:bg-zinc-900/80"
                  }`}
                  onClick={() => setSelectedId(r.id)}
                >
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{r.full_name}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {r.personnel_kind === "owner_pay" ? "Owner pay" : "Labour"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{r.compensation_type}</td>
                  <td
                    className={`px-4 py-3 font-medium ${
                      r.balance_due > 0
                        ? "text-amber-800 dark:text-amber-400"
                        : r.balance_due < 0
                          ? "text-emerald-800 dark:text-emerald-400"
                          : "text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    {fmtInr(r.balance_due)}
                  </td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                    {r.is_active ? "Yes" : "No"}
                  </td>
                  {canManage ? (
                    <td className="px-4 py-3 align-top" onClick={(e) => e.stopPropagation()}>
                      <select
                        className="max-w-[200px] rounded border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                        value={r.linked_user_id ?? ""}
                        onChange={(e) => void patchLabourLink(r.id, e.target.value)}
                      >
                        <option value="">Not linked</option>
                        {membersAvailableForRow(r).map((m) => (
                          <option key={m.user_id} value={String(m.user_id)}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  ) : null}
                  {canManage ? (
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline"
                          onClick={() => void toggleActive(r)}
                        >
                          {r.is_active ? "Deactivate" : "Reactivate"}
                        </button>
                        <button
                          type="button"
                          className="text-xs text-rose-700 dark:text-rose-400 hover:underline"
                          onClick={() => void deleteLabour(r)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationFooter
          total={total}
          limit={limit}
          offset={offset}
          onLimitChange={setLimit}
          onOffsetChange={setOffset}
        />
      </div>

      {selectedId != null && selected ? (
        <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-zinc-950/40">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Payroll — {selected.full_name}
          </h2>
          {selectedPayroll ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-zinc-100 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                <p className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                  This month (by line date)
                </p>
                <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                  Accrued (earnings): {fmtInr(selectedPayroll.month_accrued)}
                </p>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  Paid (payments): {fmtInr(selectedPayroll.month_paid)}
                </p>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Net (month): {fmtInr(selectedPayroll.month_net)}
                </p>
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  Booked payroll accrual:{" "}
                  {selectedPayroll.payroll_accrual_posted
                    ? fmtInr(selectedPayroll.payroll_accrual_amount ?? 0)
                    : "not booked"}
                </p>
              </div>
              <div className="rounded-lg border border-zinc-100 p-4 dark:border-zinc-800">
                <p className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                  Running balance (all time)
                </p>
                <p className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {fmtInr(selectedPayroll.balance_due)}
                </p>
              </div>
            </div>
          ) : null}
          {canManage ? (
            <div className="space-y-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <label className="text-sm text-zinc-600 dark:text-zinc-400">
                    Monthly salary (contract)
                  </label>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      className="min-w-[8rem] flex-1 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                      value={monthlySalaryInput}
                      onChange={(e) => setMonthlySalaryInput(e.target.value)}
                      placeholder="INR / month"
                    />
                    <button
                      type="button"
                      className="rounded-md bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-900 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                      onClick={() => void saveMonthlySalary()}
                    >
                      Save
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-zinc-600 dark:text-zinc-400">
                    Book salary for {payrollMonth} (optional override)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    value={accrueAmountInput}
                    onChange={(e) => setAccrueAmountInput(e.target.value)}
                    placeholder="Uses saved monthly salary if empty"
                  />
                  <button
                    type="button"
                    className="mt-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                    onClick={() => void bookPayrollAccrual()}
                  >
                    Book salary accrual
                  </button>
                </div>
              </div>
              <form onSubmit={recordPayrollPayout} className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-sm text-zinc-600 dark:text-zinc-400">Payout (INR)</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    value={payoutAmountInput}
                    onChange={(e) => setPayoutAmountInput(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm text-zinc-600 dark:text-zinc-400">
                    Payment date (in this month)
                  </label>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    value={payoutDateInput}
                    onChange={(e) => setPayoutDateInput(e.target.value)}
                    max={maxDateStr()}
                    required
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 sm:w-auto"
                  >
                    Record payment
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Your manager books monthly salary and records payouts. Expand advanced to see every
              ledger line.
            </p>
          )}
          <div className="border-t border-zinc-100 pt-4 dark:border-zinc-800">
            <button
              type="button"
              className="text-sm font-medium text-emerald-800 hover:underline dark:text-emerald-400"
              onClick={() => setAdvancedOpen((o) => !o)}
            >
              {advancedOpen ? "Hide" : "Show"} advanced ledger
            </button>
          </div>
          {advancedOpen ? (
            <>
          {canManage ? (
            <form onSubmit={addLedgerLine} className="grid max-w-2xl gap-3 sm:grid-cols-2">
              <div>
                <label className="text-sm text-zinc-600 dark:text-zinc-400">Type</label>
                <select
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  value={lineType}
                  onChange={(e) =>
                    setLineType(e.target.value as typeof lineType)
                  }
                >
                  <option value="earning">Earning (owed)</option>
                  <option value="payment">Payment (paid out)</option>
                  <option value="adjustment">Adjustment (+/−)</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-zinc-600 dark:text-zinc-400">Amount (INR)</label>
                <input
                  type="number"
                  step="0.01"
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  value={lineAmount}
                  onChange={(e) => setLineAmount(e.target.value)}
                  required
                />
                {lineType === "adjustment" ? (
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Use negative to reduce balance (e.g. advance taken).
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Enter a positive amount.</p>
                )}
              </div>
              <div>
                <label className="text-sm text-zinc-600 dark:text-zinc-400">Date</label>
                <input
                  type="date"
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  value={lineDate}
                  onChange={(e) => setLineDate(e.target.value)}
                  max={maxDateStr()}
                  required
                />
              </div>
              <div>
                <label className="text-sm text-zinc-600 dark:text-zinc-400">Description</label>
                <input
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  value={lineDesc}
                  onChange={(e) => setLineDesc(e.target.value)}
                />
              </div>
              {lineType === "payment" ? (
                <p className="sm:col-span-2 text-xs text-zinc-500 dark:text-zinc-400">
                  Payments are always recorded in the expense log for profit (Labour &amp; wages). To pay
                  someone not on this list, use Expenses → Labour &amp; wages and choose them from the
                  dropdown.
                </p>
              ) : null}
              {!selected.is_active ? (
                <label className="flex cursor-pointer items-center gap-2 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={forceInactive}
                    onChange={(e) => setForceInactive(e.target.checked)}
                  />
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">
                    Person is inactive — allow posting (cleanup / final settlement)
                  </span>
                </label>
              ) : null}
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                >
                  Add line
                </button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Your earnings, payments, and adjustments are listed below.
            </p>
          )}

          <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-zinc-100 bg-zinc-50 text-xs uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Note</th>
                    <th className="px-3 py-2">P&amp;L</th>
                    {canManage ? <th className="px-3 py-2" /> : null}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-zinc-900">
                  {ledgerRows.map((L) => (
                    <tr
                      key={L.id}
                      className="border-b border-zinc-100 bg-white last:border-b-0 dark:border-zinc-800/80 dark:bg-zinc-900"
                    >
                      <td className="px-3 py-2 text-zinc-900 dark:text-zinc-100">{L.line_date}</td>
                      <td className="px-3 py-2 capitalize text-zinc-900 dark:text-zinc-100">
                        {L.line_type}
                      </td>
                      <td className="px-3 py-2 font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                        {fmtInr(L.amount)}
                      </td>
                      <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{L.description ?? "—"}</td>
                      <td className="px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400">
                        {L.linked_expense_id != null ? (
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200">
                            Expense #{L.linked_expense_id}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      {canManage ? (
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            className="text-xs text-red-700 hover:underline dark:text-red-400 dark:hover:text-red-300"
                            onClick={() => void deleteLedgerLine(L.id)}
                          >
                            Remove
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {ledgerTotal > 0 ? (
            <PaginationFooter
              total={ledgerTotal}
              limit={ledgerLimit}
              offset={ledgerOffset}
              onLimitChange={setLedgerLimit}
              onOffsetChange={setLedgerOffset}
            />
          ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
