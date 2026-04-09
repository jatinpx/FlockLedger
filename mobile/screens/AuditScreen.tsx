import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useFarm } from "../lib/farm-context";
import { apiFetch, type AuditLogRow, type Paginated } from "../lib/api";
import { withPagination } from "../lib/pagination";
import { PaginatedControls } from "../components/PaginatedControls";

const DEFAULT_LIMIT = 25;

export function AuditScreen() {
  const { farmId, farms } = useFarm();
  const current = farms.find((f) => f.id === farmId);
  const canView = current?.my_role === "owner" || current?.my_role === "manager";

  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!farmId || !canView) return;
    setLoading(true);
    setFailed(false);
    try {
      const r = await apiFetch<Paginated<AuditLogRow>>(
        withPagination(`/farms/${farmId}/audit-logs`, limit, offset)
      );
      setRows(r.items);
      setTotal(r.total);
    } catch {
      setRows([]);
      setTotal(0);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [farmId, canView, limit, offset]);

  useEffect(() => {
    setOffset(0);
  }, [limit, farmId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!farmId) {
    return <Text style={styles.muted}>Select a farm first.</Text>;
  }

  if (!canView) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Audit log</Text>
        <Text style={styles.muted}>
          Only farm owners and managers can view the activity log for this farm.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.intro}>
        Recent creates, updates, and deletes (newest first). Owners and managers only.
      </Text>
      {failed && rows.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.muted}>Audit log could not be loaded.</Text>
          <Text style={styles.retryLink} onPress={() => void load()}>
            Try again
          </Text>
        </View>
      ) : null}
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
          !loading ? <Text style={styles.muted}>No audit entries on this page.</Text> : null
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.when}>{new Date(item.created_at).toLocaleString()}</Text>
            <Text style={styles.who}>
              {item.user_name} · {item.action} · {item.resource_type}
              {item.resource_id != null ? ` #${item.resource_id}` : ""}
            </Text>
            <Text style={styles.email}>{item.user_email}</Text>
            <Text style={styles.ip}>{item.ip_address ?? "—"}</Text>
            {item.detail ? (
              <Text style={styles.detail}>{JSON.stringify(item.detail)}</Text>
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
  wrap: { flex: 1, backgroundColor: "#fafafa", padding: 16 },
  intro: { fontSize: 13, color: "#52525b", marginBottom: 12 },
  center: { padding: 24, alignItems: "center" },
  muted: { color: "#71717a", padding: 8 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    padding: 16,
    margin: 16,
  },
  title: { fontSize: 17, fontWeight: "700", color: "#18181b", marginBottom: 8 },
  row: {
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    padding: 12,
    marginBottom: 8,
  },
  when: { fontSize: 11, color: "#71717a", marginBottom: 4 },
  who: { fontSize: 13, color: "#18181b", fontWeight: "600" },
  email: { fontSize: 12, color: "#52525b", marginTop: 4 },
  ip: { fontSize: 12, color: "#a1a1aa", marginTop: 4 },
  detail: {
    marginTop: 6,
    fontSize: 11,
    color: "#52525b",
    fontFamily: "monospace",
    backgroundColor: "#fafafa",
    borderRadius: 6,
    padding: 8,
  },
  retryLink: { color: "#047857", fontWeight: "600", marginTop: 8 },
});
