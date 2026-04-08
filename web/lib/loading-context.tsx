"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type LoadingCtx = {
  pushLoad: () => void;
  popLoad: () => void;
  loading: boolean;
};

const LoadingContext = createContext<LoadingCtx | null>(null);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [depth, setDepth] = useState(0);
  const pushLoad = useCallback(() => setDepth((d) => d + 1), []);
  const popLoad = useCallback(() => setDepth((d) => Math.max(0, d - 1)), []);
  const value = useMemo(
    () => ({
      pushLoad,
      popLoad,
      loading: depth > 0,
    }),
    [depth, pushLoad, popLoad]
  );
  return (
    <LoadingContext.Provider value={value}>{children}</LoadingContext.Provider>
  );
}

export function usePageLoading() {
  const ctx = useContext(LoadingContext);
  if (!ctx) throw new Error("usePageLoading requires LoadingProvider");
  return ctx;
}

/** Run async work with global top loading bar (push/pop balanced). */
export function useAsyncLoader() {
  const { pushLoad, popLoad } = usePageLoading();
  return useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      pushLoad();
      try {
        return await fn();
      } finally {
        popLoad();
      }
    },
    [pushLoad, popLoad]
  );
}
