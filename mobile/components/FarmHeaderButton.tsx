import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useFarm } from "../lib/farm-context";

/** Matches web header farm picker: tap to switch farm. */
export function FarmHeaderButton() {
  const { farms, farmId, setFarmId, loading } = useFarm();
  const [open, setOpen] = useState(false);
  const current = farms.find((f) => f.id === farmId);

  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={styles.btn} hitSlop={8}>
        {loading ? (
          <ActivityIndicator size="small" color="#047857" />
        ) : (
          <Text style={styles.btnText} numberOfLines={1}>
            {current?.name ?? "Farm"}
          </Text>
        )}
      </Pressable>
      <Modal visible={open} transparent animationType="fade">
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Switch farm</Text>
            <FlatList
              data={farms}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.row, item.id === farmId && styles.rowOn]}
                  onPress={() => {
                    setFarmId(item.id);
                    setOpen(false);
                  }}
                >
                  <Text style={styles.rowName}>{item.name}</Text>
                  <Text style={styles.rowRole}>{item.my_role}</Text>
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={styles.empty}>No farms. Create one in Settings.</Text>
              }
            />
            <Pressable style={styles.close} onPress={() => setOpen(false)}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    marginRight: 12,
    maxWidth: 160,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#ecfdf5",
  },
  btnText: { fontSize: 13, fontWeight: "700", color: "#065f46" },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: "70%",
  },
  sheetTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12, color: "#18181b" },
  row: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    marginBottom: 8,
  },
  rowOn: { borderColor: "#047857", backgroundColor: "#ecfdf5" },
  rowName: { fontSize: 15, fontWeight: "600", color: "#18181b" },
  rowRole: { fontSize: 12, color: "#71717a", marginTop: 2, textTransform: "capitalize" },
  empty: { color: "#71717a", padding: 16, textAlign: "center" },
  close: { alignItems: "center", paddingVertical: 12 },
  closeText: { color: "#047857", fontWeight: "600" },
});
