/** Query-string helpers for analytics APIs (matches backend `analytics_params`). */

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

export function buildSeriesQuery(period: SummaryPeriodInput, granularity: Granularity): string {
  const q = new URLSearchParams(buildSummaryQuery(period));
  if (granularity !== "day") q.set("granularity", granularity);
  return q.toString();
}

export const GRANULARITY_OPTIONS: { value: Granularity; label: string }[] = [
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
  { value: "quarter", label: "Quarterly" },
  { value: "half_year", label: "Half-yearly" },
  { value: "year", label: "Yearly" },
];
