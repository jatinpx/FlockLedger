"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

  const refreshSummary = useCallback(async () => {
    if (!farmId) return;
    await runLoaded(async () => {
      const [sum, shedRes] = await Promise.all([
        apiFetch<FlockSummary>(`/farms/${farmId}/flock/summary`),
        apiFetch<Paginated<Shed>>(
          withPagination(`/farms/${farmId}/sheds`, 200, 0)
        ),
      ]);
      setSummary(sum);
      setSheds(shedRes.items);
    });
  }, [farmId, runLoaded]);

  const refreshEvents = useCallback(async () => {
    if (!farmId) return;
    await runLoaded(async () => {
      const res = await apiFetch<Paginated<FlockEventRow>>(
        withPagination(`/farms/${farmId}/flock/events`, limit, offset)
      );
      setEvents(res.items);
      setTotal(res.total);
    });
  }, [farmId, limit, offset, runLoaded]);

  useEffect(() => {
    setOffset(0);
  }, [limit, farmId]);

  useEffect(() => {
    if (!farmId) return;
    refreshSummary().catch((e) => toastError(e));
  }, [farmId, refreshSummary]);

  useEffect(() => {
    if (shedId === "" && sheds.length > 0) {
      setShedId(sheds[0].id);
    }
  }, [sheds, shedId]);

  useEffect(() => {
    if (!farmId) return;
    refreshEvents().catch((e) => toastError(e));
  }, [farmId, refreshEvents]);

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
      await refreshSummary();
      await refreshEvents();
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
      await refreshSummary();
      await refreshEvents();
    } catch (err) {
      toastError(err);
    }
  }

  if (!farmId) {
    return <p className="text-zinc-500">Select or create a farm in Settings.</p>;
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
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase text-zinc-500">Live head count</p>
            <p className="mt-2 text-3xl font-semibold text-emerald-800">
              {summary.birds_alive_total.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-zinc-500">Sum of shed counts (current)</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase text-zinc-500">Mortality (logged)</p>
            <p className="mt-2 text-3xl font-semibold text-zinc-900">
              {(summary.by_kind.mortality ?? 0).toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase text-zinc-500">All removals (events)</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-900">
              {removalsTotal.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-zinc-500">Mortality, cull, sale, transfer out</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase text-zinc-500">Additions (events)</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-800">
              {additionsTotal.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-zinc-500">Purchase & transfer in</p>
          </div>
        </div>
      ) : (
        <p className="text-zinc-500">Loading flock summary…</p>
      )}

      {summary && Object.keys(summary.by_kind).length > 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-zinc-800">Totals by event type</h3>
          <ul className="mt-3 flex flex-wrap gap-2 text-sm">
            {Object.entries(summary.by_kind).map(([k, v]) => (
              <li
                key={k}
                className="rounded-md bg-zinc-50 px-3 py-1.5 text-zinc-700"
              >
                <span className="font-medium">{kindLabel(k)}</span>: {v.toLocaleString()}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {summary && summary.by_shed.length > 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-zinc-800">By shed</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-zinc-500">
                <tr>
                  <th className="py-2 pr-4">Shed</th>
                  <th className="py-2">Birds</th>
                </tr>
              </thead>
              <tbody>
                {summary.by_shed.map((s) => (
                  <tr key={s.shed_id} className="border-t border-zinc-100">
                    <td className="py-2 pr-4 font-medium text-zinc-900">{s.name}</td>
                    <td className="py-2">{s.bird_count.toLocaleString()}</td>
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
          className="max-w-xl space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
        >
          <h2 className="text-lg font-semibold text-zinc-900">Log flock event</h2>
          <p className="text-sm text-zinc-500">
            Removals use positive numbers (birds leaving the shed). For a physical recount
            mismatch, use <strong>Physical count adjust</strong> with a signed number (+ or −).
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-sm text-zinc-600">Shed</label>
              <select
                className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
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
              <label className="text-sm text-zinc-600">Date</label>
              <input
                type="date"
                className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-sm text-zinc-600">Event</label>
              <select
                className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
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
              <label className="text-sm text-zinc-600">
                Quantity (birds){eventKind === "count_adjust" ? " — use + or −" : ""}
              </label>
              <input
                type="number"
                className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm text-zinc-600">Note (optional)</label>
              <input
                className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
          <button
            type="submit"
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
          >
            Save event
          </button>
        </form>
      ) : (
        <p className="text-sm text-zinc-500">You do not have permission to log flock events.</p>
      )}

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-zinc-800">Recent events</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-100 text-xs uppercase text-zinc-500">
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
                <tr key={ev.id} className="border-b border-zinc-50">
                  <td className="px-4 py-3">{ev.event_date}</td>
                  <td className="px-4 py-3">
                    {shedNameById.get(ev.shed_id) ?? `#${ev.shed_id}`}
                  </td>
                  <td className="px-4 py-3">{kindLabel(ev.event_kind)}</td>
                  <td className="px-4 py-3">{ev.quantity}</td>
                  <td
                    className={`px-4 py-3 font-medium ${
                      ev.birds_delta < 0
                        ? "text-red-800"
                        : ev.birds_delta > 0
                          ? "text-emerald-800"
                          : "text-zinc-600"
                    }`}
                  >
                    {ev.birds_delta > 0 ? "+" : ""}
                    {ev.birds_delta}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{ev.note ?? "—"}</td>
                  {canManage ? (
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="text-xs text-red-700 hover:underline"
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
