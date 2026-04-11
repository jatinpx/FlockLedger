"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";

export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "flockledger-theme";

function systemIsDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveTheme(pref: ThemePreference): "light" | "dark" {
  if (pref === "system") return systemIsDark() ? "dark" : "light";
  return pref;
}

function readStoredPreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    /* ignore */
  }
  return "system";
}

function applyDom(resolved: "light" | "dark") {
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

type ThemeContextValue = {
  preference: ThemePreference;
  resolved: "light" | "dark";
  setPreference: (p: ThemePreference) => void;
  cyclePreference: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const p = readStoredPreference();
    const r = resolveTheme(p);
    setPreferenceState(p);
    setResolved(r);
    applyDom(r);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const r = resolveTheme(preference);
    setResolved(r);
    applyDom(r);
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      /* ignore */
    }
  }, [preference, ready]);

  useEffect(() => {
    if (!ready || preference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const r = resolveTheme("system");
      setResolved(r);
      applyDom(r);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preference, ready]);

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
  }, []);

  const cyclePreference = useCallback(() => {
    setPreferenceState((prev) =>
      prev === "light" ? "dark" : prev === "dark" ? "system" : "light",
    );
  }, []);

  const value = useMemo(
    () => ({ preference, resolved, setPreference, cyclePreference }),
    [preference, resolved, setPreference, cyclePreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

/** Recharts / canvas colors that follow the current resolved theme. */
export function useChartPalette() {
  const { resolved } = useTheme();
  const dark = resolved === "dark";
  return dark
    ? {
        grid: "#3f3f46",
        axis: "#a1a1aa",
        primary: "#34d399",
        bar: "#14b8a6",
        tooltipBg: "#18181b",
        tooltipBorder: "#3f3f46",
        tooltipColor: "#f4f4f5",
      }
    : {
        grid: "#e4e4e7",
        axis: "#71717a",
        primary: "#047857",
        bar: "#0d9488",
        tooltipBg: "#ffffff",
        tooltipBorder: "#e4e4e7",
        tooltipColor: "#18181b",
      };
}
