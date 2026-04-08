"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Farm, FarmMemberRow, Paginated } from "@/lib/api";
import { apiFetch } from "@/lib/api";
import { pageQuery } from "@/lib/pagination";

type Props = {
  farms: Farm[];
  farmId: number | null;
  setFarmId: (id: number | null) => void;
  loading: boolean;
  membersCacheEpoch: number;
};

export function FarmPicker({
  farms,
  farmId,
  setFarmId,
  loading,
  membersCacheEpoch,
}: Props) {
  const [open, setOpen] = useState(false);
  const [membersByFarm, setMembersByFarm] = useState<
    Record<number, FarmMemberRow[]>
  >({});
  const wrapRef = useRef<HTMLDivElement>(null);
  const membersLoadingRef = useRef<Set<number>>(new Set());

  const current = farms.find((f) => f.id === farmId);

  const loadMembers = useCallback(async (fid: number, role: string) => {
    if (role !== "owner" && role !== "manager") return;
    if (membersLoadingRef.current.has(fid)) return;
    membersLoadingRef.current.add(fid);
    try {
      const m = await apiFetch<Paginated<FarmMemberRow>>(
        `/farms/${fid}/members?${pageQuery(500, 0)}`
      );
      const list = m.items;
      setMembersByFarm((prev) => ({ ...prev, [fid]: list }));
    } catch {
      membersLoadingRef.current.delete(fid);
    }
  }, []);

  useEffect(() => {
    setMembersByFarm({});
    membersLoadingRef.current.clear();
  }, [membersCacheEpoch]);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="relative" ref={wrapRef}>
      <label className="mr-2 text-sm text-zinc-500" htmlFor="farm-picker-btn">
        Farm
      </label>
      <button
        id="farm-picker-btn"
        type="button"
        disabled={loading || !farms.length}
        onClick={() => setOpen((o) => !o)}
        className="min-w-[10rem] rounded-md border border-zinc-200 bg-white px-3 py-2 text-left text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
      >
        {current?.name ?? "Select farm"}
        <span className="ml-2 text-xs font-normal text-zinc-500">
          {current?.my_role ? `(${current.my_role})` : ""}
        </span>
      </button>
      {open && farms.length > 0 && (
        <div className="absolute right-0 z-50 mt-1 max-h-80 w-72 overflow-auto rounded-md border border-zinc-200 bg-white py-1 shadow-lg">
          {farms.map((f) => (
            <div
              key={f.id}
              onMouseEnter={() => loadMembers(f.id, f.my_role)}
              className="border-b border-zinc-100 last:border-0"
            >
              <button
                type="button"
                className={`w-full px-3 py-2 text-left text-sm hover:bg-zinc-50 ${
                  f.id === farmId ? "bg-emerald-50 text-emerald-900" : ""
                }`}
                onClick={() => {
                  setFarmId(f.id);
                  setOpen(false);
                }}
              >
                <span className="font-medium">{f.name}</span>
                <span className="ml-2 text-xs text-zinc-500">{f.my_role}</span>
              </button>
              {(f.my_role === "owner" || f.my_role === "manager") &&
                membersByFarm[f.id] && (
                  <div className="border-t border-zinc-100 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                    <p className="mb-1 font-medium text-zinc-500">Members</p>
                    {membersByFarm[f.id].map((m) => (
                      <div key={m.user_id}>
                        {m.name}{" "}
                        <span className="text-emerald-800">({m.role})</span>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
