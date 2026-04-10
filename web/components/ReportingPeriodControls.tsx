"use client";

import { useEffect, useState } from "react";
import {
  type Granularity,
  type PresetId,
  type SummaryPeriodInput,
  GRANULARITY_OPTIONS,
  PERIOD_PRESETS,
} from "@/lib/reporting-query";

const PRESET_LABELS: Record<PresetId, string> = {
  last_7_days: "Last 7 days",
  last_30_days: "Last 30 days",
  last_90_days: "Last 90 days",
  this_month: "This month",
  last_month: "Last month",
  this_quarter: "This quarter",
  last_quarter: "Last quarter",
  this_half: "This half-year",
  last_half: "Last half-year",
  this_year: "Year to date",
  last_year: "Last calendar year",
};

type Props = {
  period: SummaryPeriodInput;
  onPeriodChange: (p: SummaryPeriodInput) => void;
  showGranularity?: boolean;
  granularity?: Granularity;
  onGranularityChange?: (g: Granularity) => void;
};

export function ReportingPeriodControls({
  period,
  onPeriodChange,
  showGranularity = false,
  granularity = "day",
  onGranularityChange,
}: Props) {
  const [draftStart, setDraftStart] = useState("");
  const [draftEnd, setDraftEnd] = useState("");

  useEffect(() => {
    if (period.kind === "range") {
      setDraftStart(period.start_date);
      setDraftEnd(period.end_date);
    } else if (period.kind === "start_only") {
      setDraftStart(period.start_date);
      setDraftEnd("");
    } else if (period.kind === "end_only") {
      setDraftStart("");
      setDraftEnd(period.end_date);
    } else {
      setDraftStart("");
      setDraftEnd("");
    }
  }, [period]);

  function periodSelectKey(p: SummaryPeriodInput): string {
  if (p.kind === "days") return `d${p.days}`;
  if (p.kind === "range") return `r${p.start_date}_${p.end_date}`;
  if (p.kind === "start_only") return `s${p.start_date}`;
  return `e${p.end_date}`;
}

function applyCustomDates() {
    const s = draftStart.trim();
    const e = draftEnd.trim();
    if (s && e) {
      onPeriodChange({ kind: "range", start_date: s, end_date: e });
    } else if (s) {
      onPeriodChange({ kind: "start_only", start_date: s });
    } else if (e) {
      onPeriodChange({ kind: "end_only", end_date: e });
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[12rem] flex-1">
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Quick range
          </label>
          <select
            key={periodSelectKey(period)}
            defaultValue=""
            className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            onChange={(e) => {
              const id = e.target.value as PresetId;
              if (id && id in PERIOD_PRESETS) {
                onPeriodChange(PERIOD_PRESETS[id]());
              }
            }}
          >
            <option value="">Choose a preset…</option>
            {(Object.keys(PRESET_LABELS) as PresetId[]).map((id) => (
              <option key={id} value={id}>
                {PRESET_LABELS[id]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["last_7_days", "last_30_days", "last_90_days"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onPeriodChange(PERIOD_PRESETS[id]())}
              className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {id === "last_7_days" ? "7d" : id === "last_30_days" ? "30d" : "90d"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Start date (optional)
          </label>
          <input
            type="date"
            className="mt-1 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            value={draftStart}
            onChange={(e) => setDraftStart(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
            End date (optional)
          </label>
          <input
            type="date"
            className="mt-1 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            value={draftEnd}
            onChange={(e) => setDraftEnd(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={() => applyCustomDates()}
          className="rounded-md bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-900 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-white"
        >
          Apply dates
        </button>
        <p className="w-full text-xs text-zinc-500 dark:text-zinc-400">
          Leave both empty and use quick range, or set one or both: start only → through today; end
          only → last 30 days ending on that date; both → inclusive range (end capped at today).
        </p>
      </div>

      {showGranularity && onGranularityChange ? (
        <div className="border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Chart grouping
          </label>
          <select
            className="mt-1 max-w-xs rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            value={granularity}
            onChange={(e) => onGranularityChange(e.target.value as Granularity)}
          >
            {GRANULARITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  );
}
