import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  TextInput,
} from "react-native";
import { useFarm } from "../lib/farm-context";
import { apiFetch, type Paginated, type ProfitSummaryOut } from "../lib/api";
import { withPagination } from "../lib/pagination";
import {
  buildSeriesQuery,
  buildSummaryQuery,
  GRANULARITY_OPTIONS,
  type Granularity,
  type SummaryPeriodInput,
} from "../lib/reporting-query";

const CHART_PAGE = 500;
const PERIOD_DAYS = [7, 14, 30, 90, 180, 365] as const;
const PERIOD_MODES = ["days", "range", "start_only", "end_only"] as const;

function periodModeLabel(mode: (typeof PERIOD_MODES)[number]): string {
  if (mode === "days") return "Days";
  if (mode === "range") return "Range";
  if (mode === "start_only") return "From";
  return "Until";
}

const fmtInr = (n: number) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "INR" }).format(n);

/** Same data as web analytics; charts replaced with scrollable lists + JSON for ML. */
export function AnalyticsScreen() {
  const { farmId } = useFarm();
  const [periodMode, setPeriodMode] = useState<(typeof PERIOD_MODES)[number]>("days");
  const [periodDays, setPeriodDays] = useState<number>(30);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [profit, setProfit] = useState<ProfitSummaryOut | null>(null);
  const [eggs, setEggs] = useState<
    { period_label: string; date: string; usable_eggs: number; trays: number }[]
  >([]);
  const [feed, setFeed] = useState<
    {
      period_label: string;
      date: string;
      feed_received: number;
      feed_used: number;
      feed_remaining: number;
    }[]
  >([]);
  const [dailyProfit, setDailyProfit] = useState<
    { period_label: string; date: string; revenue: number; expenses: number; profit: number }[]
  >([]);
  const [mlEgg, setMlEgg] = useState<unknown>(null);
  const [mlFeed, setMlFeed] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!farmId) return;
    if (periodMode === "range" && (!startDate || !endDate)) {
      setLoading(false);
      return;
    }
    if (periodMode === "start_only" && !startDate) {
      setLoading(false);
      return;
    }
    if (periodMode === "end_only" && !endDate) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setFailed(false);
    setLoading(true);
    (async () => {
      try {
        const period: SummaryPeriodInput =
          periodMode === "days"
            ? { kind: "days", days: periodDays }
            : periodMode === "range"
              ? { kind: "range", start_date: startDate, end_date: endDate }
              : periodMode === "start_only"
                ? { kind: "start_only", start_date: startDate }
                : { kind: "end_only", end_date: endDate };
        const sumQs = buildSummaryQuery(period);
        const seriesQs = buildSeriesQuery(period, granularity);
        const [e, f, p, d, me, mf] = await Promise.all([
          apiFetch<
            Paginated<{
              period_label: string;
              date: string;
              usable_eggs: number;
              broken_eggs: number;
              trays: number;
            }>
          >(withPagination(`/farms/${farmId}/analytics/eggs/daily?${seriesQs}`, CHART_PAGE, 0)),
          apiFetch<
            Paginated<{
              period_label: string;
              date: string;
              feed_received: number;
              feed_used: number;
              feed_remaining: number;
            }>
          >(withPagination(`/farms/${farmId}/analytics/feed/daily?${seriesQs}`, CHART_PAGE, 0)),
          apiFetch<ProfitSummaryOut>(`/farms/${farmId}/analytics/profit?${sumQs}`),
          apiFetch<
            Paginated<{
              period_label: string;
              date: string;
              revenue: number;
              expenses: number;
              profit: number;
            }>
          >(withPagination(`/farms/${farmId}/analytics/profit/daily?${seriesQs}`, CHART_PAGE, 0)),
          apiFetch(`/farms/${farmId}/ml/predict/eggs-next-week`),
          apiFetch(`/farms/${farmId}/ml/predict/feed-next-days?days=30`),
        ]);
        if (!cancelled) {
          setEggs(
            e.items.map((row) => ({
              period_label: row.period_label,
              date: row.date,
              usable_eggs: row.usable_eggs,
              trays: row.trays,
            }))
          );
          setFeed(
            f.items.map((row) => ({
              period_label: row.period_label,
              date: row.date,
              feed_received: row.feed_received,
              feed_used: row.feed_used,
              feed_remaining: row.feed_remaining,
            }))
          );
          setProfit(p);
          setDailyProfit(
            d.items.map((row) => ({
              period_label: row.period_label,
              date: row.date,
              revenue: row.revenue,
              expenses: row.expenses,
              profit: row.profit,
            }))
          );
          setMlEgg(me);
          setMlFeed(mf);
        }
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [farmId, tick, periodMode, periodDays, startDate, endDate, granularity]);

  if (!farmId) {
    return <Text style={styles.muted}>Select or create a farm in Settings.</Text>;
  }

  if (failed && !profit) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Analytics could not be loaded.</Text>
        <Pressable style={styles.retry} onPress={() => setTick((t) => t + 1)}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.wrap}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => setTick((t) => t + 1)} />
      }
    >
      {loading && !profit ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#047857" />
          <Text style={styles.muted}>Loading analytics…</Text>
        </View>
      ) : null}

      <Text style={styles.hint}>Period mode</Text>
      <View style={styles.chipRow}>
        {PERIOD_MODES.map((mode) => (
          <Pressable
            key={mode}
            style={[styles.chipSm, periodMode === mode && styles.chipOn]}
            onPress={() => setPeriodMode(mode)}
          >
            <Text style={[styles.chipTextSm, periodMode === mode && styles.chipTextOn]}>
              {periodModeLabel(mode)}
            </Text>
          </Pressable>
        ))}
      </View>

      {periodMode === "days" ? (
        <>
          <Text style={styles.hint}>Period (days)</Text>
          <View style={styles.chipRow}>
            {PERIOD_DAYS.map((d) => (
              <Pressable
                key={d}
                style={[styles.chip, periodDays === d && styles.chipOn]}
                onPress={() => setPeriodDays(d)}
              >
                <Text style={[styles.chipText, periodDays === d && styles.chipTextOn]}>
                  {d === 365 ? "1y" : d === 180 ? "6m" : d === 90 ? "90d" : `${d}d`}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      {periodMode === "range" || periodMode === "start_only" ? (
        <>
          <Text style={styles.hint}>Start date (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            value={startDate}
            onChangeText={setStartDate}
            autoCapitalize="none"
            placeholder="2026-01-01"
          />
        </>
      ) : null}

      {periodMode === "range" || periodMode === "end_only" ? (
        <>
          <Text style={styles.hint}>End date (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            value={endDate}
            onChangeText={setEndDate}
            autoCapitalize="none"
            placeholder="2026-12-31"
          />
        </>
      ) : null}
      <Text style={styles.hint}>Bucket</Text>
      <View style={styles.chipRow}>
        {GRANULARITY_OPTIONS.map((g) => (
          <Pressable
            key={g.value}
            style={[styles.chipSm, granularity === g.value && styles.chipOn]}
            onPress={() => setGranularity(g.value)}
          >
            <Text style={[styles.chipTextSm, granularity === g.value && styles.chipTextOn]}>
              {g.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {profit ? (
        <View style={styles.card}>
          <Text style={styles.h2}>
            Profit summary {profit.period_start} → {profit.period_end}
          </Text>
          <Text style={styles.line}>Revenue: {fmtInr(profit.revenue)}</Text>
          <Text style={styles.line}>Expenses: {fmtInr(profit.expenses)}</Text>
          <Text style={styles.profitLine}>Profit: {fmtInr(profit.profit)}</Text>
          <Text style={styles.sub}>
            Expense mix: log {fmtInr(profit.expense_breakdown.expense_entries)} · unlinked labour{" "}
            {fmtInr(profit.expense_breakdown.unlinked_labour_payments)} · feed rows{" "}
            {fmtInr(profit.expense_breakdown.feed_purchase_cost_on_entries)}
          </Text>
          {profit.cost_per_egg != null ? (
            <Text style={styles.sub}>Cost per egg (approx.): {fmtInr(profit.cost_per_egg)}</Text>
          ) : null}
        </View>
      ) : null}

      <Text style={styles.h2}>Eggs</Text>
      {eggs.map((row) => (
        <View key={row.date} style={styles.row}>
          <Text style={styles.rowMain}>{row.period_label || row.date}</Text>
          <Text style={styles.rowSub}>
            {row.usable_eggs} usable eggs · {row.trays} trays
          </Text>
        </View>
      ))}

      <Text style={styles.h2}>Feed</Text>
      {feed.map((row) => (
        <View key={row.date} style={styles.row}>
          <Text style={styles.rowMain}>{row.period_label || row.date}</Text>
          <Text style={styles.rowSub}>
            In {row.feed_received.toFixed(2)} · Used {row.feed_used.toFixed(2)} · Rem{" "}
            {row.feed_remaining.toFixed(2)} kg
          </Text>
        </View>
      ))}

      <Text style={styles.h2}>Profit by bucket</Text>
      {dailyProfit.map((row) => (
        <View key={row.date} style={styles.row}>
          <Text style={styles.rowMain}>{row.period_label || row.date}</Text>
          <Text style={styles.rowSub}>
            P/L {fmtInr(row.profit)} · Rev {fmtInr(row.revenue)} · Exp {fmtInr(row.expenses)}
          </Text>
        </View>
      ))}

      <Text style={styles.h2}>ML: eggs next week</Text>
      <Text style={styles.json}>{JSON.stringify(mlEgg, null, 2)}</Text>
      <Text style={styles.h2}>ML: feed next 30d</Text>
      <Text style={styles.json}>{JSON.stringify(mlFeed, null, 2)}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#fafafa", padding: 16, paddingBottom: 32 },
  center: { padding: 24, alignItems: "center" },
  muted: { color: "#71717a", marginTop: 8 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    padding: 16,
    marginBottom: 20,
  },
  hint: { fontSize: 12, color: "#71717a", marginTop: 8, marginBottom: 6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    backgroundColor: "#fff",
  },
  chipSm: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    backgroundColor: "#fff",
  },
  chipOn: { backgroundColor: "#ecfdf5", borderColor: "#6ee7b7" },
  chipText: { fontSize: 13, fontWeight: "600", color: "#3f3f46" },
  chipTextSm: { fontSize: 11, fontWeight: "600", color: "#3f3f46" },
  chipTextOn: { color: "#065f46" },
  input: {
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  h2: { fontSize: 17, fontWeight: "700", color: "#18181b", marginTop: 16, marginBottom: 10 },
  line: { fontSize: 15, color: "#3f3f46", marginTop: 6 },
  profitLine: { fontSize: 16, fontWeight: "700", color: "#047857", marginTop: 8 },
  sub: { fontSize: 13, color: "#71717a", marginTop: 8 },
  row: {
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    padding: 10,
    marginBottom: 6,
  },
  rowMain: { fontWeight: "600", color: "#18181b" },
  rowSub: { fontSize: 13, color: "#52525b", marginTop: 2 },
  json: {
    fontFamily: "monospace",
    fontSize: 11,
    color: "#52525b",
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e4e4e7",
  },
  retry: {
    marginTop: 16,
    backgroundColor: "#047857",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: { color: "#fff", fontWeight: "600" },
});
