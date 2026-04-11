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
  }, [farmId, limit, offset, runLoaded]);

  useLayoutEffect(() => {
    setOffset(0);
  }, [limit, farmId]);

  useEffect(() => {
    refresh().catch((err) => toastError(err));
  }, [refresh]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!farmId) return;
    if (sheds.length === 0 || !shedId) return;
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

  const totalEggsOnPage = rows.reduce((sum, row) => sum + row.eggs_produced, 0);
  const totalBrokenOnPage = rows.reduce((sum, row) => sum + row.broken_eggs, 0);
  const totalUsableOnPage = rows.reduce((sum, row) => sum + row.usable_eggs, 0);

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-white to-emerald-50/40 p-6 shadow-sm dark:border-zinc-800 dark:from-zinc-900 dark:to-emerald-950/20">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Production</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Track daily egg output by shed and keep records clean with inline edits.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Records</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{rows.length}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Produced</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{totalEggsOnPage.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Usable</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-700 dark:text-emerald-400">{totalUsableOnPage.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Broken</p>
          <p className="mt-2 text-2xl font-semibold text-amber-700 dark:text-amber-400">{totalBrokenOnPage.toLocaleString()}</p>
        </div>
      </section>

      <form
        onSubmit={submit}
        className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Add egg production</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-sm text-zinc-600 dark:text-zinc-400">Shed</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {sheds.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    shedId === String(s.id)
                      ? "border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
                      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                  onClick={() => setShedId(String(s.id))}
                >
                  {s.name}
                </button>
              ))}
            </div>
            {sheds.length === 0 ? (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">Add a shed in Settings first.</p>
            ) : null}
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
        <div>
          <button
            type="submit"
            disabled={sheds.length === 0 || !shedId}
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-emerald-700 dark:disabled:hover:bg-emerald-600"
          >
            Save
          </button>
          {(sheds.length === 0 || !shedId) && (
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              {sheds.length === 0 ? "Add a shed in Settings to save production records." : "Select a shed to continue."}
            </p>
          )}
        </div>
      </form>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Recent records</h2>
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
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