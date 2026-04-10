"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { PaginationFooter, withPagination } from "@/components/PaginationFooter";
import { useFarm } from "@/lib/farm-context";
import { useAsyncLoader } from "@/lib/loading-context";
import { apiFetch, type EggProduction, type Paginated, type Shed } from "@/lib/api";
import { toastError, toastSuccess } from "@/lib/toast";

const DEFAULT_LIMIT = 25;

export default function ProductionPage() {
  const { farmId } = useFarm();
  const runLoaded = useAsyncLoader();
  const [sheds, setSheds] = useState<Shed[]>([]);
  const [rows, setRows] = useState<EggProduction[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [offset, setOffset] = useState(0);
  const [shedId, setShedId] = useState("");
  const [date, setDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [eggs, setEggs] = useState("");
  const [broken, setBroken] = useState("0");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editShedId, setEditShedId] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editEggs, setEditEggs] = useState("");
  const [editBroken, setEditBroken] = useState("");

  const refresh = useCallback(async () => {
    if (!farmId) return;
    await runLoaded(async () => {
      const [shedRes, eggRes] = await Promise.all([
        apiFetch<Paginated<Shed>>(
          withPagination(`/farms/${farmId}/sheds`, 200, 0)
        ),
        apiFetch<Paginated<EggProduction>>(
          withPagination(`/farms/${farmId}/production/eggs`, limit, offset)
        ),
      ]);
      setSheds(shedRes.items);
      setRows(eggRes.items);
      setTotal(eggRes.total);
      setShedId((prev) => prev || (shedRes.items.length ? String(shedRes.items[0].id) : ""));
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
    try {
      await runLoaded(async () => {
        await apiFetch(`/farms/${farmId}/production/eggs`, {
          method: "POST",
          body: JSON.stringify({
            shed_id: parseInt(shedId, 10),
            date,
            eggs_produced: parseInt(eggs, 10),
            broken_eggs: parseInt(broken, 10) || 0,
          }),
        });
      });
      toastSuccess("Production saved.");
      setEggs("");
      setBroken("0");
      await refresh();
    } catch (err) {
      toastError(err);
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
    try {
      await runLoaded(async () => {
        await apiFetch(`/farms/${farmId}/production/eggs/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify({
            shed_id: parseInt(editShedId, 10),
            date: editDate,
            eggs_produced: parseInt(editEggs, 10),
            broken_eggs: parseInt(editBroken, 10) || 0,
          }),
        });
      });
      setEditingId(null);
      toastSuccess("Record updated.");
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
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Add egg production</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-sm text-zinc-600 dark:text-zinc-400">Shed</label>
            <select
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              value={shedId}
              onChange={(e) => setShedId(e.target.value)}
              required
            >
              {sheds.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-zinc-600 dark:text-zinc-400">Date</label>
            <input
              type="date"
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-sm text-zinc-600 dark:text-zinc-400">Eggs produced</label>
            <input
              type="number"
              min={0}
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              value={eggs}
              onChange={(e) => setEggs(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-sm text-zinc-600 dark:text-zinc-400">Broken eggs</label>
            <input
              type="number"
              min={0}
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              value={broken}
              onChange={(e) => setBroken(e.target.value)}
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

      <div>
        <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Recent records</h2>
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-100 bg-zinc-50 dark:bg-zinc-900 text-xs uppercase text-zinc-500 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Shed</th>
                  <th className="px-4 py-3">Produced</th>
                  <th className="px-4 py-3">Broken</th>
                  <th className="px-4 py-3">Usable</th>
                  <th className="px-4 py-3">Trays</th>
                  <th className="w-28 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) =>
                  editingId === r.id ? (
                    <tr key={r.id} className="border-b border-zinc-50 dark:border-zinc-800/80 bg-zinc-50/80 dark:bg-zinc-900/80">
                      <td className="px-4 py-2 align-top">
                        <input
                          type="date"
                          className="w-full rounded border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                        />
                      </td>
                      <td className="px-4 py-2 align-top">
                        <select
                          className="w-full max-w-[140px] rounded border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                          value={editShedId}
                          onChange={(e) => setEditShedId(e.target.value)}
                        >
                          {sheds.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2 align-top">
                        <input
                          type="number"
                          min={0}
                          className="w-20 rounded border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                          value={editEggs}
                          onChange={(e) => setEditEggs(e.target.value)}
                        />
                      </td>
                      <td className="px-4 py-2 align-top">
                        <input
                          type="number"
                          min={0}
                          className="w-16 rounded border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                          value={editBroken}
                          onChange={(e) => setEditBroken(e.target.value)}
                        />
                      </td>
                      <td className="px-4 py-3 text-zinc-400">—</td>
                      <td className="px-4 py-3 text-zinc-400">—</td>
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
                      <td className="px-4 py-3">
                        {sheds.find((s) => s.id === r.shed_id)?.name ?? r.shed_id}
                      </td>
                      <td className="px-4 py-3">{r.eggs_produced}</td>
                      <td className="px-4 py-3">{r.broken_eggs}</td>
                      <td className="px-4 py-3">{r.usable_eggs}</td>
                      <td className="px-4 py-3">{r.trays}</td>
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
    </div>
  );
}
