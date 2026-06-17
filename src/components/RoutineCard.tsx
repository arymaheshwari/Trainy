import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Routine } from '../api/workouts/routines';
import { colors, fontSize, radius, spacing } from '../theme';

const WORKOUT_ACCENT = colors.teal;
const MAX_PREVIEW = 4;

/**
 * A single saved routine in the "My Routines" list. Shows the exercises it
 * contains, a three-dot menu to edit it, and a button to start a workout from
 * this template.
 */
export function RoutineCard({
  routine,
  onStart,
  onEdit,
}: {
  routine: Routine;
  onStart?: () => void;
  onEdit?: () => void;
}) {
  const count = routine.exercises.length;
  const preview = routine.exercises.slice(0, MAX_PREVIEW);
  const extra = count - preview.length;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconBadge}>
          <Ionicons name="barbell" size={20} color={WORKOUT_ACCENT} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>
            {routine.name}
          </Text>
          <Text style={styles.subtitle}>
            {count} {count === 1 ? 'exercise' : 'exercises'}
          </Text>
        </View>
        {onEdit && (
          <Pressable style={styles.menuButton} onPress={onEdit} hitSlop={8}>
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.textTertiary} />
          </Pressable>
        )}
      </View>

      {count > 0 && (
        <View style={styles.exercises}>
          {preview.map((exercise) => (
            <View key={exercise.id} style={styles.exerciseRow}>
              <Text style={styles.exerciseName} numberOfLines={1}>
                {exercise.name}
              </Text>
              {exercise.sets != null && (
                <Text style={styles.exerciseSets}>{exercise.sets} sets</Text>
              )}
            </View>
          ))}
          {extra > 0 && <Text style={styles.more}>+{extra} more</Text>}
        </View>
      )}

      <Pressable
        style={({ pressed }) => [styles.startButton, pressed && styles.startButtonPressed]}
        onPress={onStart}
      >
        <Ionicons name="play" size={16} color={colors.background} />
        <Text style={styles.startText}>Start Routine</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconBadge: {
    width: 44,
    height: 44,
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
  menuButton: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exercises: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  exerciseName: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize.body,
    fontWeight: '600',
  },
  exerciseSets: {
    color: colors.textTertiary,
    fontSize: fontSize.caption,
    fontWeight: '600',
  },
  more: {
    color: colors.textTertiary,
    fontSize: fontSize.caption,
    fontWeight: '600',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: WORKOUT_ACCENT,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
  },
  startButtonPressed: {
    opacity: 0.85,
  },
  startText: {
    color: colors.background,
    fontSize: fontSize.subtitle,
    fontWeight: '800',
  },
});
