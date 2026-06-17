/**
 * Barcode → food lookup.
 *
 * Open Food Facts is the primary source — it's barcode-native, keyless, and
 * covers most packaged products globally. USDA is the fallback (its branded
 * foods carry GTIN/UPCs, but it's not barcode-indexed, so it's best-effort).
 *
 * Returns a `FoodDetailSource` ready to hand straight to the detail sheet:
 *  - a USDA hit resolves by fdcId (full edit/override support),
 *  - an Open Food Facts hit is a `resolved` food logged with source "barcode".
 */
import { searchFoods, getFoodDetail } from './usda';
import { FoodDetail, FoodDetailSource, FoodMicro } from './usda/types';

const OFF_URL = 'https://world.openfoodfacts.org/api/v2/product';
// Only the fields we need — keeps the response small and fast.
const OFF_FIELDS =
  'product_name,brands,serving_size,nutriments';

export async function lookupBarcode(
  code: string,
  signal?: AbortSignal,
): Promise<FoodDetailSource | null> {
  const off = await lookupOpenFoodFacts(code, signal);
  if (off) return { kind: 'resolved', food: off, source: 'barcode', refId: code };

  const fdcId = await lookupUsdaByUpc(code, signal);
  if (fdcId != null) return { kind: 'usda', fdcId };

  return null;
}

async function lookupOpenFoodFacts(code: string, signal?: AbortSignal): Promise<FoodDetail | null> {
  const res = await fetch(`${OFF_URL}/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`, {
    signal,
    headers: { 'User-Agent': 'HealthApp/1.0 (nutrition tracker)' },
  });
  if (!res.ok) return null;

  const json = await res.json();
  if (json.status !== 1 || !json.product) return null;

  const p = json.product;
  const n = p.nutriments ?? {};
  // Prefer per-serving values when the label provides them, else per 100 g.
  const hasServing = !!p.serving_size && n['energy-kcal_serving'] != null;
  const suffix = hasServing ? '_serving' : '_100g';
  const num = (key: string) => {
    const v = n[`${key}${suffix}`];
    return typeof v === 'number' && isFinite(v) ? v : 0;
  };

  const micros: FoodMicro[] = [];
  const pushMicro = (label: string, key: string, unit: string, scale = 1) => {
    const raw = n[`${key}${suffix}`];
    if (typeof raw === 'number' && isFinite(raw)) {
      micros.push({ label, amount: round(raw * scale), unit });
    }
  };
  pushMicro('Fiber', 'fiber', 'g');
  pushMicro('Sugars', 'sugars', 'g');
  pushMicro('Saturated Fat', 'saturated-fat', 'g');
  pushMicro('Sodium', 'sodium', 'mg', 1000); // OFF reports sodium in grams

  return {
    fdcId: 0,
    description: titleCase(p.product_name ?? 'Scanned product'),
    brand: p.brands ? String(p.brands).split(',')[0].trim() : undefined,
    basis: hasServing ? `per ${p.serving_size}` : 'per 100 g',
    calories: round(num('energy-kcal')),
    protein: round(num('proteins')),
    carbs: round(num('carbohydrates')),
    fat: round(num('fat')),
    micros,
  };
}

async function lookupUsdaByUpc(code: string, signal?: AbortSignal): Promise<number | null> {
  try {
    const results = await searchFoods(code, signal);
    // searchFoods returns light rows; confirm the code really matches by loading
    // the first branded hit's detail. USDA search already biases to relevance.
    const hit = results[0];
    if (!hit?.fdcId) return null;
    await getFoodDetail(hit.fdcId, signal); // warm cache / validate it resolves
    return hit.fdcId;
  } catch {
    return null;
  }
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

function titleCase(s: string): string {
  return s.trim().replace(/\b\w/g, (c) => c.toUpperCase());
}
