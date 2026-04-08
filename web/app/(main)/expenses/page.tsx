"use client";

import { useCallback, useEffect, useState } from "react";
import { PaginationFooter, withPagination } from "@/components/PaginationFooter";
import { useFarm } from "@/lib/farm-context";
import { useAsyncLoader } from "@/lib/loading-context";
import { apiFetch, type ExpenseRow, type Paginated } from "@/lib/api";
import { toastError, toastSuccess } from "@/lib/toast";

const DEFAULT_LIMIT = 25;

export default function ExpensesPage() {
  const { farmId } = useFarm();
  const runLoaded = useAsyncLoader();
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [offset, setOffset] = useState(0);
  const [category, setCategory] = useState("feed");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editCategory, setEditCategory] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDate, setEditDate] = useState("");

  const refresh = useCallback(async () => {
    if (!farmId) return;
    await runLoaded(async () => {
      const res = await apiFetch<Paginated<ExpenseRow>>(
        withPagination(`/farms/${farmId}/expenses`, limit, offset)
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
        await apiFetch(`/farms/${farmId}/expenses`, {
          method: "POST",
          body: JSON.stringify({
            category,
            amount: parseFloat(amount),
            description: description || null,
            date,
          }),
        });
      });
      toastSuccess("Expense saved.");
      setAmount("");
      setDescription("");
      await refresh();
    } catch (err) {
      toastError(err);
    }
  }

  function startEdit(r: ExpenseRow) {
    setEditingId(r.id);
    setEditCategory(r.category);
    setEditAmount(String(r.amount));
    setEditDescription(r.description ?? "");
    setEditDate(r.date);
  }

  async function saveEdit() {
    if (!farmId || editingId == null) return;
    try {
      await runLoaded(async () => {
        await apiFetch(`/farms/${farmId}/expenses/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify({
            category: editCategory,
            amount: parseFloat(editAmount),
            description: editDescription.trim() || null,
            date: editDate,
          }),
        });
      });
      setEditingId(null);
      toastSuccess("Expense updated.");
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
        <h2 className="text-lg font-semibold text-zinc-900">Add expense</h2>
        <p className="text-sm text-zinc-500">
          Managers and owners can add expenses. Workers can view the list.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-sm text-zinc-600">Category</label>
            <input
              className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-sm text-zinc-600">Amount (₹)</label>
            <input
              type="number"
              step="0.01"
              min={0}
              className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm text-zinc-600">Description</label>
            <input
              className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Note</th>
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
                        className="min-w-[80px] rounded border border-zinc-200 px-2 py-1 text-xs"
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-2 align-top">
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        className="w-24 rounded border border-zinc-200 px-2 py-1 text-xs"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-2 align-top">
                      <input
                        className="min-w-[120px] rounded border border-zinc-200 px-2 py-1 text-xs"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                      />
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
                    <td className="px-4 py-3">{r.category}</td>
                    <td className="px-4 py-3">{fmt(r.amount)}</td>
                    <td className="px-4 py-3 text-zinc-600">{r.description ?? "—"}</td>
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
