/**
 * USDA FoodData Central API client.
 *
 * Two operations back the tracker's Search flow:
 *   - `searchFoods(query)`  → GET-equivalent /foods/search, returns light rows
 *   - `getFoodDetail(fdcId)` → /food/{id}, returns full normalized nutrition
 *
 * Design notes for speed + reliability:
 *   - Results are cached per-query / per-id (module-level Maps) so re-typing or
 *     re-opening a food is instant and costs no network.
 *   - Callers pass an AbortSignal; the search UI aborts stale requests so only
 *     the latest keystroke's results ever land.
 *   - Branded foods report per-serving values via `labelNutrients`; everything
 *     else is per-100 g via `foodNutrients`. We normalize both and surface the
 *     basis string so the UI can label it honestly.
 *
 * API key: get a free one at https://fdc.nal.usda.gov/api-key-signup.html and
 * set EXPO_PUBLIC_USDA_API_KEY. Falls back to USDA's shared DEMO_KEY, which
 * works for development but is heavily rate-limited.
 */
import { ensureOverridesLoaded, foodKey, getOverrideSync } from '../nutrition/overrides';
import { FoodDetail, FoodMicro, FoodSearchResult } from './types';

export * from './types';

const BASE_URL = 'https://api.nal.usda.gov/fdc/v1';
const API_KEY = process.env.EXPO_PUBLIC_USDA_API_KEY || 'DEMO_KEY';

/** Datasets to search, ordered so branded/whole foods surface before survey blends. */
const SEARCH_DATA_TYPES = ['Branded', 'Foundation', 'SR Legacy', 'Survey (FNDDS)'];
const PAGE_SIZE = 25;

/** USDA nutrient numbers (stable across both API endpoints). */
const NUTRIENT = {
  energy: '208',
  protein: '203',
  fat: '204',
  carbs: '205',
} as const;

/** Non-macro nutrients we surface, in display order. */
const MICRO_DEFS: { number: string; label: string }[] = [
  { number: '291', label: 'Fiber' },
  { number: '269', label: 'Sugars' },
  { number: '606', label: 'Saturated Fat' },
  { number: '601', label: 'Cholesterol' },
  { number: '307', label: 'Sodium' },
  { number: '306', label: 'Potassium' },
  { number: '301', label: 'Calcium' },
  { number: '303', label: 'Iron' },
  { number: '401', label: 'Vitamin C' },
  { number: '328', label: 'Vitamin D' },
];

const searchCache = new Map<string, FoodSearchResult[]>();
const detailCache = new Map<number, FoodDetail>();

/** A raw nutrient row from either endpoint (shapes differ; both handled). */
interface RawNutrient {
  nutrientNumber?: string;
  unitName?: string;
  value?: number;
  nutrient?: { number?: string; unitName?: string };
  amount?: number;
}

function readNutrient(nutrients: RawNutrient[] | undefined, number: string) {
  if (!nutrients) return undefined;
  for (const n of nutrients) {
    const num = n.nutrientNumber ?? n.nutrient?.number;
    if (num !== number) continue;
    const value = n.value ?? n.amount;
    if (value == null) continue;
    return { value, unit: (n.unitName ?? n.nutrient?.unitName ?? '').toLowerCase() };
  }
  return undefined;
}

/**
 * Search foods by free-text query. Returns [] for blank/too-short input.
 * Pass `signal` to cancel a request that's been superseded by newer input.
 */
