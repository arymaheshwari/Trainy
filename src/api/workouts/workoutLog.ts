/**
 * Daily workout log — completed sessions saved per calendar day.
 *
 * When a workout is finished it's saved against the user's local date
 * ("YYYY-MM-DD") as a frozen snapshot (name, duration, exercises, sets). Editing
 * a routine or exercise history later never rewrites past sessions.
 *
 * Retention: a rolling 12-month window — days older than 365 days are pruned on
 * load and on every write, so storage stays bounded.
 *
 * Local-first (AsyncStorage), mirroring the nutrition stores.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface LoggedSet {
  weight: number;
  reps: number;
}

export interface LoggedExercise {
  name: string;
  sets: LoggedSet[];
}

/** One completed workout session. */
export interface WorkoutLogEntry {
  id: string;
  /** ISO timestamp of when it was finished. */
  loggedAt: string;
  /** Routine name, or "Empty Workout" for an ad-hoc session. */
  name: string;
  durationSec: number;
  exercises: LoggedExercise[];
  /** Total completed sets across all exercises. */
  totalSets: number;
  /** Total volume (Σ weight × reps), in lbs. */
  totalVolume: number;
}

const STORAGE_KEY = 'workoutLog:v1';
const RETENTION_DAYS = 365;

type LogMap = Record<string, WorkoutLogEntry[]>;

let cache: LogMap | null = null;
let loadPromise: Promise<void> | null = null;

/** Local calendar day key, "YYYY-MM-DD". */
export function dayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Day key `offset` days from today (negative = past). */
export function dayKeyOffset(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return dayKey(d);
}

export function ensureWorkoutLogLoaded(): Promise<void> {
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

/** Drop days outside the 12-month retention window. */
function prune(): void {
  if (!cache) return;
  const cutoff = dayKeyOffset(-RETENTION_DAYS); // string compare is valid for YYYY-MM-DD
  for (const key of Object.keys(cache)) {
    if (key < cutoff) delete cache[key];
  }
}

function persist(): Promise<void> {
  return AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache ?? {}));
}

function newId(): string {
  return `w${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** Workouts logged on a day (after `ensureWorkoutLogLoaded`). Empty if none. */
export function getWorkoutsForDaySync(day: string): WorkoutLogEntry[] {
  return cache?.[day] ?? [];
}

/** All day keys that have at least one logged workout — e.g. to mark a calendar. */
export function getLoggedWorkoutDaysSync(): string[] {
  return cache ? Object.keys(cache) : [];
}

/** Save a finished workout to a day (defaults to today). Returns the entry. */
export async function addWorkout(
  entry: Omit<WorkoutLogEntry, 'id' | 'loggedAt'>,
  day: string = dayKey(),
  loggedAt: string = new Date().toISOString(),
): Promise<WorkoutLogEntry> {
  await ensureWorkoutLogLoaded();
  if (!cache) cache = {};
  const created: WorkoutLogEntry = { ...entry, id: newId(), loggedAt };
  (cache[day] ??= []).push(created);
  prune();
  await persist();
  return created;
}

/** Remove a single logged workout from a day. */
export async function removeWorkout(day: string, id: string): Promise<void> {
  await ensureWorkoutLogLoaded();
  if (!cache?.[day]) return;
  cache[day] = cache[day].filter((w) => w.id !== id);
  if (cache[day].length === 0) delete cache[day];
  await persist();
}
