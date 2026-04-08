import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Farm, Paginated } from "./api";
import { apiFetch } from "./api";
import { pageQuery } from "./pagination";

type FarmContextValue = {
  farms: Farm[];
  farmId: number | null;
  setFarmId: (id: number | null) => void;
  refreshFarms: () => Promise<void>;
  loading: boolean;
  membersCacheEpoch: number;
  invalidateMemberLists: () => void;
};

const FarmContext = createContext<FarmContextValue | null>(null);

const STORAGE_KEY = "flock_farm_id";

export function FarmProvider({ children }: { children: React.ReactNode }) {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [farmId, setFarmIdState] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [membersCacheEpoch, setMembersCacheEpoch] = useState(0);

  const invalidateMemberLists = useCallback(() => {
    setMembersCacheEpoch((e) => e + 1);
  }, []);

  const refreshFarms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<Paginated<Farm>>(`/farms?${pageQuery(500, 0)}`);
      const items = res.items;
      setFarms(items);
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      const sid = stored ? parseInt(stored, 10) : NaN;
      setFarmIdState((current) => {
        if (!items.length) return null;
        if (current != null && items.some((f) => f.id === current)) {
          return current;
        }
        if (!Number.isNaN(sid) && items.some((f) => f.id === sid)) {
          return sid;
        }
        const first = items[0].id;
        void AsyncStorage.setItem(STORAGE_KEY, String(first));
        return first;
      });
    } catch {
      setFarms([]);
      setFarmIdState(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshFarms();
  }, [refreshFarms]);

  const setFarmId = useCallback((id: number | null) => {
    setFarmIdState(id);
    if (id != null) void AsyncStorage.setItem(STORAGE_KEY, String(id));
    else void AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo(
    () => ({
      farms,
      farmId,
      setFarmId,
      refreshFarms,
      loading,
      membersCacheEpoch,
      invalidateMemberLists,
    }),
    [farms, farmId, setFarmId, refreshFarms, loading, membersCacheEpoch, invalidateMemberLists]
  );

  return <FarmContext.Provider value={value}>{children}</FarmContext.Provider>;
}

export function useFarm() {
  const ctx = useContext(FarmContext);
  if (!ctx) throw new Error("useFarm must be used within FarmProvider");
  return ctx;
}
