"use client";

import { useCallback, useEffect, useState } from "react";
import { PaginationFooter, withPagination } from "@/components/PaginationFooter";
import { useFarm } from "@/lib/farm-context";
import { useAsyncLoader } from "@/lib/loading-context";
import { apiFetch, type Paginated, type SaleRow } from "@/lib/api";
import { toastError, toastSuccess } from "@/lib/toast";

const DEFAULT_LIMIT = 25;

export default function SalesPage() {
  const { farmId } = useFarm();
  const runLoaded = useAsyncLoader();
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [offset, setOffset] = useState(0);
  const [buyer, setBuyer] = useState("");
  const [trays, setTrays] = useState("");
  const [rate, setRate] = useState("");
  const [date, setDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editBuyer, setEditBuyer] = useState("");
  const [editTrays, setEditTrays] = useState("");
  const [editRate, setEditRate] = useState("");
  const [editDate, setEditDate] = useState("");

  const refresh = useCallback(async () => {
    if (!farmId) return;
    await runLoaded(async () => {
      const res = await apiFetch<Paginated<SaleRow>>(
        withPagination(`/farms/${farmId}/sales`, limit, offset)
      );
      setRows(res.items);
      setTotal(res.total);
    });
  }, [farmId, limit, offset, runLoaded]);

  useEffect(() => {
    setOffset(0);
  }, [limit, farmId]);

  useEffect(() => {
    refresh().catch((err) => toastError(err));
  }, [refresh]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!farmId) return;
    const t = parseInt(trays, 10);
    const r = parseFloat(rate);
    const totalAmt = t * r;
    try {
      await runLoaded(async () => {
        await apiFetch(`/farms/${farmId}/sales`, {
          method: "POST",
          body: JSON.stringify({
            buyer_name: buyer,
            trays_sold: t,
            rate_per_tray: r,
            total_amount: totalAmt,
            date,
          }),
        });
      });
      toastSuccess("Sale recorded.");
      setBuyer("");
      setTrays("");
      setRate("");
      await refresh();
    } catch (err) {
      toastError(err);
    }
  }

  function startEdit(r: SaleRow) {
    setEditingId(r.id);
    setEditBuyer(r.buyer_name);
    setEditTrays(String(r.trays_sold));
    setEditRate(String(r.rate_per_tray));
    setEditDate(r.date);
  }

  async function saveEdit() {
    if (!farmId || editingId == null) return;
    const t = parseInt(editTrays, 10);
    const r = parseFloat(editRate);
    const totalAmt = t * r;
    try {
      await runLoaded(async () => {
        await apiFetch(`/farms/${farmId}/sales/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify({
            buyer_name: editBuyer,
            trays_sold: t,
            rate_per_tray: r,
            total_amount: totalAmt,
            date: editDate,
          }),
        });
      });
      setEditingId(null);
      toastSuccess("Sale updated.");
      await refresh();
    } catch (err) {
      toastError(err);
    }
  }

  if (!farmId) {
    return <p className="text-zinc-500">Select or create a farm in Settings.</p>;
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: "INR" }).format(
      n
    );

  return (
    <div className="space-y-8">
      <form
        onSubmit={submit}
        className="max-w-lg space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-lg font-semibold text-zinc-900">Record tray sale</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-sm text-zinc-600">Buyer</label>
            <input
              className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
              value={buyer}
              onChange={(e) => setBuyer(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-sm text-zinc-600">Trays sold</label>
            <input
              type="number"
              min={0}
              className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
              value={trays}
              onChange={(e) => setTrays(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-sm text-zinc-600">Rate / tray (₹)</label>
            <input
              type="number"
              step="0.01"
              min={0}
              className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm text-zinc-600">Date</label>
            <input
              type="date"
              className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
        </div>
        <button
          type="submit"
          className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
        >
          Save
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-100 bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Buyer</th>
                <th className="px-4 py-3">Trays</th>
                <th className="px-4 py-3">Rate</th>
                <th className="px-4 py-3">Total</th>
                <th className="w-24 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) =>
                editingId === r.id ? (
                  <tr key={r.id} className="border-b border-zinc-50 bg-zinc-50/80">
                    <td className="px-4 py-2 align-top">
                      <input
                        type="date"
                        className="rounded border border-zinc-200 px-2 py-1 text-xs"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-2 align-top">
                      <input
                        className="min-w-[100px] rounded border border-zinc-200 px-2 py-1 text-xs"
                        value={editBuyer}
                        onChange={(e) => setEditBuyer(e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-2 align-top">
                      <input
                        type="number"
                        min={0}
                        className="w-16 rounded border border-zinc-200 px-2 py-1 text-xs"
                        value={editTrays}
                        onChange={(e) => setEditTrays(e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-2 align-top">
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        className="w-20 rounded border border-zinc-200 px-2 py-1 text-xs"
                        value={editRate}
                        onChange={(e) => setEditRate(e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {fmt(
                        (parseInt(editTrays, 10) || 0) *
                          (parseFloat(editRate) || 0)
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 align-top">
                      <button
                        type="button"
                        className="mr-2 text-xs text-emerald-700 hover:underline"
                        onClick={() => void saveEdit()}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="text-xs text-zinc-500 hover:underline"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={r.id} className="border-b border-zinc-50">
                    <td className="px-4 py-3">{r.date}</td>
                    <td className="px-4 py-3">{r.buyer_name}</td>
                    <td className="px-4 py-3">{r.trays_sold}</td>
                    <td className="px-4 py-3">{fmt(r.rate_per_tray)}</td>
                    <td className="px-4 py-3">{fmt(r.total_amount)}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="text-xs text-emerald-700 hover:underline"
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
