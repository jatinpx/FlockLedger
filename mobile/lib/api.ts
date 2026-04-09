import * as SecureStore from "expo-secure-store";
import { pageQuery } from "./pagination";

const BASE = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000").replace(
  /\/$/,
  ""
);

export function getApiBase(): string {
  return BASE;
}

const TOKEN_KEY = "flock_token";

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string | null): Promise<void> {
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const { auth = true, headers, ...rest } = options;
  const h = new Headers(headers);
  h.set("Content-Type", "application/json");
  if (auth) {
    const t = await getToken();
    if (t) h.set("Authorization", `Bearer ${t}`);
  }
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...rest, headers: h });
  } catch (error) {
    console.error("[apiFetch] network error", {
      method: (rest.method ?? "GET").toUpperCase(),
      url: `${BASE}${path}`,
      error,
    });
    throw error;
  }
  if (!res.ok) {
    const text = await res.text();
    const msg = text || res.statusText || `HTTP ${res.status}`;
    console.error("[apiFetch] request failed", {
      method: (rest.method ?? "GET").toUpperCase(),
      url: `${BASE}${path}`,
      status: res.status,
      statusText: res.statusText,
      body: text,
    });
    throw new Error(msg);
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

/** Walk pages until all rows are loaded (for dropdowns; cap by API max limit per request). */
export async function fetchAllPaginated<T>(pathWithoutPagination: string): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  const limit = 500;
  while (true) {
    const q = pageQuery(limit, offset);
    const url = pathWithoutPagination.includes("?")
      ? `${pathWithoutPagination}&${q}`
      : `${pathWithoutPagination}?${q}`;
    const r = await apiFetch<Paginated<T>>(url);
    all.push(...r.items);
    if (r.items.length === 0 || all.length >= r.total) break;
    offset += limit;
  }
  return all;
}

export type Farm = {
  id: number;
  name: string;
  location: string | null;
  owner_id: number;
  created_at: string;
  my_role: string;
};

export type FarmDetail = {
  id: number;
  name: string;
  location: string | null;
  owner_id: number;
  created_at: string;
};

export type Shed = {
  id: number;
  farm_id: number;
  name: string;
  bird_count: number;
  created_at: string;
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
  purchase_cost_inr?: number | null;
  /** Present when API supports auto-remaining (migration 003+). */
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
  rate_per_egg?: number;
  total_amount: number;
  date: string;
  created_at: string;
};

export const MISCELLANEOUS_EXPENSE_CATEGORY = "Miscellaneous" as const;

export const LABOUR_WAGES_CATEGORY = "Labour & wages" as const;

export async function fetchExpenseCategories(): Promise<string[]> {
  return apiFetch<string[]>("/expense-categories");
}

export type ExpenseRow = {
  id: number;
  farm_id: number;
  category: string;
  amount: number;
  description: string | null;
  date: string;
  created_at: string;
  labour_ledger_line_id?: number | null;
  feed_inventory_id?: number | null;
  linked_labour_id?: number | null;
  linked_labour_name?: string | null;
};

export type DashboardSummary = {
  farm_id: number;
  period_start: string;
  period_end: string;
  period_usable_eggs: number;
  period_trays: number;
  total_birds: number;
  tray_stock: {
    trays_produced_equivalent: number;
    trays_sold: number;
    trays_in_stock: number;
    usable_eggs_equivalent: number;
  };
  labour_due_total?: number;
  flock_mortality_total?: number;
  flock_birds_added_total?: number;
  flock_birds_removed_total?: number;
};

export type ProfitExpenseBreakdown = {
  expense_entries: number;
  unlinked_labour_payments: number;
  feed_purchase_cost_on_entries: number;
  total: number;
};

export type ProfitSummaryOut = {
  period_start: string;
  period_end: string;
  revenue: number;
  expenses: number;
  profit: number;
  cost_per_egg: number | null;
  usable_eggs_in_period?: number;
  expense_breakdown: ProfitExpenseBreakdown;
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
  linked_user_id?: number | null;
  created_at: string;
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
  linked_expense_id?: number | null;
};

export type PayrollWorkerRow = {
  labour_id: number;
  full_name: string;
  linked_user_id: number | null;
  personnel_kind: string;
  is_active: boolean;
  monthly_salary: number | null;
  balance_due: number;
  month: string;
  month_accrued: number;
  month_paid: number;
  month_net: number;
  payroll_accrual_posted: boolean;
  payroll_accrual_amount: number | null;
};

export type PayrollListResponse = {
  month: string;
  labour_due_definition: string;
  workers: PayrollWorkerRow[];
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

/** @deprecated use ProfitSummaryOut */
export type ProfitSummary = ProfitSummaryOut;

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
