"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = { date: string; usable_eggs: number; trays: number };

export function EggProductionChart({ data }: { data: Point[] }) {
  const chartData = data.map((d) => ({
    ...d,
    label: d.date.slice(5),
  }));
  return (
    <div className="h-72 w-full rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h3 className="mb-2 text-sm font-semibold text-zinc-800">Egg production (usable)</h3>
      <ResponsiveContainer width="100%" height="90%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#71717a" />
          <YAxis tick={{ fontSize: 11 }} stroke="#71717a" />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="usable_eggs"
            stroke="#047857"
            strokeWidth={2}
            dot={false}
            name="Usable eggs"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
