/**
 * Active plan store — the user's weight goal, running & gym goals, and the
 * AI-generated diet + training program.
 *
 * Local-first (AsyncStorage) with an in-memory cache, mirroring the profile and
 * nutrition stores. Types are imported type-only so this stays a plain data
 * module (no runtime dependency on the component files that define them).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { DietPlan, ProgramPlan } from './generatePlan';
import type { Plan } from '../components/GoalCard';
import type { GymGoals, RunningGoals } from '../components/PlanModal';

export interface StoredPlan {
  /** The headline weight goal. */
  weight: Plan | null;
  running: RunningGoals | null;
  gym: GymGoals | null;
  /** Finalized AI output (after the review screen). */
  diet: DietPlan | null;
  program: ProgramPlan | null;
}

const STORAGE_KEY = 'plan:v1';

const DEFAULT: StoredPlan = {
  weight: null,
  running: null,
  gym: null,
  diet: null,
  program: null,
};

let cache: StoredPlan | null = null;
let loadPromise: Promise<void> | null = null;

export function ensurePlanLoaded(): Promise<void> {
  if (cache) return Promise.resolve();
  if (!loadPromise) {
    loadPromise = AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        cache = raw ? { ...DEFAULT, ...JSON.parse(raw) } : { ...DEFAULT };
      })
      .catch(() => {
        cache = { ...DEFAULT };
      });
  }
  return loadPromise;
}

/** Current stored plan (after `ensurePlanLoaded`); defaults until loaded. */
export function getPlanSync(): StoredPlan {
  return cache ?? DEFAULT;
}

/** Merge a partial update into the stored plan and persist. */
export async function savePlan(patch: Partial<StoredPlan>): Promise<void> {
  await ensurePlanLoaded();
  cache = { ...(cache ?? DEFAULT), ...patch };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
}
