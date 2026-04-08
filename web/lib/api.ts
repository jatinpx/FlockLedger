const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function getApiBase(): string {
  return API.replace(/\/$/, "");
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("flock_token");
}

export function setToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem("flock_token", token);
  else localStorage.removeItem("flock_token");
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const { auth = true, headers, ...rest } = options;
  const h = new Headers(headers);
  h.set("Content-Type", "application/json");
  if (auth) {
    const t = getToken();
    if (t) h.set("Authorization", `Bearer ${t}`);
  }
  const res = await fetch(`${getApiBase()}${path}`, { ...rest, headers: h });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export type Paginated<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

export type Farm = {
  id: number;
  name: string;
  location: string | null;
  owner_id: number;
  created_at: string;
  my_role: string;
};

export type FarmMemberRow = {
  user_id: number;
  name: string;
  email: string;
  role: string;
};

export type UserSearchRow = {
  id: number;
  name: string;
  email: string;
};

export type Shed = {
  id: number;
  farm_id: number;
  name: string;
  bird_count: number;
  created_at: string;
};

export type EggProduction = {
  id: number;
  shed_id: number;
  date: string;
  eggs_produced: number;
  broken_eggs: number;
  usable_eggs: number;
  trays: number;
  eggs_per_tray: number;
  created_at: string;
};

export type FeedRow = {
  id: number;
  farm_id: number;
  date: string;
  feed_received: number;
  feed_used: number;
  feed_remaining: number;
  opening_balance_kg?: number;
  remaining_auto?: boolean;
  created_at: string;
};

export type SaleRow = {
  id: number;
  farm_id: number;
  buyer_name: string;
  trays_sold: number;
  rate_per_tray: number;
  total_amount: number;
  date: string;
  created_at: string;
};

export type ExpenseRow = {
  id: number;
  farm_id: number;
  category: string;
  amount: number;
  description: string | null;
  date: string;
  created_at: string;
};

export type AuditLogRow = {
  id: number;
  farm_id: number | null;
  user_id: number;
  user_name: string;
  user_email: string;
  action: string;
  resource_type: string;
  resource_id: number | null;
  detail: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
};

export type DashboardSummary = {
  farm_id: number;
  total_birds: number;
  tray_stock: {
    trays_produced_equivalent: number;
    trays_sold: number;
    trays_in_stock: number;
    usable_eggs_equivalent: number;
  };
  last_7_days_eggs: number;
  last_7_days_trays: number;
  labour_due_total: number;
  flock_mortality_total: number;
  flock_birds_added_total: number;
  flock_birds_removed_total: number;
};

export type FarmLabourRow = {
  id: number;
  farm_id: number;
  full_name: string;
  phone: string | null;
  personnel_kind: string;
  compensation_type: string;
  default_rate: number | null;
  notes: string | null;
  is_active: boolean;
  hired_at: string;
  balance_due: number;
  created_at: string;
};

export type LabourBalanceRow = {
  labour_id: number;
  full_name: string;
  personnel_kind: string;
  is_active: boolean;
  balance: number;
};

export type LabourLedgerRow = {
  id: number;
  farm_id: number;
  labour_id: number;
  line_date: string;
  line_type: string;
  amount: number;
  description: string | null;
  created_by_user_id: number;
  created_at: string;
};

export type FlockSummary = {
  birds_alive_total: number;
  by_kind: Record<string, number>;
  by_shed: { shed_id: number; name: string; bird_count: number }[];
};

export type FlockEventRow = {
  id: number;
  farm_id: number;
  shed_id: number;
  event_date: string;
  event_kind: string;
  quantity: number;
  birds_delta: number;
  note: string | null;
  created_by_user_id: number;
  created_at: string;
};
