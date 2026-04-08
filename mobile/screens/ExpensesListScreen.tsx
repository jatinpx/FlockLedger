import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { apiFetch, type ExpenseRow, type Paginated } from "../lib/api";
import { withPagination } from "../lib/pagination";
import { PaginatedControls } from "../components/PaginatedControls";
import type { RootStackParamList } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "ExpensesList">;

const DEFAULT_LIMIT = 25;

export function ExpensesListScreen({ route }: Props) {
  const { farmId } = route.params;
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch<Paginated<ExpenseRow>>(
        withPagination(`/farms/${farmId}/expenses`, limit, offset)
      );
      setRows(r.items);
      setTotal(r.total);
    } catch {
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [farmId, limit, offset]);

  useEffect(() => {
    setOffset(0);
  }, [limit, farmId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <View style={styles.wrap}>
      {loading && rows.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#047857" />
        </View>
      ) : null}
      <FlatList
        data={rows}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={loading && rows.length > 0} onRefresh={load} />}
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>No expenses on this page.</Text> : null
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {item.category} · {item.date}
            </Text>
            <Text style={styles.cardBody}>₹{item.amount.toFixed(2)}</Text>
            {item.description ? (
              <Text style={styles.desc}>{item.description}</Text>
            ) : null}
          </View>
        )}
        ListFooterComponent={
          <PaginatedControls
            total={total}
            limit={limit}
            offset={offset}
            onLimitChange={setLimit}
            onOffsetChange={setOffset}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#fafafa" },
  center: { padding: 24, alignItems: "center" },
  empty: { textAlign: "center", color: "#71717a", padding: 24 },
  card: {
    marginHorizontal: 16,
    marginTop: 10,
    padding: 14,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e4e4e7",
  },
  cardTitle: { fontWeight: "700", color: "#18181b", marginBottom: 4 },
  cardBody: { fontSize: 15, color: "#047857", fontWeight: "600" },
  desc: { fontSize: 13, color: "#52525b", marginTop: 6 },
});
