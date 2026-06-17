/**
 * Supabase Edge Function: scan-label
 *
 * Receives a base64 photo of a U.S. Nutrition Facts label and returns the
 * label's data as structured JSON (calories + macros + micros), ready to
 * prefill the app's "Add a food" form. The Gemini API key never leaves the
 * server — the app calls this function, not Google directly.
 *
 * Setup:
 *   supabase functions deploy scan-label
 *   supabase secrets set GEMINI_API_KEY=<your Google AI Studio key>
 *
 * The function keeps JWT verification on (the default); the app authenticates
 * with the project's anon key, so no extra flags are needed.
 */

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const MODEL = 'gemini-2.5-flash-lite';
const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PROMPT = `You are reading a U.S. Nutrition Facts label from a photo.
Extract the nutrition for ONE serving (the "per serving" column, not per container).

Return:
- description: the product/food name if visible, else "".
- brand: the manufacturer/brand if visible, else "".
- calories: kcal per serving.
- protein: grams per serving.
- carbs: total carbohydrate, grams per serving.
- fat: total fat, grams per serving.
- micros: an array of nutrients present on the label. ONLY include ones that
  actually appear, and use EXACTLY these labels and units:
    Fiber (g), Sugars (g), Saturated Fat (g), Cholesterol (mg), Sodium (mg),
    Potassium (mg), Calcium (mg), Iron (mg), Vitamin C (mg), Vitamin D (mcg).

Use the printed numeric values. If a macro is missing, use 0. Omit any micro
that is not on the label. Return structured data only.`;

// Gemini responseSchema (OpenAPI subset) — forces clean, typed JSON back.
const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    description: { type: 'STRING' },
    brand: { type: 'STRING' },
    calories: { type: 'NUMBER' },
    protein: { type: 'NUMBER' },
    carbs: { type: 'NUMBER' },
    fat: { type: 'NUMBER' },
    micros: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          label: { type: 'STRING' },
          amount: { type: 'NUMBER' },
          unit: { type: 'STRING' },
        },
        required: ['label', 'amount', 'unit'],
      },
    },
  },
  required: ['description', 'brand', 'calories', 'protein', 'carbs', 'fat', 'micros'],
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!GEMINI_API_KEY) return json({ error: 'GEMINI_API_KEY not configured' }, 500);

  let image: string | undefined;
  let mimeType = 'image/jpeg';
  try {
    const body = await req.json();
    image = body.image;
    if (body.mimeType) mimeType = body.mimeType;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  if (!image) return json({ error: 'Missing "image" (base64) in body' }, 400);

  let geminiRes: Response;
  try {
    geminiRes = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inline_data: { mime_type: mimeType, data: image } },
              { text: PROMPT },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    });
  } catch (e) {
    return json({ error: 'Failed to reach Gemini', detail: String(e) }, 502);
  }

  if (!geminiRes.ok) {
    const detail = await geminiRes.text();
    return json({ error: 'Gemini request failed', status: geminiRes.status, detail }, 502);
  }

  const data = await geminiRes.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return json({ error: 'No content returned from model' }, 502);

  try {
    return json(JSON.parse(text), 200);
  } catch {
    return json({ error: 'Model returned non-JSON', raw: text }, 502);
  }
});
