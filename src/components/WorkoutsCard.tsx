import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { getTodayWorkouts, Workout } from '../api/googleHealth';
import { colors, fontSize, radius, spacing } from '../theme';

const WORKOUT_ACCENT = colors.teal;

/** Map an activity type to an Ionicons glyph (with a sensible fallback). */
const ACTIVITY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  run: 'walk',
  walk: 'walk',
  bike: 'bicycle',
  strength: 'barbell',
  yoga: 'body',
};

function iconFor(activity: string): keyof typeof Ionicons.glyphMap {
  return ACTIVITY_ICONS[activity] ?? 'fitness';
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/**
 * Full-width card listing today's workouts. Display-only for now — we'll add
 * the ability to launch/track workouts from here later.
 */
export function WorkoutsCard() {
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);

  useEffect(() => {
    getTodayWorkouts().then(setWorkouts);
  }, []);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconBadge}>
          <Ionicons name="barbell" size={18} color={WORKOUT_ACCENT} />
        </View>
        <Text style={styles.label}>Workouts</Text>
        {workouts && workouts.length > 0 ? (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{workouts.length}</Text>
          </View>
        ) : null}
      </View>

      {workouts == null ? (
        <ActivityIndicator color={WORKOUT_ACCENT} style={styles.loader} />
      ) : workouts.length === 0 ? (
        <Text style={styles.empty}>No workouts today</Text>
      ) : (
        <View style={styles.list}>
          {workouts.map((w, i) => (
            <WorkoutRow key={i} workout={w} />
          ))}
        </View>
      )}
    </View>
  );
}

function WorkoutRow({ workout }: { workout: Workout }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={iconFor(workout.activityType)} size={20} color={WORKOUT_ACCENT} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{titleCase(workout.activityType)}</Text>
        <Text style={styles.rowSubtitle}>
          {workout.durationMinutes} min · {workout.calories} kcal
        </Text>
      </View>
      <Text style={styles.rowTime}>{formatTime(workout.startTime)}</Text>
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
    backgroundColor: 'rgba(0, 194, 168, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  label: {
    color: colors.textSecondary,
    fontSize: fontSize.subtitle,
    fontWeight: '600',
  },
  countBadge: {
    marginLeft: spacing.sm,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0, 194, 168, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    color: WORKOUT_ACCENT,
    fontSize: fontSize.caption,
    fontWeight: '800',
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
  list: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(0, 194, 168, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '700',
  },
  rowSubtitle: {
    color: colors.textSecondary,
    fontSize: fontSize.body,
    fontWeight: '500',
    marginTop: 2,
  },
  rowTime: {
    color: colors.textTertiary,
    fontSize: fontSize.body,
    fontWeight: '600',
  },
});
