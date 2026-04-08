"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type LoadingActions = {
  pushLoad: () => void;
  popLoad: () => void;
};

/** Stable across loading toggles — useAsyncLoader subscribers do not re-render on each fetch. */
const LoadingActionsContext = createContext<LoadingActions | null>(null);
const LoadingStateContext = createContext<boolean | null>(null);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [depth, setDepth] = useState(0);
  const pushLoad = useCallback(() => setDepth((d) => d + 1), []);
  const popLoad = useCallback(() => setDepth((d) => Math.max(0, d - 1)), []);

  const actions = useMemo(
    () => ({ pushLoad, popLoad }),
    [pushLoad, popLoad],
  );

  const loading = depth > 0;

  return (
    <LoadingActionsContext.Provider value={actions}>
      <LoadingStateContext.Provider value={loading}>
        {children}
      </LoadingStateContext.Provider>
    </LoadingActionsContext.Provider>
  );
}

export function usePageLoading() {
  const loading = useContext(LoadingStateContext);
  if (loading === null) {
    throw new Error("usePageLoading requires LoadingProvider");
  }
  return { loading };
}

/**
 * Stable identity (empty deps) so list pages don't re-run data effects when only
 * loading depth changes. Uses a ref to always call the latest push/pop.
 */
export function useAsyncLoader() {
  const actions = useContext(LoadingActionsContext);
  if (!actions) {
    throw new Error("useAsyncLoader requires LoadingProvider");
  }
  const ref = useRef(actions);
  ref.current = actions;
  return useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    const { pushLoad, popLoad } = ref.current;
    pushLoad();
    try {
      return await fn();
    } finally {
      popLoad();
    }
  }, []);
}
