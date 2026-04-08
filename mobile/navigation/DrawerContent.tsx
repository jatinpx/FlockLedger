import {
  DrawerContentScrollView,
  DrawerContentComponentProps,
} from "@react-navigation/drawer";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useFarm } from "../lib/farm-context";
import { setToken } from "../lib/api";

const MAIN_LINKS: { route: string; label: string }[] = [
  { route: "Dashboard", label: "Dashboard" },
  { route: "Production", label: "Production" },
  { route: "Feed", label: "Feed" },
  { route: "Labour", label: "Labour" },
  { route: "Flock", label: "Flock" },
  { route: "Sales", label: "Sales" },
  { route: "Expenses", label: "Expenses" },
  { route: "Analytics", label: "Analytics" },
  { route: "Settings", label: "Settings" },
];

/** Same order and labels as web `AppShell` sidebar. */
export function AppDrawerContent(props: DrawerContentComponentProps) {
  const { navigation, state } = props;
  const { farms, farmId } = useFarm();
  const current = farms.find((f) => f.id === farmId);
  const canSeeAudit =
    current?.my_role === "owner" || current?.my_role === "manager";
  const active = state.routes[state.index]?.name;

  async function logout() {
    await setToken(null);
    const parent = navigation.getParent();
    parent?.reset({ index: 0, routes: [{ name: "Login" as never }] });
  }

  const links = canSeeAudit
    ? [...MAIN_LINKS, { route: "Audit", label: "Audit log" }]
    : MAIN_LINKS;

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={styles.scroll}
      style={styles.drawer}
    >
      <View style={styles.brand}>
        <Text style={styles.brandTitle}>FlockLedger</Text>
        <Text style={styles.brandSub}>Poultry farm management</Text>
      </View>
      <View style={styles.nav}>
        {links.map((l) => (
          <Pressable
            key={l.route}
            style={[styles.item, active === l.route && styles.itemActive]}
            onPress={() => navigation.navigate(l.route as never)}
          >
            <Text style={[styles.itemText, active === l.route && styles.itemTextActive]}>
              {l.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.footer}>
        <Pressable style={styles.logout} onPress={logout}>
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </View>
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  drawer: { flex: 1 },
  scroll: { flexGrow: 1 },
  brand: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f4f4f5",
  },
  brandTitle: { fontSize: 18, fontWeight: "700", color: "#065f46" },
  brandSub: { fontSize: 11, color: "#71717a", marginTop: 4 },
  nav: { padding: 8, flex: 1 },
  item: {
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 2,
  },
  itemActive: { backgroundColor: "#ecfdf5" },
  itemText: { fontSize: 14, fontWeight: "600", color: "#52525b" },
  itemTextActive: { color: "#065f46" },
  footer: {
    borderTopWidth: 1,
    borderTopColor: "#f4f4f5",
    padding: 12,
  },
  logout: {
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  logoutText: { fontSize: 14, color: "#3f3f46", fontWeight: "600" },
});
