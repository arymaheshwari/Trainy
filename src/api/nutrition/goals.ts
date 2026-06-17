/**
 * Nutrition goals — the daily targets used everywhere in the app.
 *
 * Effective goals resolve as: manual override > active AI diet plan > defaults.
 * Manual edits (Nutrition/Progress screens, or the plan's "manually enter" mode)
 * and finalized AI diets both write the override here, so there's one source of
 * truth and changes show up wherever goals are displayed. Local-first.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { DietPlan } from '../generatePlan';
import { ensurePlanLoaded, getPlanSync } from '../plan';

export interface NutritionGoals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  waterMl: number;
  /** Micronutrient targets keyed by label (units come from MICRO_LAYOUT). */
  micros: Record<string, number>;
}

export interface MicroLayoutItem {
  label: string;
  unit: string;
}
export interface MicroLayoutGroup {
  title: string;
  items: MicroLayoutItem[];
}

/** Display structure for micros (which labels, grouped how, with what units). */
export const MICRO_LAYOUT: MicroLayoutGroup[] = [
  { title: 'Carbohydrates', items: [{ label: 'Fiber', unit: 'g' }, { label: 'Sugars', unit: 'g' }] },
  { title: 'Fats', items: [{ label: 'Saturated Fat', unit: 'g' }, { label: 'Cholesterol', unit: 'mg' }] },
  {
    title: 'Minerals',
    items: [
      { label: 'Sodium', unit: 'mg' },
      { label: 'Potassium', unit: 'mg' },
      { label: 'Calcium', unit: 'mg' },
      { label: 'Iron', unit: 'mg' },
    ],
  },
  { title: 'Vitamins', items: [{ label: 'Vitamin C', unit: 'mg' }, { label: 'Vitamin D', unit: 'mcg' }] },
];

export const DEFAULT_GOALS: NutritionGoals = {
  calories: 2200,
  protein: 150,
  carbs: 250,
  fat: 70,
  waterMl: 2500,
  micros: {
    Fiber: 30,
    Sugars: 50,
    'Saturated Fat': 20,
    Cholesterol: 300,
    Sodium: 2300,
    Potassium: 3500,
    Calcium: 1000,
    Iron: 18,
    'Vitamin C': 90,
    'Vitamin D': 20,
  },
};

const STORAGE_KEY = 'nutritionGoals:v1';

let override: NutritionGoals | null = null;
let loaded = false;
let loadPromise: Promise<void> | null = null;

function loadOverride(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (!loadPromise) {
    loadPromise = AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        override = raw ? JSON.parse(raw) : null;
        loaded = true;
      })
      .catch(() => {
        override = null;
        loaded = true;
      });
  }
  return loadPromise;
}

/** Ensure both the goals override and the plan (for the diet fallback) are loaded. */
export function ensureGoalsLoaded(): Promise<void> {
  return Promise.all([loadOverride(), ensurePlanLoaded()]).then(() => undefined);
}

/** Convert a finalized AI diet into the goals shape (keeps default Sat Fat/Cholesterol). */
export function goalsFromDiet(diet: DietPlan): NutritionGoals {
  const micros: Record<string, number> = { ...DEFAULT_GOALS.micros };
  micros['Fiber'] = diet.fiber_g;
  micros['Sugars'] = diet.sugarLimit_g;
  micros['Sodium'] = diet.sodiumLimit_mg;
  for (const m of diet.micros) micros[m.label] = m.amount;
  return {
    calories: diet.dailyCalories,
    protein: diet.protein_g,
    carbs: diet.carbs_g,
    fat: diet.fat_g,
    waterMl: diet.water_ml,
    micros,
  };
}

/** Effective goals: manual override > active diet > defaults. Needs ensureGoalsLoaded. */
export function getEffectiveGoals(): NutritionGoals {
  if (override) return override;
  const diet = getPlanSync().diet;
  return diet ? goalsFromDiet(diet) : DEFAULT_GOALS;
}

/** Persist a manual goals override (becomes the source of truth). */
export async function saveGoals(goals: NutritionGoals): Promise<void> {
  override = goals;
  loaded = true;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
}

/** Persist goals derived from a finalized AI diet. */
export async function saveGoalsFromDiet(diet: DietPlan): Promise<void> {
  await saveGoals(goalsFromDiet(diet));
}
