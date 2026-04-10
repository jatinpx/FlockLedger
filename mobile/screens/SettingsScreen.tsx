import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Alert,
} from "react-native";
import type { DrawerScreenProps } from "@react-navigation/drawer";
import { useFocusEffect } from "@react-navigation/native";
import {
  apiFetch,
  type FarmDetail,
  type FarmMemberRow,
  type Paginated,
  type Shed,
  type UserSearchRow,
} from "../lib/api";
import { useFarm } from "../lib/farm-context";
import { withPagination } from "../lib/pagination";
import { PaginatedControls } from "../components/PaginatedControls";
import type { DrawerParamList } from "../navigation/MainDrawer";

type Props = DrawerScreenProps<DrawerParamList, "Settings">;

const DEFAULT_SHED = 10;
const DEFAULT_MEM = 10;

function roleOptionsForMember(m: FarmMemberRow, isOwner: boolean): string[] {
  if (m.role === "owner" && !isOwner) return [];
  if (isOwner) return ["worker", "manager", "owner"];
  return ["worker", "manager"];
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    owner: { bg: "#dcfce7", fg: "#166534" },
    manager: { bg: "#dbeafe", fg: "#1d4ed8" },
    worker: { bg: "#f3f4f6", fg: "#374151" },
  };
  const c = colors[role] ?? colors.worker;
  return (
    <View style={[styles.roleBadge, { backgroundColor: c.bg }]}>
      <Text style={[styles.roleBadgeText, { color: c.fg }]}>{role}</Text>
    </View>
  );
}

