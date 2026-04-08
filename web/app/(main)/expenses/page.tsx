"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { PaginationFooter, withPagination } from "@/components/PaginationFooter";
import { useFarm } from "@/lib/farm-context";
import { useAsyncLoader } from "@/lib/loading-context";
import {
  apiFetch,
  fetchExpenseCategories,
  MISCELLANEOUS_EXPENSE_CATEGORY,
  type ExpenseRow,
  type Paginated,
} from "@/lib/api";
import { toastError, toastSuccess } from "@/lib/toast";

const DEFAULT_LIMIT = 25;

function categoryOptionsWithLegacy(predefined: string[], current: string): string[] {
  if (current && !predefined.includes(current)) {
    return [current, ...predefined];
  }
  return predefined;
}

export default function ExpensesPage() {
  const { farmId } = useFarm();
  const runLoaded = useAsyncLoader();
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [offset, setOffset] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState("Feed & fodder");
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
  }, [farmId, limit, offset]);

  useLayoutEffect(() => {
    setOffset(0);
  }, [limit, farmId]);

  useEffect(() => {
    refresh().catch((err) => toastError(err));
  }, [refresh]);

  useEffect(() => {
    fetchExpenseCategories()
      .then((list) => setCategories(list))
      .catch((err) => toastError(err));
  }, []);

  useEffect(() => {
    if (!categories.length) return;
    setCategory((prev) => (categories.includes(prev) ? prev : categories[0]));
  }, [categories]);

  const miscNeedsDescription = category === MISCELLANEOUS_EXPENSE_CATEGORY;
  const editMiscNeedsDescription = editCategory === MISCELLANEOUS_EXPENSE_CATEGORY;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!farmId) return;
    const descTrim = description.trim();
    if (miscNeedsDescription && !descTrim) {
      toastError(new Error("Add a short description for Miscellaneous expenses."));
      return;
    }
    try {
      await runLoaded(async () => {
        await apiFetch(`/farms/${farmId}/expenses`, {
          method: "POST",
          body: JSON.stringify({
            category,
            amount: parseFloat(amount),
            description: descTrim ? descTrim : null,
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
    const editDescTrim = editDescription.trim();
    if (editMiscNeedsDescription && !editDescTrim) {
      toastError(new Error("Add a short description for Miscellaneous expenses."));
      return;
    }
    try {
      await runLoaded(async () => {
        await apiFetch(`/farms/${farmId}/expenses/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify({
            category: editCategory,
            amount: parseFloat(editAmount),
            description: editDescTrim ? editDescTrim : null,
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
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Add expense</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Managers and owners can add expenses. Workers can view the list.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-sm text-zinc-600 dark:text-zinc-400">Category</label>
            <select
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              value={
                !categories.length ? "" : categories.includes(category) ? category : categories[0]
              }
              onChange={(e) => setCategory(e.target.value)}
              required
              disabled={!categories.length}
            >
              {!categories.length ? (
                <option value="">Loading categories…</option>
              ) : (
                categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))
              )}
            </select>
          </div>
          <div>
            <label className="text-sm text-zinc-600 dark:text-zinc-400">Amount (₹)</label>
            <input
              type="number"
              step="0.01"
              min={0}
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm text-zinc-600 dark:text-zinc-400">
              Description
              {miscNeedsDescription ? (
                <span className="text-red-600 dark:text-red-400"> (required)</span>
              ) : null}
            </label>
            <input
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required={miscNeedsDescription}
              placeholder={
                miscNeedsDescription ? "What was this expense for?" : "Optional note"
              }
            />
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
          disabled={!categories.length}
          className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500"
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
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Note</th>
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
                      <select
                        className="max-w-[220px] rounded border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                        value={
                          (() => {
                            const opts = categoryOptionsWithLegacy(categories, editCategory);
                            return opts.includes(editCategory) ? editCategory : opts[0] ?? "";
                          })()
                        }
                        onChange={(e) => setEditCategory(e.target.value)}
                        disabled={!categories.length && !editCategory}
                      >
                        {categoryOptionsWithLegacy(categories, editCategory).map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2 align-top">
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        className="w-24 rounded border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-2 align-top">
                      <input
                        className="min-w-[120px] rounded border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        required={editMiscNeedsDescription}
                        placeholder={
                          editMiscNeedsDescription ? "Required for Miscellaneous" : "Note"
                        }
                      />
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
                    <td className="px-4 py-3">{r.category}</td>
                    <td className="px-4 py-3">{fmt(r.amount)}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{r.description ?? "—"}</td>
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
