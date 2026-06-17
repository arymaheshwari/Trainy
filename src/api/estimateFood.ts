/**
 * AI food estimation via the Supabase `estimate-food` Edge Function.
 *
 * Sends a free-text description to our backend (Gemini 2.5 Flash) and gets back
 * an estimated nutrition breakdown to review before logging. Same env vars as
 * the label scanner (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY).
 *
 * Safeguards: input is length-capped, the backend rejects non-food text
 * (returned here as `{ ok: false }`), and the backend sanitizes the output —
 * but we still validate the shape client-side before trusting it.
 */
import { FoodMicro } from './usda';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Max characters we send for a description (also enforced server-side). */
export const MAX_FOOD_DESCRIPTION = 200;

/** Estimated nutrition for a described food/meal (the whole described amount). */
export interface EstimatedFood {
  description: string;
  brand: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  micros: FoodMicro[];
}

/** Either a usable estimate, or a rejection (not food / too long) with a reason. */
export type EstimateResult = { ok: true; food: EstimatedFood } | { ok: false; reason: string };

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

/** Confirm the payload matches our expected shape before trusting it. */
function validate(data: any): EstimatedFood | null {
  if (!data || typeof data !== 'object') return null;
  if (!isNum(data.calories) || !isNum(data.protein) || !isNum(data.carbs) || !isNum(data.fat)) {
    return null;
  }
  const micros: FoodMicro[] = Array.isArray(data.micros)
    ? data.micros.filter(
        (m: any) => m && typeof m.label === 'string' && typeof m.unit === 'string' && isNum(m.amount),
      )
    : [];
  return {
    description: String(data.description ?? ''),
    brand: String(data.brand ?? ''),
    calories: data.calories,
    protein: data.protein,
    carbs: data.carbs,
    fat: data.fat,
    micros,
  };
}

export async function estimateFood(
  description: string,
  signal?: AbortSignal,
): Promise<EstimateResult> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'AI logging is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }

  const trimmed = description.trim();
  if (!trimmed) return { ok: false, reason: 'Please describe a food.' };
  if (trimmed.length > MAX_FOOD_DESCRIPTION) {
    return { ok: false, reason: `Keep it under ${MAX_FOOD_DESCRIPTION} characters.` };
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/estimate-food`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ description: trimmed }),
    signal,
  });

  // Expected rejections come back as structured errors, not thrown.
  if (res.status === 422) {
    return { ok: false, reason: "That doesn't look like a food description." };
  }
  if (res.status === 400) {
    return { ok: false, reason: `Keep it under ${MAX_FOOD_DESCRIPTION} characters.` };
  }
  if (!res.ok) {
    throw new Error(`Estimate failed (${res.status})`);
  }

  const food = validate(await res.json());
  if (!food) throw new Error('Unexpected response format');
  return { ok: true, food };
}

/** Estimate nutrition from a photo of food (base64) via `estimate-food-photo`. */
export async function estimateFoodPhoto(
  base64: string,
  mimeType = 'image/jpeg',
  signal?: AbortSignal,
): Promise<EstimateResult> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'AI logging is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/estimate-food-photo`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ image: base64, mimeType }),
    signal,
  });

  if (res.status === 422) {
    return { ok: false, reason: "That doesn't look like food." };
  }
  if (res.status === 400) {
    return { ok: false, reason: 'That image is too large.' };
  }
  if (!res.ok) {
    throw new Error(`Estimate failed (${res.status})`);
  }

  const food = validate(await res.json());
  if (!food) throw new Error('Unexpected response format');
  return { ok: true, food };
}
