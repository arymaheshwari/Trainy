import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  bmi,
  FALLBACK_HEIGHT_CM,
  FALLBACK_WEIGHT_KG,
  kgToLb,
  lbToKg,
  saveProfile,
  WeightUnit,
} from '../api/profile';
import { Plan } from './GoalCard';
import { NutritionGoalsModal } from './NutritionGoalsModal';
import { colors, fontSize, radius, spacing } from '../theme';

// --- Guardrails -------------------------------------------------------------
// Health bounds: we won't let a target sit below severe-underweight or above
// class-I obesity — past those a "goal" is just unhealthy.
const BMI_HARD_MIN = 16;
const BMI_HARD_MAX = 35;
// A single goal is capped at ±25% of current bodyweight.
const MAX_CHANGE = 0.25;
// Healthy BMI band (WHO).
const BMI_HEALTHY_MIN = 18.5;
const BMI_HEALTHY_MAX = 24.9;

// Healthy weekly rate of change, as a fraction of bodyweight per week.
// Loss: ~0.5–1%/wk is the widely cited sustainable range; we treat ≤0.75% as
// comfortable, ≤1.25% aggressive, beyond that very aggressive. Lean gain runs
// at roughly half those rates (more fat is gained past ~0.5%/wk).
const LOSS_REALISTIC = 0.0075;
const LOSS_AGGRESSIVE = 0.0125;
const GAIN_REALISTIC = 0.004;
const GAIN_AGGRESSIVE = 0.007;

const WEEKS_MIN = 1;
const WEEKS_MAX = 104;

const ROW_HEIGHT = 48;
const VISIBLE_ROWS = 5;
const WHEEL_HEIGHT = ROW_HEIGHT * VISIBLE_ROWS;

const round1 = (n: number) => Math.round(n * 10) / 10;
const fmt = (n: number) => String(round1(n));

const toUnit = (kg: number, unit: WeightUnit) => (unit === 'lb' ? kgToLb(kg) : kg);
const fromUnit = (v: number, unit: WeightUnit) => (unit === 'lb' ? lbToKg(v) : v);

function weightForBmi(b: number, heightCm: number): number {
  const m = heightCm / 100;
  return b * m * m;
}

interface Scale {
  values: number[]; // selectable weights in the display unit
  minKg: number;
  maxKg: number;
}

/** Build the bounded list of selectable target weights in the display unit. */
function buildScale(currentKg: number, heightCm: number, unit: WeightUnit): Scale {
  const lower = Math.max(weightForBmi(BMI_HARD_MIN, heightCm), currentKg * (1 - MAX_CHANGE));
  const upper = Math.min(weightForBmi(BMI_HARD_MAX, heightCm), currentKg * (1 + MAX_CHANGE));
  const minKg = lower < upper ? lower : weightForBmi(BMI_HARD_MIN, heightCm);
  const maxKg = lower < upper ? upper : weightForBmi(BMI_HARD_MAX, heightCm);

  const step = unit === 'lb' ? 1 : 0.5;
  const start = Math.ceil(toUnit(minKg, unit) / step) * step;
  const end = Math.floor(toUnit(maxKg, unit) / step) * step;
  const values: number[] = [];
  for (let v = start; v <= end + 1e-9; v += step) values.push(round1(v));

  return { values, minKg, maxKg };
}

