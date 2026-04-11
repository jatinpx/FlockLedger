"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { PaginationFooter, withPagination } from "@/components/PaginationFooter";
import { useFarm } from "@/lib/farm-context";
import { useAsyncLoader } from "@/lib/loading-context";
import { apiFetch, type Paginated, type SaleRow } from "@/lib/api";
import { toastError, toastSuccess } from "@/lib/toast";

const DEFAULT_LIMIT = 25;
/** Must match backend `production_service.EGGS_PER_TRAY`. */
const EGGS_PER_TRAY = 30;

type RateBasis = "tray" | "egg";

function roundMoney2(n: number): number {
  return Math.round(n * 100) / 100;
}

function eggFromRow(r: SaleRow): number {
  return r.rate_per_egg ?? r.rate_per_tray / EGGS_PER_TRAY;
}

export default function SalesPage() {
  const { farmId } = useFarm();
  const runLoaded = useAsyncLoader();
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [offset, setOffset] = useState(0);
  const [buyer, setBuyer] = useState("");
  const [trays, setTrays] = useState("");
  const [rateBasis, setRateBasis] = useState<RateBasis>("tray");
  const [rateInput, setRateInput] = useState("");
  const [date, setDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editBuyer, setEditBuyer] = useState("");
  const [editTrays, setEditTrays] = useState("");
  const [editRateBasis, setEditRateBasis] = useState<RateBasis>("tray");
  const [editRateInput, setEditRateInput] = useState("");
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
  }, [farmId, limit, offset]);

  useLayoutEffect(() => {
    setOffset(0);
  }, [limit, farmId]);

  useEffect(() => {
    refresh().catch((err) => toastError(err));
  }, [refresh]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!farmId) return;
    const t = parseInt(trays, 10);
    const r = parseFloat(rateInput);
    if (!Number.isFinite(r) || r < 0) {
      toastError(new Error("Enter a valid rate."));
      return;
    }
    const ratePerTray =
      rateBasis === "tray" ? r : roundMoney2(r * EGGS_PER_TRAY);
    const totalAmt = roundMoney2(t * ratePerTray);
    const payload =
      rateBasis === "egg"
        ? {
            buyer_name: buyer,
            trays_sold: t,
            rate_per_egg: roundMoney2(r),
            total_amount: totalAmt,
            date,
          }
        : {
            buyer_name: buyer,
            trays_sold: t,
            rate_per_tray: roundMoney2(r),
            total_amount: totalAmt,
            date,
          };
    try {
      await runLoaded(async () => {
        await apiFetch(`/farms/${farmId}/sales`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      });
      toastSuccess("Sale recorded.");
      setBuyer("");
      setTrays("");
      setRateInput("");
      setRateBasis("tray");
      await refresh();
    } catch (err) {
      toastError(err);
    }
  }

  function startEdit(r: SaleRow) {
    setEditingId(r.id);
    setEditBuyer(r.buyer_name);
    setEditTrays(String(r.trays_sold));
    setEditRateBasis("tray");
    setEditRateInput(String(r.rate_per_tray));
    setEditDate(r.date);
  }

  async function saveEdit() {
    if (!farmId || editingId == null) return;
    const t = parseInt(editTrays, 10);
    const r = parseFloat(editRateInput);
    if (!Number.isFinite(r) || r < 0) {
      toastError(new Error("Enter a valid rate."));
      return;
    }
    const ratePerTray =
      editRateBasis === "tray" ? r : roundMoney2(r * EGGS_PER_TRAY);
    const totalAmt = roundMoney2(t * ratePerTray);
    const payload =
      editRateBasis === "egg"
        ? {
            buyer_name: editBuyer,
            trays_sold: t,
            rate_per_egg: roundMoney2(r),
            total_amount: totalAmt,
            date: editDate,
          }
        : {
            buyer_name: editBuyer,
            trays_sold: t,
            rate_per_tray: roundMoney2(r),
            total_amount: totalAmt,
            date: editDate,
          };
    try {
      await runLoaded(async () => {
        await apiFetch(`/farms/${farmId}/sales/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
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
    return <p className="text-zinc-500 dark:text-zinc-400">Select or create a farm in Settings.</p>;
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: "INR" }).format(
      n
    );

  return (
    <div className="space-y-8">
      <form
        onSubmit={submit}
        className="max-w-lg space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Record sale</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          1 tray = {EGGS_PER_TRAY} eggs. Enter rate per tray or per egg — the other is derived automatically.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-sm text-zinc-600 dark:text-zinc-400">Buyer</label>
            <input
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              value={buyer}
              onChange={(e) => setBuyer(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-sm text-zinc-600 dark:text-zinc-400">Trays sold</label>
            <input
              type="number"
              min={0}
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              value={trays}
              onChange={(e) => setTrays(e.target.value)}
              required
            />
          </div>
          <div>
            <span className="text-sm text-zinc-600 dark:text-zinc-400">Price basis</span>
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={() => setRateBasis("tray")}
                className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium ${
                  rateBasis === "tray"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-900 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-200"
                    : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                ₹ / tray
              </button>
              <button
                type="button"
                onClick={() => setRateBasis("egg")}
                className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium ${
                  rateBasis === "egg"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-900 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-200"
                    : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                ₹ / egg
              </button>
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm text-zinc-600 dark:text-zinc-400">
              {rateBasis === "tray" ? "Rate per tray (₹)" : "Rate per egg (₹)"}
            </label>
            <input
              type="number"
              step="0.01"
              min={0}
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              value={rateInput}
              onChange={(e) => setRateInput(e.target.value)}
              required
            />
            {rateInput !== "" && !Number.isNaN(parseFloat(rateInput)) && parseFloat(rateInput) >= 0 ? (
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {rateBasis === "tray" ? (
                  <>
                    ≈ {fmt(roundMoney2(parseFloat(rateInput) / EGGS_PER_TRAY))} per egg ·{" "}
                    {fmt(
                      roundMoney2(
                        (parseInt(trays, 10) || 0) * parseFloat(rateInput)
                      )
                    )}{" "}
                    total
                  </>
                ) : (
                  <>
                    ≈ {fmt(roundMoney2(parseFloat(rateInput) * EGGS_PER_TRAY))} per tray ·{" "}
                    {fmt(
                      roundMoney2(
                        (parseInt(trays, 10) || 0) *
                          parseFloat(rateInput) *
                          EGGS_PER_TRAY
                      )
                    )}{" "}
                    total
                  </>
                )}
              </p>
            ) : null}
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm text-zinc-600 dark:text-zinc-400">Date</label>
            <input
              type="date"
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
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
                <th className="px-4 py-3">Buyer</th>
                <th className="px-4 py-3">Trays</th>
                <th className="px-4 py-3">₹/tray</th>
                <th className="px-4 py-3">₹/egg</th>
                <th className="px-4 py-3">Total</th>
                <th className="w-24 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) =>
                editingId === r.id ? (
                  <tr key={r.id} className="border-b border-zinc-50 dark:border-zinc-800/80 bg-zinc-50/80 dark:bg-zinc-900/80">
                    <td className="px-4 py-2 align-top">
                      <input
                        type="date"
                        className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-2 align-top">
                      <input
                        className="min-w-[100px] rounded border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                        value={editBuyer}
                        onChange={(e) => setEditBuyer(e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-2 align-top">
                      <input
                        type="number"
                        min={0}
                        className="w-16 rounded border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                        value={editTrays}
                        onChange={(e) => setEditTrays(e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-2 align-top" colSpan={2}>
                      <div className="flex min-w-[140px] flex-col gap-1">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => setEditRateBasis("tray")}
                            className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                              editRateBasis === "tray"
                                ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200"
                                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                            }`}
                          >
                            Tray
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditRateBasis("egg")}
                            className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                              editRateBasis === "egg"
                                ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200"
                                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                            }`}
                          >
                            Egg
                          </button>
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          className="w-full rounded border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                          value={editRateInput}
                          onChange={(e) => setEditRateInput(e.target.value)}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400">
                      {fmt(
                        roundMoney2(
                          (parseInt(editTrays, 10) || 0) *
                            (editRateBasis === "tray"
                              ? parseFloat(editRateInput) || 0
                              : (parseFloat(editRateInput) || 0) * EGGS_PER_TRAY)
                        )
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 align-top">
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
                    <td className="px-4 py-3">{r.buyer_name}</td>
                    <td className="px-4 py-3">{r.trays_sold}</td>
                    <td className="px-4 py-3">{fmt(r.rate_per_tray)}</td>
                    <td className="px-4 py-3">{fmt(roundMoney2(eggFromRow(r)))}</td>
                    <td className="px-4 py-3">{fmt(r.total_amount)}</td>
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
