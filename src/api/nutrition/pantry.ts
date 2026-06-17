/**
 * Pantry — the ingredients the user has on hand.
 *
 * Local-first (AsyncStorage), like the other nutrition stores. Maps to a
 * `pantry_items(user_id, id, name)` Postgres table for the eventual cloud sync.
 * Feeds the "What can I make?" feature later.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PantryItem {
  id: string;
  name: string;
}

const STORAGE_KEY = 'pantry:v1';

let cache: PantryItem[] | null = null;
let loadPromise: Promise<void> | null = null;

export function ensurePantryLoaded(): Promise<void> {
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
  return `p${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** Current pantry (after `ensurePantryLoaded`), newest first. */
export function getPantrySync(): PantryItem[] {
  return cache ?? [];
}

export async function addPantryItem(name: string): Promise<PantryItem | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  await ensurePantryLoaded();
  if (!cache) cache = [];
  const item: PantryItem = { id: newId(), name: trimmed };
  cache.unshift(item);
  await persist();
  return item;
}

export async function removePantryItem(id: string): Promise<void> {
  await ensurePantryLoaded();
  if (!cache) return;
  cache = cache.filter((i) => i.id !== id);
  await persist();
}
