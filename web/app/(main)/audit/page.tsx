"use client";

import { useCallback, useEffect, useState } from "react";
import { PaginationFooter, withPagination } from "@/components/PaginationFooter";
import { useFarm } from "@/lib/farm-context";
import { useAsyncLoader } from "@/lib/loading-context";
import { apiFetch, type AuditLogRow, type Paginated } from "@/lib/api";
import { toastError } from "@/lib/toast";

const DEFAULT_LIMIT = 25;

export default function AuditPage() {
  const { farms, farmId } = useFarm();
  const runLoaded = useAsyncLoader();
  const currentFarm = farms.find((f) => f.id === farmId);
  const canView =
    currentFarm?.my_role === "owner" || currentFarm?.my_role === "manager";

  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [offset, setOffset] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(async () => {
    if (!farmId || !canView) return;
    await runLoaded(async () => {
      const r = await apiFetch<Paginated<AuditLogRow>>(
        withPagination(`/farms/${farmId}/audit-logs`, limit, offset)
      );
      setRows(r.items);
      setTotal(r.total);
    });
  }, [farmId, canView, limit, offset, runLoaded]);

  useEffect(() => {
    setOffset(0);
  }, [limit, farmId]);

  useEffect(() => {
    if (!farmId || !canView) {
      setRows([]);
      setTotal(0);
      return;
    }
    setLoadFailed(false);
    load().catch((e) => {
      toastError(e);
      setLoadFailed(true);
    });
  }, [farmId, canView, load]);

  if (!farmId) {
    return (
      <p className="text-zinc-500">Select a farm to view its audit history.</p>
    );
  }

  if (!canView) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 text-zinc-600 shadow-sm">
        <p className="font-medium text-zinc-800">Audit log</p>
        <p className="mt-2 text-sm">
          Only farm owners and managers can view the activity log for this farm.
        </p>
      </div>
    );
  }

  if (loadFailed && rows.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <p className="text-zinc-600">The audit log could not be loaded.</p>
        <button
          type="button"
          className="mt-4 rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
          onClick={() => void load()}
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Audit log</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Recent creates, updates, and deletes (newest first). Owners and
          managers only.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-100 bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Who</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Resource</th>
                <th className="px-3 py-2">IP</th>
                <th className="px-3 py-2">Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-zinc-50 align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-zinc-600">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <span className="font-medium text-zinc-800">{r.user_name}</span>
                    <br />
                    <span className="text-zinc-500">{r.user_email}</span>
                  </td>
                  <td className="px-3 py-2 text-xs text-zinc-700">{r.action}</td>
                  <td className="px-3 py-2 text-xs text-zinc-700">
                    {r.resource_type}
                    {r.resource_id != null ? ` #${r.resource_id}` : ""}
                  </td>
                  <td className="px-3 py-2 text-xs text-zinc-500">
                    {r.ip_address ?? "—"}
                  </td>
                  <td className="max-w-md px-3 py-2">
                    <pre className="overflow-x-auto whitespace-pre-wrap break-all text-[11px] text-zinc-600">
                      {r.detail ? JSON.stringify(r.detail, null, 2) : "—"}
                    </pre>
                  </td>
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

      {!rows.length && !loadFailed && (
        <p className="text-sm text-zinc-500">No audit entries on this page.</p>
      )}
    </div>
  );
}
