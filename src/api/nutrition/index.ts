/**
 * Nutrition data module.
 *
 * A day's summary combines the user's daily goals with the actual logged totals
 * for that day (from `dailyLog`). Goals come from `nutrition/goals` (manual
 * override > active AI diet > defaults).
 */
import { dayKey, getDayTotalsSync } from './dailyLog';
import { getEffectiveGoals, MICRO_LAYOUT } from './goals';
import { getDayWaterSync } from './waterLog';

export interface MacroNutrient {
  /** Grams consumed today. */
  grams: number;
  /** Daily target in grams. */
  goalGrams: number;
}

export interface Micronutrient {
  /** Display name, e.g. "Fiber" or "Vitamin C". */
  label: string;
  /** Amount consumed today, in `unit`. */
  amount: number;
  /** Daily target, in `unit`. */
  goal: number;
  /** Measurement unit, e.g. "g", "mg", "mcg". */
  unit: string;
}

/** A named, collapsible grouping of related micronutrients. */
export interface MicronutrientGroup {
  title: string;
  items: Micronutrient[];
}

export interface NutritionSummary {
  calories: number;
  caloriesGoal: number;
  carbs: MacroNutrient;
  protein: MacroNutrient;
  fats: MacroNutrient;
  /** Micronutrients grouped into collapsible categories. */
  microGroups: MicronutrientGroup[];
  /** Water consumed that day, in milliliters. */
  waterMl: number;
  /** Daily water target, in milliliters. */
  waterGoalMl: number;
}

/**
 * Build the nutrition summary for a given day ("YYYY-MM-DD") from the effective
 * goals + that day's logged totals. Empty days come back as all-zero consumption
 * against the goals. Requires `ensureLogLoaded()` and `ensureGoalsLoaded()`.
 */
export function buildDaySummary(day: string = dayKey()): NutritionSummary {
  const totals = getDayTotalsSync(day);
  const consumed = new Map(totals.micros.map((m) => [m.label, m.amount]));
  const goals = getEffectiveGoals();

  return {
    calories: totals.calories,
    caloriesGoal: goals.calories,
    protein: { grams: totals.protein, goalGrams: goals.protein },
    carbs: { grams: totals.carbs, goalGrams: goals.carbs },
    fats: { grams: totals.fat, goalGrams: goals.fat },
    microGroups: MICRO_LAYOUT.map((g) => ({
      title: g.title,
      items: g.items.map((it) => ({
        label: it.label,
        amount: consumed.get(it.label) ?? 0,
        goal: goals.micros[it.label] ?? 0,
        unit: it.unit,
      })),
    })),
    waterMl: getDayWaterSync(day),
    waterGoalMl: goals.waterMl,
  };
}
