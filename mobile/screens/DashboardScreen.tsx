import { useCallback, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, RefreshControl } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { apiFetch } from "../lib/api";
import type { RootStackParamList } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Dashboard">;

type Summary = {
  total_birds: number;
  last_7_days_eggs: number;
  last_7_days_trays: number;
  tray_stock: {
    trays_in_stock: number;
    trays_produced_equivalent: number;
    trays_sold: number;
  };
};

export function DashboardScreen({ navigation, route }: Props) {
  const { farmId, farmName } = route.params;
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiFetch<Summary>(`/farms/${farmId}/analytics/dashboard`);
      setData(d);
    } catch {
      setData(null);
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
        </View>
      ) : (
        <Text style={styles.muted}>{loading ? "Loading…" : "No data"}</Text>
      )}

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#fafafa", padding: 16 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 16, color: "#18181b" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 20 },
  tile: {
    width: "47%",
    padding: 14,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e4e4e7",
  },
  tileLabel: { fontSize: 11, color: "#71717a", textTransform: "uppercase" },
  tileVal: { fontSize: 22, fontWeight: "700", color: "#065f46", marginTop: 4 },
  muted: { color: "#71717a", marginBottom: 16 },
  btn: {
    backgroundColor: "#047857",
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "600" },
});
