import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { apiFetch, setToken, type Farm, type Paginated } from "../lib/api";
import { pageQuery } from "../lib/pagination";
import type { RootStackParamList } from "../types";

type Nav = NativeStackNavigationProp<RootStackParamList, "FarmOverview">;

export function FarmOverviewScreen({ navigation }: { navigation: Nav }) {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<Paginated<Farm>>(`/farms?${pageQuery(500, 0)}`);
      setFarms(res.items);
    } catch {
      setFarms([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function logout() {
    await setToken(null);
    navigation.replace("Login");
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Your farms</Text>
        <Pressable onPress={logout}>
          <Text style={styles.link}>Log out</Text>
        </Pressable>
      </View>
      {loading && farms.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#047857" />
          <Text style={styles.loadingText}>Loading farms…</Text>
        </View>
      ) : null}
      <FlatList
        data={farms}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl refreshing={loading && farms.length > 0} onRefresh={load} />
        }
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.empty}>No farms. Ask an owner to add you.</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() =>
              navigation.navigate("Dashboard", {
                farmId: item.id,
                farmName: item.name,
                myRole: item.my_role,
              })
            }
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.roleBadge}>{item.my_role}</Text>
            </View>
            {item.location ? (
              <Text style={styles.cardSub}>{item.location}</Text>
            ) : null}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#fafafa" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e4e4e7",
    backgroundColor: "#fff",
  },
  title: { fontSize: 20, fontWeight: "700", color: "#18181b" },
  link: { color: "#047857", fontWeight: "600" },
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e4e4e7",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: { fontSize: 16, fontWeight: "600", color: "#18181b", flex: 1 },
  roleBadge: {
    fontSize: 11,
    fontWeight: "700",
    color: "#047857",
    textTransform: "uppercase",
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: "hidden",
  },
  cardSub: { marginTop: 4, color: "#71717a" },
  empty: { padding: 24, textAlign: "center", color: "#71717a" },
  centered: { paddingTop: 48, alignItems: "center" },
  loadingText: { marginTop: 12, color: "#71717a", fontSize: 14 },
});