export async function searchFoods(query: string, signal?: AbortSignal): Promise<FoodSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const cacheKey = q.toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached) return cached;

  const res = await fetch(`${BASE_URL}/foods/search?api_key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: q,
      dataType: SEARCH_DATA_TYPES,
      pageSize: PAGE_SIZE,
      requireAllWords: true,
    }),
    signal,
  });

  if (!res.ok) {
    throw new Error(`USDA search failed (${res.status})`);
  }

  const json = await res.json();
  await ensureOverridesLoaded();
  const results: FoodSearchResult[] = (json.foods ?? []).map((f: any) => {
    const override = getOverrideSync(foodKey({ fdcId: f.fdcId }));
    return {
      id: `usda:${f.fdcId}`,
      source: 'usda' as const,
      fdcId: f.fdcId,
      description: titleCase(f.description ?? ''),
      brand: f.brandOwner || f.brandName || undefined,
      dataType: f.dataType ?? '',
      calories: override?.calories ?? readNutrient(f.foodNutrients, NUTRIENT.energy)?.value,
    };
  });

  searchCache.set(cacheKey, results);
  return results;
}

/**
 * Fetch and normalize full nutrition for a single food, then apply any saved
 * label override the user previously made for it. The raw USDA values are
 * cached by fdcId; overrides are applied on every read so edits show up
 * immediately without busting the network cache.
 */
export async function getFoodDetail(fdcId: number, signal?: AbortSignal): Promise<FoodDetail> {
  await ensureOverridesLoaded();

  let base = detailCache.get(fdcId);
  if (!base) {
    const res = await fetch(`${BASE_URL}/food/${fdcId}?api_key=${API_KEY}`, { signal });
    if (!res.ok) {
      throw new Error(`USDA lookup failed (${res.status})`);
    }
    base = normalizeDetail(await res.json());
    detailCache.set(fdcId, base);
  }

  return applyOverride(base);
}

/** Overlay the user's saved label corrections (if any) onto USDA's values. */
function applyOverride(base: FoodDetail): FoodDetail {
  const override = getOverrideSync(foodKey({ fdcId: base.fdcId }));
  if (!override) return base;
  return {
    ...base,
    calories: override.calories ?? base.calories,
    protein: override.protein ?? base.protein,
    carbs: override.carbs ?? base.carbs,
    fat: override.fat ?? base.fat,
    micros: override.micros ?? base.micros,
    servingGrams: override.servingGrams ?? base.servingGrams,
    cupGrams: override.cupGrams ?? base.cupGrams,
    isEdited: true,
  };
}

function normalizeDetail(food: any): FoodDetail {
  const base = {
    fdcId: food.fdcId,
    description: titleCase(food.description ?? ''),
    brand: food.brandOwner || food.brandName || undefined,
  };

  // Branded foods carry per-serving values in `labelNutrients` — prefer those,
  // since that's what's printed on the package the user is holding.
  const label = food.labelNutrients;
  if (label) {
    const micros: FoodMicro[] = [
      ['Fiber', label.fiber, 'g'],
      ['Sugars', label.sugars, 'g'],
      ['Saturated Fat', label.saturatedFat, 'g'],
      ['Cholesterol', label.cholesterol, 'mg'],
      ['Sodium', label.sodium, 'mg'],
      ['Potassium', label.potassium, 'mg'],
      ['Calcium', label.calcium, 'mg'],
      ['Iron', label.iron, 'mg'],
    ]
      .filter(([, v]) => v && v.value != null)
      .map(([labelName, v, unit]) => ({
        label: labelName as string,
        amount: round((v as { value: number }).value),
        unit: unit as string,
      }));

    return {
      ...base,
      basis: servingBasis(food),
      calories: round(label.calories?.value ?? 0),
      protein: round(label.protein?.value ?? 0),
      carbs: round(label.carbohydrates?.value ?? 0),
      fat: round(label.fat?.value ?? 0),
      // Branded labels are per serving — capture its gram weight when given.
      servingGrams:
        food.servingSizeUnit === 'g' && food.servingSize ? round(food.servingSize) : undefined,
      micros,
    };
  }

  // Foundation / SR Legacy / Survey foods: nutrients are per 100 g.
  const nutrients: RawNutrient[] = food.foodNutrients ?? [];
  const micros: FoodMicro[] = MICRO_DEFS.map((def) => {
    const n = readNutrient(nutrients, def.number);
    return n ? { label: def.label, amount: round(n.value), unit: n.unit } : null;
  }).filter((m): m is FoodMicro => m !== null);

  return {
    ...base,
    basis: 'per 100 g',
    calories: round(readNutrient(nutrients, NUTRIENT.energy)?.value ?? 0),
    protein: round(readNutrient(nutrients, NUTRIENT.protein)?.value ?? 0),
    carbs: round(readNutrient(nutrients, NUTRIENT.carbs)?.value ?? 0),
    fat: round(readNutrient(nutrients, NUTRIENT.fat)?.value ?? 0),
    // Nutrition is per 100 g, so one "serving" is 100 g — enables g/oz portions.
    servingGrams: 100,
    micros,
  };
}

function servingBasis(food: any): string {
  if (food.householdServingFullText) return `per ${food.householdServingFullText}`;
  if (food.servingSize && food.servingSizeUnit) {
    return `per ${round(food.servingSize)} ${food.servingSizeUnit}`;
  }
  return 'per serving';
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/** USDA descriptions are SHOUTED; make them readable while keeping acronyms sane. */
function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
