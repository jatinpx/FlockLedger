import type { DashboardSummary } from "@/lib/api";

export function FarmSummary({ data }: { data: DashboardSummary }) {
  const t = data.tray_stock;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Birds
        </p>
        <p className="mt-2 text-3xl font-semibold text-zinc-900">
          {data.total_birds.toLocaleString()}
        </p>
      </div>
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          7d usable eggs
        </p>
        <p className="mt-2 text-3xl font-semibold text-zinc-900">
          {data.last_7_days_eggs.toLocaleString()}
        </p>
      </div>
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          7d trays (equiv.)
        </p>
        <p className="mt-2 text-3xl font-semibold text-zinc-900">
          {data.last_7_days_trays.toLocaleString()}
        </p>
      </div>
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Tray stock (derived)
        </p>
        <p className="mt-2 text-2xl font-semibold text-emerald-800">
          {t.trays_in_stock.toLocaleString()}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Produced equiv. {t.trays_produced_equivalent} · Sold {t.trays_sold}
        </p>
      </div>
    </div>
  );
}
