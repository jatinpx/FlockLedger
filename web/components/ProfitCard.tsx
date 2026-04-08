export function ProfitCard(props: {
  revenue: number;
  expenses: number;
  profit: number;
  cost_per_egg: number | null;
  periodLabel?: string;
}) {
  const fmt = (n: number) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: "INR" }).format(
      n
    );
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        {props.periodLabel ?? "Profit summary"}
      </h2>
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
      {props.cost_per_egg != null && (
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          Cost per egg (approx.): {fmt(props.cost_per_egg)}
        </p>
      )}
    </div>
  );
}
