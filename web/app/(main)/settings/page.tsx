"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { PaginationFooter, withPagination } from "@/components/PaginationFooter";
import { useFarm } from "@/lib/farm-context";
import { useAsyncLoader } from "@/lib/loading-context";
import {
  apiFetch,
  type Farm,
  type FarmMemberRow,
  type Paginated,
  type Shed,
  type UserSearchRow,
} from "@/lib/api";
import { toastError, toastSuccess } from "@/lib/toast";

const DEFAULT_LIMIT = 10;

export default function SettingsPage() {
  const { farms, farmId, setFarmId, refreshFarms, invalidateMemberLists } =
    useFarm();
  const runLoaded = useAsyncLoader();
  const currentFarm = farms.find((f) => f.id === farmId);
  const canManage =
    currentFarm?.my_role === "owner" || currentFarm?.my_role === "manager";
  const isOwner = currentFarm?.my_role === "owner";

  const [farmName, setFarmName] = useState("");
  const [farmLocation, setFarmLocation] = useState("");
  const [editFarmName, setEditFarmName] = useState("");
  const [editFarmLocation, setEditFarmLocation] = useState("");

  const [shedName, setShedName] = useState("");
  const [birds, setBirds] = useState("0");
  const [sheds, setSheds] = useState<Shed[]>([]);
  const [shedTotal, setShedTotal] = useState(0);
  const [shedLimit, setShedLimit] = useState(DEFAULT_LIMIT);
  const [shedOffset, setShedOffset] = useState(0);
  const [editingShed, setEditingShed] = useState<number | null>(null);
  const [editShedName, setEditShedName] = useState("");
  const [editShedBirds, setEditShedBirds] = useState("");

  const [memberRole, setMemberRole] = useState("worker");
  const [memberEmail, setMemberEmail] = useState("");
  const [members, setMembers] = useState<FarmMemberRow[]>([]);
  const [memTotal, setMemTotal] = useState(0);
  const [memLimit, setMemLimit] = useState(DEFAULT_LIMIT);
  const [memOffset, setMemOffset] = useState(0);
  const [roleSavingId, setRoleSavingId] = useState<number | null>(null);

  const [userQuery, setUserQuery] = useState("");
  const [searchHits, setSearchHits] = useState<UserSearchRow[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchLimit, setSearchLimit] = useState(25);
  const [searchOffset, setSearchOffset] = useState(0);
  const [searchBusy, setSearchBusy] = useState(false);

  const loadSheds = useCallback(async () => {
    if (!farmId) return;
    await runLoaded(async () => {
      const r = await apiFetch<Paginated<Shed>>(
        withPagination(`/farms/${farmId}/sheds`, shedLimit, shedOffset)
      );
      setSheds(r.items);
      setShedTotal(r.total);
    });
  }, [farmId, shedLimit, shedOffset]);

  const loadMembers = useCallback(async () => {
    if (!farmId || !canManage) return;
    await runLoaded(async () => {
      const r = await apiFetch<Paginated<FarmMemberRow>>(
        withPagination(`/farms/${farmId}/members`, memLimit, memOffset)
      );
      setMembers(r.items);
      setMemTotal(r.total);
    });
  }, [farmId, canManage, memLimit, memOffset]);

  useLayoutEffect(() => {
    setShedOffset(0);
  }, [shedLimit, farmId]);
  useLayoutEffect(() => {
    setMemOffset(0);
  }, [memLimit, farmId]);
  useLayoutEffect(() => {
    setSearchOffset(0);
  }, [searchLimit, userQuery, farmId]);

  useEffect(() => {
    if (!farmId) {
      setSheds([]);
      setShedTotal(0);
      return;
    }
    loadSheds().catch((e) => toastError(e));
  }, [farmId, loadSheds]);

  useEffect(() => {
    if (!farmId || !canManage) {
      setMembers([]);
      setMemTotal(0);
      return;
    }
    loadMembers().catch((e) => toastError(e));
  }, [farmId, canManage, loadMembers]);

  useEffect(() => {
    if (!farmId || !canManage) {
      setSearchHits([]);
      setSearchTotal(0);
      return;
    }
    const t = setTimeout(() => {
      const q = userQuery.trim();
      const path = `/farms/${farmId}/users/search?q=${encodeURIComponent(q)}`;
      setSearchBusy(true);
      apiFetch<Paginated<UserSearchRow>>(
        withPagination(path, searchLimit, searchOffset)
      )
        .then((r) => {
          setSearchHits(r.items);
          setSearchTotal(r.total);
        })
        .catch(() => {
          setSearchHits([]);
          setSearchTotal(0);
        })
        .finally(() => setSearchBusy(false));
    }, 300);
    return () => clearTimeout(t);
  }, [farmId, canManage, userQuery, searchLimit, searchOffset]);

  useEffect(() => {
    if (currentFarm) {
      setEditFarmName(currentFarm.name);
      setEditFarmLocation(currentFarm.location ?? "");
    }
  }, [currentFarm]);

  useEffect(() => {
    if (!isOwner && memberRole === "owner") setMemberRole("worker");
  }, [isOwner, memberRole]);

  async function createFarm(e: React.FormEvent) {
    e.preventDefault();
    try {
      await runLoaded(async () => {
        const f = await apiFetch<Farm>("/farms", {
          method: "POST",
          body: JSON.stringify({
            name: farmName,
            location: farmLocation || null,
          }),
        });
        setFarmName("");
        setFarmLocation("");
        await refreshFarms();
        setFarmId(f.id);
        toastSuccess(`Farm “${f.name}” created.`);
      });
    } catch (err) {
      toastError(err);
    }
  }

  async function saveFarmDetails(e: React.FormEvent) {
    e.preventDefault();
    if (!farmId || !canManage) return;
    try {
      await runLoaded(async () => {
        await apiFetch(`/farms/${farmId}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: editFarmName,
            location: editFarmLocation || null,
          }),
        });
      });
      await refreshFarms();
      toastSuccess("Farm updated.");
    } catch (err) {
      toastError(err);
    }
  }

  async function addShed(e: React.FormEvent) {
    e.preventDefault();
    if (!farmId) return;
    try {
      await runLoaded(async () => {
        await apiFetch(`/farms/${farmId}/sheds`, {
          method: "POST",
          body: JSON.stringify({
            name: shedName,
            bird_count: parseInt(birds, 10) || 0,
          }),
        });
      });
      setShedName("");
      setBirds("0");
      await loadSheds();
      toastSuccess("Shed added.");
    } catch (err) {
      toastError(err);
    }
  }

  async function saveShed(shedId: number) {
    if (!farmId) return;
    try {
      await runLoaded(async () => {
        await apiFetch(`/farms/${farmId}/sheds/${shedId}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: editShedName,
            bird_count: parseInt(editShedBirds, 10),
          }),
        });
      });
      setEditingShed(null);
      await loadSheds();
      toastSuccess("Shed updated.");
    } catch (err) {
      toastError(err);
    }
  }

  async function addMemberByUserId(uid: number) {
    if (!farmId) return;
    try {
      await runLoaded(async () => {
        await apiFetch(`/farms/${farmId}/members/by-user-id`, {
          method: "POST",
          body: JSON.stringify({ user_id: uid, role: memberRole }),
        });
      });
      setUserQuery("");
      await loadMembers();
      invalidateMemberLists();
      toastSuccess("Member added.");
    } catch (err) {
      toastError(err);
    }
  }

  async function addMemberByEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!farmId) return;
    try {
      await runLoaded(async () => {
        await apiFetch(`/farms/${farmId}/members`, {
          method: "POST",
          body: JSON.stringify({ email: memberEmail.trim(), role: memberRole }),
        });
      });
      setMemberEmail("");
      await loadMembers();
      invalidateMemberLists();
      toastSuccess("Member invited.");
    } catch (err) {
      toastError(err);
    }
  }

  async function updateMemberRole(uid: number, newRole: string) {
    if (!farmId) return;
    setRoleSavingId(uid);
    try {
      await apiFetch<FarmMemberRow>(`/farms/${farmId}/members/${uid}`, {
        method: "PATCH",
        body: JSON.stringify({ role: newRole }),
      });
      await loadMembers();
      invalidateMemberLists();
      toastSuccess("Role updated.");
    } catch (err) {
      toastError(err);
    } finally {
      setRoleSavingId(null);
    }
  }

  function roleOptionsForMember(m: FarmMemberRow): string[] {
    if (m.role === "owner" && !isOwner) return [];
    if (isOwner) return ["worker", "manager", "owner"];
    return ["worker", "manager"];
  }

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Create farm</h2>
        <form onSubmit={createFarm} className="mt-4 space-y-3">
          <input
            placeholder="Farm name"
            className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
            value={farmName}
            onChange={(e) => setFarmName(e.target.value)}
            required
          />
          <input
            placeholder="Location (optional)"
            className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
            value={farmLocation}
            onChange={(e) => setFarmLocation(e.target.value)}
          />
          <button
            type="submit"
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white"
          >
            Create
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Your farms</h2>
        <ul className="mt-3 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
          {farms.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                className={`text-left underline-offset-2 hover:underline ${
                  f.id === farmId ? "font-semibold text-emerald-800 dark:text-emerald-400" : ""
                }`}
                onClick={() => setFarmId(f.id)}
              >
                {f.name}
              </button>
              <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">({f.my_role})</span>
              {f.location && (
                <span className="text-zinc-500 dark:text-zinc-400"> — {f.location}</span>
              )}
            </li>
          ))}
          {!farms.length && <li className="text-zinc-500 dark:text-zinc-400">No farms yet.</li>}
        </ul>
      </section>

      {farmId && currentFarm && (
        <>
          {canManage && (
            <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Farm details
              </h2>
              <form onSubmit={saveFarmDetails} className="mt-4 space-y-3">
                <input
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
                  value={editFarmName}
                  onChange={(e) => setEditFarmName(e.target.value)}
                  required
                />
                <input
                  placeholder="Location"
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
                  value={editFarmLocation}
                  onChange={(e) => setEditFarmLocation(e.target.value)}
                />
                <button
                  type="submit"
                  className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white"
                >
                  Save changes
                </button>
              </form>
            </section>
          )}

          <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="p-6 pb-2">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Sheds</h2>
            </div>
            <ul className="space-y-2 px-6 text-sm text-zinc-600 dark:text-zinc-400">
              {sheds.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-2">
                  {editingShed === s.id ? (
                    <>
                      <input
                        className="rounded border border-zinc-200 px-2 py-1 text-sm"
                        value={editShedName}
                        onChange={(e) => setEditShedName(e.target.value)}
                      />
                      <input
                        type="number"
                        min={0}
                        className="w-24 rounded border border-zinc-200 px-2 py-1 text-sm"
                        value={editShedBirds}
                        onChange={(e) => setEditShedBirds(e.target.value)}
                      />
                      <button
                        type="button"
                        className="rounded bg-emerald-700 px-2 py-1 text-xs text-white"
                        onClick={() => saveShed(s.id)}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="text-xs text-zinc-500 dark:text-zinc-400"
                        onClick={() => setEditingShed(null)}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <span>
                        {s.name} — {s.bird_count} birds
                      </span>
                      {canManage && (
                        <button
                          type="button"
                          className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline"
                          onClick={() => {
                            setEditingShed(s.id);
                            setEditShedName(s.name);
                            setEditShedBirds(String(s.bird_count));
                          }}
                        >
                          Edit
                        </button>
                      )}
                    </>
                  )}
                </li>
              ))}
              {!sheds.length && (
                <li className="text-zinc-500 dark:text-zinc-400">No sheds on this page.</li>
              )}
            </ul>
            <PaginationFooter
              total={shedTotal}
              limit={shedLimit}
              offset={shedOffset}
              onLimitChange={setShedLimit}
              onOffsetChange={setShedOffset}
            />
            {canManage && (
              <form
                onSubmit={addShed}
                className="grid gap-2 border-t border-zinc-100 dark:border-zinc-800 p-6 sm:grid-cols-3"
              >
                <input
                  placeholder="Shed name"
                  className="rounded-md border border-zinc-200 px-3 py-2 text-sm sm:col-span-2"
                  value={shedName}
                  onChange={(e) => setShedName(e.target.value)}
                  required
                />
                <input
                  type="number"
                  min={0}
                  placeholder="Birds"
                  className="rounded-md border border-zinc-200 px-3 py-2 text-sm"
                  value={birds}
                  onChange={(e) => setBirds(e.target.value)}
                />
                <button
                  type="submit"
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white sm:col-span-3"
                >
                  Add shed
                </button>
              </form>
            )}
          </section>

          {canManage && (
            <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="p-6 pb-2">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  Team members
                </h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Change roles here. Only owners may assign the owner role or
                  edit another owner. The last owner cannot be demoted.
                </p>
              </div>
              <ul className="space-y-2 px-6 text-sm">
                {members.map((m) => {
                  const opts = roleOptionsForMember(m);
                  const locked = m.role === "owner" && !isOwner;
                  return (
                    <li
                      key={m.user_id}
                      className="flex flex-wrap items-center gap-2 border-b border-zinc-50 dark:border-zinc-800/80 py-2"
                    >
                      <span className="font-medium">{m.name}</span>
                      <span className="text-zinc-500 dark:text-zinc-400">&lt;{m.email}&gt;</span>
                      {locked ? (
                        <span className="text-emerald-800 dark:text-emerald-400">({m.role})</span>
                      ) : (
                        <select
                          className="rounded border border-zinc-200 px-2 py-1 text-sm"
                          value={m.role}
                          disabled={roleSavingId === m.user_id}
                          onChange={(e) =>
                            void updateMemberRole(m.user_id, e.target.value)
                          }
                        >
                          {(opts.length ? opts : [m.role]).map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      )}
                      {roleSavingId === m.user_id && (
                        <span className="text-xs text-zinc-400">Saving…</span>
                      )}
                    </li>
                  );
                })}
                {!members.length && (
                  <li className="py-4 text-zinc-500 dark:text-zinc-400">No members on this page.</li>
                )}
              </ul>
              <PaginationFooter
                total={memTotal}
                limit={memLimit}
                offset={memOffset}
                onLimitChange={setMemLimit}
                onOffsetChange={setMemOffset}
              />

              <div className="border-t border-zinc-100 dark:border-zinc-800 p-6">
                <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  Invite by email
                </h3>
                <form
                  onSubmit={addMemberByEmail}
                  className="mt-2 flex flex-wrap gap-2"
                >
                  <input
                    type="email"
                    placeholder="user@example.com"
                    className="min-w-[200px] flex-1 rounded-md border border-zinc-200 px-3 py-2 text-sm"
                    value={memberEmail}
                    onChange={(e) => setMemberEmail(e.target.value)}
                    required
                  />
                  <button
                    type="submit"
                    className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white"
                  >
                    Add by email
                  </button>
                </form>

                <h3 className="mt-6 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  Or search registered users
                </h3>
                <input
                  placeholder="Search name or email…"
                  className="mt-2 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                />
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">Role for invite:</span>
                  <select
                    className="rounded-md border border-zinc-200 px-2 py-1 text-sm"
                    value={memberRole}
                    onChange={(e) => setMemberRole(e.target.value)}
                  >
                    <option value="worker">worker</option>
                    <option value="manager">manager</option>
                    {isOwner && <option value="owner">owner</option>}
                  </select>
                </div>
                {searchBusy && (
                  <p className="mt-2 text-xs text-zinc-400">Searching…</p>
                )}
                <ul className="mt-3 max-h-48 space-y-1 overflow-auto rounded-md border border-zinc-100 p-2 text-sm">
                  {searchHits.map((u) => (
                    <li
                      key={u.id}
                      className="flex items-center justify-between gap-2 py-1"
                    >
                      <span>
                        {u.name}{" "}
                        <span className="text-zinc-500 dark:text-zinc-400">{u.email}</span>
                      </span>
                      <button
                        type="button"
                        className="shrink-0 rounded bg-emerald-700 px-2 py-1 text-xs text-white"
                        onClick={() => addMemberByUserId(u.id)}
                      >
                        Add
                      </button>
                    </li>
                  ))}
                  {!searchHits.length && !searchBusy && (
                    <li className="text-zinc-500 dark:text-zinc-400">
                      No users match (or all are members).
                    </li>
                  )}
                </ul>
                <PaginationFooter
                  className="rounded-b-none border-t-0"
                  total={searchTotal}
                  limit={searchLimit}
                  offset={searchOffset}
                  onLimitChange={setSearchLimit}
                  onOffsetChange={setSearchOffset}
                />
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
