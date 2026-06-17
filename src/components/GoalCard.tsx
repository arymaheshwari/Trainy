import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { kgToLb, WeightUnit } from '../api/profile';
import { colors, fontSize, radius, spacing } from '../theme';

const GOAL_ACCENT = colors.primary;

const fmt = (n: number) => String(Math.round(n * 10) / 10);

/** The user's primary goal. Filled in via the plan modal. */
export interface Plan {
  /** Headline goal, e.g. "Lose 4 kg". */
  title: string;
  /** Optional human-readable deadline, e.g. "By August 1". */
  deadline?: string;
  /** Where the user started, the target, and where they are now. */
  startValue: number;
  currentValue: number;
  targetValue: number;
  unit: string;
  /** Timeframe to reach the target, in weeks. */
  weeks?: number;
}

/**
 * The headline goal card. When a plan exists it shows the goal with a big
 * progress readout and a bar toward the target; otherwise it's an empty-state
 * prompt to create one. Tapping the card opens the plan modal either way.
 *
 * Plan weights are stored canonically (kg) — `weightUnit` is the user's global
 * body-weight display preference and we convert for display only.
 */
export function GoalCard({
  plan,
  weightUnit,
  onPress,
}: {
  plan: Plan | null;
  weightUnit: WeightUnit;
  onPress: () => void;
}) {
  if (!plan) {
    return (
      <Pressable
        style={({ pressed }) => [styles.empty, pressed && styles.pressed]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Make a plan"
      >
        <View style={styles.emptyIcon}>
          <Ionicons name="flag-outline" size={24} color={GOAL_ACCENT} />
        </View>
        <Text style={styles.emptyTitle}>No active plan</Text>
        <Text style={styles.emptySubtitle}>
          Make a plan to set your goal and start tracking progress
        </Text>
      </Pressable>
    );
  }

  const total = Math.abs(plan.startValue - plan.targetValue);
  const done = Math.abs(plan.startValue - plan.currentValue);
  const pct = total > 0 ? Math.min(Math.max(done / total, 0), 1) : 0;
  const remaining = Math.abs(plan.currentValue - plan.targetValue);

  // Convert canonical kg values into the user's chosen body-weight unit.
  const toDisp = (kg: number) => (weightUnit === 'lb' ? kgToLb(kg) : kg);
  const diff = plan.targetValue - plan.startValue;
  const headline =
    Math.abs(diff) < 0.05
      ? 'Maintain weight'
      : `${diff < 0 ? 'Lose' : 'Gain'} ${fmt(toDisp(Math.abs(diff)))} ${weightUnit}`;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Edit plan: ${headline}`}
    >
      <View style={styles.header}>
        <View style={styles.iconBadge}>
          <Ionicons name="flag" size={20} color={GOAL_ACCENT} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.label}>Current Goal</Text>
          {plan.deadline ? <Text style={styles.subtitle}>{plan.deadline}</Text> : null}
        </View>
      </View>

      <Text style={styles.title}>{headline}</Text>

      <View style={styles.metrics}>
        <View>
          <Text style={styles.bigValue}>
            {fmt(toDisp(plan.currentValue))}
            <Text style={styles.unit}> {weightUnit}</Text>
          </Text>
          <Text style={styles.metricLabel}>Current</Text>
        </View>
        <View style={styles.metricRight}>
          <Text style={styles.bigValue}>
            {fmt(toDisp(remaining))}
            <Text style={styles.unit}> {weightUnit}</Text>
          </Text>
          <Text style={styles.metricLabel}>To go</Text>
        </View>
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%` }]} />
      </View>
      <Text style={styles.pctText}>{Math.round(pct * 100)}% there</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  empty: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(124, 92, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.title,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  emptySubtitle: {
    color: colors.textTertiary,
    fontSize: fontSize.body,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: 'rgba(124, 92, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  label: {
    color: colors.textSecondary,
    fontSize: fontSize.subtitle,
    fontWeight: '600',
  },
  subtitle: {
    color: colors.textTertiary,
    fontSize: fontSize.caption,
    fontWeight: '600',
    marginTop: 1,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize.heading,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: spacing.lg,
  },
  metrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  metricRight: {
    alignItems: 'flex-end',
  },
  bigValue: {
    color: colors.textPrimary,
    fontSize: fontSize.title,
    fontWeight: '800',
  },
  unit: {
    color: colors.textSecondary,
    fontSize: fontSize.body,
    fontWeight: '600',
  },
  metricLabel: {
    color: colors.textTertiary,
    fontSize: fontSize.caption,
    fontWeight: '600',
    marginTop: 2,
  },
  track: {
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: GOAL_ACCENT,
  },
  pctText: {
    color: colors.textSecondary,
    fontSize: fontSize.caption,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
});
