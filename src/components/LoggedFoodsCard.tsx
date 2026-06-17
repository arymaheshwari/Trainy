import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LogEntry } from '../api/nutrition/dailyLog';
import { formatPortion } from '../api/nutrition/portions';
import { colors, fontSize, radius, spacing } from '../theme';

/**
 * The list of foods logged on the selected day, each with its calorie
 * contribution and a remove button. Empty days show a gentle prompt.
 */
export function LoggedFoodsCard({
  entries,
  onRemove,
}: {
  entries: LogEntry[];
  onRemove: (id: string) => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Logged foods</Text>

      {entries.length === 0 ? (
        <Text style={styles.empty}>Nothing logged this day yet.</Text>
      ) : (
        entries.map((e) => (
          <View key={e.id} style={styles.row}>
            <View style={styles.info}>
              <Text style={styles.name} numberOfLines={1}>
                {e.description}
              </Text>
              <Text style={styles.brand} numberOfLines={1}>
                {e.portion
                  ? formatPortion(e.portion.amount, e.portion.unit)
                  : `${e.quantity}× serving`}
                {e.brand ? ` · ${e.brand}` : ''}
              </Text>
            </View>
            <Text style={styles.calories}>{Math.round(e.calories * e.quantity)} kcal</Text>
            <Pressable onPress={() => onRemove(e.id)} hitSlop={8} style={styles.remove}>
              <Ionicons name="close" size={16} color={colors.textTertiary} />
            </Pressable>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xxl,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize.title,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: spacing.md,
  },
  empty: {
    color: colors.textTertiary,
    fontSize: fontSize.body,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  info: {
    flex: 1,
  },
  name: {
    color: colors.textPrimary,
    fontSize: fontSize.body,
    fontWeight: '600',
  },
  brand: {
    color: colors.textTertiary,
    fontSize: fontSize.caption,
    fontWeight: '600',
    marginTop: 2,
  },
  calories: {
    color: colors.textSecondary,
    fontSize: fontSize.caption,
    fontWeight: '700',
  },
  remove: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
