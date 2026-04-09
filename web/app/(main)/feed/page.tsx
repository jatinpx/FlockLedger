"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { PaginationFooter, withPagination } from "@/components/PaginationFooter";
import { useFarm } from "@/lib/farm-context";
import { useAsyncLoader } from "@/lib/loading-context";
import { apiFetch, type FeedRow, type Paginated } from "@/lib/api";
import { toastError, toastSuccess } from "@/lib/toast";

const DEFAULT_LIMIT = 25;

export default function FeedPage() {
  const { farmId } = useFarm();
  const runLoaded = useAsyncLoader();
  const [rows, setRows] = useState<FeedRow[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [offset, setOffset] = useState(0);
  const [date, setDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
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

  const refresh = useCallback(async () => {
    if (!farmId) return;
    await runLoaded(async () => {
      const res = await apiFetch<Paginated<FeedRow>>(
        withPagination(`/farms/${farmId}/feed`, limit, offset)
      );
      setRows(res.items);
      setTotal(res.total);
    });
  }, [farmId, limit, offset]);

  useLayoutEffect(() => {
    setOffset(0);
  }, [limit, farmId]);

  useEffect(() => {
    refresh().catch((err) => toastError(err));
  }, [refresh]);

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!farmId) return;
    try {
      await runLoaded(async () => {
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
      });
      toastSuccess("Feed entry saved.");
      setReceived("");
      setUsed("");
      setOverrideRemaining(false);
      setRemainingOverride("");
      setPurchaseCost("");
      await refresh();
    } catch (err) {
      toastError(err);
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
    try {
      await runLoaded(async () => {
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
      });
      setEditingId(null);
      toastSuccess("Entry updated.");
      await refresh();
    } catch (err) {
      toastError(err);
    }
  }

  if (!farmId) {
    return <p className="text-zinc-500 dark:text-zinc-400">Select or create a farm in Settings.</p>;
  }

  return (
    <div className="space-y-8">
      <form
        onSubmit={submit}
        className="max-w-lg space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Feed inventory entry</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Remaining is calculated as opening stock + received − used. Use a manual remaining only
          for physical count corrections. Optional <strong>purchase cost (₹)</strong> counts toward
          profit and is also added to Expenses.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-sm text-zinc-600 dark:text-zinc-400">Date</label>
            <input
              type="date"
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
            {openingPreview != null && (
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Opening stock for this row:{" "}
                <span className="font-medium text-zinc-800 dark:text-zinc-200">{openingPreview.toFixed(2)} kg</span>
              </p>
            )}
          </div>
          <div>
            <label className="text-sm text-zinc-600 dark:text-zinc-400">Received (kg)</label>
            <input
              type="number"
              step="0.01"
              min={0}
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              value={received}
              onChange={(e) => setReceived(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-sm text-zinc-600 dark:text-zinc-400">Used (kg)</label>
            <input
              type="number"
              step="0.01"
              min={0}
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              value={used}
              onChange={(e) => setUsed(e.target.value)}
              required
            />
          </div>
          {!overrideRemaining && computedRemaining != null && (
            <div className="sm:col-span-2 rounded-md bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 text-sm text-emerald-900 dark:text-emerald-200">
              Closing remaining (auto):{" "}
              <span className="font-semibold">{computedRemaining.toFixed(2)} kg</span>
            </div>
          )}
          <label className="flex cursor-pointer items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              checked={overrideRemaining}
              onChange={(e) => setOverrideRemaining(e.target.checked)}
            />
            <span className="text-sm text-zinc-700 dark:text-zinc-300">Manual remaining (physical count differs)</span>
          </label>
          {overrideRemaining && (
            <div className="sm:col-span-2">
              <label className="text-sm text-zinc-600 dark:text-zinc-400">Remaining (kg)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                value={remainingOverride}
                onChange={(e) => setRemainingOverride(e.target.value)}
                required
              />
            </div>
          )}
          <div>
            <label className="text-sm text-zinc-600 dark:text-zinc-400">
              Purchase cost (₹, optional)
            </label>
            <input
              type="number"
              step="0.01"
              min={0}
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              value={purchaseCost}
              onChange={(e) => setPurchaseCost(e.target.value)}
              placeholder="e.g. feed bill for this receipt"
            />
          </div>
        </div>
        <button
          type="submit"
          className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
        >
          Save
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-100 bg-zinc-50 dark:bg-zinc-900 text-xs uppercase text-zinc-500 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Open</th>
                <th className="px-4 py-3">Received</th>
                <th className="px-4 py-3">Used</th>
                <th className="px-4 py-3">Remaining</th>
                <th className="px-4 py-3">Cost ₹</th>
                <th className="px-4 py-3">Auto</th>
                <th className="w-24 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) =>
                editingId === r.id ? (
                  <tr key={r.id} className="border-b border-zinc-50 dark:border-zinc-800/80 bg-zinc-50/80 dark:bg-zinc-900/80">
                    <td className="px-4 py-2">
                      <input
                        type="date"
                        className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-2 text-xs text-zinc-500 dark:text-zinc-400">
                      {(r.opening_balance_kg ?? 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        className="w-24 rounded border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                        value={editReceived}
                        onChange={(e) => setEditReceived(e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        className="w-24 rounded border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                        value={editUsed}
                        onChange={(e) => setEditUsed(e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        className="w-24 rounded border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                        value={editRemaining}
                        onChange={(e) => setEditRemaining(e.target.value)}
                        disabled={!editOverride}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        className="w-20 rounded border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                        value={editPurchaseCost}
                        onChange={(e) => setEditPurchaseCost(e.target.value)}
                        placeholder="₹"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <label className="flex items-center gap-1 text-xs">
                        <input
                          type="checkbox"
                          checked={editOverride}
                          onChange={(e) => setEditOverride(e.target.checked)}
                        />
                        manual rem.
                      </label>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
                      <button
                        type="button"
                        className="mr-2 text-xs text-emerald-700 dark:text-emerald-400 hover:underline"
                        onClick={() => void saveEdit()}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="text-xs text-zinc-500 dark:text-zinc-400 hover:underline"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={r.id} className="border-b border-zinc-50 dark:border-zinc-800/80">
                    <td className="px-4 py-3">{r.date}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {(r.opening_balance_kg ?? 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">{r.feed_received}</td>
                    <td className="px-4 py-3">{r.feed_used}</td>
                    <td className="px-4 py-3">{r.feed_remaining}</td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      {r.purchase_cost_inr != null && r.purchase_cost_inr !== undefined
                        ? new Intl.NumberFormat(undefined, {
                            style: "currency",
                            currency: "INR",
                          }).format(r.purchase_cost_inr)
                        : "—"}
                    </td>
                    <td className="px-4 py-3">{r.remaining_auto !== false ? "Yes" : "No"}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline"
                        onClick={() => startEdit(r)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                )
              )}
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
    </div>
  );
}
