import { createDrawerNavigator } from "@react-navigation/drawer";
import { FarmHeaderButton } from "../components/FarmHeaderButton";
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

export function MainDrawer() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <AppDrawerContent {...props} />}
      initialRouteName="Dashboard"
      screenOptions={{
        headerShown: true,
        headerTitle: "FlockLedger",
        headerRight,
        drawerType: "front",
        drawerStyle: { width: 280 },
      }}
    >
      <Drawer.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: "Dashboard", headerTitle: "Dashboard" }}
      />
      <Drawer.Screen
        name="Production"
        component={ProductionScreen}
        options={{ title: "Production", headerTitle: "Production" }}
      />
      <Drawer.Screen name="Feed" component={FeedScreen} options={{ title: "Feed", headerTitle: "Feed" }} />
      <Drawer.Screen name="Labour" component={LabourScreen} options={{ title: "Labour", headerTitle: "Labour" }} />
      <Drawer.Screen name="Flock" component={FlockScreen} options={{ title: "Flock", headerTitle: "Flock" }} />
      <Drawer.Screen name="Sales" component={SalesScreen} options={{ title: "Sales", headerTitle: "Sales" }} />
      <Drawer.Screen
        name="Expenses"
        component={ExpensesScreen}
        options={{ title: "Expenses", headerTitle: "Expenses" }}
      />
      <Drawer.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{ title: "Analytics", headerTitle: "Analytics" }}
      />
      <Drawer.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: "Settings", headerTitle: "Settings" }}
      />
      <Drawer.Screen name="Audit" component={AuditScreen} options={{ title: "Audit log", headerTitle: "Audit log" }} />
    </Drawer.Navigator>
  );
}
