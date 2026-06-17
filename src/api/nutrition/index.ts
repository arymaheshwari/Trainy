/**
 * Nutrition data module.
 *
 * A day's summary is built by combining the user's daily goals (config below)
 * with the actual logged totals for that day (from `dailyLog`). Goals are
 * static for now and will move to user settings later.
 */
import { dayKey, getDayTotalsSync } from './dailyLog';
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
 * Daily goals/targets. Static for now; will become per-user settings. Micro
 * labels/units intentionally match what we log (see DEFAULT_MICROS) so logged
 * amounts line up against these goals by label.
 */
const GOALS = {
  calories: 2200,
  protein: 150,
  carbs: 250,
  fat: 70,
  waterGoalMl: 2500,
  microGroups: [
    {
      title: 'Carbohydrates',
      items: [
        { label: 'Fiber', goal: 30, unit: 'g' },
        { label: 'Sugars', goal: 50, unit: 'g' },
      ],
    },
    {
      title: 'Fats',
      items: [
        { label: 'Saturated Fat', goal: 20, unit: 'g' },
        { label: 'Cholesterol', goal: 300, unit: 'mg' },
      ],
    },
    {
      title: 'Minerals',
      items: [
        { label: 'Sodium', goal: 2300, unit: 'mg' },
        { label: 'Potassium', goal: 3500, unit: 'mg' },
        { label: 'Calcium', goal: 1000, unit: 'mg' },
        { label: 'Iron', goal: 18, unit: 'mg' },
      ],
    },
    {
      title: 'Vitamins',
      items: [
        { label: 'Vitamin C', goal: 90, unit: 'mg' },
        { label: 'Vitamin D', goal: 20, unit: 'mcg' },
      ],
    },
  ],
} as const;

/**
 * Build the nutrition summary for a given day ("YYYY-MM-DD") from goals + that
 * day's logged totals. Empty days come back as all-zero consumption against the
 * goals. Requires `ensureLogLoaded()` to have resolved first.
 */
export function buildDaySummary(day: string = dayKey()): NutritionSummary {
  const totals = getDayTotalsSync(day);
  const consumed = new Map(totals.micros.map((m) => [m.label, m.amount]));

  return {
    calories: totals.calories,
    caloriesGoal: GOALS.calories,
    protein: { grams: totals.protein, goalGrams: GOALS.protein },
    carbs: { grams: totals.carbs, goalGrams: GOALS.carbs },
    fats: { grams: totals.fat, goalGrams: GOALS.fat },
    microGroups: GOALS.microGroups.map((g) => ({
      title: g.title,
      items: g.items.map((it) => ({
        label: it.label,
        amount: consumed.get(it.label) ?? 0,
        goal: it.goal,
        unit: it.unit,
      })),
    })),
    waterMl: getDayWaterSync(day),
    waterGoalMl: GOALS.waterGoalMl,
  };
}
