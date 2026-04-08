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
import {
  apiFetch,
  getApiBase,
  getToken,
  type DashboardSummary,
  type ProfitSummaryOut,
} from "../lib/api";

const PERIOD_OPTIONS = [7, 30, 90, 180, 365] as const;

export function DashboardScreen() {
  const { farmId } = useFarm();
  const [periodDays, setPeriodDays] = useState<number>(30);
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [profit, setProfit] = useState<ProfitSummaryOut | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState<string | null>(null);

  useEffect(() => {
    if (!farmId) return;
    let cancelled = false;
    setData(null);
    setProfit(null);
    setLoadFailed(false);
    setLoading(true);
    (async () => {
      try {
        const qs = `days=${periodDays}`;
        const [dash, p] = await Promise.all([
          apiFetch<DashboardSummary>(`/farms/${farmId}/analytics/dashboard?${qs}`),
          apiFetch<ProfitSummaryOut>(`/farms/${farmId}/analytics/profit?${qs}`),
        ]);
        if (!cancelled) {
          setData(dash);
          setProfit(p);
        }
      } catch {
        if (!cancelled) setLoadFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [farmId, retryTick, periodDays]);

  useEffect(() => {
    if (!farmId) return;
    let ws: WebSocket | null = null;
    (async () => {
      const token = await getToken();
      if (!token) return;
      const base = getApiBase().replace(/^http/, "ws");
      const url = `${base}/ws/farms/${farmId}?token=${encodeURIComponent(token)}`;
      try {
        ws = new WebSocket(url);
      } catch {
        return;
      }
      ws.onmessage = (ev) => setLive(String(ev.data));
      ws.onerror = () => {};
    })();
    return () => {
      ws?.close();
    };
  }, [farmId]);

  if (!farmId) {
    return (
      <Text style={styles.muted}>Create a farm under Settings, or ask an owner to add you.</Text>
    );
  }

  if (loadFailed && !data) {
    return (
      <View style={styles.card}>
        <Text style={styles.muted}>The dashboard could not be loaded.</Text>
        <Pressable style={styles.retry} onPress={() => setRetryTick((t) => t + 1)}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  if (!data && loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#047857" />
        <Text style={styles.muted}>Loading dashboard…</Text>
      </View>
    );
  }

  if (!data) {
    return <Text style={styles.muted}>No data</Text>;
  }

  const t = data.tray_stock;
  const fmtInr = (n: number) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: "INR" }).format(n);
  const labourDue = data.labour_due_total ?? 0;
  const mort = data.flock_mortality_total ?? 0;
  const flockOut = data.flock_birds_removed_total ?? 0;
  const flockIn = data.flock_birds_added_total ?? 0;

  return (
    <ScrollView
      style={styles.wrap}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => setRetryTick((x) => x + 1)}
        />
      }
    >
      {live ? (
        <View style={styles.live}>
          <Text style={styles.liveText}>Live: {live}</Text>
        </View>
      ) : null}

      <Text style={styles.periodHint}>Dashboard period (tap to change)</Text>
      <View style={styles.periodRow}>
        {PERIOD_OPTIONS.map((d) => (
          <Pressable
            key={d}
            style={[styles.periodChip, periodDays === d && styles.periodChipOn]}
            onPress={() => setPeriodDays(d)}
          >
            <Text style={[styles.periodChipText, periodDays === d && styles.periodChipTextOn]}>
              {d === 365 ? "1y" : d === 180 ? "6m" : `${d}d`}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.grid}>
        <View style={styles.tile}>
          <Text style={styles.tileLabel}>Birds</Text>
          <Text style={styles.tileVal}>{data.total_birds.toLocaleString()}</Text>
        </View>
        <View style={styles.tile}>
          <Text style={styles.tileLabel}>Period eggs</Text>
          <Text style={styles.tileVal}>{data.period_usable_eggs.toLocaleString()}</Text>
          <Text style={styles.tileSub}>
            {data.period_start} → {data.period_end}
          </Text>
        </View>
        <View style={styles.tile}>
          <Text style={styles.tileLabel}>Period trays</Text>
          <Text style={styles.tileVal}>{data.period_trays.toLocaleString()}</Text>
        </View>
        <View style={styles.tileWide}>
          <Text style={styles.tileLabel}>Tray stock (derived)</Text>
          <Text style={styles.tileValEm}>{t.trays_in_stock.toLocaleString()}</Text>
          <Text style={styles.tileSub}>
            Produced equiv. {t.trays_produced_equivalent} · Sold {t.trays_sold}
          </Text>
        </View>
      </View>

      <View style={styles.grid}>
        <View style={styles.tileWide}>
          <Text style={styles.tileLabel}>Labour due (est.)</Text>
          <Text style={[styles.tileVal, { color: "#b45309", fontSize: 22 }]}>{fmtInr(labourDue)}</Text>
        </View>
        <View style={styles.tile}>
          <Text style={styles.tileLabel}>Flock mortality</Text>
          <Text style={styles.tileVal}>{mort.toLocaleString()}</Text>
        </View>
        <View style={styles.tile}>
          <Text style={styles.tileLabel}>Flock removals</Text>
          <Text style={styles.tileVal}>{flockOut.toLocaleString()}</Text>
        </View>
        <View style={styles.tile}>
          <Text style={styles.tileLabel}>Flock additions</Text>
          <Text style={styles.tileValEm}>{flockIn.toLocaleString()}</Text>
        </View>
      </View>

      {profit ? (
        <View style={styles.card}>
          <Text style={styles.h2}>
            Profit {profit.period_start} → {profit.period_end}
          </Text>
          <View style={styles.profitRow}>
            <View style={styles.profitCol}>
              <Text style={styles.profitLabel}>Revenue</Text>
              <Text style={styles.profitVal}>
                {new Intl.NumberFormat(undefined, { style: "currency", currency: "INR" }).format(
                  profit.revenue
                )}
              </Text>
            </View>
            <View style={styles.profitCol}>
              <Text style={styles.profitLabel}>Expenses</Text>
              <Text style={styles.profitVal}>
                {new Intl.NumberFormat(undefined, { style: "currency", currency: "INR" }).format(
                  profit.expenses
                )}
              </Text>
            </View>
            <View style={styles.profitCol}>
              <Text style={styles.profitLabel}>Profit</Text>
              <Text style={[styles.profitVal, styles.profitHighlight]}>
                {new Intl.NumberFormat(undefined, { style: "currency", currency: "INR" }).format(
                  profit.profit
                )}
              </Text>
            </View>
          </View>
          <Text style={styles.costEgg}>
            P&amp;L expense mix: log {fmtInr(profit.expense_breakdown.expense_entries)} · labour
            (not in log) {fmtInr(profit.expense_breakdown.unlinked_labour_payments)} · feed purchase
            on entries {fmtInr(profit.expense_breakdown.feed_purchase_cost_on_entries)}
          </Text>
          {profit.cost_per_egg != null ? (
            <Text style={styles.costEgg}>
              Cost per egg (approx.):{" "}
              {new Intl.NumberFormat(undefined, { style: "currency", currency: "INR" }).format(
                profit.cost_per_egg
              )}
            </Text>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#fafafa", padding: 16 },
  periodHint: { fontSize: 12, color: "#71717a", marginBottom: 8 },
  periodRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  periodChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    backgroundColor: "#fff",
  },
  periodChipOn: { backgroundColor: "#ecfdf5", borderColor: "#6ee7b7" },
  periodChipText: { fontSize: 13, fontWeight: "600", color: "#3f3f46" },
  periodChipTextOn: { color: "#065f46" },
  center: { padding: 48, alignItems: "center" },
  muted: { padding: 16, color: "#71717a" },
  live: {
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  liveText: { fontSize: 12, color: "#065f46" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: {
    width: "47%",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    padding: 16,
  },
  tileWide: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    padding: 16,
  },
  tileLabel: { fontSize: 11, fontWeight: "600", color: "#71717a", textTransform: "uppercase" },
  tileVal: { fontSize: 28, fontWeight: "600", color: "#18181b", marginTop: 8 },
  tileValEm: { fontSize: 24, fontWeight: "600", color: "#065f46", marginTop: 8 },
  tileSub: { fontSize: 12, color: "#71717a", marginTop: 6 },
  card: {
    marginTop: 20,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    padding: 16,
  },
  h2: { fontSize: 17, fontWeight: "700", color: "#18181b", marginBottom: 12 },
  profitRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  profitCol: { minWidth: "28%", flex: 1 },
  profitLabel: { fontSize: 11, color: "#71717a", textTransform: "uppercase" },
  profitVal: { fontSize: 18, fontWeight: "600", color: "#18181b", marginTop: 4 },
  profitHighlight: { color: "#065f46" },
  costEgg: { marginTop: 12, fontSize: 13, color: "#52525b" },
  retry: {
    marginTop: 16,
    alignSelf: "center",
    backgroundColor: "#047857",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: { color: "#fff", fontWeight: "600" },
});
