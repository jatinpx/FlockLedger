"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { PaginationFooter, withPagination } from "@/components/PaginationFooter";
import { useFarm } from "@/lib/farm-context";
import { useAsyncLoader } from "@/lib/loading-context";
import {
  apiFetch,
  fetchExpenseCategories,
  LABOUR_WAGES_CATEGORY,
  MISCELLANEOUS_EXPENSE_CATEGORY,
  type ExpenseRow,
  type FarmLabourRow,
  type Paginated,
} from "@/lib/api";
import { pageQuery } from "@/lib/pagination";
import { toastError, toastSuccess } from "@/lib/toast";

const DEFAULT_LIMIT = 25;

function expenseIsLinked(r: ExpenseRow): boolean {
  return r.labour_ledger_line_id != null || r.feed_inventory_id != null;
}

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
  /** Farm labour row id when category is Labour & wages (creates payment + link). */
  const [wageLabourId, setWageLabourId] = useState("");
  const [activeLabour, setActiveLabour] = useState<FarmLabourRow[]>([]);

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

  useEffect(() => {
    if (category !== LABOUR_WAGES_CATEGORY) setWageLabourId("");
  }, [category]);

  useEffect(() => {
    if (!farmId) {
      setActiveLabour([]);
      return;
    }
    let cancelled = false;
    apiFetch<Paginated<FarmLabourRow>>(
      `/farms/${farmId}/labour?${pageQuery(500, 0)}&active_only=true`
    )
      .then((res) => {
        if (!cancelled) setActiveLabour(res.items.filter((r) => r.is_active));
      })
      .catch(() => {
        if (!cancelled) setActiveLabour([]);
      });
    return () => {
      cancelled = true;
    };
  }, [farmId]);

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
        const body: Record<string, unknown> = {
          category,
          amount: parseFloat(amount),
          description: descTrim ? descTrim : null,
          date,
        };
        if (category === LABOUR_WAGES_CATEGORY && wageLabourId.trim()) {
          const lid = parseInt(wageLabourId, 10);
          if (!Number.isNaN(lid)) body.labour_id = lid;
        }
        await apiFetch(`/farms/${farmId}/expenses`, {
          method: "POST",
          body: JSON.stringify(body),
        });
      });
      toastSuccess("Expense saved.");
      setAmount("");
      setDescription("");
      setWageLabourId("");
      await refresh();
    } catch (err) {
      toastError(err);
    }
  }

  function startEdit(r: ExpenseRow) {
    if (expenseIsLinked(r)) {
      toastError(
        new Error(
          "This row is linked to labour or feed. Remove it from the Labour ledger (or delete the linked expense from feed rules) before editing here."
        )
      );
      return;
    }
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
          Managers and owners can add expenses. Workers can view the list. For{" "}
          <strong>Labour &amp; wages</strong>, choose a worker to record a payment and link this expense.
          Feed purchase cost can be set on the Feed page.
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
          {category === LABOUR_WAGES_CATEGORY ? (
            <div className="sm:col-span-2">
              <label className="text-sm text-zinc-600 dark:text-zinc-400">
                Pay to (active workers)
              </label>
              <select
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                value={wageLabourId}
                onChange={(e) => setWageLabourId(e.target.value)}
              >
                <option value="">— Not linked (e.g. outside contractor) —</option>
                {activeLabour.map((L) => (
                  <option key={L.id} value={String(L.id)}>
                    {L.full_name}
                    {L.personnel_kind === "owner_pay" ? " (owner pay)" : ""}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                If you select someone, a labour payment is created and their balance updates.
              </p>
            </div>
          ) : null}
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
                <th className="px-4 py-3">Worker</th>
                <th className="px-4 py-3">Link</th>
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
                    <td className="px-4 py-2 align-top text-xs text-zinc-400">—</td>
                    <td className="px-4 py-2 align-top text-xs text-zinc-400">—</td>
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
                    <td className="px-4 py-3 text-xs text-zinc-700 dark:text-zinc-300">
                      {r.linked_labour_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">
                      {r.labour_ledger_line_id != null ? (
                        <span className="rounded bg-violet-100 px-1.5 py-0.5 text-violet-900 dark:bg-violet-950/50 dark:text-violet-200">
                          Labour
                        </span>
                      ) : r.feed_inventory_id != null ? (
                        <span className="rounded bg-sky-100 px-1.5 py-0.5 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200">
                          Feed
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                        onClick={() => startEdit(r)}
                        disabled={expenseIsLinked(r)}
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
