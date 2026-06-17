/**
 * Meal-idea suggestions via the Supabase `meal-ideas` Edge Function.
 *
 * Sends the chosen meal, the user's pantry, and an optional preference note to
 * our backend (Gemini 2.5 Flash-Lite) and gets back exactly 5 ideas. Same env
 * vars as the other AI features.
 */
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Character cap on the preference note (also enforced server-side). */
export const MAX_MEAL_NOTE = 200;

export type MealType = 'breakfast' | 'lunch' | 'dinner';

export interface MealIdea {
  name: string;
  description: string;
  ingredients: string[];
}

export type MealIdeasResult = { ok: true; ideas: MealIdea[] } | { ok: false; reason: string };

function validate(data: any): MealIdea[] | null {
  if (!data || !Array.isArray(data.ideas)) return null;
  return data.ideas
    .filter(
      (i: any) => i && typeof i.name === 'string' && typeof i.description === 'string',
    )
    .map((i: any) => ({
      name: i.name,
      description: i.description,
      ingredients: Array.isArray(i.ingredients)
        ? i.ingredients.filter((x: any) => typeof x === 'string')
        : [],
    }));
}

export async function fetchMealIdeas(
  input: { meal: MealType; note: string; pantry: string[] },
  signal?: AbortSignal,
): Promise<MealIdeasResult> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'Meal ideas are not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/meal-ideas`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      meal: input.meal,
      note: input.note.slice(0, MAX_MEAL_NOTE),
      pantry: input.pantry,
    }),
    signal,
  });

  if (!res.ok) {
    throw new Error(`Meal ideas failed (${res.status})`);
  }

  const ideas = validate(await res.json());
  if (!ideas || ideas.length === 0) {
    return { ok: false, reason: 'No ideas came back — try again or tweak your note.' };
  }
  return { ok: true, ideas };
}
