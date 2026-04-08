import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { useFarm } from "../lib/farm-context";
import { apiFetch, type Paginated } from "../lib/api";
import { withPagination } from "../lib/pagination";

const CHART_PAGE = 500;

const fmtInr = (n: number) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "INR" }).format(n);

/** Same data as web analytics; charts replaced with scrollable lists + JSON for ML. */
export function AnalyticsScreen() {
  const { farmId } = useFarm();
  const [profit, setProfit] = useState<{
    revenue: number;
    expenses: number;
    profit: number;
    cost_per_egg: number | null;
  } | null>(null);
  const [eggs, setEggs] = useState<
    { date: string; usable_eggs: number; trays: number }[]
  >([]);
  const [feed, setFeed] = useState<
    { date: string; feed_received: number; feed_used: number; feed_remaining: number }[]
  >([]);
  const [dailyProfit, setDailyProfit] = useState<
    { date: string; revenue: number; expenses: number; profit: number }[]
  >([]);
  const [mlEgg, setMlEgg] = useState<unknown>(null);
  const [mlFeed, setMlFeed] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!farmId) return;
    let cancelled = false;
    setFailed(false);
    setLoading(true);
    (async () => {
      try {
        const [e, f, p, d, me, mf] = await Promise.all([
          apiFetch<
            Paginated<{ date: string; usable_eggs: number; broken_eggs: number; trays: number }>
          >(withPagination(`/farms/${farmId}/analytics/eggs/daily?days=14`, CHART_PAGE, 0)),
          apiFetch<
            Paginated<{
              date: string;
              feed_received: number;
              feed_used: number;
              feed_remaining: number;
            }>
          >(withPagination(`/farms/${farmId}/analytics/feed/daily?days=14`, CHART_PAGE, 0)),
          apiFetch<{
            revenue: number;
            expenses: number;
            profit: number;
            cost_per_egg: number | null;
          }>(`/farms/${farmId}/analytics/profit?days=30`),
          apiFetch<
            Paginated<{ date: string; revenue: number; expenses: number; profit: number }>
          >(
            withPagination(`/farms/${farmId}/analytics/profit/daily?days=30`, CHART_PAGE, 0)
          ),
          apiFetch(`/farms/${farmId}/ml/predict/eggs-next-week`),
          apiFetch(`/farms/${farmId}/ml/predict/feed-next-days?days=30`),
        ]);
        if (!cancelled) {
          setEggs(e.items.map((row) => ({ date: row.date, usable_eggs: row.usable_eggs, trays: row.trays })));
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
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [farmId, tick]);

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

      {profit ? (
        <View style={styles.card}>
          <Text style={styles.h2}>Last 30 days</Text>
          <Text style={styles.line}>Revenue: {fmtInr(profit.revenue)}</Text>
          <Text style={styles.line}>Expenses: {fmtInr(profit.expenses)}</Text>
          <Text style={styles.profitLine}>Profit: {fmtInr(profit.profit)}</Text>
          {profit.cost_per_egg != null ? (
            <Text style={styles.sub}>Cost per egg (approx.): {fmtInr(profit.cost_per_egg)}</Text>
          ) : null}
        </View>
      ) : null}

      <Text style={styles.h2}>Eggs (14d daily)</Text>
      {eggs.map((row) => (
        <View key={row.date} style={styles.row}>
          <Text style={styles.rowMain}>{row.date}</Text>
          <Text style={styles.rowSub}>
            {row.usable_eggs} usable eggs · {row.trays} trays
          </Text>
        </View>
      ))}

      <Text style={styles.h2}>Feed (14d daily)</Text>
      {feed.map((row) => (
        <View key={row.date} style={styles.row}>
          <Text style={styles.rowMain}>{row.date}</Text>
          <Text style={styles.rowSub}>
            In {row.feed_received.toFixed(2)} · Used {row.feed_used.toFixed(2)} · Rem{" "}
            {row.feed_remaining.toFixed(2)} kg
          </Text>
        </View>
      ))}

      <Text style={styles.h2}>Daily profit (30d)</Text>
      {dailyProfit.map((row) => (
        <View key={row.date} style={styles.row}>
          <Text style={styles.rowMain}>{row.date}</Text>
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
