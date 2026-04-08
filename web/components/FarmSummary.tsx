import type { DashboardSummary } from "@/lib/api";

const fmtInr = (n: number) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "INR" }).format(n);

export function FarmSummary({ data }: { data: DashboardSummary }) {
  const t = data.tray_stock;
  const labourDue = data.labour_due_total ?? 0;
  const mort = data.flock_mortality_total ?? 0;
  const added = data.flock_birds_added_total ?? 0;
  const removed = data.flock_birds_removed_total ?? 0;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Birds
          </p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
            {data.total_birds.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            7d usable eggs
          </p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
            {data.last_7_days_eggs.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            7d trays (equiv.)
          </p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
            {data.last_7_days_trays.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Tray stock (derived)
          </p>
          <p className="mt-2 text-2xl font-semibold text-emerald-800 dark:text-emerald-400">
            {t.trays_in_stock.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Produced equiv. {t.trays_produced_equivalent} · Sold {t.trays_sold}
          </p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Labour due (est.)
          </p>
          <p className="mt-2 text-2xl font-semibold text-amber-800 dark:text-amber-400">{fmtInr(labourDue)}</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Sum of positive balances owed</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Mortality logged
          </p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900 dark:text-zinc-100">{mort.toLocaleString()}</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Birds (flock events)</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Flock removals
          </p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900 dark:text-zinc-100">{removed.toLocaleString()}</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Mortality, cull, sale, transfer out</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Flock additions
          </p>
          <p className="mt-2 text-3xl font-semibold text-emerald-800 dark:text-emerald-400">{added.toLocaleString()}</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Purchase & transfer in</p>
        </div>
      </div>
    </div>
  );
}
