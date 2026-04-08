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
import { apiFetch, type AuditLogRow, type Paginated } from "../lib/api";
import { withPagination } from "../lib/pagination";
import { PaginatedControls } from "../components/PaginatedControls";
import type { RootStackParamList } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Audit">;

const DEFAULT_LIMIT = 25;

export function AuditScreen({ route }: Props) {
  const { farmId } = route.params;
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch<Paginated<AuditLogRow>>(
        withPagination(`/farms/${farmId}/audit-logs`, limit, offset)
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
          !loading ? (
            <Text style={styles.empty}>No audit entries (or no access).</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.when}>{new Date(item.created_at).toLocaleString()}</Text>
            <Text style={styles.who}>
              {item.user_name} · {item.action} · {item.resource_type}
              {item.resource_id != null ? ` #${item.resource_id}` : ""}
            </Text>
            <Text style={styles.ip}>{item.ip_address ?? "—"}</Text>
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
    padding: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e4e4e7",
  },
  when: { fontSize: 11, color: "#71717a", marginBottom: 4 },
  who: { fontSize: 13, color: "#18181b", fontWeight: "600" },
  ip: { fontSize: 12, color: "#a1a1aa", marginTop: 4 },
});
