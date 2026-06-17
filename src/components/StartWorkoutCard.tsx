import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radius, spacing } from '../theme';

const WORKOUT_ACCENT = colors.teal;

/**
 * Compact call-to-action card that kicks off a fresh, empty workout session.
 * Sits at the top of the Workout tab as the primary action.
 */
export function StartWorkoutCard({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={styles.iconBadge}>
        <Ionicons name="add" size={24} color={WORKOUT_ACCENT} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>Start Empty Workout</Text>
        <Text style={styles.subtitle}>Track sets and reps as you go</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
    </Pressable>
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
    gap: spacing.md,
  },
  cardPressed: {
    opacity: 0.7,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: 'rgba(0, 194, 168, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
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
});
