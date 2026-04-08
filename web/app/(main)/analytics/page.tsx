"use client";

import { useEffect, useState } from "react";
import { EggProductionChart } from "@/components/EggProductionChart";
import { FeedUsageChart } from "@/components/FeedUsageChart";
import { ProfitCard } from "@/components/ProfitCard";
import { ReportingPeriodControls } from "@/components/ReportingPeriodControls";
import { useFarm } from "@/lib/farm-context";
import { useAsyncLoader } from "@/lib/loading-context";
import {
  apiFetch,
  type Paginated,
  type ProfitSummaryOut,
} from "@/lib/api";
import { toastError } from "@/lib/toast";
import { useChartPalette } from "@/lib/theme-context";
import { withPagination } from "@/components/PaginationFooter";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  buildSeriesQuery,
  buildSummaryQuery,
  type Granularity,
  type SummaryPeriodInput,
} from "@/lib/reporting-query";

const CHART_PAGE = 500;

const DEFAULT_PERIOD: SummaryPeriodInput = { kind: "days", days: 30 };

type EggPoint = {
  date: string;
  period_label?: string;
  usable_eggs: number;
  trays: number;
};
type FeedPoint = {
  date: string;
  period_label?: string;
  feed_received: number;
  feed_used: number;
  feed_remaining: number;
};

export default function AnalyticsPage() {
  const pal = useChartPalette();
  const { farmId } = useFarm();
  const runLoaded = useAsyncLoader();
  const [period, setPeriod] = useState<SummaryPeriodInput>(DEFAULT_PERIOD);
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [eggs, setEggs] = useState<EggPoint[]>([]);
  const [feed, setFeed] = useState<FeedPoint[]>([]);
  const [profit, setProfit] = useState<ProfitSummaryOut | null>(null);
  const [dailyProfit, setDailyProfit] = useState<
    { date: string; period_label?: string; revenue: number; expenses: number; profit: number }[]
  >([]);
  const [mlEgg, setMlEgg] = useState<unknown>(null);
  const [mlFeed, setMlFeed] = useState<unknown>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    if (!farmId) return;
    let cancelled = false;
    setLoadFailed(false);
    const sumQs = buildSummaryQuery(period);
    const seriesQs = buildSeriesQuery(period, granularity);
    (async () => {
      try {
        await runLoaded(async () => {
          const [e, f, p, d, me, mf] = await Promise.all([
            apiFetch<
              Paginated<{
                date: string;
                period_label: string;
                usable_eggs: number;
                broken_eggs: number;
                trays: number;
              }>
            >(
              withPagination(
                `/farms/${farmId}/analytics/eggs/daily?${seriesQs}`,
                CHART_PAGE,
                0
              )
            ),
            apiFetch<
              Paginated<{
                date: string;
                period_label: string;
                feed_received: number;
                feed_used: number;
                feed_remaining: number;
              }>
            >(
              withPagination(
                `/farms/${farmId}/analytics/feed/daily?${seriesQs}`,
                CHART_PAGE,
                0
              )
            ),
            apiFetch<ProfitSummaryOut>(`/farms/${farmId}/analytics/profit?${sumQs}`),
            apiFetch<
              Paginated<{
                date: string;
                period_label: string;
                revenue: number;
                expenses: number;
                profit: number;
              }>
            >(
              withPagination(
                `/farms/${farmId}/analytics/profit/daily?${seriesQs}`,
                CHART_PAGE,
                0
              )
            ),
            apiFetch(`/farms/${farmId}/ml/predict/eggs-next-week`),
            apiFetch(`/farms/${farmId}/ml/predict/feed-next-days?days=30`),
          ]);
          if (!cancelled) {
            setEggs(
              e.items.map((row) => ({
                date: row.date,
                period_label: row.period_label,
                usable_eggs: row.usable_eggs,
                trays: row.trays,
              }))
            );
            setFeed(
              f.items.map((row) => ({
                date: row.date,
                period_label: row.period_label,
                feed_received: row.feed_received,
                feed_used: row.feed_used,
                feed_remaining: row.feed_remaining,
              }))
            );
            setProfit(p);
            setDailyProfit(d.items);
            setMlEgg(me);
            setMlFeed(mf);
          }
        });
      } catch (err) {
        if (!cancelled) {
          toastError(err);
          setLoadFailed(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [farmId, retryTick, period, granularity]);

  if (!farmId) {
    return <p className="text-zinc-500 dark:text-zinc-400">Select a farm first.</p>;
  }

  if (loadFailed) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-zinc-600 dark:text-zinc-400">Analytics could not be loaded.</p>
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

  if (!profit && !eggs.length && !feed.length) {
    return <p className="text-zinc-500 dark:text-zinc-400">Loading analytics…</p>;
  }

  const profitChartData = dailyProfit.map((d) => ({
    ...d,
    label: d.period_label ?? d.date.slice(5),
  }));

  const granLabel =
    granularity === "day"
      ? "daily"
      : granularity === "week"
        ? "weekly"
        : granularity === "month"
          ? "monthly"
          : granularity === "quarter"
            ? "quarterly"
            : granularity === "half_year"
              ? "half-yearly"
              : "yearly";

  return (
    <div className="space-y-8">
      <ReportingPeriodControls
        period={period}
        onPeriodChange={setPeriod}
        showGranularity
        granularity={granularity}
        onGranularityChange={setGranularity}
      />

      {profit && (
        <ProfitCard
          revenue={profit.revenue}
          expenses={profit.expenses}
          profit={profit.profit}
          cost_per_egg={profit.cost_per_egg}
          periodLabel={`${profit.period_start} → ${profit.period_end}`}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <EggProductionChart data={eggs} />
        <FeedUsageChart data={feed} />
      </div>

      <div className="h-80 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="mb-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          Profit ({granLabel} buckets)
        </h3>
        <ResponsiveContainer width="100%" height="90%">
          <LineChart data={profitChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={pal.grid} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: pal.axis }} stroke={pal.axis} />
            <YAxis tick={{ fontSize: 11, fill: pal.axis }} stroke={pal.axis} />
            <Tooltip
              contentStyle={{
                backgroundColor: pal.tooltipBg,
                border: `1px solid ${pal.tooltipBorder}`,
                borderRadius: "8px",
                color: pal.tooltipColor,
              }}
            />
            <Legend />
            <Line type="monotone" dataKey="profit" stroke={pal.primary} name="Profit" dot={false} />
            <Line type="monotone" dataKey="revenue" stroke="#2563eb" name="Revenue" dot={false} />
            <Line type="monotone" dataKey="expenses" stroke="#dc2626" name="Expenses" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 sm:grid-cols-2">
        <div>
          <p className="font-semibold text-zinc-900 dark:text-zinc-100">ML: eggs next week</p>
          <pre className="mt-2 overflow-x-auto rounded border border-zinc-200 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
            {JSON.stringify(mlEgg, null, 2)}
          </pre>
        </div>
        <div>
          <p className="font-semibold text-zinc-900 dark:text-zinc-100">ML: feed next 30d</p>
          <pre className="mt-2 overflow-x-auto rounded border border-zinc-200 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
            {JSON.stringify(mlFeed, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
