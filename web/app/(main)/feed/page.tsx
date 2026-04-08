"use client";

import { useCallback, useEffect, useState } from "react";
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
  const [remaining, setRemaining] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editReceived, setEditReceived] = useState("");
  const [editUsed, setEditUsed] = useState("");
  const [editRemaining, setEditRemaining] = useState("");

  const refresh = useCallback(async () => {
    if (!farmId) return;
    await runLoaded(async () => {
      const res = await apiFetch<Paginated<FeedRow>>(
        withPagination(`/farms/${farmId}/feed`, limit, offset)
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
    try {
      await runLoaded(async () => {
        await apiFetch(`/farms/${farmId}/feed`, {
          method: "POST",
          body: JSON.stringify({
            date,
            feed_received: parseFloat(received),
            feed_used: parseFloat(used),
            feed_remaining: parseFloat(remaining),
          }),
        });
      });
      toastSuccess("Feed entry saved.");
      setReceived("");
      setUsed("");
      setRemaining("");
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
  }

  async function saveEdit() {
    if (!farmId || editingId == null) return;
    try {
      await runLoaded(async () => {
        await apiFetch(`/farms/${farmId}/feed/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify({
            date: editDate,
            feed_received: parseFloat(editReceived),
            feed_used: parseFloat(editUsed),
            feed_remaining: parseFloat(editRemaining),
          }),
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
    return <p className="text-zinc-500">Select or create a farm in Settings.</p>;
  }

  return (
    <div className="space-y-8">
      <form
        onSubmit={submit}
        className="max-w-lg space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-lg font-semibold text-zinc-900">Feed inventory entry</h2>
        <div className="grid gap-3 sm:grid-cols-2">
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
          <div>
            <label className="text-sm text-zinc-600">Received (kg)</label>
            <input
              type="number"
              step="0.01"
              min={0}
              className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
              value={received}
              onChange={(e) => setReceived(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-sm text-zinc-600">Used (kg)</label>
            <input
              type="number"
              step="0.01"
              min={0}
              className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
              value={used}
              onChange={(e) => setUsed(e.target.value)}
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm text-zinc-600">Remaining (kg)</label>
            <input
              type="number"
              step="0.01"
              min={0}
              className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
              value={remaining}
              onChange={(e) => setRemaining(e.target.value)}
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
                <th className="px-4 py-3">Received</th>
                <th className="px-4 py-3">Used</th>
                <th className="px-4 py-3">Remaining</th>
                <th className="w-24 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) =>
                editingId === r.id ? (
                  <tr key={r.id} className="border-b border-zinc-50 bg-zinc-50/80">
                    <td className="px-4 py-2">
                      <input
                        type="date"
                        className="rounded border border-zinc-200 px-2 py-1 text-xs"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        className="w-24 rounded border border-zinc-200 px-2 py-1 text-xs"
                        value={editReceived}
                        onChange={(e) => setEditReceived(e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        className="w-24 rounded border border-zinc-200 px-2 py-1 text-xs"
                        value={editUsed}
                        onChange={(e) => setEditUsed(e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        className="w-24 rounded border border-zinc-200 px-2 py-1 text-xs"
                        value={editRemaining}
                        onChange={(e) => setEditRemaining(e.target.value)}
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
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
                    <td className="px-4 py-3">{r.feed_received}</td>
                    <td className="px-4 py-3">{r.feed_used}</td>
                    <td className="px-4 py-3">{r.feed_remaining}</td>
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
