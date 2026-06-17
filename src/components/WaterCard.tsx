import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radius, spacing } from '../theme';

const WATER_ACCENT = colors.blue;

/**
 * Compact water-intake card: consumption vs goal on the left, and − / + controls
 * on the right that add or remove a glass for the selected day.
 */
export function WaterCard({
  waterMl,
  waterGoalMl,
  onAdd,
  onRemove,
}: {
  waterMl: number;
  waterGoalMl: number;
  onAdd?: () => void;
  onRemove?: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.left}>
        <View style={styles.iconBadge}>
          <Ionicons name="water" size={18} color={WATER_ACCENT} />
        </View>
        <View>
          <Text style={styles.label}>Water</Text>
          <Text style={styles.value}>
            {(waterMl / 1000).toFixed(1)}
            <Text style={styles.goal}> / {(waterGoalMl / 1000).toFixed(1)} L</Text>
          </Text>
        </View>
      </View>

      <View style={styles.controls}>
        <Pressable
          style={[styles.button, waterMl === 0 && styles.buttonDisabled]}
          onPress={onRemove}
          disabled={waterMl === 0}
          hitSlop={8}
        >
          <Ionicons name="remove" size={22} color={WATER_ACCENT} />
        </Pressable>
        <Pressable style={styles.button} onPress={onAdd} hitSlop={8}>
          <Ionicons name="add" size={22} color={WATER_ACCENT} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: 'rgba(77, 155, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: colors.textSecondary,
    fontSize: fontSize.body,
    fontWeight: '600',
  },
  value: {
    color: colors.textPrimary,
    fontSize: fontSize.title,
    fontWeight: '800',
  },
  goal: {
    color: colors.textTertiary,
    fontSize: fontSize.body,
    fontWeight: '600',
  },
  controls: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  button: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(77, 155, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.35,
  },
});
