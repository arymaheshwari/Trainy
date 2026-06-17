import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { WorkoutLogEntry } from '../api/workouts/workoutLog';
import { colors, fontSize, radius, spacing } from '../theme';

const WORKOUT_ACCENT = colors.teal;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatDuration(sec: number): string {
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

/** A completed workout in the day's history: headline stats + exercise list. */
export function LoggedWorkoutCard({
  workout,
  onRemove,
}: {
  workout: WorkoutLogEntry;
  onRemove: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconBadge}>
          <Ionicons name="barbell" size={18} color={WORKOUT_ACCENT} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>
            {workout.name}
          </Text>
          <Text style={styles.subtitle}>
            {formatTime(workout.loggedAt)} · {formatDuration(workout.durationSec)}
          </Text>
        </View>
        <Pressable style={styles.remove} onPress={onRemove} hitSlop={8}>
          <Ionicons name="close" size={16} color={colors.textTertiary} />
        </Pressable>
      </View>

      <View style={styles.stats}>
        <Text style={styles.statValue}>
          {workout.totalSets}
          <Text style={styles.statUnit}> sets</Text>
        </Text>
        <View style={styles.statDot} />
        <Text style={styles.statValue}>
          {workout.totalVolume.toLocaleString()}
          <Text style={styles.statUnit}> lbs</Text>
        </Text>
      </View>

      <View style={styles.exercises}>
        {workout.exercises.map((exercise, i) => (
          <Text key={i} style={styles.exerciseRow} numberOfLines={1}>
            <Text style={styles.exerciseSets}>{exercise.sets.length}× </Text>
            {exercise.name}
          </Text>
        ))}
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
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: 'rgba(0, 194, 168, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: fontSize.body,
    fontWeight: '500',
    marginTop: 2,
  },
  remove: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: fontSize.body,
    fontWeight: '800',
  },
  statUnit: {
    color: colors.textTertiary,
    fontSize: fontSize.caption,
    fontWeight: '600',
  },
  statDot: {
    width: 3,
    height: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.textTertiary,
  },
  exercises: {
    gap: spacing.xs,
  },
  exerciseRow: {
    color: colors.textSecondary,
    fontSize: fontSize.body,
    fontWeight: '500',
  },
  exerciseSets: {
    color: colors.textTertiary,
    fontWeight: '700',
  },
});
