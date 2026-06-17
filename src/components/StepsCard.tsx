import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { getTodaySteps } from '../api/googleHealth';
import { colors, fontSize, radius, spacing } from '../theme';

/** Daily step goal used for the progress bar. */
const STEP_GOAL = 10000;

/**
 * Full-width card showing the user's total step count for today, with a
 * subtle progress bar toward the daily goal.
 */
export function StepsCard() {
  const [steps, setSteps] = useState<number | null>(null);

  useEffect(() => {
    getTodaySteps().then(setSteps);
  }, []);

  const progress = steps == null ? 0 : Math.min(steps / STEP_GOAL, 1);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconBadge}>
          <Ionicons name="footsteps" size={18} color={colors.primary} />
        </View>
        <Text style={styles.label}>Steps</Text>
      </View>

      {steps == null ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <>
          <View style={styles.valueRow}>
            <Text style={styles.value}>{steps.toLocaleString()}</Text>
            <Text style={styles.goal}>/ {STEP_GOAL.toLocaleString()}</Text>
          </View>

          <View style={styles.track}>
            <View style={[styles.fill, { width: `${progress * 100}%` }]} />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: 'rgba(124, 92, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  label: {
    color: colors.textSecondary,
    fontSize: fontSize.subtitle,
    fontWeight: '600',
  },
  loader: {
    alignSelf: 'flex-start',
    marginVertical: spacing.sm,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: spacing.lg,
  },
  value: {
    color: colors.textPrimary,
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1,
  },
  goal: {
    color: colors.textTertiary,
    fontSize: fontSize.subtitle,
    fontWeight: '600',
    marginLeft: spacing.sm,
    marginBottom: spacing.sm,
  },
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
});
