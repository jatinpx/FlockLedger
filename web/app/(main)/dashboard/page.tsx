"use client";

import { useEffect, useState } from "react";
import { FarmSummary } from "@/components/FarmSummary";
import { ProfitCard } from "@/components/ProfitCard";
import { ReportingPeriodControls } from "@/components/ReportingPeriodControls";
import { useFarm } from "@/lib/farm-context";
import { useAsyncLoader } from "@/lib/loading-context";
import {
  apiFetch,
  getApiBase,
  getToken,
  type DashboardSummary,
  type ProfitSummaryOut,
} from "@/lib/api";
import { toastError } from "@/lib/toast";
import { buildSummaryQuery, type SummaryPeriodInput } from "@/lib/reporting-query";

const DEFAULT_PERIOD: SummaryPeriodInput = { kind: "days", days: 30 };

export default function DashboardPage() {
  const { farmId } = useFarm();
  const runLoaded = useAsyncLoader();
  const [period, setPeriod] = useState<SummaryPeriodInput>(DEFAULT_PERIOD);
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [profit, setProfit] = useState<ProfitSummaryOut | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const [live, setLive] = useState<string | null>(null);

  useEffect(() => {
    if (!farmId) return;
    let cancelled = false;
    setData(null);
    setProfit(null);
    setLoadFailed(false);
    const qs = buildSummaryQuery(period);
    (async () => {
      try {
        await runLoaded(async () => {
          const [dash, p] = await Promise.all([
            apiFetch<DashboardSummary>(`/farms/${farmId}/analytics/dashboard?${qs}`),
            apiFetch<ProfitSummaryOut>(`/farms/${farmId}/analytics/profit?${qs}`),
          ]);
          if (!cancelled) {
            setData(dash);
            setProfit(p);
          }
        });
      } catch (e) {
        if (!cancelled) {
          toastError(e);
          setLoadFailed(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [farmId, retryTick, period]);

  useEffect(() => {
    if (!farmId || typeof window === "undefined") return;
    const token = getToken();
    if (!token) return;
    const base = getApiBase().replace(/^http/, "ws");
    const url = `${base}/ws/farms/${farmId}?token=${encodeURIComponent(token)}`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      return;
    }
    ws.onmessage = (ev) => {
      setLive(String(ev.data));
    };
    ws.onerror = () => {};
    return () => {
      ws.close();
    };
  }, [farmId]);

  if (!farmId) {
    return (
      <p className="text-zinc-500 dark:text-zinc-400">
        Create a farm under Settings, or ask an owner to add you.
      </p>
    );
  }

  if (loadFailed && !data) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-zinc-600 dark:text-zinc-400">The dashboard could not be loaded.</p>
        <button
          type="button"
          className="mt-4 rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          onClick={() => setRetryTick((t) => t + 1)}
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data) {
    return <p className="text-zinc-500 dark:text-zinc-400">Loading dashboard…</p>;
  }

  return (
    <div className="space-y-8">
      <ReportingPeriodControls period={period} onPeriodChange={setPeriod} />

      {live && (
        <p className="rounded-md border border-emerald-100 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-400">
          Live: {live}
        </p>
      )}
      <FarmSummary data={data} />
      {profit && (
        <ProfitCard
          revenue={profit.revenue}
          expenses={profit.expenses}
          profit={profit.profit}
          cost_per_egg={profit.cost_per_egg}
          periodLabel={`${profit.period_start} → ${profit.period_end}`}
          expenseBreakdown={profit.expense_breakdown}
        />
      )}
    </div>
  );
}
