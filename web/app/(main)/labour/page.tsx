"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { PaginationFooter, withPagination } from "@/components/PaginationFooter";
import { useFarm } from "@/lib/farm-context";
import { useAsyncLoader } from "@/lib/loading-context";
import {
  apiFetch,
  type FarmLabourRow,
  type LabourLedgerRow,
  type Paginated,
} from "@/lib/api";
import { toastError, toastSuccess } from "@/lib/toast";

const DEFAULT_LIMIT = 25;
const LEDGER_LIMIT = 50;

const fmtInr = (n: number) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "INR" }).format(n);

export default function LabourPage() {
  const { farms, farmId } = useFarm();
  const runLoaded = useAsyncLoader();
  const currentFarm = farms.find((f) => f.id === farmId);
  const canManage =
    currentFarm?.my_role === "owner" || currentFarm?.my_role === "manager";

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
          }),
        });
      });
      toastSuccess("Person added.");
      setFullName("");
      setPhone("");
      setNotes("");
      setDefaultRate("");
      await refresh();
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
      if (selectedId === r.id) await refreshLedger();
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
      await refreshLedger();
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
      await refreshLedger();
    } catch (err) {
      toastError(err);
    }
  }

  if (!farmId) {
    return <p className="text-zinc-500 dark:text-zinc-400">Select or create a farm in Settings.</p>;
  }

  const selected = rows.find((r) => r.id === selectedId);

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-amber-100 bg-amber-50/80 p-4 text-sm text-amber-950">
        <strong>Balances:</strong> positive means the farm still owes that person.{" "}
        <strong>Earning</strong> increases what you owe; <strong>payment</strong> reduces it.{" "}
        <strong>Adjustment</strong> moves the balance up or down (corrections, advances, write-offs).
      </div>

      {canManage ? (
        <form
          onSubmit={createPerson}
          className="max-w-xl space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Add field staff or owner-pay line</h2>
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
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">People</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Select a row to view or post ledger lines.</p>
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
                        ? "text-amber-800"
                        : r.balance_due < 0
                          ? "text-emerald-800 dark:text-emerald-400"
                          : "text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    {fmtInr(r.balance_due)}
                  </td>
                  <td className="px-4 py-3">{r.is_active ? "Yes" : "No"}</td>
                  {canManage ? (
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline"
                        onClick={() => void toggleActive(r)}
                      >
                        {r.is_active ? "Deactivate" : "Reactivate"}
                      </button>
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
        <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Ledger — {selected.full_name}
          </h2>
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
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Managers can post payments and earnings.</p>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-100 text-xs uppercase text-zinc-500 dark:text-zinc-400">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Note</th>
                  {canManage ? <th className="px-3 py-2" /> : null}
                </tr>
              </thead>
              <tbody>
                {ledgerRows.map((L) => (
                  <tr key={L.id} className="border-b border-zinc-50 dark:border-zinc-800/80">
                    <td className="px-3 py-2">{L.line_date}</td>
                    <td className="px-3 py-2">{L.line_type}</td>
                    <td className="px-3 py-2">{fmtInr(L.amount)}</td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{L.description ?? "—"}</td>
                    {canManage ? (
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="text-xs text-red-700 hover:underline"
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
          {ledgerTotal > 0 ? (
            <PaginationFooter
              total={ledgerTotal}
              limit={ledgerLimit}
              offset={ledgerOffset}
              onLimitChange={setLedgerLimit}
              onOffsetChange={setLedgerOffset}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
