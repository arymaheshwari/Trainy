/**
 * Per-exercise performance history.
 *
 * Remembers the sets (weight × reps) from the last time each exercise was
 * performed, so a new workout can prefill/hint the previous numbers. Keyed by a
 * normalized exercise name, persisted to disk and loaded once into memory.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SetRecord {
  weight: number;
  reps: number;
}

const STORAGE_KEY = 'workoutHistory:v1';

/** name (normalized) -> the sets performed the last time it was done. */
let cache: Record<string, SetRecord[]> | null = null;
let loadPromise: Promise<void> | null = null;

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

export function ensureHistoryLoaded(): Promise<void> {
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

function persist(): Promise<void> {
  return AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache ?? {}));
}

/** The sets from the last time this exercise was performed, if any. */
export function getLastSetsSync(name: string): SetRecord[] | undefined {
  return cache?.[normalize(name)];
}

/**
 * Record the sets performed for one or more exercises (e.g. on finishing a
 * workout). Exercises with no sets are skipped so existing history is kept.
 */
export async function recordExerciseSets(
  entries: { name: string; sets: SetRecord[] }[],
): Promise<void> {
  await ensureHistoryLoaded();
  if (!cache) cache = {};
  for (const { name, sets } of entries) {
    if (sets.length > 0) cache[normalize(name)] = sets;
  }
  await persist();
}
