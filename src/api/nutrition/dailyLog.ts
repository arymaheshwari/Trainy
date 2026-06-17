/**
 * Daily food log — the "days system".
 *
 * Foods are logged against a calendar day (the user's local date, "YYYY-MM-DD").
 * Each entry stores a *frozen snapshot* of the food's per-serving nutrition at
 * log time, so editing or deleting the underlying food later never rewrites
 * history. Totals for a day are computed by summing entries × quantity.
 *
 * Retention: a rolling 12-month window — days older than 365 days are pruned on
 * load and on every write, so storage stays bounded.
 *
 * Local-first (AsyncStorage), mirroring the other nutrition stores. The shape
 * maps 1:1 to a future Postgres table for cloud sync:
 *
 *   food_log_entries(
 *     id text primary key, user_id uuid, day date, logged_at timestamptz,
 *     description text, brand text, source text, ref_id text, quantity numeric,
 *     calories numeric, protein numeric, carbs numeric, fat numeric, micros jsonb
 *   )
 *   -- index on (user_id, day)
 *
 * So migration is: for each local day, insert its entries with the day as the
 * `day` column and the user's id — no reshaping.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { FoodMicro, FoodSource } from '../usda/types';
import { PortionUnit } from './portions';

/** One logged food. Nutrition fields are per single serving; multiply by `quantity`. */
export interface LogEntry {
  id: string;
  /** ISO timestamp of when it was logged. */
  loggedAt: string;
  description: string;
  brand?: string;
  /** Where the food came from, kept so the entry can be traced back / re-opened. */
  source: FoodSource;
  /** fdcId (as string) for USDA foods, or the customId for custom foods. */
  refId: string;
  /** Number of servings consumed (the multiplier applied to the per-serving values). */
  quantity: number;
  /** The portion as the user chose it, for display (e.g. 150 g). `quantity` is the math. */
  portion?: { amount: number; unit: PortionUnit };
  // Per-serving snapshot, frozen at log time.
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  micros: FoodMicro[];
}

export interface DayTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  micros: FoodMicro[];
}

const STORAGE_KEY = 'dailyLog:v1';
const RETENTION_DAYS = 365;

type LogMap = Record<string, LogEntry[]>;

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

export function ensureLogLoaded(): Promise<void> {
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
  return `l${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** Entries logged on a day (after `ensureLogLoaded`). Empty array if none. */
export function getDayEntriesSync(day: string): LogEntry[] {
  return cache?.[day] ?? [];
}

/** All day keys that have at least one entry — e.g. to mark a calendar. */
export function getLoggedDaysSync(): string[] {
  return cache ? Object.keys(cache) : [];
}

/**
 * Per-day totals across an inclusive [startDay, endDay] range, sorted by day.
 * Only days that have entries are returned. This is the building block for
 * weekly/monthly analysis — pass a 7-day range for a week, a month range for a
 * month, then average/sum/chart the result.
 */
export function getDailyTotalsInRange(
  startDay: string,
  endDay: string,
): { day: string; totals: DayTotals }[] {
  if (!cache) return [];
  return Object.keys(cache)
    .filter((d) => d >= startDay && d <= endDay)
    .sort()
    .map((d) => ({ day: d, totals: getDayTotalsSync(d) }));
}

/** Summed totals for a day (entries × quantity). */
export function getDayTotalsSync(day: string): DayTotals {
  const entries = getDayEntriesSync(day);
  const totals: DayTotals = { calories: 0, protein: 0, carbs: 0, fat: 0, micros: [] };
  const microByLabel = new Map<string, FoodMicro>();

  for (const e of entries) {
    totals.calories += e.calories * e.quantity;
    totals.protein += e.protein * e.quantity;
    totals.carbs += e.carbs * e.quantity;
    totals.fat += e.fat * e.quantity;
    for (const m of e.micros) {
      const existing = microByLabel.get(m.label);
      if (existing) {
        existing.amount += m.amount * e.quantity;
      } else {
        microByLabel.set(m.label, { ...m, amount: m.amount * e.quantity });
      }
    }
  }

  totals.micros = [...microByLabel.values()].map((m) => ({ ...m, amount: round(m.amount) }));
  totals.calories = round(totals.calories);
  totals.protein = round(totals.protein);
  totals.carbs = round(totals.carbs);
  totals.fat = round(totals.fat);
  return totals;
}

/** Log a food to a day (defaults to today). Returns the created entry. */
export async function addLogEntry(
  entry: Omit<LogEntry, 'id' | 'loggedAt'>,
  day: string = dayKey(),
  loggedAt: string = new Date().toISOString(),
): Promise<LogEntry> {
  await ensureLogLoaded();
  if (!cache) cache = {};
  const created: LogEntry = { ...entry, id: newId(), loggedAt };
  (cache[day] ??= []).push(created);
  prune();
  await persist();
  return created;
}

/** Remove a single logged entry from a day. */
export async function removeLogEntry(day: string, id: string): Promise<void> {
  await ensureLogLoaded();
  if (!cache?.[day]) return;
  cache[day] = cache[day].filter((e) => e.id !== id);
  if (cache[day].length === 0) delete cache[day];
  await persist();
}

/** Change the serving quantity of a logged entry. */
export async function setEntryQuantity(day: string, id: string, quantity: number): Promise<void> {
  await ensureLogLoaded();
  const entry = cache?.[day]?.find((e) => e.id === id);
  if (entry) {
    entry.quantity = quantity;
    await persist();
  }
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
