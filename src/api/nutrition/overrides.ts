/**
 * Persisted "label overrides" for foods.
 *
 * USDA (and barcode) data isn't always right, so the user can correct a food's
 * label. Those corrections are keyed by the food's identity (USDA fdcId or, for
 * scanned items, barcode) and saved to disk, so the next time the same food is
 * searched or scanned the corrected values are applied automatically.
 *
 * Loaded once into memory on first use; reads are synchronous afterward so
 * applying an override during a food lookup never blocks on storage.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { FoodMicro } from '../usda/types';

/** The editable fields of a food label. All optional — only set fields override. */
export interface FoodOverride {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  /** Full replacement micros list (vitamins/minerals/etc.). */
  micros?: FoodMicro[];
  /** Saved serving stats so portion units (g/oz/cup) work for this food. */
  servingGrams?: number;
  cupGrams?: number;
}

const STORAGE_KEY = 'foodLabelOverrides:v1';

let cache: Record<string, FoodOverride> | null = null;
let loadPromise: Promise<void> | null = null;

/** Stable identity key for a food: prefer barcode, else USDA fdcId. */
export function foodKey(source: { fdcId?: number; barcode?: string }): string {
  if (source.barcode) return `barcode:${source.barcode}`;
  return `usda:${source.fdcId}`;
}

/** Ensure overrides are loaded from disk into memory. Safe to call repeatedly. */
export function ensureOverridesLoaded(): Promise<void> {
  if (cache) return Promise.resolve();
  if (!loadPromise) {
    loadPromise = AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        cache = raw ? JSON.parse(raw) : {};
      })
      .catch(() => {
        cache = {};
      });
  }
  return loadPromise;
}

/** Synchronous read — call only after `ensureOverridesLoaded()` has resolved. */
export function getOverrideSync(key: string): FoodOverride | undefined {
  return cache?.[key];
}

/** Persist (or clear) the override for a food and update the in-memory cache. */
export async function setOverride(key: string, override: FoodOverride | null): Promise<void> {
  await ensureOverridesLoaded();
  if (!cache) cache = {};

  if (override && Object.keys(override).length > 0) {
    cache[key] = override;
  } else {
    delete cache[key];
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
}
