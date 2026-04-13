import { useEffect, useMemo, useState } from "react";
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
import { useIsFocused } from "@react-navigation/native";
import { useFarm } from "../lib/farm-context";
import { apiFetch, type Paginated, type ProfitSummaryOut } from "../lib/api";
import { useAppTheme, type AppColors } from "../lib/theme";
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
  const isFocused = useIsFocused();
  const colors = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
    if (!isFocused) return;
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
  }, [isFocused, farmId, tick, periodMode, periodDays, startDate, endDate, granularity]);

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
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => setTick((t) => t + 1)} />
      }
    >
      <View style={styles.headerCard}>
        <Text style={styles.screenTitle}>Analytics</Text>
        <Text style={styles.screenSub}>Profit, eggs, feed and trends in one place</Text>
      </View>

      {loading && !profit ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#047857" />
          <Text style={styles.muted}>Loading analytics…</Text>
        </View>
      ) : null}

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Period & Bucket</Text>
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
      </View>

      {profit ? (
        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Revenue</Text>
            <Text style={styles.kpiValue}>{fmtInr(profit.revenue)}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Expenses</Text>
            <Text style={styles.kpiValue}>{fmtInr(profit.expenses)}</Text>
          </View>
          <View style={styles.kpiCardWide}>
            <Text style={styles.kpiLabel}>Profit</Text>
            <Text style={styles.kpiValueAccent}>{fmtInr(profit.profit)}</Text>
          </View>
        </View>
      ) : null}

      {profit ? (
        <View style={styles.sectionCard}>
          <Text style={styles.h2}>
            Profit summary {profit.period_start} → {profit.period_end}
          </Text>
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
      {eggs.map((row, i) => (
        <View key={`egg-${row.date}-${i}`} style={styles.compactRow}>
          <View style={styles.rowTop}>
            <View style={styles.recordHeadLeft}>
              <Text style={styles.recordTitle}>{row.period_label || row.date}</Text>
              <Text style={styles.recordDate}>{row.date}</Text>
            </View>
          </View>
          <View style={styles.recordStatsCompact}>
            <Text style={[styles.statInline, styles.accentText]}>U {row.usable_eggs}</Text>
            <Text style={styles.statInline}>T {row.trays}</Text>
          </View>
        </View>
      ))}

      <Text style={styles.h2}>Feed</Text>
      {feed.map((row, i) => (
        <View key={`feed-${row.date}-${i}`} style={styles.compactRow}>
          <View style={styles.rowTop}>
            <View style={styles.recordHeadLeft}>
              <Text style={styles.recordTitle}>{row.period_label || row.date}</Text>
              <Text style={styles.recordDate}>{row.date}</Text>
            </View>
          </View>
          <View style={styles.recordStatsCompact}>
            <Text style={styles.statInline}>In {row.feed_received.toFixed(2)}</Text>
            <Text style={styles.statInline}>U {row.feed_used.toFixed(2)}</Text>
            <Text style={[styles.statInline, styles.accentText]}>R {row.feed_remaining.toFixed(2)}</Text>
          </View>
        </View>
      ))}

      <Text style={styles.h2}>Profit by bucket</Text>
      {dailyProfit.map((row, i) => (
        <View key={`profit-${row.date}-${i}`} style={styles.compactRow}>
          <View style={styles.rowTop}>
            <View style={styles.recordHeadLeft}>
              <Text style={styles.recordTitle}>{row.period_label || row.date}</Text>
              <Text style={styles.recordDate}>{row.date}</Text>
            </View>
          </View>
          <View style={styles.recordStatsCompact}>
            <Text style={[styles.statInline, row.profit >= 0 ? styles.accentText : styles.warnText]}>
              P {fmtInr(row.profit)}
            </Text>
            <Text style={styles.statInline}>R {fmtInr(row.revenue)}</Text>
            <Text style={styles.statInline}>E {fmtInr(row.expenses)}</Text>
          </View>
        </View>
      ))}

      <Text style={styles.h2}>ML: eggs next week</Text>
      <Text style={styles.json}>{JSON.stringify(mlEgg, null, 2)}</Text>
      <Text style={styles.h2}>ML: feed next 30d</Text>
      <Text style={styles.json}>{JSON.stringify(mlFeed, null, 2)}</Text>
    </ScrollView>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32 },
  center: { padding: 24, alignItems: "center" },
  muted: { color: colors.textMuted, marginTop: 8 },

  headerCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  screenTitle: { fontSize: 24, fontWeight: "800", color: colors.text },
  screenSub: { fontSize: 13, color: colors.textMuted, marginTop: 4 },

  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 6 },

  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  kpiCard: {
    width: "48%",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 12,
  },
  kpiCardWide: {
    width: "100%",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 12,
  },
  kpiLabel: { fontSize: 11, color: colors.textMuted, textTransform: "uppercase", fontWeight: "700" },
  kpiValue: { fontSize: 18, fontWeight: "800", color: colors.text, marginTop: 4 },
  kpiValueAccent: { fontSize: 20, fontWeight: "800", color: colors.accent, marginTop: 4 },

  hint: { fontSize: 12, color: colors.textMuted, marginTop: 8, marginBottom: 6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSm: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.textSoft },
  chipTextSm: { fontSize: 11, fontWeight: "600", color: colors.textSoft },
  chipTextOn: { color: colors.accentText },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.inputBg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    color: colors.inputText,
  },
  h2: { fontSize: 17, fontWeight: "700", color: colors.textStrong, marginTop: 16, marginBottom: 10 },
  sub: { fontSize: 13, color: colors.textMuted, marginTop: 8 },
  compactRow: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  recordHeadLeft: { flex: 1, paddingRight: 8 },
  recordTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  recordDate: { fontSize: 11, color: colors.textMuted, fontWeight: "600", marginTop: 1 },
  recordStatsCompact: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
  },
  statInline: { fontSize: 12, fontWeight: "700", color: colors.inputText },
  accentText: { color: colors.accent },
  warnText: { color: colors.warning },
  json: {
    fontFamily: "monospace",
    fontSize: 11,
    color: colors.textSoft,
    backgroundColor: colors.surface,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retry: {
    marginTop: 16,
    backgroundColor: colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: { color: colors.inverseText, fontWeight: "600" },
});
