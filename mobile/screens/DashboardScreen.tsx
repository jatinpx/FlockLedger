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
import {
  apiFetch,
  getApiBase,
  getToken,
  type DashboardSummary,
  type ProfitSummaryOut,
} from "../lib/api";
import { useAppTheme, type AppColors } from "../lib/theme";
import { buildSummaryQuery, type SummaryPeriodInput } from "../lib/reporting-query";

const PERIOD_OPTIONS = [7, 30, 90, 180, 365] as const;
const PERIOD_MODES = ["days", "range", "start_only", "end_only"] as const;

function periodModeLabel(mode: (typeof PERIOD_MODES)[number]): string {
  if (mode === "days") return "Days";
  if (mode === "range") return "Range";
  if (mode === "start_only") return "From";
  return "Until";
}
export function DashboardScreen() {
  const { farmId } = useFarm();
  const isFocused = useIsFocused();
  const colors = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [periodMode, setPeriodMode] = useState<(typeof PERIOD_MODES)[number]>("days");
  const [periodDays, setPeriodDays] = useState<number>(30);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [profit, setProfit] = useState<ProfitSummaryOut | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState<string | null>(null);

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
    setData(null);
    setProfit(null);
    setLoadFailed(false);
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
        const qs = buildSummaryQuery(period);
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
  }, [isFocused, farmId, retryTick, periodMode, periodDays, startDate, endDate]);

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
      <View style={styles.errorCard}>
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
        <ActivityIndicator size="large" color={colors.accent} />
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
  const profitColor = profit && profit.profit < 0 ? styles.negText : styles.posText;

  return (
    <ScrollView
      style={styles.wrap}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => setRetryTick((x) => x + 1)}
        />
      }
      contentContainerStyle={styles.content}
    >
      <View style={styles.headerCard}>
        <View>
          <Text style={styles.screenTitle}>Dashboard</Text>
          <Text style={styles.screenSub}>Overview of production, stock, labour and profitability</Text>
        </View>
        <View style={styles.badgeSoft}>
          <Text style={styles.badgeSoftText}>{data.period_start} → {data.period_end}</Text>
        </View>
      </View>


      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Reporting Period</Text>
        <Text style={styles.sectionSub}>Pick a mode, then review KPIs below</Text>
        <View style={styles.chipRow}>
          {PERIOD_MODES.map((mode) => (
            <Pressable
              key={mode}
              style={[styles.chip, periodMode === mode && styles.chipOn]}
              onPress={() => setPeriodMode(mode)}
            >
              <Text style={[styles.chipText, periodMode === mode && styles.chipTextOn]}>
                {periodModeLabel(mode)}
              </Text>
            </Pressable>
          ))}
        </View>

        {periodMode === "days" ? (
          <View style={styles.chipRow}>
            {PERIOD_OPTIONS.map((d) => (
              <Pressable
                key={d}
                style={[styles.chip, periodDays === d && styles.chipOn]}
                onPress={() => setPeriodDays(d)}
              >
                <Text style={[styles.chipText, periodDays === d && styles.chipTextOn]}>
                  {d === 365 ? "1y" : d === 180 ? "6m" : `${d}d`}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {periodMode === "range" || periodMode === "start_only" ? (
          <>
            <Text style={styles.inputLabel}>Start date</Text>
            <TextInput
              style={styles.input}
              value={startDate}
              onChangeText={setStartDate}
              autoCapitalize="none"
              placeholder="YYYY-MM-DD"
            />
          </>
        ) : null}

        {periodMode === "range" || periodMode === "end_only" ? (
          <>
            <Text style={styles.inputLabel}>End date</Text>
            <TextInput
              style={styles.input}
              value={endDate}
              onChangeText={setEndDate}
              autoCapitalize="none"
              placeholder="YYYY-MM-DD"
            />
          </>
        ) : null}

        {periodMode !== "days" ? (
          <View style={styles.chipRow}>
            {periodMode === "range" || periodMode === "start_only" ? (
              <Pressable
                style={styles.ghostBtn}
                onPress={() => setStartDate(new Date().toISOString().slice(0, 10))}
              >
                <Text style={styles.ghostBtnText}>Use today as start</Text>
              </Pressable>
            ) : null}
            {periodMode === "range" || periodMode === "end_only" ? (
              <Pressable
                style={styles.ghostBtn}
                onPress={() => setEndDate(new Date().toISOString().slice(0, 10))}
              >
                <Text style={styles.ghostBtnText}>Use today as end</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Total Birds</Text>
          <Text style={styles.kpiValue}>{data.total_birds.toLocaleString()}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Usable Eggs</Text>
          <Text style={styles.kpiValue}>{data.period_usable_eggs.toLocaleString()}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Trays Produced</Text>
          <Text style={styles.kpiValue}>{data.period_trays.toLocaleString()}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Tray Stock</Text>
          <Text style={styles.kpiValueAccent}>{t.trays_in_stock.toLocaleString()}</Text>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Stock Breakdown</Text>
        <View style={styles.splitRow}>
          <Text style={styles.splitKey}>Produced equivalent</Text>
          <Text style={styles.splitVal}>{t.trays_produced_equivalent.toLocaleString()}</Text>
        </View>
        <View style={styles.splitRow}>
          <Text style={styles.splitKey}>Sold</Text>
          <Text style={styles.splitVal}>{t.trays_sold.toLocaleString()}</Text>
        </View>
        <View style={styles.splitRowLast}>
          <Text style={styles.splitKeyStrong}>In stock</Text>
          <Text style={styles.splitValStrong}>{t.trays_in_stock.toLocaleString()}</Text>
        </View>
      </View>

      <View style={styles.kpiGrid}>
        <View style={styles.kpiCardWide}>
          <Text style={styles.kpiLabel}>Labour Due (Estimate)</Text>
          <Text style={[styles.kpiValue, styles.warnText]}>{fmtInr(labourDue)}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Mortality</Text>
          <Text style={styles.kpiValue}>{mort.toLocaleString()}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Removals</Text>
          <Text style={styles.kpiValue}>{flockOut.toLocaleString()}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Additions</Text>
          <Text style={styles.kpiValueAccent}>{flockIn.toLocaleString()}</Text>
        </View>
      </View>

      {profit ? (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Profit & Loss</Text>
          <Text style={styles.sectionSub}>{profit.period_start} → {profit.period_end}</Text>
          <View style={styles.kpiGridCompact}>
            <View style={styles.kpiMiniCard}>
              <Text style={styles.kpiLabel}>Revenue</Text>
              <Text style={styles.kpiMiniValue}>{fmtInr(profit.revenue)}</Text>
            </View>
            <View style={styles.kpiMiniCard}>
              <Text style={styles.kpiLabel}>Expenses</Text>
              <Text style={styles.kpiMiniValue}>{fmtInr(profit.expenses)}</Text>
            </View>
            <View style={styles.kpiMiniCard}>
              <Text style={styles.kpiLabel}>Net Profit</Text>
              <Text style={[styles.kpiMiniValue, profitColor]}>{fmtInr(profit.profit)}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.splitRow}>
            <Text style={styles.splitKey}>Expense entries</Text>
            <Text style={styles.splitVal}>{fmtInr(profit.expense_breakdown.expense_entries)}</Text>
          </View>
          <View style={styles.splitRow}>
            <Text style={styles.splitKey}>Unlinked labour payments</Text>
            <Text style={styles.splitVal}>{fmtInr(profit.expense_breakdown.unlinked_labour_payments)}</Text>
          </View>
          <View style={styles.splitRowLast}>
            <Text style={styles.splitKey}>Feed purchase (not in log)</Text>
            <Text style={styles.splitVal}>{fmtInr(profit.expense_breakdown.feed_purchase_cost_on_entries)}</Text>
          </View>

          {profit.cost_per_egg != null ? (
            <View style={styles.costCard}>
              <Text style={styles.costLabel}>Cost per egg (approx.)</Text>
              <Text style={styles.costValue}>{fmtInr(profit.cost_per_egg)}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 28 },
  center: { padding: 48, alignItems: "center" },
  muted: { padding: 16, color: colors.textMuted, fontSize: 14 },
  errorCard: {
    margin: 16,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },

  headerCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
    gap: 10,
  },
  screenTitle: { fontSize: 24, fontWeight: "800", color: colors.text },
  screenSub: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  badgeSoft: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: colors.infoSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeSoftText: { fontSize: 12, color: colors.infoText, fontWeight: "600" },

  liveCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  livePill: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.accentText,
    backgroundColor: colors.successSoft,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: "hidden",
  },
  liveText: { flex: 1, fontSize: 12, color: colors.accentText, fontWeight: "600" },

  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  sectionSub: { fontSize: 12, color: colors.textMuted, marginTop: 3, marginBottom: 10 },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 12, color: colors.textSoft, fontWeight: "700" },
  chipTextOn: { color: colors.inverseText },

  inputLabel: { fontSize: 12, color: colors.textSoft, fontWeight: "600", marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 10,
    backgroundColor: colors.inputBg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    color: colors.inputText,
  },
  ghostBtn: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  ghostBtnText: { fontSize: 12, color: colors.textSoft, fontWeight: "600" },

  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  kpiGridCompact: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 },
  kpiCard: {
    width: "48%",
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  kpiCardWide: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  kpiMiniCard: {
    minWidth: "30%",
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    backgroundColor: colors.surfaceMuted,
  },
  kpiLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: colors.textMuted,
    fontWeight: "700",
  },
  kpiValue: { fontSize: 24, color: colors.text, fontWeight: "800", marginTop: 8 },
  kpiValueAccent: { fontSize: 24, color: colors.accent, fontWeight: "800", marginTop: 8 },
  kpiMiniValue: { fontSize: 16, color: colors.inputText, fontWeight: "700", marginTop: 6 },

  splitRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  splitRowLast: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
  },
  splitKey: { fontSize: 13, color: colors.textSoft },
  splitKeyStrong: { fontSize: 13, color: colors.inputText, fontWeight: "700" },
  splitVal: { fontSize: 13, color: colors.inputText, fontWeight: "600" },
  splitValStrong: { fontSize: 14, color: colors.accent, fontWeight: "800" },

  divider: { height: 1, backgroundColor: colors.borderSoft, marginVertical: 10 },
  costCard: {
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    padding: 10,
  },
  costLabel: { fontSize: 12, color: colors.accentText, fontWeight: "700" },
  costValue: { fontSize: 16, color: colors.accent, fontWeight: "800", marginTop: 4 },

  warnText: { color: colors.warning },
  posText: { color: colors.accent },
  negText: { color: colors.danger },

  retry: {
    marginTop: 12,
    alignSelf: "center",
    backgroundColor: colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryText: { color: colors.inverseText, fontWeight: "700" },
});
