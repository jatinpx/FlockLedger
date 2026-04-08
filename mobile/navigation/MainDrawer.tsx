import { createDrawerNavigator } from "@react-navigation/drawer";
import { FarmHeaderButton } from "../components/FarmHeaderButton";
import { useFarm } from "../lib/farm-context";
import { AppDrawerContent } from "./DrawerContent";
import { DashboardScreen } from "../screens/DashboardScreen";
import { ProductionScreen } from "../screens/ProductionScreen";
import { FeedScreen } from "../screens/FeedScreen";
import { LabourScreen } from "../screens/LabourScreen";
import { FlockScreen } from "../screens/FlockScreen";
import { SalesScreen } from "../screens/SalesScreen";
import { ExpensesScreen } from "../screens/ExpensesScreen";
import { AnalyticsScreen } from "../screens/AnalyticsScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { AuditScreen } from "../screens/AuditScreen";

export type DrawerParamList = {
  Dashboard: undefined;
  Production: undefined;
  Feed: undefined;
  Labour: undefined;
  Flock: undefined;
  Sales: undefined;
  Expenses: undefined;
  Analytics: undefined;
  Settings: undefined;
  Audit: undefined;
};

const Drawer = createDrawerNavigator<DrawerParamList>();

const headerRight = () => <FarmHeaderButton />;

function MainDrawerInner() {
  const { farms, farmId, loading } = useFarm();
  const current = farms.find((f) => f.id === farmId);
  const workerOnly = !loading && current?.my_role === "worker";

  return (
    <Drawer.Navigator
      drawerContent={(props) => <AppDrawerContent {...props} />}
      initialRouteName={workerOnly ? "Labour" : "Dashboard"}
      screenOptions={{
        headerShown: true,
        headerTitle: "FlockLedger",
        headerRight,
        drawerType: "front",
        drawerStyle: { width: 280 },
      }}
    >
      {!workerOnly ? (
        <Drawer.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{ title: "Dashboard", headerTitle: "Dashboard" }}
        />
      ) : null}
      {!workerOnly ? (
        <Drawer.Screen
          name="Production"
          component={ProductionScreen}
          options={{ title: "Production", headerTitle: "Production" }}
        />
      ) : null}
      {!workerOnly ? (
        <Drawer.Screen name="Feed" component={FeedScreen} options={{ title: "Feed", headerTitle: "Feed" }} />
      ) : null}
      <Drawer.Screen
        name="Labour"
        component={LabourScreen}
        options={{
          title: workerOnly ? "My pay" : "Labour",
          headerTitle: workerOnly ? "My pay & ledger" : "Labour",
        }}
      />
      {!workerOnly ? (
        <Drawer.Screen name="Flock" component={FlockScreen} options={{ title: "Flock", headerTitle: "Flock" }} />
      ) : null}
      {!workerOnly ? (
        <Drawer.Screen name="Sales" component={SalesScreen} options={{ title: "Sales", headerTitle: "Sales" }} />
      ) : null}
      {!workerOnly ? (
        <Drawer.Screen
          name="Expenses"
          component={ExpensesScreen}
          options={{ title: "Expenses", headerTitle: "Expenses" }}
        />
      ) : null}
      {!workerOnly ? (
        <Drawer.Screen
          name="Analytics"
          component={AnalyticsScreen}
          options={{ title: "Analytics", headerTitle: "Analytics" }}
        />
      ) : null}
      {!workerOnly ? (
        <Drawer.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ title: "Settings", headerTitle: "Settings" }}
        />
      ) : null}
      {!workerOnly ? (
        <Drawer.Screen
          name="Audit"
          component={AuditScreen}
          options={{ title: "Audit log", headerTitle: "Audit log" }}
        />
      ) : null}
    </Drawer.Navigator>
  );
}

export function MainDrawer() {
  return <MainDrawerInner />;
}
