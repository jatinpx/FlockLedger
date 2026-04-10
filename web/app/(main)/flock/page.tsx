"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { PaginationFooter, withPagination } from "@/components/PaginationFooter";
import { useFarm } from "@/lib/farm-context";
import { useAsyncLoader } from "@/lib/loading-context";
import {
  apiFetch,
  type FlockEventRow,
  type FlockSummary,
  type Paginated,
  type Shed,
} from "@/lib/api";
import { toastError, toastSuccess } from "@/lib/toast";

const DEFAULT_LIMIT = 25;

const EVENT_KINDS = [
  { value: "mortality", label: "Mortality" },
  { value: "cull", label: "Cull" },
  { value: "live_sale", label: "Live sale (out)" },
  { value: "transfer_out", label: "Transfer out" },
  { value: "purchase", label: "Purchase (in)" },
  { value: "transfer_in", label: "Transfer in" },
  { value: "count_adjust", label: "Physical count adjust (±)" },
] as const;

function kindLabel(k: string): string {
  return EVENT_KINDS.find((x) => x.value === k)?.label ?? k;
}

export default function FlockPage() {
  const { farms, farmId } = useFarm();
  const runLoaded = useAsyncLoader();
  const currentFarm = farms.find((f) => f.id === farmId);
  const canManage =
    currentFarm?.my_role === "owner" || currentFarm?.my_role === "manager";
  const canPostEvent =
    currentFarm?.my_role === "owner" ||
    currentFarm?.my_role === "manager" ||
    currentFarm?.my_role === "worker";

  const [summary, setSummary] = useState<FlockSummary | null>(null);
  const [sheds, setSheds] = useState<Shed[]>([]);
  const [events, setEvents] = useState<FlockEventRow[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [offset, setOffset] = useState(0);

  const [shedId, setShedId] = useState<number | "">("");
  const [eventDate, setEventDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [eventKind, setEventKind] =
    useState<(typeof EVENT_KINDS)[number]["value"]>("mortality");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");

  const shedNameById = useMemo(() => {
    const m = new Map<number, string>();
    for (const s of sheds) m.set(s.id, s.name);
    return m;
  }, [sheds]);

  /** One loading bar cycle: summary, sheds, and paged events together (avoids duplicate effect runs). */
  const loadFlockPageData = useCallback(async () => {
    if (!farmId) return;
    await runLoaded(async () => {
      const [sum, shedRes, evRes] = await Promise.all([
        apiFetch<FlockSummary>(`/farms/${farmId}/flock/summary`),
        apiFetch<Paginated<Shed>>(
          withPagination(`/farms/${farmId}/sheds`, 200, 0),
        ),
        apiFetch<Paginated<FlockEventRow>>(
          withPagination(`/farms/${farmId}/flock/events`, limit, offset),
        ),
      ]);
      setSummary(sum);
      setSheds(shedRes.items);
      setEvents(evRes.items);
      setTotal(evRes.total);
    });
  }, [farmId, limit, offset]);

  useLayoutEffect(() => {
    setOffset(0);
  }, [limit, farmId]);

  useEffect(() => {
    if (!farmId) return;
    loadFlockPageData().catch((e) => toastError(e));
  }, [farmId, loadFlockPageData]);

  useEffect(() => {
    if (shedId === "" && sheds.length > 0) {
      setShedId(sheds[0].id);
    }
  }, [sheds, shedId]);

  async function submitEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!farmId || !canPostEvent) return;
    if (shedId === "") {
      toastError(new Error("Add a shed under Settings first."));
      return;
    }
    const qRaw = quantity.trim();
    const q = parseInt(qRaw, 10);
    if (Number.isNaN(q) || (eventKind !== "count_adjust" && q <= 0)) {
      toastError(new Error("Enter a valid quantity (positive, or signed for count adjust)."));
      return;
    }
    if (eventKind === "count_adjust" && q === 0) {
      toastError(new Error("Count adjust cannot be zero."));
      return;
    }
    try {
      await runLoaded(async () => {
        await apiFetch(`/farms/${farmId}/flock/events`, {
          method: "POST",
          body: JSON.stringify({
            shed_id: shedId,
            event_date: eventDate,
            event_kind: eventKind,
            quantity: q,
            note: note.trim() || null,
          }),
        });
      });
      toastSuccess("Flock event recorded.");
      setQuantity("");
      setNote("");
      await loadFlockPageData();
    } catch (err) {
      toastError(err);
    }
  }

  async function deleteEvent(id: number) {
    if (!farmId || !canManage) return;
    if (
      !window.confirm(
        "Delete this event? Shed bird counts will be reversed. This may fail if counts would go negative."
      )
    ) {
      return;
    }
    try {
      await runLoaded(async () => {
        await apiFetch(`/farms/${farmId}/flock/events/${id}`, {
          method: "DELETE",
        });
      });
      toastSuccess("Event removed.");
      await loadFlockPageData();
    } catch (err) {
      toastError(err);
    }
  }

  if (!farmId) {
    return <p className="text-zinc-500 dark:text-zinc-400">Select or create a farm in Settings.</p>;
  }

  const removalsTotal = summary
    ? (summary.by_kind.mortality ?? 0) +
      (summary.by_kind.cull ?? 0) +
      (summary.by_kind.live_sale ?? 0) +
      (summary.by_kind.transfer_out ?? 0)
    : 0;
  const additionsTotal = summary
    ? (summary.by_kind.purchase ?? 0) + (summary.by_kind.transfer_in ?? 0)
    : 0;

  return (
    <div className="space-y-8">
      {summary ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">Live head count</p>
            <p className="mt-2 text-3xl font-semibold text-emerald-800 dark:text-emerald-400">
              {summary.birds_alive_total.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Sum of shed counts (current)</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">Mortality (logged)</p>
            <p className="mt-2 text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
              {(summary.by_kind.mortality ?? 0).toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">All removals (events)</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              {removalsTotal.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Mortality, cull, sale, transfer out</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">Additions (events)</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-800 dark:text-emerald-400">
              {additionsTotal.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Purchase & transfer in</p>
          </div>
        </div>
      ) : (
        <p className="text-zinc-500 dark:text-zinc-400">Loading flock summary…</p>
      )}

      {summary && Object.keys(summary.by_kind).length > 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Totals by event type</h3>
          <ul className="mt-3 flex flex-wrap gap-2 text-sm">
            {Object.entries(summary.by_kind).map(([k, v]) => (
              <li
                key={k}
                className="rounded-md bg-zinc-50 dark:bg-zinc-900 px-3 py-1.5 text-zinc-700 dark:text-zinc-300"
              >
                <span className="font-medium">{kindLabel(k)}</span>: {v.toLocaleString()}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {summary && summary.by_shed.length > 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">By shed</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-zinc-500 dark:text-zinc-400">
                <tr>
                  <th className="py-2 pr-4">Shed</th>
                  <th className="py-2">Birds</th>
                </tr>
              </thead>
              <tbody>
                {summary.by_shed.map((s) => (
                  <tr key={s.shed_id} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="py-2 pr-4 font-medium text-zinc-900 dark:text-zinc-100">{s.name}</td>
                    <td className="py-2 text-zinc-900 dark:text-zinc-100">{s.bird_count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {canPostEvent ? (
        <form
          onSubmit={submitEvent}
          className="max-w-xl space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Log flock event</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Removals use positive numbers (birds leaving the shed). For a physical recount
            mismatch, use{" "}
            <strong className="text-zinc-700 dark:text-zinc-200">Physical count adjust</strong> with
            a signed number (+ or −).
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-sm text-zinc-600 dark:text-zinc-400">Shed</label>
              <select
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                value={shedId === "" ? "" : String(shedId)}
                onChange={(e) =>
                  setShedId(e.target.value ? Number(e.target.value) : "")
                }
                required
              >
                {sheds.length === 0 ? (
                  <option value="">No sheds — add in Settings</option>
                ) : null}
                {sheds.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.bird_count} birds)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-zinc-600 dark:text-zinc-400">Date</label>
              <input
                type="date"
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-sm text-zinc-600 dark:text-zinc-400">Event</label>
              <select
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                value={eventKind}
                onChange={(e) =>
                  setEventKind(e.target.value as (typeof EVENT_KINDS)[number]["value"])
                }
              >
                {EVENT_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm text-zinc-600 dark:text-zinc-400">
                Quantity (birds){eventKind === "count_adjust" ? " — use + or −" : ""}
              </label>
              <input
                type="number"
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm text-zinc-600 dark:text-zinc-400">Note (optional)</label>
              <input
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
          <button
            type="submit"
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            Save event
          </button>
        </form>
      ) : (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">You do not have permission to log flock events.</p>
      )}

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-100 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/80">
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Recent events</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-100 bg-zinc-50/80 text-xs uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Shed</th>
                <th className="px-4 py-3">Kind</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">Δ birds</th>
                <th className="px-4 py-3">Note</th>
                {canManage ? <th className="w-20 px-4 py-3" /> : null}
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id} className="border-b border-zinc-50 dark:border-zinc-800/80">
                  <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100">{ev.event_date}</td>
                  <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100">
                    {shedNameById.get(ev.shed_id) ?? `#${ev.shed_id}`}
                  </td>
                  <td className="px-4 py-3 text-zinc-800 dark:text-zinc-200">{kindLabel(ev.event_kind)}</td>
                  <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100">{ev.quantity}</td>
                  <td
                    className={`px-4 py-3 font-medium ${
                      ev.birds_delta < 0
                        ? "text-red-800 dark:text-red-400"
                        : ev.birds_delta > 0
                          ? "text-emerald-800 dark:text-emerald-400"
                          : "text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    {ev.birds_delta > 0 ? "+" : ""}
                    {ev.birds_delta}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{ev.note ?? "—"}</td>
                  {canManage ? (
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="text-xs text-red-700 hover:underline dark:text-red-400"
                        onClick={() => void deleteEvent(ev.id)}
                      >
                        Delete
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationFooter
          total={total}
          limit={limit}
          offset={offset}
          onLimitChange={setLimit}
          onOffsetChange={setOffset}
        />
      </div>
    </div>
  );
}
