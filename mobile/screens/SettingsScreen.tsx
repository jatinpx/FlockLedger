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

const DEFAULT_SHEED = 10;
const DEFAULT_MEM = 10;

function roleOptionsForMember(m: FarmMemberRow, isOwner: boolean): string[] {
  if (m.role === "owner" && !isOwner) return [];
  if (isOwner) return ["worker", "manager", "owner"];
  return ["worker", "manager"];
}

export function SettingsScreen({ navigation }: Props) {
  const { farmId, farms, setFarmId, refreshFarms, invalidateMemberLists } = useFarm();
  const currentFarm = farms.find((f) => f.id === farmId);
  const farmName = currentFarm?.name ?? "Farm";
  const myRole = currentFarm?.my_role ?? "worker";
  const isOwner = myRole === "owner";
  const canManage = myRole === "owner" || myRole === "manager";

  const [refreshing, setRefreshing] = useState(false);

  const [newFarmName, setNewFarmName] = useState("");
  const [newFarmLoc, setNewFarmLoc] = useState("");
  const [createBusy, setCreateBusy] = useState(false);

  const [farmDetail, setFarmDetail] = useState<FarmDetail | null>(null);
  const [editName, setEditName] = useState("");
  const [editLoc, setEditLoc] = useState("");
  const [saveFarmBusy, setSaveFarmBusy] = useState(false);

  const [sheds, setSheds] = useState<Shed[]>([]);
  const [shedTotal, setShedTotal] = useState(0);
  const [shedLimit, setShedLimit] = useState(DEFAULT_SHEED);
  const [shedOffset, setShedOffset] = useState(0);
  const [shedName, setShedName] = useState("");
  const [shedBirds, setShedBirds] = useState("0");
  const [addShedBusy, setAddShedBusy] = useState(false);
  const [editingShed, setEditingShed] = useState<Shed | null>(null);
  const [editShedName, setEditShedName] = useState("");
  const [editShedBirds, setEditShedBirds] = useState("");
  const [saveShedBusy, setSaveShedBusy] = useState(false);

  const [members, setMembers] = useState<FarmMemberRow[]>([]);
  const [memTotal, setMemTotal] = useState(0);
  const [memLimit, setMemLimit] = useState(DEFAULT_MEM);
  const [memOffset, setMemOffset] = useState(0);
  const [memberEmail, setMemberEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"worker" | "manager" | "owner">("worker");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [roleSavingId, setRoleSavingId] = useState<number | null>(null);

  const [userQuery, setUserQuery] = useState("");
  const [searchHits, setSearchHits] = useState<UserSearchRow[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchLimit, setSearchLimit] = useState(25);
  const [searchOffset, setSearchOffset] = useState(0);
  const [searchBusy, setSearchBusy] = useState(false);

  const [roleModal, setRoleModal] = useState<{
    userId: number;
    name: string;
    options: string[];
  } | null>(null);

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

  useEffect(() => {
    loadSheds().catch(() => {});
  }, [loadSheds]);

  useEffect(() => {
    loadMembers().catch(() => {});
  }, [loadMembers]);

  useEffect(() => {
    setShedOffset(0);
  }, [shedLimit, farmId]);
  useEffect(() => {
    setMemOffset(0);
  }, [memLimit, farmId]);
  useEffect(() => {
    setSearchOffset(0);
  }, [userQuery, farmId, searchLimit]);

  useEffect(() => {
    if (!farmId || !canManage) {
      setSearchHits([]);
      setSearchTotal(0);
      return;
    }
    const q = userQuery.trim();
    const t = setTimeout(() => {
      setSearchBusy(true);
      const path =
        `/farms/${farmId}/users/search?q=${encodeURIComponent(q)}`;
      apiFetch<Paginated<UserSearchRow>>(withPagination(path, searchLimit, searchOffset))
        .then((r) => {
          setSearchHits(r.items);
          setSearchTotal(r.total);
        })
        .catch(() => {
          setSearchHits([]);
          setSearchTotal(0);
        })
        .finally(() => setSearchBusy(false));
    }, 350);
    return () => clearTimeout(t);
  }, [userQuery, farmId, searchLimit, searchOffset, canManage]);

  useEffect(() => {
    if (!isOwner && inviteRole === "owner") setInviteRole("worker");
  }, [isOwner, inviteRole]);

  async function createFarm() {
    setCreateBusy(true);
    try {
      const f = await apiFetch<FarmDetail>("/farms", {
        method: "POST",
        body: JSON.stringify({
          name: newFarmName.trim(),
          location: newFarmLoc.trim() || null,
        }),
      });
      setNewFarmName("");
      setNewFarmLoc("");
      await refreshFarms();
      setFarmId(f.id);
      Alert.alert("Created", `Farm “${f.name}” created.`);
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
        body: JSON.stringify({
          name: editName.trim(),
          location: editLoc.trim() || null,
        }),
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
        body: JSON.stringify({
          name: shedName.trim(),
          bird_count: parseInt(shedBirds, 10) || 0,
        }),
      });
      setShedName("");
      setShedBirds("0");
      await loadSheds();
      Alert.alert("Saved", "Shed added.");
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
        body: JSON.stringify({
          name: editShedName.trim(),
          bird_count: parseInt(editShedBirds, 10),
        }),
      });
      setEditingShed(null);
      await loadSheds();
      Alert.alert("Saved", "Shed updated.");
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
      await loadMembers();
      invalidateMemberLists();
      Alert.alert("Sent", "Invitation sent.");
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

  return (
    <ScrollView
      style={styles.wrap}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reloadAll} />}
    >
      <Text style={styles.h1}>
        Settings{farmId ? ` · ${farmName}` : ""}
      </Text>

      <Text style={styles.section}>Create farm</Text>
      <TextInput
        style={styles.input}
        placeholder="New farm name"
        value={newFarmName}
        onChangeText={setNewFarmName}
      />
      <TextInput
        style={styles.input}
        placeholder="Location (optional)"
        value={newFarmLoc}
        onChangeText={setNewFarmLoc}
      />
      <Pressable
        style={[styles.btn, createBusy && styles.btnDisabled]}
        onPress={createFarm}
        disabled={createBusy || !newFarmName.trim()}
      >
        {createBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Create farm</Text>}
      </Pressable>

      {!farmId ? (
        <Text style={styles.hint}>Choose a farm from the header menu to edit it.</Text>
      ) : null}

      {farmId && canManage ? (
        <>
          <Text style={styles.section}>This farm</Text>
          <TextInput style={styles.input} value={editName} onChangeText={setEditName} />
          <TextInput
            style={styles.input}
            value={editLoc}
            onChangeText={setEditLoc}
            placeholder="Location"
          />
          <Pressable
            style={[styles.btn, saveFarmBusy && styles.btnDisabled]}
            onPress={saveFarm}
            disabled={saveFarmBusy}
          >
            {saveFarmBusy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Save farm details</Text>
            )}
          </Pressable>
        </>
      ) : null}

      {farmId ? (
        <>
      <Text style={styles.section}>Sheds</Text>
      <TextInput style={styles.input} placeholder="Shed name" value={shedName} onChangeText={setShedName} />
      <TextInput
        style={styles.input}
        placeholder="Bird count"
        value={shedBirds}
        onChangeText={setShedBirds}
        keyboardType="number-pad"
      />
      <Pressable
        style={[styles.btn, addShedBusy && styles.btnDisabled]}
        onPress={addShed}
        disabled={addShedBusy || !shedName.trim()}
      >
        {addShedBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Add shed</Text>}
      </Pressable>

      {sheds.map((s) => (
        <View key={s.id} style={styles.card}>
          <Text style={styles.cardTitle}>
            {s.name} · {s.bird_count} birds
          </Text>
          <Pressable
            onPress={() => {
              setEditingShed(s);
              setEditShedName(s.name);
              setEditShedBirds(String(s.bird_count));
            }}
          >
            <Text style={styles.link}>Edit</Text>
          </Pressable>
        </View>
      ))}
      <PaginatedControls
        total={shedTotal}
        limit={shedLimit}
        offset={shedOffset}
        onLimitChange={setShedLimit}
        onOffsetChange={setShedOffset}
      />
        </>
      ) : null}

      {farmId && canManage ? (
        <>
      <Text style={styles.section}>Members</Text>
      <Text style={styles.sub}>Invite role</Text>
      <View style={styles.roleRow}>
        {(["worker", "manager", "owner"] as const).map((r) => (
          <Pressable
            key={r}
            style={[styles.roleChip, inviteRole === r && styles.roleChipOn, r === "owner" && !isOwner && styles.hidden]}
            disabled={r === "owner" && !isOwner}
            onPress={() => setInviteRole(r)}
          >
            <Text style={[styles.roleChipText, inviteRole === r && styles.roleChipTextOn]}>{r}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        style={styles.input}
        placeholder="Search users by name or email"
        value={userQuery}
        onChangeText={setUserQuery}
        autoCapitalize="none"
      />
      {searchBusy ? <ActivityIndicator style={{ marginVertical: 8 }} color="#047857" /> : null}
      {searchHits.map((u) => (
        <View key={u.id} style={styles.card}>
          <Text style={styles.cardTitle}>{u.name}</Text>
          <Text style={styles.cardSub}>{u.email}</Text>
          <Pressable onPress={() => addByUserId(u.id)}>
            <Text style={styles.link}>Add with selected role</Text>
          </Pressable>
        </View>
      ))}
      {searchTotal > 0 ? (
        <PaginatedControls
          total={searchTotal}
          limit={searchLimit}
          offset={searchOffset}
          onLimitChange={setSearchLimit}
          onOffsetChange={setSearchOffset}
        />
      ) : null}

      <Text style={styles.sub}>Invite by email</Text>
      <TextInput
        style={styles.input}
        placeholder="email@example.com"
        value={memberEmail}
        onChangeText={setMemberEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <Pressable
        style={[styles.btn, inviteBusy && styles.btnDisabled]}
        onPress={inviteByEmail}
        disabled={inviteBusy || !memberEmail.trim()}
      >
        {inviteBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Send invite</Text>}
      </Pressable>

      {members.map((m) => {
        const opts = roleOptionsForMember(m, isOwner);
        const busy = roleSavingId === m.user_id;
        return (
          <View key={m.user_id} style={styles.card}>
            <Text style={styles.cardTitle}>{m.name}</Text>
            <Text style={styles.cardSub}>{m.email}</Text>
            <Text style={styles.roleLine}>Role: {m.role}</Text>
            {opts.length > 0 ? (
              <Pressable
                disabled={busy}
                onPress={() =>
                  setRoleModal({ userId: m.user_id, name: m.name, options: opts })
                }
              >
                <Text style={styles.link}>{busy ? "Saving…" : "Change role"}</Text>
              </Pressable>
            ) : (
              <Text style={styles.muted}>Only an owner can change another owner.</Text>
            )}
          </View>
        );
      })}
      <PaginatedControls
        total={memTotal}
        limit={memLimit}
        offset={memOffset}
        onLimitChange={setMemLimit}
        onOffsetChange={setMemOffset}
      />
        </>
      ) : null}

      <Modal visible={!!editingShed} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Edit shed</Text>
            <TextInput style={styles.input} value={editShedName} onChangeText={setEditShedName} />
            <TextInput
              style={styles.input}
              value={editShedBirds}
              onChangeText={setEditShedBirds}
              keyboardType="number-pad"
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setEditingShed(null)}>
                <Text style={styles.link}>Cancel</Text>
              </Pressable>
              <Pressable onPress={saveShed} disabled={saveShedBusy}>
                {saveShedBusy ? <ActivityIndicator color="#047857" /> : <Text style={styles.link}>Save</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!roleModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Role for {roleModal?.name}</Text>
            {roleModal?.options.map((opt) => (
              <Pressable
                key={opt}
                style={styles.modalOption}
                onPress={() => applyRole(roleModal.userId, opt)}
              >
                <Text style={styles.modalOptionText}>{opt}</Text>
              </Pressable>
            ))}
            <Pressable style={styles.modalCancel} onPress={() => setRoleModal(null)}>
              <Text style={styles.link}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#fafafa", padding: 16, paddingBottom: 40 },
  h1: { fontSize: 18, fontWeight: "700", color: "#18181b", marginBottom: 16 },
  hint: { fontSize: 14, color: "#71717a", marginBottom: 12 },
  section: {
    fontSize: 13,
    fontWeight: "700",
    color: "#52525b",
    textTransform: "uppercase",
    marginTop: 20,
    marginBottom: 8,
  },
  sub: { fontSize: 12, color: "#71717a", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  btn: {
    backgroundColor: "#047857",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 8,
    minHeight: 48,
    justifyContent: "center",
  },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: "#fff", fontWeight: "600" },
  card: {
    padding: 12,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    marginBottom: 8,
  },
  cardTitle: { fontWeight: "700", color: "#18181b" },
  cardSub: { fontSize: 13, color: "#71717a", marginTop: 2 },
  roleLine: { marginTop: 6, fontSize: 13, color: "#3f3f46" },
  link: { marginTop: 6, color: "#047857", fontWeight: "600" },
  muted: { marginTop: 4, fontSize: 12, color: "#a1a1aa" },
  roleRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  roleChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d4d4d8",
    backgroundColor: "#fff",
  },
  roleChipOn: { backgroundColor: "#047857", borderColor: "#047857" },
  roleChipText: { fontSize: 13, fontWeight: "600", color: "#3f3f46", textTransform: "capitalize" },
  roleChipTextOn: { color: "#fff" },
  hidden: { opacity: 0.35 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 24,
  },
  modalBox: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
  },
  modalTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  modalOption: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f4f4f5",
  },
  modalOptionText: { fontSize: 16, textTransform: "capitalize" },
  modalCancel: { marginTop: 12, alignItems: "center" },
});
