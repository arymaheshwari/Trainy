import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { getTodaySleep, SleepSummary } from '../api/googleHealth';
import { colors, fontSize, radius, spacing } from '../theme';

const SLEEP_ACCENT = colors.blue;

function formatDuration(minutes: number): { h: number; m: number } {
  return { h: Math.floor(minutes / 60), m: minutes % 60 };
}

/** Color-code the sleep score band. */
function scoreColor(score: number): string {
  if (score >= 85) return colors.teal;
  if (score >= 70) return colors.blue;
  if (score >= 60) return colors.amber;
  return colors.red;
}

/**
 * Full-width card showing last night's sleep duration and a sleep score.
 * NOTE: the score is currently a placeholder (see getTodaySleep) — the Google
 * Health API has no sleep score, so we'll compute our own later.
 */
export function SleepCard() {
  const [sleep, setSleep] = useState<SleepSummary | null | undefined>(undefined);

  useEffect(() => {
    getTodaySleep().then(setSleep);
  }, []);

  const duration = sleep ? formatDuration(sleep.durationMinutes) : null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconBadge}>
          <Ionicons name="moon" size={18} color={SLEEP_ACCENT} />
        </View>
        <Text style={styles.label}>Sleep</Text>
      </View>

      {sleep === undefined ? (
        <ActivityIndicator color={SLEEP_ACCENT} style={styles.loader} />
      ) : sleep === null ? (
        <Text style={styles.empty}>No sleep recorded</Text>
      ) : (
        <View style={styles.row}>
          <View style={styles.valueRow}>
            <Text style={styles.value}>{duration!.h}</Text>
            <Text style={styles.unit}>h</Text>
            <Text style={styles.value}>{duration!.m}</Text>
            <Text style={styles.unit}>m</Text>
          </View>

          <View style={styles.scoreBlock}>
            <Text style={[styles.score, { color: scoreColor(sleep.score) }]}>
              {sleep.score}
            </Text>
            <Text style={styles.scoreLabel}>Sleep Score</Text>
          </View>
        </View>
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
    backgroundColor: 'rgba(77, 155, 255, 0.15)',
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
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
    marginLeft: 2,
    marginRight: spacing.sm,
    marginBottom: 7,
  },
  scoreBlock: {
    alignItems: 'center',
  },
  score: {
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1,
  },
  scoreLabel: {
    color: colors.textTertiary,
    fontSize: fontSize.caption,
    fontWeight: '600',
    marginTop: 2,
  },
});
