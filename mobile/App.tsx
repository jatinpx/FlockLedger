import { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { getToken } from "./lib/api";
import type { RootStackParamList } from "./types";
import { LoginScreen } from "./screens/LoginScreen";
import { FarmOverviewScreen } from "./screens/FarmOverviewScreen";
import { DashboardScreen } from "./screens/DashboardScreen";
import { AddEggScreen } from "./screens/AddEggScreen";
import { AddFeedScreen } from "./screens/AddFeedScreen";
import { AddSaleScreen } from "./screens/AddSaleScreen";
import { AddExpenseScreen } from "./screens/AddExpenseScreen";
import { ProductionListScreen } from "./screens/ProductionListScreen";
import { FeedListScreen } from "./screens/FeedListScreen";
import { SalesListScreen } from "./screens/SalesListScreen";
import { ExpensesListScreen } from "./screens/ExpensesListScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { AuditScreen } from "./screens/AuditScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    (async () => {
      const t = await getToken();
      setAuthed(!!t);
      setReady(true);
    })();
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#047857" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Stack.Navigator
        initialRouteName={authed ? "FarmOverview" : "Login"}
        screenOptions={{ headerShown: true, headerTitle: "FlockLedger" }}
      >
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="FarmOverview" component={FarmOverviewScreen} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="AddEgg" component={AddEggScreen} options={{ title: "Egg production" }} />
        <Stack.Screen name="AddFeed" component={AddFeedScreen} options={{ title: "Feed" }} />
        <Stack.Screen name="AddSale" component={AddSaleScreen} options={{ title: "Sale" }} />
        <Stack.Screen name="AddExpense" component={AddExpenseScreen} options={{ title: "Expense" }} />
        <Stack.Screen
          name="ProductionList"
          component={ProductionListScreen}
          options={{ title: "Egg production" }}
        />
        <Stack.Screen name="FeedList" component={FeedListScreen} options={{ title: "Feed" }} />
        <Stack.Screen name="SalesList" component={SalesListScreen} options={{ title: "Sales" }} />
        <Stack.Screen name="ExpensesList" component={ExpensesListScreen} options={{ title: "Expenses" }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: "Settings" }} />
        <Stack.Screen name="Audit" component={AuditScreen} options={{ title: "Audit log" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
