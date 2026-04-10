import type { NavigatorScreenParams } from "@react-navigation/native";
import type { DrawerParamList } from "./navigation/MainDrawer";

export type RootStackParamList = {
  Login: undefined;
  /** Drawer shell (same sections as web AppShell sidebar). */
  Main: NavigatorScreenParams<DrawerParamList> | undefined;
};
