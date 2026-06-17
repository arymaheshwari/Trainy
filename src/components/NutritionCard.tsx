import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { buildDaySummary, MacroNutrient, NutritionSummary } from '../api/nutrition';
import { dayKey, ensureLogLoaded } from '../api/nutrition/dailyLog';
import { colors, fontSize, radius, spacing } from '../theme';

const NUTRITION_ACCENT = colors.orange;

const MACROS = [
  { key: 'carbs', label: 'Carbs', color: colors.amber },
  { key: 'protein', label: 'Protein', color: colors.teal },
  { key: 'fats', label: 'Fats', color: colors.red },
] as const;

/**
 * Full-width card showing total calories for the day plus the carb/protein/fat
 * macro breakdown. Currently backed by placeholder data (see api/nutrition).
 */
export function NutritionCard() {
  const [nutrition, setNutrition] = useState<NutritionSummary | null>(null);

  useEffect(() => {
    ensureLogLoaded().then(() => setNutrition(buildDaySummary(dayKey())));
  }, []);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconBadge}>
          <Ionicons name="nutrition" size={18} color={NUTRITION_ACCENT} />
        </View>
        <Text style={styles.label}>Nutrition</Text>
      </View>

      {!nutrition ? (
        <ActivityIndicator color={NUTRITION_ACCENT} style={styles.loader} />
      ) : (
        <>
          <View style={styles.valueRow}>
            <Text style={styles.value}>{nutrition.calories.toLocaleString()}</Text>
            <Text style={styles.unit}>kcal</Text>
            <Text style={styles.goal}>/ {nutrition.caloriesGoal.toLocaleString()}</Text>
          </View>

          <View style={styles.macros}>
            {MACROS.map((m) => (
              <Macro
                key={m.key}
                label={m.label}
                color={m.color}
                macro={nutrition[m.key]}
              />
            ))}
          </View>
        </>
      )}
    </View>
  );
}

function Macro({
  label,
  color,
  macro,
}: {
  label: string;
  color: string;
  macro: MacroNutrient;
}) {
  const progress = Math.min(macro.grams / macro.goalGrams, 1);
  return (
    <View style={styles.macro}>
      <Text style={styles.macroLabel}>{label}</Text>
      <Text style={styles.macroValue}>{macro.grams}g</Text>
      <View style={styles.macroTrack}>
        <View
          style={[styles.macroFill, { width: `${progress * 100}%`, backgroundColor: color }]}
        />
      </View>
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
    backgroundColor: 'rgba(255, 122, 89, 0.15)',
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
  goal: {
    color: colors.textTertiary,
    fontSize: fontSize.subtitle,
    fontWeight: '600',
    marginLeft: spacing.sm,
    marginBottom: spacing.sm,
  },
  macros: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  macro: {
    flex: 1,
  },
  macroLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.body,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  macroValue: {
    color: colors.textPrimary,
    fontSize: fontSize.title,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  macroTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  macroFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
});
