/**
 * Saved workout routines ("My Routines").
 *
 * A routine is a reusable template of exercises the user can start a workout
 * from. Stored locally and keyed by a generated id, persisted to disk.
 *
 * Loaded once into memory; reads are synchronous afterward so the Workout tab
 * can render the list without awaiting storage on every render.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface RoutineExercise {
  id: string;
  name: string;
  /** Planned number of sets, if specified. */
  sets?: number;
}

export interface Routine {
  id: string;
  name: string;
  exercises: RoutineExercise[];
  /** Epoch millis of creation; used for newest-first ordering. */
  createdAt: number;
}

const STORAGE_KEY = 'workoutRoutines:v1';

let cache: Routine[] | null = null;
let loadPromise: Promise<void> | null = null;

export function ensureRoutinesLoaded(): Promise<void> {
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
  return `r${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** All saved routines, newest first. Empty until loaded. */
export function getRoutinesSync(): Routine[] {
  return cache ?? [];
}

export async function addRoutine(
  data: Omit<Routine, 'id' | 'createdAt'>,
): Promise<Routine> {
  await ensureRoutinesLoaded();
  if (!cache) cache = [];
  const routine: Routine = { ...data, id: newId(), createdAt: Date.now() };
  cache.unshift(routine);
  await persist();
  return routine;
}

export async function updateRoutine(
  id: string,
  data: Partial<Omit<Routine, 'id' | 'createdAt'>>,
): Promise<void> {
  await ensureRoutinesLoaded();
  if (!cache) return;
  const i = cache.findIndex((r) => r.id === id);
  if (i >= 0) {
    cache[i] = { ...cache[i], ...data };
    await persist();
  }
}

export async function deleteRoutine(id: string): Promise<void> {
  await ensureRoutinesLoaded();
  if (!cache) return;
  cache = cache.filter((r) => r.id !== id);
  await persist();
}
