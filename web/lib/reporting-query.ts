/** Query-string helpers for analytics / reporting APIs (matches backend `analytics_params`). */

export type Granularity = "day" | "week" | "month" | "quarter" | "half_year" | "year";

export type SummaryPeriodInput =
  | { kind: "days"; days: number }
  | { kind: "range"; start_date: string; end_date: string }
  | { kind: "start_only"; start_date: string }
  | { kind: "end_only"; end_date: string };

export function buildSummaryQuery(p: SummaryPeriodInput): string {
  const q = new URLSearchParams();
  if (p.kind === "days") {
    q.set("days", String(p.days));
  } else if (p.kind === "range") {
    q.set("start_date", p.start_date);
    q.set("end_date", p.end_date);
  } else if (p.kind === "start_only") {
    q.set("start_date", p.start_date);
  } else {
    q.set("end_date", p.end_date);
  }
  return q.toString();
}

export function buildSeriesQuery(
  period: SummaryPeriodInput,
  granularity: Granularity
): string {
  const q = new URLSearchParams(buildSummaryQuery(period));
  if (granularity !== "day") q.set("granularity", granularity);
  return q.toString();
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

/** Preset period definitions (local calendar). */
export const PERIOD_PRESETS = {
  last_7_days: (): SummaryPeriodInput => ({ kind: "days", days: 7 }),
  last_30_days: (): SummaryPeriodInput => ({ kind: "days", days: 30 }),
  last_90_days: (): SummaryPeriodInput => ({ kind: "days", days: 90 }),
  this_month: (): SummaryPeriodInput => {
    const t = new Date();
    return { kind: "range", start_date: iso(startOfMonth(t)), end_date: iso(t) };
  },
  last_month: (): SummaryPeriodInput => {
    const t = new Date();
    const first = startOfMonth(t);
    const end = new Date(first);
    end.setDate(0);
    const start = startOfMonth(end);
    return { kind: "range", start_date: iso(start), end_date: iso(end) };
  },
  this_quarter: (): SummaryPeriodInput => {
    const t = new Date();
    const m = t.getMonth();
    const qStartMonth = Math.floor(m / 3) * 3;
    const start = new Date(t.getFullYear(), qStartMonth, 1);
    return { kind: "range", start_date: iso(start), end_date: iso(t) };
  },
  last_quarter: (): SummaryPeriodInput => {
    const t = new Date();
    const m = t.getMonth();
    const q = Math.floor(m / 3);
    const prevQ = q === 0 ? 3 : q - 1;
    const year = q === 0 ? t.getFullYear() - 1 : t.getFullYear();
    const startM = prevQ * 3;
    const start = new Date(year, startM, 1);
    const end = new Date(year, startM + 3, 0);
    return { kind: "range", start_date: iso(start), end_date: iso(end) };
  },
  this_half: (): SummaryPeriodInput => {
    const t = new Date();
    const start =
      t.getMonth() < 6
        ? new Date(t.getFullYear(), 0, 1)
        : new Date(t.getFullYear(), 6, 1);
    return { kind: "range", start_date: iso(start), end_date: iso(t) };
  },
  last_half: (): SummaryPeriodInput => {
    const t = new Date();
    const thisHalfStart =
      t.getMonth() < 6
        ? new Date(t.getFullYear(), 0, 1)
        : new Date(t.getFullYear(), 6, 1);
    const end = new Date(thisHalfStart);
    end.setDate(end.getDate() - 1);
    const start =
      end.getMonth() < 6
        ? new Date(end.getFullYear(), 0, 1)
        : new Date(end.getFullYear(), 6, 1);
    return { kind: "range", start_date: iso(start), end_date: iso(end) };
  },
  this_year: (): SummaryPeriodInput => {
    const t = new Date();
    return {
      kind: "range",
      start_date: iso(new Date(t.getFullYear(), 0, 1)),
      end_date: iso(t),
    };
  },
  last_year: (): SummaryPeriodInput => {
    const y = new Date().getFullYear() - 1;
    return {
      kind: "range",
      start_date: iso(new Date(y, 0, 1)),
      end_date: iso(new Date(y, 11, 31)),
    };
  },
} as const;

export type PresetId = keyof typeof PERIOD_PRESETS;

export const GRANULARITY_OPTIONS: { value: Granularity; label: string }[] = [
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
  { value: "quarter", label: "Quarterly" },
  { value: "half_year", label: "Half-yearly" },
  { value: "year", label: "Yearly" },
];
