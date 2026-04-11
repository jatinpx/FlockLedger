import type { ProfitExpenseBreakdown } from "@/lib/api";

export function ProfitCard(props: {
  revenue: number;
  expenses: number;
  profit: number;
  cost_per_egg: number | null;
  periodLabel?: string;
  expenseBreakdown?: ProfitExpenseBreakdown | null;
}) {
  const fmt = (n: number) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: "INR" }).format(
      n
    );
  const br = props.expenseBreakdown;
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        {props.periodLabel ?? "Profit summary"}
      </h2>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Expenses include the expense log plus labour and feed costs that are not yet linked there
        (no double counting).
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs uppercase text-zinc-500 dark:text-zinc-400">Revenue</p>
          <p className="text-xl font-medium text-zinc-900 dark:text-zinc-100">{fmt(props.revenue)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-zinc-500 dark:text-zinc-400">Expenses</p>
          <p className="text-xl font-medium text-zinc-900 dark:text-zinc-100">{fmt(props.expenses)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-zinc-500 dark:text-zinc-400">Profit</p>
          <p className="text-xl font-medium text-emerald-800 dark:text-emerald-400">{fmt(props.profit)}</p>
        </div>
      </div>
      {br ? (
        <ul className="mt-4 space-y-1 border-t border-zinc-100 pt-4 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          <li className="flex justify-between gap-4">
            <span>Expense log (incl. linked labour payments)</span>
            <span className="shrink-0 font-medium text-zinc-800 dark:text-zinc-200">
              {fmt(br.expense_entries)}
            </span>
          </li>
          <li className="flex justify-between gap-4">
            <span>Labour payments (not in log)</span>
            <span className="shrink-0 font-medium text-zinc-800 dark:text-zinc-200">
              {fmt(br.unlinked_labour_payments)}
            </span>
          </li>
          <li className="flex justify-between gap-4">
            <span>Feed purchase cost (not in log)</span>
            <span className="shrink-0 font-medium text-zinc-800 dark:text-zinc-200">
              {fmt(br.feed_purchase_cost_on_entries)}
            </span>
          </li>
        </ul>
      ) : null}
      {props.cost_per_egg != null && (
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          Cost per egg (approx.): {fmt(props.cost_per_egg)}
        </p>
      )}
    </div>
  );
}
