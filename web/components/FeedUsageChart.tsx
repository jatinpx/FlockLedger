"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = {
  date: string;
  feed_received: number;
  feed_used: number;
  feed_remaining: number;
};

export function FeedUsageChart({ data }: { data: Point[] }) {
  const chartData = data.map((d) => ({
    ...d,
    label: d.date.slice(5),
  }));
  return (
    <div className="h-72 w-full rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h3 className="mb-2 text-sm font-semibold text-zinc-800">Feed used (kg)</h3>
      <ResponsiveContainer width="100%" height="90%">
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#71717a" />
          <YAxis tick={{ fontSize: 11 }} stroke="#71717a" />
          <Tooltip />
          <Bar dataKey="feed_used" fill="#0d9488" name="Used (kg)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
