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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