/** Index in `values` whose weight is closest to `targetKg`. */
function indexForKg(values: number[], targetKg: number, unit: WeightUnit): number {
  const targetDisp = toUnit(targetKg, unit);
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < values.length; i++) {
    const d = Math.abs(values[i] - targetDisp);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

function bmiFeedback(targetKg: number, heightCm: number): { value: number; label: string; color: string } {
  const value = bmi(targetKg, heightCm);
  if (value < BMI_HEALTHY_MIN) return { value, label: 'Underweight', color: colors.amber };
  if (value <= BMI_HEALTHY_MAX) return { value, label: 'Healthy range', color: colors.teal };
  if (value < 30) return { value, label: 'Overweight', color: colors.amber };
  return { value, label: 'Obese', color: colors.red };
}

/** A timeframe that lands the change at a comfortable weekly rate. */
function defaultWeeks(diffKg: number, currentKg: number): number {
  const d = Math.abs(diffKg);
  if (d < 0.05) return 1;
  const rate = currentKg * (diffKg < 0 ? LOSS_REALISTIC : GAIN_REALISTIC);
  return Math.min(Math.max(Math.ceil(d / rate), WEEKS_MIN), WEEKS_MAX);
}

/** Per-week pace and how aggressive it is, based on weekly % of bodyweight. */
function rateFeedback(diffKg: number, currentKg: number, weeks: number, unit: WeightUnit) {
  const d = Math.abs(diffKg);
  const perWeekKg = d / Math.max(weeks, 1);
  const perWeekLabel = `${fmt(toUnit(perWeekKg, unit))} ${unit}/week`;
  if (d < 0.05) {
    return { level: 'maintenance', color: colors.textSecondary, perWeekLabel: `0 ${unit}/week` };
  }
  const pct = currentKg > 0 ? perWeekKg / currentKg : 0;
  const [realistic, aggressive] =
    diffKg < 0 ? [LOSS_REALISTIC, LOSS_AGGRESSIVE] : [GAIN_REALISTIC, GAIN_AGGRESSIVE];
  if (pct <= realistic) return { level: 'realistic', color: colors.teal, perWeekLabel };
  if (pct <= aggressive) return { level: 'aggressive', color: colors.amber, perWeekLabel };
  return { level: 'very aggressive', color: colors.red, perWeekLabel };
}

function planTitle(startKg: number, targetKg: number): string {
  const diff = targetKg - startKg;
  if (Math.abs(diff) < 0.05) return 'Maintain weight';
  return `${diff < 0 ? 'Lose' : 'Gain'} ${fmt(Math.abs(diff))} kg`;
}

// --- Running & Gym goals ----------------------------------------------------
/** How hard a program runs. "custom" = the user's chosen sessions/week. */
export type Pace = 'slow' | 'regular' | 'intense' | 'custom';
// Sessions per week differ by activity.
const RUN_PACE_DAYS: Record<'slow' | 'regular' | 'intense', number> = { slow: 1, regular: 2, intense: 3 };
const GYM_PACE_DAYS: Record<'slow' | 'regular' | 'intense', number> = { slow: 2, regular: 3, intense: 6 };

function paceToDays(pace: Pace, customDays: number, map: Record<string, number>): number {
  if (pace === 'custom') return customDays;
  return map[pace];
}
// Beyond this many combined run + gym sessions a week, we nudge toward rest.
const MAX_WEEKLY_SESSIONS = 6;

export type RunForm = 'beginner' | '5k' | '10k' | 'half' | 'marathon';
export type RunGoalKind = 'casual' | 'regular' | '10k' | 'half' | 'marathon';

export interface RunningGoals {
  /** Whether the user wants a running plan at all. */
  enabled: boolean;
  currentForm: RunForm;
  /** Typed times keyed by form (e.g. "25:30"); not used for "beginner". */
  times: Partial<Record<RunForm, string>>;
  goal: RunGoalKind;
  pace: Pace;
  customDays: number;
}

export const EMPTY_RUNNING: RunningGoals = {
  enabled: true,
  currentForm: 'beginner',
  times: {},
  goal: 'casual',
  pace: 'regular',
  customDays: 3,
};

export type GymForm = 'beginner' | 'intermediate' | 'advanced';
export type GymGoalKind = 'casual' | 'regular' | 'build_muscle';

export interface GymGoals {
  enabled: boolean;
  currentForm: GymForm;
  goal: GymGoalKind;
  pace: Pace;
  customDays: number;
}

export const EMPTY_GYM: GymGoals = {
  enabled: true,
  currentForm: 'beginner',
  goal: 'casual',
  pace: 'regular',
  customDays: 3,
};

/** Resolved weekly session counts (0 when the plan is disabled). */
export function runDaysPerWeek(r: RunningGoals): number {
  return r.enabled ? paceToDays(r.pace, r.customDays, RUN_PACE_DAYS) : 0;
}
export function gymDaysPerWeek(g: GymGoals): number {
  return g.enabled ? paceToDays(g.pace, g.customDays, GYM_PACE_DAYS) : 0;
}

interface Option {
  label: string;
  value: string;
}

const RUN_FORM_OPTIONS: Option[] = [
  { label: 'Beginner', value: 'beginner' },
  { label: '5K', value: '5k' },
  { label: '10K', value: '10k' },
  { label: 'Half marathon', value: 'half' },
  { label: 'Marathon', value: 'marathon' },
];
const RUN_GOAL_OPTIONS: Option[] = [
  { label: 'Casual', value: 'casual' },
  { label: 'Regular', value: 'regular' },
  { label: '10K', value: '10k' },
  { label: 'Half marathon', value: 'half' },
  { label: 'Full marathon', value: 'marathon' },
];
const GYM_FORM_OPTIONS: Option[] = [
  { label: 'Beginner', value: 'beginner' },
  { label: 'Intermediate', value: 'intermediate' },
  { label: 'Advanced', value: 'advanced' },
];
const GYM_GOAL_OPTIONS: Option[] = [
  { label: 'Casual', value: 'casual' },
  { label: 'Regular', value: 'regular' },
  { label: 'Build muscle', value: 'build_muscle' },
];
const PACE_OPTIONS: Option[] = [
  { label: 'Slow', value: 'slow' },
  { label: 'Regular', value: 'regular' },
  { label: 'Intense', value: 'intense' },
  { label: 'Custom', value: 'custom' },
];

const FORM_LABEL: Record<RunForm, string> = {
  beginner: 'Beginner',
  '5k': '5K',
  '10k': '10K',
  half: 'half marathon',
  marathon: 'marathon',
};

/**
 * Plan editor with three tabs: a target-weight wheel (with a timeframe step), a
 * running plan, and a gym plan. Each tab saves its own goal. The combined
 * weekly session count is watched across running + gym to nudge toward rest.
 */
export function PlanModal({
  visible,
  mode,
  plan,
  running,
  gym,
  currentWeightKg,
  heightCm,
  weightUnit,
  onClose,
  onComplete,
}: {
  visible: boolean;
  mode: 'create' | 'edit';
  plan: Plan | null;
  running: RunningGoals;
  gym: GymGoals;
  currentWeightKg: number | null;
  heightCm: number | null;
  weightUnit: WeightUnit;
  onClose: () => void;
  /** Called once all three goals are set — hands off to plan generation. */
  onComplete: (plan: Plan, running: RunningGoals, gym: GymGoals) => void;
}) {
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const scrollMax = Math.round(screenH * 0.42);

  const currentKg = currentWeightKg ?? FALLBACK_WEIGHT_KG;
  const h = heightCm ?? FALLBACK_HEIGHT_CM;
  const heightKnown = heightCm != null;

  const [tab, setTab] = useState<'weight' | 'running' | 'gym'>('weight');
  const [weightStep, setWeightStep] = useState<'target' | 'timeframe'>('target');
  const [unit, setUnit] = useState<WeightUnit>(weightUnit);
  // Selected target, kept canonically (kg) so it survives unit switches.
  const [targetKg, setTargetKg] = useState(currentKg);
  const [weeks, setWeeks] = useState(1);
  const [run, setRun] = useState<RunningGoals>(running);
  const [gymGoals, setGymGoals] = useState<GymGoals>(gym);
  // Which tabs the user has set this session — all three → generate.
  const [done, setDone] = useState({ weight: false, running: false, gym: false });
  const [manualOpen, setManualOpen] = useState(false);
  // Bumped to remount each wheel at the right spot.
  const [wheelSeq, setWheelSeq] = useState(0);
  const [weeksSeq, setWeeksSeq] = useState(0);

  const scale = useMemo(() => buildScale(currentKg, h, unit), [currentKg, h, unit]);

  useEffect(() => {
    if (!visible) return;
    const anchorKg = Math.min(Math.max(plan?.targetValue ?? currentKg, scale.minKg), scale.maxKg);
    setTab('weight');
    setWeightStep('target');
    setUnit(weightUnit);
    setTargetKg(round1(anchorKg));
    setRun(running);
    setGymGoals(gym);
    setDone({ weight: false, running: false, gym: false });
    setWheelSeq((s) => s + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const initialIndex = indexForKg(scale.values, targetKg, unit);
  const bmiInfo = bmiFeedback(targetKg, h);
  const diffKg = targetKg - currentKg;
  const rate = rateFeedback(diffKg, currentKg, weeks, unit);

  const totalSessions = runDaysPerWeek(run) + gymDaysPerWeek(gymGoals);
  const overTrained = totalSessions > MAX_WEEKLY_SESSIONS;

  const toggleUnit = (u: WeightUnit) => {
    if (u === unit) return;
    setUnit(u);
    saveProfile({ weightUnit: u }); // global body-weight preference
    setWheelSeq((s) => s + 1); // remount wheel in the new unit at the same target
  };

  const goToTimeframe = () => {
    setWeeks(plan?.weeks ?? defaultWeeks(diffKg, currentKg));
    setWeightStep('timeframe');
    setWeeksSeq((s) => s + 1);
  };

  const buildPlan = (): Plan => {
    const startValue = plan?.startValue ?? round1(currentKg);
    const currentValue = plan?.currentValue ?? round1(currentKg);
    return {
      ...(plan ?? {}),
      title: planTitle(startValue, targetKg),
      startValue,
      currentValue,
      targetValue: round1(targetKg),
      unit: 'kg',
      weeks,
    };
  };

  /** Mark a tab set; when all three are set, hand off to generation. */
  const markDone = (which: 'weight' | 'running' | 'gym') => {
    const next = { ...done, [which]: true };
    setDone(next);
    if (next.weight && next.running && next.gym) {
      onComplete(buildPlan(), run, gymGoals);
      onClose();
      return;
    }
    const order = ['weight', 'running', 'gym'] as const;
    const nextTab = order.find((t) => !next[t]);
    if (nextTab) {
      setTab(nextTab);
      setWeightStep('target');
    }
  };

  const switchTab = (t: 'weight' | 'running' | 'gym') => {
    setTab(t);
    setWeightStep('target');
  };

  const verb = diffKg < 0 ? 'Lose' : 'Gain';
  const changeSummary =
    Math.abs(diffKg) < 0.05
      ? 'Maintain weight'
      : `${verb} ${fmt(toUnit(Math.abs(diffKg), unit))} ${unit} over ${weeks} ${weeks === 1 ? 'week' : 'weeks'}`;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}>
          <View style={styles.header}>
            <Text style={styles.title}>{mode === 'create' ? 'Make a plan' : 'Edit plan'}</Text>
            <Pressable onPress={onClose} hitSlop={8} style={styles.closeButton}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* Tabs */}
          <View style={styles.tabs}>
            {(['weight', 'running', 'gym'] as const).map((t) => {
              const activeTab = t === tab;
              return (
                <Pressable
                  key={t}
                  style={[styles.tab, activeTab && styles.tabActive]}
                  onPress={() => switchTab(t)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: activeTab }}
                >
                  <View style={styles.tabInner}>
                    {done[t] && <Ionicons name="checkmark-circle" size={14} color={colors.teal} />}
                    <Text style={[styles.tabText, activeTab && styles.tabTextActive]}>
                      {t[0].toUpperCase() + t.slice(1)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            style={styles.manualLink}
            onPress={() => setManualOpen(true)}
            accessibilityRole="button"
          >
            <Ionicons name="create-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.manualLinkText}>Enter nutrition goals manually</Text>
          </Pressable>

          {tab === 'weight' && weightStep === 'target' && (
            <>
              <View style={styles.questionRow}>
                <Text style={styles.question}>What is your target weight?</Text>
                <View style={styles.segment}>
                  {(['kg', 'lb'] as WeightUnit[]).map((u) => {
                    const activeUnit = u === unit;
                    return (
                      <Pressable
                        key={u}
                        style={[styles.segmentItem, activeUnit && styles.segmentItemActive]}
                        onPress={() => toggleUnit(u)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: activeUnit }}
                      >
                        <Text style={[styles.segmentText, activeUnit && styles.segmentTextActive]}>{u}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <Wheel
                key={`w${wheelSeq}`}
                values={scale.values}
                label={unit}
                initialIndex={initialIndex}
                format={fmt}
                onChange={(i) => setTargetKg(round1(fromUnit(scale.values[i], unit)))}
              />

              <View style={styles.bmiBlock}>
                <Text style={styles.bmiValue}>{fmt(bmiInfo.value)}</Text>
                <Text style={styles.bmiCaption}>BMI</Text>
                <View style={[styles.bmiPill, { backgroundColor: bmiInfo.color + '26' }]}>
                  <Text style={[styles.bmiPillText, { color: bmiInfo.color }]}>{bmiInfo.label}</Text>
                </View>
              </View>

              <Text style={styles.hint}>
                {heightKnown
                  ? `Based on your height of ${fmt(h)} cm`
                  : `Assuming a height of ${fmt(h)} cm — set yours in Profile for an accurate BMI`}
              </Text>
            </>
          )}

          {tab === 'weight' && weightStep === 'timeframe' && (
            <>
              <Text style={styles.question}>Over how many weeks?</Text>

              <Wheel
                key={`t${weeksSeq}`}
                values={WEEKS_VALUES}
                label="weeks"
                initialIndex={weeks - WEEKS_MIN}
                format={(n) => String(n)}
                onChange={(i) => setWeeks(WEEKS_VALUES[i])}
              />

              <Text style={styles.changeSummary}>{changeSummary}</Text>
              <Text style={[styles.rateText, { color: rate.color }]}>
                {rate.perWeekLabel} · {rate.level}
              </Text>
            </>
          )}

          {tab !== 'weight' && (
            <ScrollView
              style={{ maxHeight: scrollMax }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {tab === 'running' ? (
                <>
                  <View style={styles.questionRow}>
                    <Text style={styles.question}>Running plan?</Text>
                    <YesNo value={run.enabled} onChange={(v) => setRun((p) => ({ ...p, enabled: v }))} />
                  </View>

                  {run.enabled && (
                    <>
                      <Section label="Current form">
                        <ChipGroup
                          options={RUN_FORM_OPTIONS}
                          value={run.currentForm}
                          onChange={(v) => setRun((p) => ({ ...p, currentForm: v as RunForm }))}
                        />
                        {run.currentForm !== 'beginner' && (
                          <TextInput
                            style={styles.timeInput}
                            value={run.times[run.currentForm] ?? ''}
                            onChangeText={(v) =>
                              setRun((p) => ({ ...p, times: { ...p.times, [p.currentForm]: v } }))
                            }
                            keyboardType="numbers-and-punctuation"
                            placeholder={`Your ${FORM_LABEL[run.currentForm]} time (e.g. 25:30)`}
                            placeholderTextColor={colors.textTertiary}
                          />
                        )}
                      </Section>

                      <Section label="Goal">
                        <ChipGroup
                          options={RUN_GOAL_OPTIONS}
                          value={run.goal}
                          onChange={(v) => setRun((p) => ({ ...p, goal: v as RunGoalKind }))}
                        />
                      </Section>

                      <Section label="Program pace">
                        <ChipGroup
                          options={PACE_OPTIONS}
                          value={run.pace}
                          onChange={(v) => setRun((p) => ({ ...p, pace: v as Pace }))}
                        />
                        {run.pace === 'custom' && (
                          <DaysPicker
                            value={run.customDays}
                            onChange={(n) => setRun((p) => ({ ...p, customDays: n }))}
                          />
                        )}
                      </Section>
                    </>
                  )}
                </>
              ) : (
                <>
                  <View style={styles.questionRow}>
                    <Text style={styles.question}>Gym plan?</Text>
                    <YesNo
                      value={gymGoals.enabled}
                      onChange={(v) => setGymGoals((p) => ({ ...p, enabled: v }))}
                    />
                  </View>

                  {gymGoals.enabled && (
                    <>
                      <Section label="Current form">
                        <ChipGroup
                          options={GYM_FORM_OPTIONS}
                          value={gymGoals.currentForm}
                          onChange={(v) => setGymGoals((p) => ({ ...p, currentForm: v as GymForm }))}
                        />
                      </Section>

                      <Section label="Goal">
                        <ChipGroup
                          options={GYM_GOAL_OPTIONS}
                          value={gymGoals.goal}
                          onChange={(v) => setGymGoals((p) => ({ ...p, goal: v as GymGoalKind }))}
                        />
                      </Section>

                      <Section label="Program pace">
                        <ChipGroup
                          options={PACE_OPTIONS}
                          value={gymGoals.pace}
                          onChange={(v) => setGymGoals((p) => ({ ...p, pace: v as Pace }))}
                        />
                        {gymGoals.pace === 'custom' && (
                          <DaysPicker
                            value={gymGoals.customDays}
                            onChange={(n) => setGymGoals((p) => ({ ...p, customDays: n }))}
                          />
                        )}
                      </Section>
                    </>
                  )}
                </>
              )}
            </ScrollView>
          )}

          {tab !== 'weight' && overTrained && (
            <View style={styles.warning}>
              <Ionicons name="bed-outline" size={18} color={colors.amber} />
              <Text style={styles.warningText}>
                {totalSessions} run + gym sessions a week isn't recommended — rest is a key part of
                building muscle and endurance.
              </Text>
            </View>
          )}

          {/* Footer buttons */}
          {tab === 'weight' && weightStep === 'target' && (
            <Pressable
              style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}
              onPress={goToTimeframe}
            >
              <Text style={styles.saveButtonText}>Next</Text>
            </Pressable>
          )}
          {tab === 'weight' && weightStep === 'timeframe' && (
            <View style={styles.footerRow}>
              <Pressable
                style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
                onPress={() => setWeightStep('target')}
              >
                <Text style={styles.backButtonText}>Back</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.saveButton, styles.flex, styles.noTopMargin, pressed && styles.pressed]}
                onPress={() => markDone('weight')}
              >
                <Text style={styles.saveButtonText}>Set goal</Text>
              </Pressable>
            </View>
          )}
          {tab !== 'weight' && (
            <Pressable
              style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}
              onPress={() => markDone(tab)}
            >
              <Text style={styles.saveButtonText}>Save {tab} plan</Text>
            </Pressable>
          )}
        </View>
      </View>

      <NutritionGoalsModal visible={manualOpen} onClose={() => setManualOpen(false)} />
    </Modal>
  );
}

const WEEKS_VALUES = Array.from({ length: WEEKS_MAX - WEEKS_MIN + 1 }, (_, i) => i + WEEKS_MIN);

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

function YesNo({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.segment}>
      {[
        { label: 'Yes', v: true },
        { label: 'No', v: false },
      ].map((o) => {
        const active = o.v === value;
        return (
          <Pressable
            key={o.label}
            style={[styles.segmentItem, active && styles.segmentItemActive]}
            onPress={() => onChange(o.v)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ChipGroup({
  options,
  value,
  onChange,
}: {
  options: Option[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function DaysPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <View style={styles.daysWrap}>
      <Text style={styles.daysLabel}>Times per week</Text>
      <View style={styles.days}>
        {[1, 2, 3, 4, 5, 6, 7].map((n) => {
          const active = n === value;
          return (
            <Pressable
              key={n}
              style={[styles.day, active && styles.dayActive]}
              onPress={() => onChange(n)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.dayText, active && styles.dayTextActive]}>{n}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Vertical scroll wheel; the value at the centre line is selected. */
function Wheel({
  values,
  label,
  initialIndex,
  format,
  onChange,
}: {
  values: number[];
  label: string;
  initialIndex: number;
  format: (n: number) => string;
  onChange: (index: number) => void;
}) {
  const ref = useRef<ScrollView>(null);
  const [active, setActive] = useState(initialIndex);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.y / ROW_HEIGHT);
    const clamped = Math.min(Math.max(i, 0), values.length - 1);
    if (clamped !== active) {
      setActive(clamped);
      onChange(clamped);
    }
  };

  return (
    <View style={styles.wheelWrap}>
      <View style={styles.wheelBand} pointerEvents="none" />
      <Text style={styles.wheelUnit} pointerEvents="none">
        {label}
      </Text>
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ROW_HEIGHT}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={onScroll}
        contentContainerStyle={{ paddingVertical: (WHEEL_HEIGHT - ROW_HEIGHT) / 2 }}
        onContentSizeChange={() => ref.current?.scrollTo({ y: initialIndex * ROW_HEIGHT, animated: false })}
      >
        {values.map((v, i) => (
          <View key={i} style={styles.wheelRow}>
            <Text style={[styles.wheelText, i === active && styles.wheelTextActive]}>{format(v)}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize.title,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: 4,
    marginBottom: spacing.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  tabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tabActive: {
    backgroundColor: colors.surface,
  },
  tabText: {
    color: colors.textTertiary,
    fontSize: fontSize.body,
    fontWeight: '700',
  },
  tabTextActive: {
    color: colors.textPrimary,
  },
  manualLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  manualLinkText: {
    color: colors.textSecondary,
    fontSize: fontSize.caption,
    fontWeight: '700',
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  question: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '700',
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.pill,
    padding: 3,
  },
  segmentItem: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  segmentItemActive: {
    backgroundColor: colors.primary,
  },
  segmentText: {
    color: colors.textSecondary,
    fontSize: fontSize.caption,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: colors.textPrimary,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.caption,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActive: {
    backgroundColor: 'rgba(124, 92, 255, 0.15)',
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: fontSize.body,
    fontWeight: '700',
  },
  chipTextActive: {
    color: colors.textPrimary,
  },
  timeInput: {
    marginTop: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '700',
  },
  daysWrap: {
    marginTop: spacing.md,
  },
  daysLabel: {
    color: colors.textTertiary,
    fontSize: fontSize.caption,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  days: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  day: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayActive: {
    backgroundColor: colors.primary,
  },
  dayText: {
    color: colors.textSecondary,
    fontSize: fontSize.body,
    fontWeight: '800',
  },
  dayTextActive: {
    color: colors.textPrimary,
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255, 176, 32, 0.12)',
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  warningText: {
    flex: 1,
    color: colors.amber,
    fontSize: fontSize.caption,
    fontWeight: '700',
    lineHeight: 17,
  },
  wheelWrap: {
    height: WHEEL_HEIGHT,
    justifyContent: 'center',
  },
  wheelBand: {
    position: 'absolute',
    left: spacing.xxxl,
    right: spacing.xxxl,
    top: (WHEEL_HEIGHT - ROW_HEIGHT) / 2,
    height: ROW_HEIGHT,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
  },
  wheelUnit: {
    position: 'absolute',
    alignSelf: 'center',
    marginLeft: 100,
    color: colors.textTertiary,
    fontSize: fontSize.subtitle,
    fontWeight: '700',
  },
  wheelRow: {
    height: ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelText: {
    color: colors.textTertiary,
    fontSize: fontSize.title,
    fontWeight: '700',
  },
  wheelTextActive: {
    color: colors.textPrimary,
    fontSize: fontSize.heading,
    fontWeight: '800',
  },
  bmiBlock: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  bmiValue: {
    color: colors.textPrimary,
    fontSize: fontSize.heading,
    fontWeight: '800',
  },
  bmiCaption: {
    color: colors.textTertiary,
    fontSize: fontSize.body,
    fontWeight: '700',
  },
  bmiPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    alignSelf: 'center',
  },
  bmiPillText: {
    fontSize: fontSize.caption,
    fontWeight: '800',
  },
  changeSummary: {
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  rateText: {
    fontSize: fontSize.body,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  hint: {
    color: colors.textTertiary,
    fontSize: fontSize.caption,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  footerRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  backButton: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    color: colors.textSecondary,
    fontSize: fontSize.subtitle,
    fontWeight: '800',
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  saveButtonText: {
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '800',
  },
  noTopMargin: {
    marginTop: 0,
  },
  pressed: {
    opacity: 0.7,
  },
});
