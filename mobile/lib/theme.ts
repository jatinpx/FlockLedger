import { DarkTheme, DefaultTheme, type Theme } from "@react-navigation/native";
import { useColorScheme } from "react-native";

export type AppColors = {
  isDark: boolean;
  background: string;
  surface: string;
  surfaceAlt: string;
  surfaceMuted: string;
  text: string;
  textStrong: string;
  textMuted: string;
  textSoft: string;
  textFaint: string;
  border: string;
  borderStrong: string;
  borderSoft: string;
  inputBg: string;
  inputAltBg: string;
  inputDisabledBg: string;
  inputText: string;
  inputDisabledText: string;
  placeholder: string;
  accent: string;
  accentStrong: string;
  accentSoft: string;
  accentSoftAlt: string;
  accentBorder: string;
  accentText: string;
  info: string;
  infoSoft: string;
  infoText: string;
  successSoft: string;
  warning: string;
  warningStrong: string;
  warningSoft: string;
  warningBorder: string;
  warningText: string;
  danger: string;
  dangerSoft: string;
  dangerBorder: string;
  dangerText: string;
  overlay: string;
  drawerOverlay: string;
  disabled: string;
  inverseText: string;
  darkButton: string;
};

const lightColors: AppColors = {
  isDark: false,
  background: "#f3f4f6",
  surface: "#ffffff",
  surfaceAlt: "#fafafa",
  surfaceMuted: "#f9fafb",
  text: "#0f172a",
  textStrong: "#18181b",
  textMuted: "#6b7280",
  textSoft: "#52525b",
  textFaint: "#9ca3af",
  border: "#e5e7eb",
  borderStrong: "#d1d5db",
  borderSoft: "#f3f4f6",
  inputBg: "#ffffff",
  inputAltBg: "#fafafa",
  inputDisabledBg: "#f9fafb",
  inputText: "#111827",
  inputDisabledText: "#9ca3af",
  placeholder: "#9ca3af",
  accent: "#047857",
  accentStrong: "#065f46",
  accentSoft: "#ecfdf5",
  accentSoftAlt: "#f0fdf4",
  accentBorder: "#a7f3d0",
  accentText: "#065f46",
  info: "#2563eb",
  infoSoft: "#ecfeff",
  infoText: "#0f766e",
  successSoft: "#d1fae5",
  warning: "#b45309",
  warningStrong: "#92400e",
  warningSoft: "#fffbeb",
  warningBorder: "#fde68a",
  warningText: "#78350f",
  danger: "#b91c1c",
  dangerSoft: "#fff7ed",
  dangerBorder: "#fecaca",
  dangerText: "#9a3412",
  overlay: "rgba(0,0,0,0.45)",
  drawerOverlay: "rgba(0,0,0,0.35)",
  disabled: "#a1a1aa",
  inverseText: "#ffffff",
  darkButton: "#27272a",
} as const;

const darkColors: AppColors = {
  isDark: true,
  background: "#0b1120",
  surface: "#111827",
  surfaceAlt: "#0f172a",
  surfaceMuted: "#1f2937",
  text: "#f3f4f6",
  textStrong: "#f9fafb",
  textMuted: "#9ca3af",
  textSoft: "#d1d5db",
  textFaint: "#94a3b8",
  border: "#1f2937",
  borderStrong: "#374151",
  borderSoft: "#1e293b",
  inputBg: "#111827",
  inputAltBg: "#0f172a",
  inputDisabledBg: "#1f2937",
  inputText: "#f9fafb",
  inputDisabledText: "#6b7280",
  placeholder: "#6b7280",
  accent: "#10b981",
  accentStrong: "#34d399",
  accentSoft: "#052e2b",
  accentSoftAlt: "#063b35",
  accentBorder: "#065f46",
  accentText: "#6ee7b7",
  info: "#60a5fa",
  infoSoft: "#082f49",
  infoText: "#67e8f9",
  successSoft: "#064e3b",
  warning: "#f59e0b",
  warningStrong: "#fbbf24",
  warningSoft: "#3b2a0a",
  warningBorder: "#92400e",
  warningText: "#fcd34d",
  danger: "#f87171",
  dangerSoft: "#3f1d1d",
  dangerBorder: "#7f1d1d",
  dangerText: "#fdba74",
  overlay: "rgba(2,6,23,0.78)",
  drawerOverlay: "rgba(2,6,23,0.66)",
  disabled: "#6b7280",
  inverseText: "#ffffff",
  darkButton: "#374151",
} as const;

export function useAppTheme(): AppColors {
  const scheme = useColorScheme();
  return scheme === "dark" ? darkColors : lightColors;
}

export function getNavigationTheme(colors: AppColors): Theme {
  const base = colors.isDark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    dark: colors.isDark,
    colors: {
      ...base.colors,
      primary: colors.accent,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.accent,
    },
  };
}
