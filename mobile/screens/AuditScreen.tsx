import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { useFarm } from "../lib/farm-context";
import { apiFetch, type AuditLogRow, type Paginated } from "../lib/api";
import { withPagination } from "../lib/pagination";
import { PaginatedControls } from "../components/PaginatedControls";

const DEFAULT_LIMIT = 50;

function actionTheme(action: string): { bg: string; fg: string } {
  const key = action.toLowerCase();
  if (key.includes("delete") || key.includes("remove")) {
    return { bg: "#fee2e2", fg: "#b91c1c" };
  }
  if (key.includes("create") || key.includes("add") || key.includes("invite")) {
    return { bg: "#dcfce7", fg: "#166534" };
  }
  if (key.includes("update") || key.includes("edit") || key.includes("patch")) {
    return { bg: "#dbeafe", fg: "#1d4ed8" };
  }
  return { bg: "#f3f4f6", fg: "#374151" };
}

function resourceLabel(resourceType: string, resourceId: number | null): string {
  return resourceId == null ? resourceType : `${resourceType} #${resourceId}`;
}

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
    return (
      <View style={styles.stateWrap}>
        <Text style={styles.stateTitle}>Audit Log</Text>
        <Text style={styles.stateText}>Select a farm first.</Text>
      </View>
    );
  }

  if (!canView) {
    return (
      <View style={styles.stateWrap}>
        <Text style={styles.stateTitle}>Audit Log</Text>
        <Text style={styles.stateText}>
          Only farm owners and managers can view the activity log for this farm.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <FlatList
        data={rows}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={loading && rows.length > 0} onRefresh={load} />}
        ListHeaderComponent={
          <>
            <View style={styles.headerCard}>
              <Text style={styles.title}>Audit Log</Text>
              <Text style={styles.intro}>Timeline of changes across this farm.</Text>
            </View>

            <View style={styles.kpiRow}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Total</Text>
                <Text style={styles.kpiValue}>{total}</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>On this page</Text>
                <Text style={styles.kpiValue}>{rows.length}</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Page</Text>
                <Text style={styles.kpiValue}>{Math.floor(offset / limit) + 1}</Text>
              </View>
            </View>

            {failed && rows.length === 0 ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorTitle}>Could not load audit records</Text>
                <Pressable style={styles.retryBtn} onPress={() => void load()}>
                  <Text style={styles.retryBtnText}>Retry</Text>
                </Pressable>
              </View>
            ) : null}

            {loading && rows.length === 0 ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" color="#047857" />
              </View>
            ) : null}
          </>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No entries on this page</Text>
              <Text style={styles.emptyText}>Try adjusting page size or pull to refresh.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowTop}>
              <View style={styles.actionPillWrap}>
                <View
                  style={[
                    styles.actionPill,
                    { backgroundColor: actionTheme(item.action).bg },
                  ]}
                >
                  <Text style={[styles.actionPillText, { color: actionTheme(item.action).fg }]}>
                    {item.action.toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={styles.recordDate}>{new Date(item.created_at).toLocaleString()}</Text>
            </View>

            <Text style={styles.resourceLine} numberOfLines={1}>
              {resourceLabel(item.resource_type, item.resource_id ?? null)}
            </Text>

            <View style={styles.recordStatsCompact}>
              <Text style={styles.statInline} numberOfLines={1}>{item.user_name}</Text>
              <Text style={styles.statInline} numberOfLines={1}>{item.user_email}</Text>
              <Text style={styles.statInline} numberOfLines={1}>{item.ip_address ?? "—"}</Text>
            </View>

            {item.detail ? (
              <View style={styles.detailBox}>
                <Text style={styles.detail} numberOfLines={4}>
                  {JSON.stringify(item.detail)}
                </Text>
              </View>
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
  wrap: { flex: 1, backgroundColor: "#f3f4f6", padding: 16 },
  listContent: { paddingBottom: 24 },

  stateWrap: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    padding: 16,
    justifyContent: "center",
  },
  stateTitle: { fontSize: 24, fontWeight: "800", color: "#0f172a", marginBottom: 8 },
  stateText: { fontSize: 14, color: "#6b7280" },

  headerCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 16,
    marginBottom: 12,
  },
  intro: { fontSize: 13, color: "#6b7280", marginTop: 4 },
  kpiRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  kpiCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 10,
  },
  kpiLabel: { fontSize: 11, color: "#6b7280", fontWeight: "700", textTransform: "uppercase" },
  kpiValue: { marginTop: 5, fontSize: 18, fontWeight: "800", color: "#0f172a" },

  center: { padding: 24, alignItems: "center" },
  errorCard: {
    backgroundColor: "#fff7ed",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fed7aa",
    padding: 14,
    marginBottom: 12,
  },
  errorTitle: { fontSize: 13, fontWeight: "700", color: "#9a3412" },
  retryBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: "#047857",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  retryBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
  },
  emptyTitle: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  emptyText: { marginTop: 3, fontSize: 12, color: "#6b7280" },

  title: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  row: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
    gap: 8,
  },
  actionPillWrap: { flexDirection: "row", alignItems: "center" },
  actionPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  actionPillText: { fontSize: 10, fontWeight: "800" },

  recordDate: { fontSize: 11, color: "#6b7280", fontWeight: "600", marginTop: 1 },
  resourceLine: { fontSize: 14, color: "#0f172a", fontWeight: "700", marginBottom: 5 },
  recordStatsCompact: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
    marginBottom: 2,
  },
  statInline: { fontSize: 12, fontWeight: "700", color: "#111827" },
  detailBox: {
    marginTop: 6,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 8,
  },
  detail: {
    fontSize: 11,
    color: "#52525b",
    fontFamily: "monospace",
  },
});
