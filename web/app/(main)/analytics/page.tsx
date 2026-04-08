"use client";

import { useEffect, useState } from "react";
import { EggProductionChart } from "@/components/EggProductionChart";
import { FeedUsageChart } from "@/components/FeedUsageChart";
import { ProfitCard } from "@/components/ProfitCard";
import { useFarm } from "@/lib/farm-context";
import { useAsyncLoader } from "@/lib/loading-context";
import { apiFetch, type Paginated } from "@/lib/api";
import { toastError } from "@/lib/toast";
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

type EggPoint = { date: string; usable_eggs: number; trays: number };
type FeedPoint = {
  date: string;
  feed_received: number;
  feed_used: number;
  feed_remaining: number;
};

/** Large page size so charts get full series; API still paginates. */
const CHART_PAGE = 500;

export default function AnalyticsPage() {
  const { farmId } = useFarm();
  const runLoaded = useAsyncLoader();
  const [eggs, setEggs] = useState<EggPoint[]>([]);
  const [feed, setFeed] = useState<FeedPoint[]>([]);
  const [profit, setProfit] = useState<{
    revenue: number;
    expenses: number;
    profit: number;
    cost_per_egg: number | null;
  } | null>(null);
  const [dailyProfit, setDailyProfit] = useState<
    { date: string; revenue: number; expenses: number; profit: number }[]
  >([]);
  const [mlEgg, setMlEgg] = useState<unknown>(null);
  const [mlFeed, setMlFeed] = useState<unknown>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    if (!farmId) return;
    let cancelled = false;
    setLoadFailed(false);
    (async () => {
      try {
        await runLoaded(async () => {
          const [e, f, p, d, me, mf] = await Promise.all([
            apiFetch<
              Paginated<{
                date: string;
                usable_eggs: number;
                broken_eggs: number;
                trays: number;
              }>
            >(
              withPagination(
                `/farms/${farmId}/analytics/eggs/daily?days=14`,
                CHART_PAGE,
                0
              )
            ),
            apiFetch<
              Paginated<{
                date: string;
                feed_received: number;
                feed_used: number;
                feed_remaining: number;
              }>
            >(
              withPagination(
                `/farms/${farmId}/analytics/feed/daily?days=14`,
                CHART_PAGE,
                0
              )
            ),
            apiFetch<{
              revenue: number;
              expenses: number;
              profit: number;
              cost_per_egg: number | null;
            }>(`/farms/${farmId}/analytics/profit?days=30`),
            apiFetch<
              Paginated<{
                date: string;
                revenue: number;
                expenses: number;
                profit: number;
              }>
            >(
              withPagination(
                `/farms/${farmId}/analytics/profit/daily?days=30`,
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
                usable_eggs: row.usable_eggs,
                trays: row.trays,
              }))
            );
            setFeed(
              f.items.map((row) => ({
                date: row.date,
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
  }, [farmId, retryTick, runLoaded]);

  if (!farmId) {
    return <p className="text-zinc-500">Select a farm first.</p>;
  }

  if (loadFailed) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <p className="text-zinc-600">Analytics could not be loaded.</p>
        <button
          type="button"
          className="mt-4 rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
          onClick={() => setRetryTick((t) => t + 1)}
        >
          Try again
        </button>
      </div>
    );
  }

  if (!profit && !eggs.length && !feed.length) {
    return <p className="text-zinc-500">Loading analytics…</p>;
  }

  const profitChartData = dailyProfit.map((d) => ({
    ...d,
    label: d.date.slice(5),
  }));

  return (
    <div className="space-y-8">
      {profit && <ProfitCard {...profit} />}

      <div className="grid gap-6 lg:grid-cols-2">
        <EggProductionChart data={eggs} />
        <FeedUsageChart data={feed} />
      </div>

      <div className="h-80 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold text-zinc-800">Daily profit (30d)</h3>
        <ResponsiveContainer width="100%" height="90%">
          <LineChart data={profitChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="profit" stroke="#047857" name="Profit" dot={false} />
            <Line type="monotone" dataKey="revenue" stroke="#2563eb" name="Revenue" dot={false} />
            <Line type="monotone" dataKey="expenses" stroke="#dc2626" name="Expenses" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 sm:grid-cols-2">
        <div>
          <p className="font-semibold text-zinc-900">ML: eggs next week</p>
          <pre className="mt-2 overflow-x-auto rounded bg-white p-2 text-xs">
            {JSON.stringify(mlEgg, null, 2)}
          </pre>
        </div>
        <div>
          <p className="font-semibold text-zinc-900">ML: feed next 30d</p>
          <pre className="mt-2 overflow-x-auto rounded bg-white p-2 text-xs">
            {JSON.stringify(mlFeed, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
