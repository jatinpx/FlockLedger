import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { PAGE_SIZE_OPTIONS, totalPages } from "../lib/pagination";
import { useAppTheme, type AppColors } from "../lib/theme";

type Props = {
  total: number;
  limit: number;
  offset: number;
  onLimitChange: (n: number) => void;
  onOffsetChange: (n: number) => void;
};

export function PaginatedControls({
  total,
  limit,
  offset,
  onLimitChange,
  onOffsetChange,
}: Props) {
  const colors = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const pages = totalPages(total, limit);
  const currentPage = Math.floor(offset / limit) + 1;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);

  return (
    <View style={styles.wrap}>
      <Text style={styles.meta}>
        {total === 0 ? "No rows" : `${from}–${to} of ${total} · page ${currentPage}/${pages}`}
      </Text>
      <Text style={styles.label}>Page size</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
        {PAGE_SIZE_OPTIONS.map((n) => (
          <Pressable
            key={n}
            style={[styles.chip, limit === n && styles.chipOn]}
            onPress={() => onLimitChange(n)}
          >
            <Text style={[styles.chipText, limit === n && styles.chipTextOn]}>{n}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.nav}>
        <Pressable
          style={[styles.navBtn, styles.navBtnLeft, offset <= 0 && styles.btnDisabled]}
          disabled={offset <= 0}
          onPress={() => onOffsetChange(Math.max(0, offset - limit))}
        >
          <Text style={styles.btnText}>Previous</Text>
        </Pressable>
        <Pressable
          style={[styles.navBtn, offset + limit >= total && styles.btnDisabled]}
          disabled={offset + limit >= total}
          onPress={() => onOffsetChange(offset + limit)}
        >
          <Text style={styles.btnText}>Next</Text>
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  wrap: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  meta: { fontSize: 12, color: colors.textSoft, marginBottom: 8 },
  label: { fontSize: 11, color: colors.textMuted, marginBottom: 6, textTransform: "uppercase" },
  chips: { flexGrow: 0, marginBottom: 10 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    marginRight: 8,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 13, color: colors.textSoft, fontWeight: "600" },
  chipTextOn: { color: colors.inverseText },
  nav: { flexDirection: "row" },
  navBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  navBtnLeft: { marginRight: 10 },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontSize: 14, fontWeight: "600", color: colors.textStrong },
});
