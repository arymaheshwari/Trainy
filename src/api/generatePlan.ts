/**
 * AI plan generation via two Supabase Edge Functions (Gemini 2.5 Flash-Lite):
 *   - `generate-diet`    — a dietitian computes daily calories + macros
 *   - `generate-program` — a coach builds the running / gym / combined schedule
 *
 * Same auth as the other AI features (EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY); the
 * Gemini key stays on the server. Each call is resilient: the backend enforces a
 * response schema, and the client validates + clamps before trusting it. When a
 * discipline is disabled we DON'T call — we return null so the caller excludes it.
 */
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// --- Public types -----------------------------------------------------------

export interface Micro {
  label: string;
  amount: number;
  unit: string;
}

export interface DietPlan {
  dailyCalories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugarLimit_g: number;
  sodiumLimit_mg: number;
  water_ml: number;
  /** Vitamins/minerals — hardcoded RDAs merged in client-side (don't vary by program). */
  micros: Micro[];
  rationale: string;
}

export type SessionType = 'run' | 'gym' | 'cardio' | 'rest';
export interface ProgramSession {
  day: number; // 1-7
  type: SessionType;
  title: string;
  detail: string;
}
export interface ProgramPhase {
  name: string;
  weeks: number;
  /** A representative 7-day week for this phase. */
  week: ProgramSession[];
}
export interface ProgramPlan {
  discipline: 'run' | 'gym' | 'both';
  phases: ProgramPhase[];
  notes: string;
}

export interface ActivitySummary {
  enabled: boolean;
  sessionsPerWeek: number;
  goal: string;
  currentForm: string;
  /** Optional best-known times for running forms, e.g. { "5k": "25:30" }. */
  times?: Record<string, string>;
}

export interface PlanInput {
  currentWeightKg: number;
  heightCm: number;
  targetWeightKg: number;
  perWeekKg: number;
  totalWeeks: number;
  running: ActivitySummary;
  gym: ActivitySummary;
}

export interface GeneratedPlan {
  diet: DietPlan | null;
  program: ProgramPlan | null;
}

/**
 * Standard adult RDAs for micros that don't shift with a training program, so we
 * don't burn LLM fields (and error budget) on them. Approximate, not medical.
 */
const STANDARD_MICROS: Micro[] = [
  { label: 'Vitamin C', amount: 90, unit: 'mg' },
  { label: 'Vitamin D', amount: 20, unit: 'mcg' },
  { label: 'Vitamin B12', amount: 2.4, unit: 'mcg' },
  { label: 'Calcium', amount: 1000, unit: 'mg' },
  { label: 'Iron', amount: 18, unit: 'mg' },
  { label: 'Potassium', amount: 3500, unit: 'mg' },
  { label: 'Magnesium', amount: 400, unit: 'mg' },
];

function assertConfigured() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'AI plan generation is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY as string,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const num = (v: unknown) => (isNum(v) && v >= 0 ? Math.round(v * 10) / 10 : 0);

function validateDiet(d: any): DietPlan | null {
  if (!d || typeof d !== 'object') return null;
  if (!isNum(d.dailyCalories) || d.dailyCalories <= 0) return null;
  return {
    dailyCalories: num(d.dailyCalories),
    protein_g: num(d.protein_g),
    carbs_g: num(d.carbs_g),
    fat_g: num(d.fat_g),
    fiber_g: num(d.fiber_g),
    sugarLimit_g: num(d.sugarLimit_g),
    sodiumLimit_mg: num(d.sodiumLimit_mg),
    water_ml: num(d.water_ml),
    micros: STANDARD_MICROS,
    rationale: String(d.rationale ?? '').slice(0, 400),
  };
}

function validateProgram(p: any): ProgramPlan | null {
  if (!p || typeof p !== 'object' || !Array.isArray(p.phases)) return null;
  const phases: ProgramPhase[] = p.phases
    .filter((ph: any) => ph && typeof ph === 'object' && Array.isArray(ph.week))
    .map((ph: any) => ({
      name: String(ph.name ?? '').slice(0, 80),
      weeks: Math.max(1, Math.round(Number(ph.weeks) || 1)),
      week: ph.week
        .filter((s: any) => s && typeof s === 'object')
        .map((s: any) => ({
          day: Math.min(Math.max(Math.round(Number(s.day) || 1), 1), 7),
          type: (['run', 'gym', 'cardio', 'rest'].includes(s.type) ? s.type : 'rest') as SessionType,
          title: String(s.title ?? '').slice(0, 80),
          detail: String(s.detail ?? '').slice(0, 200),
        })),
    }));
  if (phases.length === 0) return null;
  const discipline = ['run', 'gym', 'both'].includes(p.discipline) ? p.discipline : 'both';
  return { discipline, phases, notes: String(p.notes ?? '').slice(0, 400) };
}

/** Dietitian call. Throws on a real failure (so the UI can show an error). */
export async function generateDiet(input: PlanInput, signal?: AbortSignal): Promise<DietPlan> {
  assertConfigured();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-diet`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(input),
    signal,
  });
  if (!res.ok) throw new Error(`Diet generation failed (${res.status})`);
  const diet = validateDiet(await res.json());
  if (!diet) throw new Error('Unexpected diet response');
  return diet;
}

/**
 * Coach call. Returns null when neither discipline is enabled (nothing to plan)
 * — the caller catches null and excludes the program. Throws on a real failure.
 */
export async function generateProgram(
  input: PlanInput,
  signal?: AbortSignal,
): Promise<ProgramPlan | null> {
  if (!input.running.enabled && !input.gym.enabled) return null;
  assertConfigured();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-program`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(input),
    signal,
  });
  if (!res.ok) throw new Error(`Program generation failed (${res.status})`);
  const program = validateProgram(await res.json());
  if (!program) throw new Error('Unexpected program response');
  return program;
}
