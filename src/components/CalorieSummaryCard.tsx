import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { MacroNutrient, NutritionSummary } from '../api/nutrition';
import { colors, fontSize, radius, spacing } from '../theme';

const NUTRITION_ACCENT = colors.orange;

/**
 * The hero card for the Nutrition tracker. Calories are centered up top with a
 * progress bar beneath them, followed by the protein / fat / carbs macros —
 * each with its own progress bar — laid out left / middle / right.
 *
 * Stateless: pass in the day's `nutrition` summary (null while loading).
 */
export function CalorieSummaryCard({ nutrition }: { nutrition: NutritionSummary | null }) {
  if (!nutrition) {
    return (
      <View style={[styles.card, styles.cardLoading]}>
        <ActivityIndicator color={NUTRITION_ACCENT} />
      </View>
    );
  }

  const calorieProgress = Math.min(nutrition.calories / nutrition.caloriesGoal, 1);
  const remaining = Math.max(nutrition.caloriesGoal - nutrition.calories, 0);

  return (
    <View style={styles.card}>
      <View style={styles.calories}>
        <Text style={styles.caloriesLabel}>Calories consumed</Text>
        <Text style={styles.caloriesValue}>{nutrition.calories.toLocaleString()}</Text>
        <Text style={styles.caloriesGoal}>of {nutrition.caloriesGoal.toLocaleString()} kcal</Text>

        <View style={styles.caloriesTrack}>
          <View style={[styles.caloriesFill, { width: `${calorieProgress * 100}%` }]} />
        </View>

        <Text style={styles.caloriesRemaining}>
          {remaining.toLocaleString()} kcal remaining
        </Text>
      </View>

      <View style={styles.macros}>
        <Macro label="Protein" color={colors.teal} macro={nutrition.protein} />
        <Macro label="Fat" color={colors.red} macro={nutrition.fats} />
        <Macro label="Carbs" color={colors.amber} macro={nutrition.carbs} />
      </View>
    </View>
  );
}

function Macro({ label, color, macro }: { label: string; color: string; macro: MacroNutrient }) {
  const progress = Math.min(macro.grams / macro.goalGrams, 1);
  return (
    <View style={styles.macro}>
      <Text style={styles.macroLabel}>{label}</Text>
      <View style={styles.macroTrack}>
        <View style={[styles.macroFill, { width: `${progress * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.macroValue}>
        {macro.grams} / {macro.goalGrams} g
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xxl,
  },
  cardLoading: {
    minHeight: 320,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calories: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  caloriesLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.subtitle,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  caloriesValue: {
    color: colors.textPrimary,
    fontSize: 72,
    fontWeight: '800',
    letterSpacing: -2,
    lineHeight: 78,
  },
  caloriesGoal: {
    color: colors.textTertiary,
    fontSize: fontSize.subtitle,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  caloriesTrack: {
    width: '100%',
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
    marginTop: spacing.xl,
  },
  caloriesFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: NUTRITION_ACCENT,
  },
  caloriesRemaining: {
    color: colors.textSecondary,
    fontSize: fontSize.body,
    fontWeight: '600',
    marginTop: spacing.md,
  },
  macros: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.xxl,
  },
  macro: {
    flex: 1,
  },
  macroLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.body,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  macroTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  macroFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  macroValue: {
    color: colors.textPrimary,
    fontSize: fontSize.body,
    fontWeight: '800',
    marginTop: spacing.sm,
  },
});
