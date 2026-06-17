/**
 * Daily water log.
 *
 * One running total (in milliliters) per calendar day, mirroring the food log:
 * local-first AsyncStorage, day-keyed, 12-month rolling retention. Maps to a
 * `water_log(user_id, day, ml)` Postgres row for the eventual cloud sync.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { dayKey, dayKeyOffset } from './dailyLog';

/** One glass — the amount the + button adds (and − removes). */
export const GLASS_ML = 250;

const STORAGE_KEY = 'waterLog:v1';
const RETENTION_DAYS = 365;

type WaterMap = Record<string, number>;

let cache: WaterMap | null = null;
let loadPromise: Promise<void> | null = null;

export function ensureWaterLoaded(): Promise<void> {
  if (cache) return Promise.resolve();
  if (!loadPromise) {
    loadPromise = AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        cache = raw ? JSON.parse(raw) : {};
        prune();
      })
      .catch(() => {
        cache = {};
      });
  }
  return loadPromise;
}

function prune(): void {
  if (!cache) return;
  const cutoff = dayKeyOffset(-RETENTION_DAYS);
  for (const key of Object.keys(cache)) {
    if (key < cutoff) delete cache[key];
  }
}

function persist(): Promise<void> {
  return AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache ?? {}));
}

/** Water logged on a day, in ml (after `ensureWaterLoaded`). */
export function getDayWaterSync(day: string): number {
  return cache?.[day] ?? 0;
}

/** Add (or subtract) water for a day; clamps at 0. Returns the new total. */
export async function addWater(deltaMl: number, day: string = dayKey()): Promise<number> {
  await ensureWaterLoaded();
  if (!cache) cache = {};
  const next = Math.max(0, (cache[day] ?? 0) + deltaMl);
  if (next === 0) delete cache[day];
  else cache[day] = next;
  prune();
  await persist();
  return next;
}
