import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { getTodayHeartRate, HeartRateSummary } from '../api/googleHealth';
import { colors, fontSize, radius, spacing } from '../theme';

const HR_ACCENT = colors.red;

/**
 * Full-width card showing today's heart rate: the latest reading large, with
 * resting / min / max stats below. Backed by Google Health heart-rate data.
 */
export function HeartRateCard() {
  const [hr, setHr] = useState<HeartRateSummary | null | undefined>(undefined);

  useEffect(() => {
    getTodayHeartRate().then(setHr);
  }, []);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconBadge}>
          <Ionicons name="heart" size={18} color={HR_ACCENT} />
        </View>
        <Text style={styles.label}>Heart Rate</Text>
      </View>

      {hr === undefined ? (
        <ActivityIndicator color={HR_ACCENT} style={styles.loader} />
      ) : hr === null ? (
        <Text style={styles.empty}>No heart rate recorded</Text>
      ) : (
        <>
          <View style={styles.valueRow}>
            <Text style={styles.value}>{hr.latest}</Text>
            <Text style={styles.unit}>bpm</Text>
            <Text style={styles.caption}>latest</Text>
          </View>

          <View style={styles.stats}>
            <Stat label="Resting" value={hr.resting} />
            <View style={styles.divider} />
            <Stat label="Min" value={hr.min} />
            <View style={styles.divider} />
            <Stat label="Max" value={hr.max} />
          </View>
        </>
      )}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
    backgroundColor: 'rgba(255, 77, 109, 0.15)',
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
  empty: {
    color: colors.textTertiary,
    fontSize: fontSize.subtitle,
    fontWeight: '600',
    marginVertical: spacing.sm,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: spacing.xl,
  },
  value: {
    color: colors.textPrimary,
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1,
  },
  unit: {
    color: colors.textTertiary,
    fontSize: fontSize.title,
    fontWeight: '700',
    marginLeft: spacing.sm,
    marginBottom: 7,
  },
  caption: {
    color: colors.textTertiary,
    fontSize: fontSize.body,
    fontWeight: '600',
    marginLeft: spacing.sm,
    marginBottom: spacing.sm,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: fontSize.title,
    fontWeight: '800',
  },
  statLabel: {
    color: colors.textTertiary,
    fontSize: fontSize.caption,
    fontWeight: '600',
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
  },
});