function SectionHeader({ label, count }: { label: string; count?: number }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {count !== undefined ? (
        <View style={styles.countPill}>
          <Text style={styles.countPillText}>{count}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function SettingsScreen({ navigation }: Props) {
  const { farmId, farms, setFarmId, refreshFarms, invalidateMemberLists } = useFarm();
  const currentFarm = farms.find((f) => f.id === farmId);
  const farmName = currentFarm?.name ?? "Farm";
  const myRole = currentFarm?.my_role ?? "worker";
  const isOwner = myRole === "owner";
  const canManage = myRole === "owner" || myRole === "manager";

  const [refreshing, setRefreshing] = useState(false);

  // Create farm
  const [newFarmName, setNewFarmName] = useState("");
  const [newFarmLoc, setNewFarmLoc] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [showCreateFarm, setShowCreateFarm] = useState(false);

  // Farm detail / edit
  const [farmDetail, setFarmDetail] = useState<FarmDetail | null>(null);
  const [editName, setEditName] = useState("");
  const [editLoc, setEditLoc] = useState("");
  const [saveFarmBusy, setSaveFarmBusy] = useState(false);

  // Sheds
  const [sheds, setSheds] = useState<Shed[]>([]);
  const [shedTotal, setShedTotal] = useState(0);
  const [shedLimit, setShedLimit] = useState(DEFAULT_SHED);
  const [shedOffset, setShedOffset] = useState(0);
  const [showAddShed, setShowAddShed] = useState(false);
  const [shedName, setShedName] = useState("");
  const [shedBirds, setShedBirds] = useState("0");
  const [addShedBusy, setAddShedBusy] = useState(false);
  const [editingShed, setEditingShed] = useState<Shed | null>(null);
  const [editShedName, setEditShedName] = useState("");
  const [editShedBirds, setEditShedBirds] = useState("");
  const [saveShedBusy, setSaveShedBusy] = useState(false);

  // Members
  const [members, setMembers] = useState<FarmMemberRow[]>([]);
  const [memTotal, setMemTotal] = useState(0);
  const [memLimit, setMemLimit] = useState(DEFAULT_MEM);
  const [memOffset, setMemOffset] = useState(0);
  const [roleSavingId, setRoleSavingId] = useState<number | null>(null);

  // Invite / search panel
  const [showInvitePanel, setShowInvitePanel] = useState(false);
  const [inviteRole, setInviteRole] = useState<"worker" | "manager" | "owner">("worker");
  const [memberEmail, setMemberEmail] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [userQuery, setUserQuery] = useState("");
  const [searchHits, setSearchHits] = useState<UserSearchRow[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchLimit] = useState(25);
  const [searchOffset, setSearchOffset] = useState(0);
  const [searchBusy, setSearchBusy] = useState(false);

  // Modals
  const [roleModal, setRoleModal] = useState<{
    userId: number;
    name: string;
    options: string[];
  } | null>(null);

  // ─── Data loaders ─────────────────────────────────────────────────────────

  const loadFarm = useCallback(async () => {
    if (!farmId) return;
    const f = await apiFetch<FarmDetail>(`/farms/${farmId}`);
    setFarmDetail(f);
    setEditName(f.name);
    setEditLoc(f.location ?? "");
  }, [farmId]);

  const loadSheds = useCallback(async () => {
    if (!farmId) return;
    const r = await apiFetch<Paginated<Shed>>(
      withPagination(`/farms/${farmId}/sheds`, shedLimit, shedOffset)
    );
    setSheds(r.items);
    setShedTotal(r.total);
  }, [farmId, shedLimit, shedOffset]);

  const loadMembers = useCallback(async () => {
    if (!farmId || !canManage) return;
    const r = await apiFetch<Paginated<FarmMemberRow>>(
      withPagination(`/farms/${farmId}/members`, memLimit, memOffset)
    );
    setMembers(r.items);
    setMemTotal(r.total);
  }, [farmId, memLimit, memOffset, canManage]);

  const reloadAll = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadFarm();
      await loadSheds();
      await loadMembers();
    } catch {
      Alert.alert("Error", "Could not refresh settings.");
    } finally {
      setRefreshing(false);
    }
  }, [loadFarm, loadSheds, loadMembers]);

  useFocusEffect(
    useCallback(() => {
      loadFarm().catch(() => {});
    }, [loadFarm])
  );

  useEffect(() => { loadSheds().catch(() => {}); }, [loadSheds]);
  useEffect(() => { loadMembers().catch(() => {}); }, [loadMembers]);
  useEffect(() => { setShedOffset(0); }, [shedLimit, farmId]);
  useEffect(() => { setMemOffset(0); }, [memLimit, farmId]);
  useEffect(() => { setSearchOffset(0); }, [userQuery, farmId]);

  useEffect(() => {
    if (!farmId || !canManage || !showInvitePanel) {
      setSearchHits([]);
      setSearchTotal(0);
      return;
    }
    const q = userQuery.trim();
    const t = setTimeout(() => {
      setSearchBusy(true);
      apiFetch<Paginated<UserSearchRow>>(
        withPagination(
          `/farms/${farmId}/users/search?q=${encodeURIComponent(q)}`,
          searchLimit,
          searchOffset
        )
      )
        .then((r) => { setSearchHits(r.items); setSearchTotal(r.total); })
        .catch(() => { setSearchHits([]); setSearchTotal(0); })
        .finally(() => setSearchBusy(false));
    }, 350);
    return () => clearTimeout(t);
  }, [userQuery, farmId, searchLimit, searchOffset, canManage, showInvitePanel]);

  useEffect(() => {
    if (!isOwner && inviteRole === "owner") setInviteRole("worker");
  }, [isOwner, inviteRole]);

  // ─── Actions ──────────────────────────────────────────────────────────────

  async function createFarm() {
    setCreateBusy(true);
    try {
      const f = await apiFetch<FarmDetail>("/farms", {
        method: "POST",
        body: JSON.stringify({ name: newFarmName.trim(), location: newFarmLoc.trim() || null }),
      });
      setNewFarmName("");
      setNewFarmLoc("");
      setShowCreateFarm(false);
      await refreshFarms();
      setFarmId(f.id);
      Alert.alert("Created", `Farm "${f.name}" created.`);
      navigation.navigate("Dashboard");
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreateBusy(false);
    }
  }

  async function saveFarm() {
    if (!farmId) return;
    setSaveFarmBusy(true);
    try {
      await apiFetch(`/farms/${farmId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editName.trim(), location: editLoc.trim() || null }),
      });
      await loadFarm();
      await refreshFarms();
      Alert.alert("Saved", "Farm details updated.");
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaveFarmBusy(false);
    }
  }

  async function addShed() {
    if (!farmId) return;
    setAddShedBusy(true);
    try {
      await apiFetch(`/farms/${farmId}/sheds`, {
        method: "POST",
        body: JSON.stringify({ name: shedName.trim(), bird_count: parseInt(shedBirds, 10) || 0 }),
      });
      setShedName("");
      setShedBirds("0");
      setShowAddShed(false);
      await loadSheds();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed");
    } finally {
      setAddShedBusy(false);
    }
  }

  async function saveShed() {
    if (!farmId || !editingShed) return;
    setSaveShedBusy(true);
    try {
      await apiFetch(`/farms/${farmId}/sheds/${editingShed.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editShedName.trim(), bird_count: parseInt(editShedBirds, 10) }),
      });
      setEditingShed(null);
      await loadSheds();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed");
    } finally {
      setSaveShedBusy(false);
    }
  }

  async function inviteByEmail() {
    if (!farmId) return;
    setInviteBusy(true);
    try {
      await apiFetch(`/farms/${farmId}/members`, {
        method: "POST",
        body: JSON.stringify({ email: memberEmail.trim(), role: inviteRole }),
      });
      setMemberEmail("");
      setShowInvitePanel(false);
      await loadMembers();
      invalidateMemberLists();
      Alert.alert("Invited", "Invitation sent.");
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed");
    } finally {
      setInviteBusy(false);
    }
  }

  async function addByUserId(uid: number) {
    if (!farmId) return;
    try {
      await apiFetch(`/farms/${farmId}/members/by-user-id`, {
        method: "POST",
        body: JSON.stringify({ user_id: uid, role: inviteRole }),
      });
      setUserQuery("");
      setShowInvitePanel(false);
      await loadMembers();
      invalidateMemberLists();
      Alert.alert("Added", "Member added.");
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed");
    }
  }

  async function applyRole(userId: number, newRole: string) {
    if (!farmId) return;
    setRoleSavingId(userId);
    setRoleModal(null);
    try {
      await apiFetch(`/farms/${farmId}/members/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ role: newRole }),
      });
      await loadMembers();
      invalidateMemberLists();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Role update failed");
    } finally {
      setRoleSavingId(null);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={styles.wrapContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reloadAll} />}
    >
      {/* ── Header ── */}
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>
              {farmId ? farmName : "FlockLedger"}
            </Text>
            <Text style={styles.headerSub}>
              {farmId
                ? "Farm settings & configuration"
                : "Select or create a farm to begin"}
            </Text>
          </View>
          {farmId ? <RoleBadge role={myRole} /> : null}
        </View>
        {farmId && farmDetail ? (
          <View style={styles.headerMetaRow}>
            <Text style={styles.headerMeta}>Farm ID #{farmId}</Text>
            {farmDetail.location ? (
              <Text style={styles.headerMeta}>  ·  {farmDetail.location}</Text>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* ── No farm selected hint ── */}
      {!farmId ? (
        <View style={styles.hintCard}>
          <Text style={styles.hintTitle}>No farm selected</Text>
          <Text style={styles.hintText}>
            Tap the farm picker in the top bar to switch to an existing farm, or create a new one below.
          </Text>
        </View>
      ) : null}

      {/* ── Farm Profile ── */}
      {farmId && canManage ? (
        <View style={styles.sectionCard}>
          <SectionHeader label="Farm Profile" />
          <View style={styles.sectionBody}>
            <Text style={styles.label}>Farm name</Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="Enter farm name"
            />
            <Text style={styles.label}>
              Location{" "}
              <Text style={styles.labelOptional}>(optional)</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={editLoc}
              onChangeText={setEditLoc}
              placeholder="City, region, or address"
            />
            <Pressable
              style={[styles.btnPrimary, saveFarmBusy && styles.btnDisabled]}
              onPress={saveFarm}
              disabled={saveFarmBusy}
            >
              {saveFarmBusy
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.btnPrimaryText}>Save changes</Text>}
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* ── Sheds ── */}
      {farmId ? (
        <View style={styles.sectionCard}>
          <SectionHeader label="Sheds" count={shedTotal} />
          <View style={styles.sectionBody}>
            {sheds.length === 0 && !showAddShed ? (
              <Text style={styles.emptyNote}>No sheds yet. Add your first shed below.</Text>
            ) : null}

            {sheds.map((s, idx) => (
              <View
                key={s.id}
                style={[styles.itemRow, idx === sheds.length - 1 && styles.itemRowLast]}
              >
                <View style={styles.itemRowLeft}>
                  <Text style={styles.itemTitle}>{s.name}</Text>
                  <Text style={styles.itemSubStat}>
                    <Text style={styles.itemStatAccent}>{s.bird_count.toLocaleString()}</Text>
                    {"  birds"}
                  </Text>
                </View>
                {canManage ? (
                  <Pressable
                    style={styles.itemEditBtn}
                    onPress={() => {
                      setEditingShed(s);
                      setEditShedName(s.name);
                      setEditShedBirds(String(s.bird_count));
                    }}
                  >
                    <Text style={styles.itemEditBtnText}>Edit</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}

            {shedTotal > 0 ? (
              <PaginatedControls
                total={shedTotal}
                limit={shedLimit}
                offset={shedOffset}
                onLimitChange={setShedLimit}
                onOffsetChange={setShedOffset}
              />
            ) : null}

            {showAddShed ? (
              <View style={styles.inlineForm}>
                <Text style={styles.inlineFormTitle}>New shed</Text>
                <Text style={styles.label}>Shed name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Shed A, Block 1"
                  value={shedName}
                  onChangeText={setShedName}
                />
                <Text style={styles.label}>Bird count</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  value={shedBirds}
                  onChangeText={setShedBirds}
                  keyboardType="number-pad"
                />
                <View style={styles.inlineFormActions}>
                  <Pressable
                    style={styles.btnSecondary}
                    onPress={() => {
                      setShowAddShed(false);
                      setShedName("");
                      setShedBirds("0");
                    }}
                  >
                    <Text style={styles.btnSecondaryText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.btnPrimary,
                      styles.btnFlex,
                      (addShedBusy || !shedName.trim()) && styles.btnDisabled,
                    ]}
                    onPress={addShed}
                    disabled={addShedBusy || !shedName.trim()}
                  >
                    {addShedBusy
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.btnPrimaryText}>Add shed</Text>}
                  </Pressable>
                </View>
              </View>
            ) : canManage ? (
              <Pressable style={styles.addRowBtn} onPress={() => setShowAddShed(true)}>
                <Text style={styles.addRowBtnText}>+ Add shed</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* ── Team ── */}
      {farmId && canManage ? (
        <View style={styles.sectionCard}>
          <SectionHeader label="Team" count={memTotal} />
          <View style={styles.sectionBody}>
            {members.length === 0 && !showInvitePanel ? (
              <Text style={styles.emptyNote}>No team members yet.</Text>
            ) : null}

            {members.map((m, idx) => {
              const opts = roleOptionsForMember(m, isOwner);
              const busy = roleSavingId === m.user_id;
              return (
                <View
                  key={m.user_id}
                  style={[styles.memberRow, idx === members.length - 1 && styles.itemRowLast]}
                >
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{m.name}</Text>
                    <Text style={styles.memberEmail}>{m.email}</Text>
                  </View>
                  <View style={styles.memberRight}>
                    <RoleBadge role={m.role} />
                    {opts.length > 0 ? (
                      <Pressable
                        style={styles.changeRoleBtn}
                        disabled={busy}
                        onPress={() =>
                          setRoleModal({ userId: m.user_id, name: m.name, options: opts })
                        }
                      >
                        {busy
                          ? <ActivityIndicator size="small" color="#047857" />
                          : <Text style={styles.changeRoleBtnText}>Change role</Text>}
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              );
            })}

            {memTotal > 0 ? (
              <PaginatedControls
                total={memTotal}
                limit={memLimit}
                offset={memOffset}
                onLimitChange={setMemLimit}
                onOffsetChange={setMemOffset}
              />
            ) : null}

            {showInvitePanel ? (
              <View style={styles.inlineForm}>
                <Text style={styles.inlineFormTitle}>Add member</Text>

                <Text style={styles.label}>Role for new member</Text>
                <View style={styles.chipRow}>
                  {(["worker", "manager", "owner"] as const).map((r) => {
                    if (r === "owner" && !isOwner) return null;
                    return (
                      <Pressable
                        key={r}
                        style={[styles.chip, inviteRole === r && styles.chipActive]}
                        onPress={() => setInviteRole(r)}
                      >
                        <Text style={[styles.chipText, inviteRole === r && styles.chipTextActive]}>
                          {r}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.label}>Search by name or email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Type to search existing users…"
                  value={userQuery}
                  onChangeText={setUserQuery}
                  autoCapitalize="none"
                />
                {searchBusy ? (
                  <ActivityIndicator style={{ marginBottom: 8 }} color="#047857" />
                ) : null}
                {searchHits.length > 0 ? (
                  <View style={styles.searchResults}>
                    {searchHits.map((u) => (
                      <Pressable
                        key={u.id}
                        style={styles.searchResultRow}
                        onPress={() => addByUserId(u.id)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.searchResultName}>{u.name}</Text>
                          <Text style={styles.searchResultEmail}>{u.email}</Text>
                        </View>
                        <Text style={styles.searchResultAdd}>Add</Text>
                      </Pressable>
                    ))}
                    {searchTotal > searchHits.length ? (
                      <Text style={styles.searchMoreNote}>
                        +{searchTotal - searchHits.length} more — refine your search
                      </Text>
                    ) : null}
                  </View>
                ) : userQuery.trim().length > 0 && !searchBusy ? (
                  <Text style={styles.emptyNote}>No users found matching "{userQuery}"</Text>
                ) : null}

                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>  or invite by email  </Text>
                  <View style={styles.dividerLine} />
                </View>

                <Text style={styles.label}>Email address</Text>
                <TextInput
                  style={styles.input}
                  placeholder="colleague@example.com"
                  value={memberEmail}
                  onChangeText={setMemberEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                <View style={styles.inlineFormActions}>
                  <Pressable
                    style={styles.btnSecondary}
                    onPress={() => {
                      setShowInvitePanel(false);
                      setUserQuery("");
                      setMemberEmail("");
                    }}
                  >
                    <Text style={styles.btnSecondaryText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.btnPrimary,
                      styles.btnFlex,
                      (inviteBusy || !memberEmail.trim()) && styles.btnDisabled,
                    ]}
                    onPress={inviteByEmail}
                    disabled={inviteBusy || !memberEmail.trim()}
                  >
                    {inviteBusy
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.btnPrimaryText}>Send invite</Text>}
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable style={styles.addRowBtn} onPress={() => setShowInvitePanel(true)}>
                <Text style={styles.addRowBtnText}>+ Add or invite member</Text>
              </Pressable>
            )}
          </View>
        </View>
      ) : null}

      {/* ── Create new farm ── */}
      <View style={styles.sectionCard}>
        <SectionHeader label="Create new farm" />
        <View style={styles.sectionBody}>
          {showCreateFarm ? (
            <>
              <Text style={styles.label}>Farm name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Sunrise Poultry"
                value={newFarmName}
                onChangeText={setNewFarmName}
              />
              <Text style={styles.label}>
                Location{" "}
                <Text style={styles.labelOptional}>(optional)</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="City or region"
                value={newFarmLoc}
                onChangeText={setNewFarmLoc}
              />
              <View style={styles.inlineFormActions}>
                <Pressable
                  style={styles.btnSecondary}
                  onPress={() => {
                    setShowCreateFarm(false);
                    setNewFarmName("");
                    setNewFarmLoc("");
                  }}
                >
                  <Text style={styles.btnSecondaryText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.btnPrimary,
                    styles.btnFlex,
                    (createBusy || !newFarmName.trim()) && styles.btnDisabled,
                  ]}
                  onPress={createFarm}
                  disabled={createBusy || !newFarmName.trim()}
                >
                  {createBusy
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.btnPrimaryText}>Create farm</Text>}
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.createFarmNote}>
                Each farm has its own flocks, sheds, feeds, sales and team. Switch between farms from the top bar at any time.
              </Text>
              <Pressable style={styles.addRowBtn} onPress={() => setShowCreateFarm(true)}>
                <Text style={styles.addRowBtnText}>+ Create new farm</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>

      <View style={{ height: 32 }} />

      {/* ── Shed edit modal ── */}
      <Modal visible={!!editingShed} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Edit shed</Text>
            <Text style={styles.modalSubtitle}>Update name or bird count</Text>
            <Text style={styles.label}>Shed name</Text>
            <TextInput
              style={styles.input}
              value={editShedName}
              onChangeText={setEditShedName}
              placeholder="e.g. Shed A"
            />
            <Text style={styles.label}>Bird count</Text>
            <TextInput
              style={styles.input}
              value={editShedBirds}
              onChangeText={setEditShedBirds}
              keyboardType="number-pad"
              placeholder="0"
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.btnSecondary} onPress={() => setEditingShed(null)}>
                <Text style={styles.btnSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.btnPrimary, styles.btnFlex, saveShedBusy && styles.btnDisabled]}
                onPress={saveShed}
                disabled={saveShedBusy}
              >
                {saveShedBusy
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.btnPrimaryText}>Save changes</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Role change modal ── */}
      <Modal visible={!!roleModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Change role</Text>
            <Text style={styles.modalSubtitle}>{roleModal?.name}</Text>
            <Text style={styles.modalNote}>
              Select a new role. Changes take effect immediately.
            </Text>
            <View style={styles.roleOptionList}>
              {roleModal?.options.map((opt) => {
                const palette: Record<string, { bg: string; fg: string; border: string }> = {
                  owner: { bg: "#f0fdf4", fg: "#166534", border: "#bbf7d0" },
                  manager: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
                  worker: { bg: "#f9fafb", fg: "#374151", border: "#e5e7eb" },
                };
                const c = palette[opt] ?? palette.worker;
                return (
                  <Pressable
                    key={opt}
                    style={[styles.roleOptionBtn, { backgroundColor: c.bg, borderColor: c.border }]}
                    onPress={() => applyRole(roleModal.userId, opt)}
                  >
                    <Text style={[styles.roleOptionBtnText, { color: c.fg }]}>{opt}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              style={[styles.btnSecondary, { marginTop: 12 }]}
              onPress={() => setRoleModal(null)}
            >
              <Text style={styles.btnSecondaryText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#f3f4f6" },
  wrapContent: { padding: 16 },

  // Header
  headerCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 16,
    marginBottom: 14,
  },
  headerTop: { flexDirection: "row", alignItems: "flex-start" },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  headerSub: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  headerMetaRow: { flexDirection: "row", marginTop: 10 },
  headerMeta: { fontSize: 12, color: "#9ca3af", fontWeight: "500" },

  // Role badge
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: "flex-start",
    marginLeft: 10,
  },
  roleBadgeText: { fontSize: 12, fontWeight: "700", textTransform: "capitalize" },

  // Hint card
  hintCard: {
    backgroundColor: "#fffbeb",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fde68a",
    padding: 14,
    marginBottom: 14,
  },
  hintTitle: { fontSize: 14, fontWeight: "700", color: "#92400e", marginBottom: 4 },
  hintText: { fontSize: 13, color: "#b45309", lineHeight: 19 },

  // Section card
  sectionCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 12,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    backgroundColor: "#fafafa",
  },
  sectionLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  countPill: {
    backgroundColor: "#e5e7eb",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countPillText: { fontSize: 12, fontWeight: "700", color: "#6b7280" },
  sectionBody: { padding: 14 },

  // Labels & inputs
  label: { fontSize: 12, fontWeight: "600", color: "#374151", marginBottom: 5 },
  labelOptional: { fontSize: 12, fontWeight: "400", color: "#9ca3af" },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#fafafa",
    marginBottom: 12,
  },

  // Buttons
  btnPrimary: {
    backgroundColor: "#047857",
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    minHeight: 44,
  },
  btnPrimaryText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  btnSecondary: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
  },
  btnSecondaryText: { color: "#374151", fontWeight: "600", fontSize: 14 },
  btnDisabled: { opacity: 0.55 },
  btnFlex: { flex: 1 },

  addRowBtn: {
    borderWidth: 1,
    borderColor: "#d1fae5",
    borderRadius: 9,
    backgroundColor: "#f0fdf4",
    alignItems: "center",
    paddingVertical: 12,
    marginTop: 6,
  },
  addRowBtnText: { color: "#047857", fontWeight: "700", fontSize: 14 },

  // Item rows (sheds)
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  itemRowLast: { borderBottomWidth: 0 },
  itemRowLeft: { flex: 1 },
  itemTitle: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  itemSubStat: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  itemStatAccent: { color: "#047857", fontWeight: "700" },
  itemEditBtn: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 7,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#f9fafb",
  },
  itemEditBtnText: { fontSize: 13, fontWeight: "600", color: "#374151" },

  // Member rows
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  memberEmail: { fontSize: 12, color: "#6b7280", marginTop: 1 },
  memberRight: { alignItems: "flex-end", gap: 5 },
  changeRoleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#f9fafb",
  },
  changeRoleBtnText: { fontSize: 12, fontWeight: "600", color: "#374151" },

  // Search results
  searchResults: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 9,
    backgroundColor: "#fafafa",
    marginBottom: 12,
    overflow: "hidden",
  },
  searchResultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  searchResultName: { fontSize: 13, fontWeight: "700", color: "#0f172a" },
  searchResultEmail: { fontSize: 12, color: "#6b7280" },
  searchResultAdd: { fontSize: 13, fontWeight: "700", color: "#047857" },
  searchMoreNote: { fontSize: 12, color: "#9ca3af", padding: 10, textAlign: "center" },

  // Divider
  dividerRow: { flexDirection: "row", alignItems: "center", marginVertical: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#e5e7eb" },
  dividerText: { fontSize: 12, color: "#9ca3af", fontWeight: "500" },

  // Role chips (inline invite panel)
  chipRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  chip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#f9fafb",
  },
  chipActive: { backgroundColor: "#047857", borderColor: "#047857" },
  chipText: { fontSize: 13, fontWeight: "600", color: "#374151", textTransform: "capitalize" },
  chipTextActive: { color: "#fff" },

  // Inline forms
  inlineForm: {
    backgroundColor: "#f9fafb",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
    marginTop: 10,
  },
  inlineFormTitle: { fontSize: 14, fontWeight: "700", color: "#0f172a", marginBottom: 12 },
  inlineFormActions: { flexDirection: "row", gap: 10, marginTop: 4 },

  // Create farm note
  createFarmNote: { fontSize: 13, color: "#6b7280", lineHeight: 19, marginBottom: 12 },
  emptyNote: { fontSize: 13, color: "#9ca3af", fontStyle: "italic", marginBottom: 8 },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  modalBox: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalTitle: { fontSize: 17, fontWeight: "800", color: "#0f172a", marginBottom: 2 },
  modalSubtitle: { fontSize: 13, color: "#6b7280", marginBottom: 6 },
  modalNote: { fontSize: 13, color: "#9ca3af", marginBottom: 16, lineHeight: 18 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 6 },
  roleOptionList: { gap: 8 },
  roleOptionBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  roleOptionBtnText: { fontSize: 15, fontWeight: "700", textTransform: "capitalize" },
});
