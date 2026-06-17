/**
 * Nutrition-label scanning via the Supabase `scan-label` Edge Function.
 *
 * The app sends a base64 photo to our backend, which calls Gemini and returns
 * structured label data. The Gemini key lives only on the server; the app
 * authenticates to the function with the project's anon key.
 *
 * Requires EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (set in
 * .env — EXPO_PUBLIC_ vars are inlined at build time, so restart the dev
 * server after adding them).
 */
import { FoodMicro } from './usda';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Structured label as returned by the scan function. */
export interface ScannedLabel {
  description: string;
  brand: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  micros: FoodMicro[];
}

export async function scanLabel(
  base64: string,
  mimeType = 'image/jpeg',
  signal?: AbortSignal,
): Promise<ScannedLabel> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'Label scanning is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/scan-label`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ image: base64, mimeType }),
    signal,
  });

  if (!res.ok) {
    throw new Error(`Scan failed (${res.status})`);
  }
  return res.json() as Promise<ScannedLabel>;
}
