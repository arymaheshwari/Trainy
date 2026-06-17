/**
 * User-added ("custom") foods.
 *
 * When a food can't be found in USDA, the user can add their own. These are
 * stored fully (label + micros) and keyed by a generated id, persisted to disk
 * so they show up in future searches under a "Your foods" section.
 *
 * Loaded once into memory; reads are synchronous afterward so search can filter
 * them instantly without awaiting storage on every keystroke.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { FoodDetail, FoodMicro, FoodSearchResult } from '../usda/types';

export interface CustomFood {
  id: string;
  description: string;
  brand?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  micros: FoodMicro[];
  /** Saved serving stats so portion units (g/oz/cup) work for this food. */
  servingGrams?: number;
  cupGrams?: number;
}

/** The standard micro set offered when adding/editing a food, all starting at 0. */
export const DEFAULT_MICROS: FoodMicro[] = [
  { label: 'Fiber', amount: 0, unit: 'g' },
  { label: 'Sugars', amount: 0, unit: 'g' },
  { label: 'Saturated Fat', amount: 0, unit: 'g' },
  { label: 'Cholesterol', amount: 0, unit: 'mg' },
  { label: 'Sodium', amount: 0, unit: 'mg' },
  { label: 'Potassium', amount: 0, unit: 'mg' },
  { label: 'Calcium', amount: 0, unit: 'mg' },
  { label: 'Iron', amount: 0, unit: 'mg' },
  { label: 'Vitamin C', amount: 0, unit: 'mg' },
  { label: 'Vitamin D', amount: 0, unit: 'mcg' },
];

const STORAGE_KEY = 'customFoods:v1';

let cache: CustomFood[] | null = null;
let loadPromise: Promise<void> | null = null;

export function ensureCustomFoodsLoaded(): Promise<void> {
  if (cache) return Promise.resolve();
  if (!loadPromise) {
    loadPromise = AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        cache = raw ? JSON.parse(raw) : [];
      })
      .catch(() => {
        cache = [];
      });
  }
  return loadPromise;
}

function persist(): Promise<void> {
  return AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache ?? []));
}

function newId(): string {
  return `c${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** Custom foods whose name or brand matches `query`. Newest first. */
export function searchCustomFoodsSync(query: string): FoodSearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q || !cache) return [];
  return cache
    .filter(
      (f) =>
        f.description.toLowerCase().includes(q) || (f.brand ?? '').toLowerCase().includes(q),
    )
    .map(toSearchResult);
}

export function getCustomFoodDetailSync(id: string): FoodDetail | undefined {
  const food = cache?.find((f) => f.id === id);
  return food ? toDetail(food) : undefined;
}

export async function addCustomFood(data: Omit<CustomFood, 'id'>): Promise<CustomFood> {
  await ensureCustomFoodsLoaded();
  if (!cache) cache = [];
  const food: CustomFood = { ...data, id: newId() };
  cache.unshift(food);
  await persist();
  return food;
}

export async function updateCustomFood(
  id: string,
  data: Partial<Omit<CustomFood, 'id'>>,
): Promise<void> {
  await ensureCustomFoodsLoaded();
  if (!cache) return;
  const i = cache.findIndex((f) => f.id === id);
  if (i >= 0) {
    cache[i] = { ...cache[i], ...data };
    await persist();
  }
}

export async function deleteCustomFood(id: string): Promise<void> {
  await ensureCustomFoodsLoaded();
  if (!cache) return;
  cache = cache.filter((f) => f.id !== id);
  await persist();
}

function toSearchResult(f: CustomFood): FoodSearchResult {
  return {
    id: `custom:${f.id}`,
    source: 'custom',
    customId: f.id,
    description: f.description,
    brand: f.brand,
    dataType: 'Custom',
    calories: f.calories,
  };
}

function toDetail(f: CustomFood): FoodDetail {
  return {
    fdcId: 0, // unused for custom foods; identity is the customId
    description: f.description,
    brand: f.brand,
    basis: 'per serving',
    calories: f.calories,
    protein: f.protein,
    carbs: f.carbs,
    fat: f.fat,
    micros: f.micros,
    servingGrams: f.servingGrams,
    cupGrams: f.cupGrams,
  };
}
