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
import { useChartPalette } from "@/lib/theme-context";

type Point = { date: string; usable_eggs: number; trays: number };

export function EggProductionChart({ data }: { data: Point[] }) {
  const pal = useChartPalette();
  const chartData = data.map((d) => ({
    ...d,
    label: d.date.slice(5),
  }));
  return (
    <div className="h-72 w-full rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="mb-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
        Egg production (usable)
      </h3>
      <ResponsiveContainer width="100%" height="90%">
        <LineChart data={chartData}>
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
          <Line
            type="monotone"
            dataKey="usable_eggs"
            stroke={pal.primary}
            strokeWidth={2}
            dot={false}
            name="Usable eggs"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
