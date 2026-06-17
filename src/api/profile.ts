/**
 * User profile — body metrics, blood-marker values, and notes.
 *
 * Local-first (AsyncStorage) with an in-memory cache, mirroring the nutrition
 * stores. Weight and height are stored canonically (kg, cm) regardless of the
 * unit the user is viewing, so anything that needs the real values (e.g. the
 * BMI in the Progress plan) reads one consistent number.
 *
 * Maps cleanly to a future `profiles` row for cloud sync.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type WeightUnit = 'kg' | 'lb';
export type HeightUnit = 'cm' | 'ftin';

export interface Profile {
  /** Canonical weight in kilograms, or null if unset. */
  weightKg: number | null;
  /** Canonical height in centimetres, or null if unset. */
  heightCm: number | null;
  /** Display preferences only — the canonical values above are unit-agnostic. */
  weightUnit: WeightUnit;
  heightUnit: HeightUnit;
  /** Blood-marker values keyed by marker id (raw strings as typed). */
  markers: Record<string, string>;
  /** Free-form notes (deficiencies etc. without a dedicated marker). */
  notes: string;
}

/** Used when the user hasn't entered the value yet (e.g. for the plan's BMI). */
export const FALLBACK_WEIGHT_KG = 67;
export const FALLBACK_HEIGHT_CM = 170;

const STORAGE_KEY = 'profile:v1';

const DEFAULT: Profile = {
  weightKg: null,
  heightCm: null,
  weightUnit: 'kg',
  heightUnit: 'ftin',
  markers: {},
  notes: '',
};

let cache: Profile | null = null;
let loadPromise: Promise<void> | null = null;

export function ensureProfileLoaded(): Promise<void> {
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

/** Current profile (after `ensureProfileLoaded`); defaults until loaded. */
export function getProfileSync(): Profile {
  return cache ?? DEFAULT;
}

/** Merge a partial update into the profile and persist. */
export async function saveProfile(patch: Partial<Profile>): Promise<void> {
  await ensureProfileLoaded();
  cache = { ...(cache ?? DEFAULT), ...patch };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
}

// --- Unit conversions -------------------------------------------------------

const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;

export const kgToLb = (kg: number): number => kg / KG_PER_LB;
export const lbToKg = (lb: number): number => lb * KG_PER_LB;

export function cmToFtIn(cm: number): { ft: number; in: number } {
  const totalIn = cm / CM_PER_IN;
  let ft = Math.floor(totalIn / 12);
  let inch = Math.round(totalIn - ft * 12);
  if (inch === 12) {
    ft += 1;
    inch = 0;
  }
  return { ft, in: inch };
}

export function ftInToCm(ft: number, inch: number): number {
  return (ft * 12 + inch) * CM_PER_IN;
}

/** Body Mass Index from canonical weight (kg) and height (cm). */
export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return m > 0 ? weightKg / (m * m) : 0;
}
