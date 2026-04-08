import { useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { apiFetch, type DashboardSummary, type ProfitSummary } from "../lib/api";
import type { RootStackParamList } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Dashboard">;

export function DashboardScreen({ navigation, route }: Props) {
  const { farmId, farmName, myRole } = route.params;
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [profit, setProfit] = useState<ProfitSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const canManage = myRole === "owner" || myRole === "manager";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, p] = await Promise.all([
        apiFetch<DashboardSummary>(`/farms/${farmId}/analytics/dashboard`),
        apiFetch<ProfitSummary>(`/farms/${farmId}/analytics/profit?days=30`),
      ]);
      setData(d);
      setProfit(p);
    } catch {
      setData(null);
      setProfit(null);
    } finally {
      setLoading(false);
    }
  }, [farmId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <ScrollView
      style={styles.wrap}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <Text style={styles.title}>{farmName}</Text>
      <Text style={styles.roleLine}>Your role: {myRole}</Text>

      {loading && !data ? (
        <View style={styles.loadingBlock}>
          <ActivityIndicator size="large" color="#047857" />
          <Text style={styles.muted}>Loading dashboard…</Text>
        </View>
      ) : null}

      {data ? (
        <View style={styles.grid}>
          <View style={styles.tile}>
            <Text style={styles.tileLabel}>Birds</Text>
            <Text style={styles.tileVal}>{data.total_birds}</Text>
          </View>
          <View style={styles.tile}>
            <Text style={styles.tileLabel}>7d eggs</Text>
            <Text style={styles.tileVal}>{data.last_7_days_eggs}</Text>
          </View>
          <View style={styles.tile}>
            <Text style={styles.tileLabel}>7d trays</Text>
            <Text style={styles.tileVal}>{data.last_7_days_trays}</Text>
          </View>
          <View style={styles.tile}>
            <Text style={styles.tileLabel}>Tray stock</Text>
            <Text style={styles.tileVal}>{data.tray_stock.trays_in_stock}</Text>
          </View>
          <View style={styles.tileWide}>
            <Text style={styles.tileLabel}>Usable eggs (equiv.)</Text>
            <Text style={styles.tileVal}>{data.tray_stock.usable_eggs_equivalent}</Text>
          </View>
        </View>
      ) : !loading ? (
        <Text style={styles.muted}>No data</Text>
      ) : null}

      {profit ? (
        <View style={styles.profitCard}>
          <Text style={styles.profitTitle}>30-day profit</Text>
          <Text style={styles.profitRow}>
            Revenue: <Text style={styles.profitNum}>₹{profit.revenue.toFixed(2)}</Text>
          </Text>
          <Text style={styles.profitRow}>
            Expenses: <Text style={styles.profitNum}>₹{profit.expenses.toFixed(2)}</Text>
          </Text>
          <Text style={styles.profitRow}>
            Profit: <Text style={styles.profitHighlight}>₹{profit.profit.toFixed(2)}</Text>
          </Text>
          {profit.cost_per_egg != null ? (
            <Text style={styles.profitSub}>Cost / egg: ₹{profit.cost_per_egg.toFixed(4)}</Text>
          ) : null}
        </View>
      ) : null}

      <Text style={styles.section}>Records</Text>
      <Pressable
        style={styles.btnSecondary}
        onPress={() => navigation.navigate("ProductionList", { farmId })}
      >
        <Text style={styles.btnSecondaryText}>Egg production</Text>
      </Pressable>
      <Pressable
        style={styles.btnSecondary}
        onPress={() => navigation.navigate("FeedList", { farmId })}
      >
        <Text style={styles.btnSecondaryText}>Feed inventory</Text>
      </Pressable>
      <Pressable
        style={styles.btnSecondary}
        onPress={() => navigation.navigate("SalesList", { farmId })}
      >
        <Text style={styles.btnSecondaryText}>Sales</Text>
      </Pressable>
      <Pressable
        style={styles.btnSecondary}
        onPress={() => navigation.navigate("ExpensesList", { farmId })}
      >
        <Text style={styles.btnSecondaryText}>Expenses</Text>
      </Pressable>

      {canManage ? (
        <Pressable
          style={styles.btnSecondary}
          onPress={() =>
            navigation.navigate("Settings", { farmId, farmName, myRole })
          }
        >
          <Text style={styles.btnSecondaryText}>Farm settings</Text>
        </Pressable>
      ) : null}

      {canManage ? (
        <Pressable
          style={styles.btnSecondary}
          onPress={() => navigation.navigate("Audit", { farmId })}
        >
          <Text style={styles.btnSecondaryText}>Audit log</Text>
        </Pressable>
      ) : null}

      <Text style={styles.section}>Quick add</Text>
      <Pressable
        style={styles.btn}
        onPress={() => navigation.navigate("AddEgg", { farmId })}
      >
        <Text style={styles.btnText}>Add egg production</Text>
      </Pressable>
      <Pressable
        style={styles.btn}
        onPress={() => navigation.navigate("AddFeed", { farmId })}
      >
        <Text style={styles.btnText}>Add feed usage</Text>
      </Pressable>
      <Pressable
        style={styles.btn}
        onPress={() => navigation.navigate("AddSale", { farmId })}
      >
        <Text style={styles.btnText}>Add sale</Text>
      </Pressable>
      {canManage ? (
        <Pressable
          style={styles.btn}
          onPress={() => navigation.navigate("AddExpense", { farmId })}
        >
          <Text style={styles.btnText}>Add expense</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#fafafa", padding: 16 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 4, color: "#18181b" },
  roleLine: { fontSize: 13, color: "#71717a", marginBottom: 16 },
  loadingBlock: { alignItems: "center", paddingVertical: 24 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16 },
  tile: {
    width: "47%",
    padding: 14,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e4e4e7",
  },
  tileWide: {
    width: "100%",
    padding: 14,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e4e4e7",
  },
  tileLabel: { fontSize: 11, color: "#71717a", textTransform: "uppercase" },
  tileVal: { fontSize: 22, fontWeight: "700", color: "#065f46", marginTop: 4 },
  muted: { color: "#71717a", marginBottom: 16 },
  profitCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    padding: 16,
    marginBottom: 20,
  },
  profitTitle: { fontSize: 15, fontWeight: "700", color: "#18181b", marginBottom: 8 },
  profitRow: { fontSize: 14, color: "#52525b", marginTop: 4 },
  profitNum: { fontWeight: "600", color: "#18181b" },
  profitHighlight: { fontWeight: "700", color: "#047857" },
  profitSub: { marginTop: 8, fontSize: 12, color: "#71717a" },
  section: {
    fontSize: 13,
    fontWeight: "700",
    color: "#52525b",
    textTransform: "uppercase",
    marginBottom: 8,
    marginTop: 8,
  },
  btn: {
    backgroundColor: "#047857",
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "600" },
  btnSecondary: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e4e4e7",
  },
  btnSecondaryText: { color: "#18181b", fontWeight: "600" },
});
