import { useEffect, useMemo, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { getToken } from "./lib/api";
import { FarmProvider } from "./lib/farm-context";
import { getNavigationTheme, useAppTheme } from "./lib/theme";
import type { RootStackParamList } from "./types";
import { LoginScreen } from "./screens/LoginScreen";
import { MainDrawer } from "./navigation/MainDrawer";

const Stack = createNativeStackNavigator<RootStackParamList>();

function MainApp() {
  return (
    <FarmProvider>
      <MainDrawer />
    </FarmProvider>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const colors = useAppTheme();
  const navigationTheme = useMemo(() => getNavigationTheme(colors), [colors]);

  useEffect(() => {
    (async () => {
      const t = await getToken();
      setAuthed(!!t);
      setReady(true);
    })();
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      <StatusBar style={colors.isDark ? "light" : "dark"} />
      <Stack.Navigator
        initialRouteName={authed ? "Main" : "Login"}
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Main" component={MainApp} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
