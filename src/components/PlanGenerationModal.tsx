import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  DietPlan,
  generateDiet,
  generateProgram,
  PlanInput,
  ProgramPlan,
  ProgramSession,
} from '../api/generatePlan';
import { FALLBACK_HEIGHT_CM, FALLBACK_WEIGHT_KG } from '../api/profile';
import { Plan } from './GoalCard';
import { gymDaysPerWeek, GymGoals, runDaysPerWeek, RunningGoals } from './PlanModal';
import { colors, fontSize, radius, spacing } from '../theme';

type CallStatus = 'loading' | 'done' | 'error' | 'skipped';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const round = (n: number) => Math.round(n);
const parseNum = (t: string) => {
  const n = parseFloat(t);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

export interface GenerationInput {
  plan: Plan;
  running: RunningGoals;
  gym: GymGoals;
  currentWeightKg: number | null;
  heightCm: number | null;
}

/**
 * Runs the two AI calls for a freshly set plan, then shows a review screen where
 * the user can edit the macros/micros and the run/gym plan, or save as-is.
 */
export function PlanGenerationModal({
  visible,
  input,
  onClose,
  onSave,
}: {
  visible: boolean;
  input: GenerationInput | null;
  onClose: () => void;
  onSave?: (diet: DietPlan | null, program: ProgramPlan | null) => void;
}) {
  const insets = useSafeAreaInsets();

  const [dietStatus, setDietStatus] = useState<CallStatus>('loading');
  const [programStatus, setProgramStatus] = useState<CallStatus>('loading');
  const [diet, setDiet] = useState<DietPlan | null>(null);
  const [program, setProgram] = useState<ProgramPlan | null>(null);
  const [editing, setEditing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const lastRun = useRef<{ input: GenerationInput | null; attempt: number }>({
    input: null,
    attempt: -1,
  });

  useEffect(() => {
    if (!visible || !input) return;
    if (lastRun.current.input === input && lastRun.current.attempt === attempt) return;
    lastRun.current = { input, attempt };

    const controller = new AbortController();
    const programEnabled = input.running.enabled || input.gym.enabled;

    const startKg = input.plan.startValue;
    const targetKg = input.plan.targetValue;
    const weeks = input.plan.weeks ?? 1;
    const payload: PlanInput = {
      currentWeightKg: input.currentWeightKg ?? FALLBACK_WEIGHT_KG,
      heightCm: input.heightCm ?? FALLBACK_HEIGHT_CM,
      targetWeightKg: targetKg,
      perWeekKg: Math.round(((targetKg - startKg) / weeks) * 100) / 100,
      totalWeeks: weeks,
      running: {
        enabled: input.running.enabled,
        sessionsPerWeek: runDaysPerWeek(input.running),
        goal: input.running.goal,
        currentForm: input.running.currentForm,
        times: input.running.times,
      },
      gym: {
        enabled: input.gym.enabled,
        sessionsPerWeek: gymDaysPerWeek(input.gym),
        goal: input.gym.goal,
        currentForm: input.gym.currentForm,
      },
    };

    setEditing(false);
    setDietStatus('loading');
    setProgramStatus(programEnabled ? 'loading' : 'skipped');

    generateDiet(payload, controller.signal)
      .then((d) => {
        setDiet(d);
        setDietStatus('done');
      })
      .catch(() => setDietStatus('error'));

    if (programEnabled) {
      generateProgram(payload, controller.signal)
        .then((p) => {
          setProgram(p);
          setProgramStatus(p ? 'done' : 'skipped');
        })
        .catch(() => setProgramStatus('error'));
    }

    return () => controller.abort();
  }, [visible, input, attempt]);

  const retry = () => setAttempt((a) => a + 1);
  const anyError = dietStatus === 'error' || programStatus === 'error';
  const settled = (dietStatus === 'done' || dietStatus === 'error') && programStatus !== 'loading';
  const inReview = settled && !anyError;

  const setDietField = (k: keyof DietPlan, v: number) =>
    setDiet((d) => (d ? { ...d, [k]: v } : d));
  const setMicro = (i: number, amount: number) =>
    setDiet((d) => (d ? { ...d, micros: d.micros.map((m, idx) => (idx === i ? { ...m, amount } : m)) } : d));
  const patchPhase = (pi: number, patch: Partial<{ name: string; weeks: number }>) =>
    setProgram((p) =>
      p ? { ...p, phases: p.phases.map((ph, i) => (i === pi ? { ...ph, ...patch } : ph)) } : p,
    );
  const patchSession = (pi: number, si: number, patch: Partial<ProgramSession>) =>
    setProgram((p) =>
      p
        ? {
            ...p,
            phases: p.phases.map((ph, i) =>
              i === pi ? { ...ph, week: ph.week.map((s, j) => (j === si ? { ...s, ...patch } : s)) } : ph,
            ),
          }
        : p,
    );

  const save = () => {
    onSave?.(diet, program);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <Text style={styles.headerTitle}>{inReview ? 'Review your plan' : 'Building your plan'}</Text>
          <Pressable onPress={onClose} hitSlop={8} style={styles.closeButton} accessibilityLabel="Close">
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {!inReview && (
            <>
              <StatusRow label="Nutrition plan" status={dietStatus} accent={colors.orange} />
              <StatusRow label="Training program" status={programStatus} accent={colors.teal} />
            </>
          )}

          {inReview && diet && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Daily Nutrition</Text>
              <NumField label="Calories" value={diet.dailyCalories} unit="kcal" editing={editing}
                onChange={(v) => setDietField('dailyCalories', v)} big />
              <NumField label="Protein" value={diet.protein_g} unit="g" editing={editing}
                onChange={(v) => setDietField('protein_g', v)} />
              <NumField label="Carbs" value={diet.carbs_g} unit="g" editing={editing}
                onChange={(v) => setDietField('carbs_g', v)} />
              <NumField label="Fat" value={diet.fat_g} unit="g" editing={editing}
                onChange={(v) => setDietField('fat_g', v)} />
              <NumField label="Fiber" value={diet.fiber_g} unit="g" editing={editing}
                onChange={(v) => setDietField('fiber_g', v)} />
              <NumField label="Water" value={diet.water_ml} unit="ml" editing={editing}
                onChange={(v) => setDietField('water_ml', v)} />
              <NumField label="Sugar limit" value={diet.sugarLimit_g} unit="g" editing={editing}
                onChange={(v) => setDietField('sugarLimit_g', v)} />
              <NumField label="Sodium limit" value={diet.sodiumLimit_mg} unit="mg" editing={editing}
                onChange={(v) => setDietField('sodiumLimit_mg', v)} />

              <Text style={styles.subHeading}>Micronutrients</Text>
              {diet.micros.map((m, i) => (
                <NumField key={m.label} label={m.label} value={m.amount} unit={m.unit} editing={editing}
                  onChange={(v) => setMicro(i, v)} />
              ))}

              {!editing && diet.rationale ? <Text style={styles.rationale}>{diet.rationale}</Text> : null}
            </View>
          )}

          {inReview && programStatus === 'skipped' && (
            <Text style={styles.skipNote}>No running or gym plan selected.</Text>
          )}

          {inReview && program && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Training Program</Text>
              {program.phases.map((phase, pi) => (
                <View key={pi} style={pi > 0 ? styles.phaseSpacer : undefined}>
                  {editing ? (
                    <View style={styles.phaseEditRow}>
                      <TextInput
                        style={[styles.input, styles.flex]}
                        value={phase.name}
                        onChangeText={(t) => patchPhase(pi, { name: t })}
                        placeholder="Phase name"
                        placeholderTextColor={colors.textTertiary}
                      />
                      <TextInput
                        style={[styles.input, styles.weeksInput]}
                        value={String(phase.weeks)}
                        onChangeText={(t) => patchPhase(pi, { weeks: Math.max(1, round(parseNum(t))) })}
                        keyboardType="number-pad"
                      />
                      <Text style={styles.weeksUnit}>wks</Text>
                    </View>
                  ) : (
                    <>
                      <Text style={styles.phaseName}>{phase.name}</Text>
                      <Text style={styles.phaseWeeks}>
                        {phase.weeks} {phase.weeks === 1 ? 'week' : 'weeks'}
                      </Text>
                    </>
                  )}

                  {phase.week
                    .map((s, si) => ({ s, si }))
                    .sort((a, b) => a.s.day - b.s.day)
                    .map(({ s, si }) => (
                      <View key={si} style={styles.sessionRow}>
                        <Text style={styles.sessionDay}>{DAY_LABELS[(s.day - 1) % 7]}</Text>
                        <View style={[styles.sessionDot, { backgroundColor: typeColor(s.type) }]} />
                        {editing && s.type !== 'rest' ? (
                          <View style={styles.flex}>
                            <TextInput
                              style={styles.inputTight}
                              value={s.title}
                              onChangeText={(t) => patchSession(pi, si, { title: t })}
                              placeholder="Title"
                              placeholderTextColor={colors.textTertiary}
                            />
                            <TextInput
                              style={[styles.inputTight, styles.detailInput]}
                              value={s.detail}
                              onChangeText={(t) => patchSession(pi, si, { detail: t })}
                              placeholder="Details"
                              placeholderTextColor={colors.textTertiary}
                              multiline
                            />
                          </View>
                        ) : (
                          <View style={styles.flex}>
                            <Text style={styles.sessionTitle}>{s.type === 'rest' ? 'Rest' : s.title}</Text>
                            {s.detail && s.type !== 'rest' ? (
                              <Text style={styles.sessionDetail}>{s.detail}</Text>
                            ) : null}
                          </View>
                        )}
                      </View>
                    ))}
                </View>
              ))}
              {!editing && program.notes ? <Text style={styles.rationale}>{program.notes}</Text> : null}
            </View>
          )}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          {anyError && (
            <>
              <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]} onPress={onClose}>
                <Text style={styles.secondaryText}>Close</Text>
              </Pressable>
              <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} onPress={retry}>
                <Text style={styles.primaryText}>Retry</Text>
              </Pressable>
            </>
          )}
          {inReview && (
            <>
              <Pressable
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                onPress={() => setEditing((e) => !e)}
              >
                <Text style={styles.secondaryText}>{editing ? 'Preview' : 'Edit'}</Text>
              </Pressable>
              <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} onPress={save}>
                <Text style={styles.primaryText}>{editing ? 'Save changes' : 'Save plan'}</Text>
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function StatusRow({ label, status, accent }: { label: string; status: CallStatus; accent: string }) {
  return (
    <View style={styles.statusRow}>
      <Text style={styles.statusLabel}>{label}</Text>
      {status === 'loading' && <ActivityIndicator color={accent} />}
      {status === 'done' && <Ionicons name="checkmark-circle" size={20} color={colors.teal} />}
      {status === 'error' && <Ionicons name="alert-circle" size={20} color={colors.red} />}
      {status === 'skipped' && <Ionicons name="remove-circle-outline" size={20} color={colors.textTertiary} />}
    </View>
  );
}

function NumField({
  label,
  value,
  unit,
  editing,
  onChange,
  big,
}: {
  label: string;
  value: number;
  unit: string;
  editing: boolean;
  onChange: (v: number) => void;
  big?: boolean;
}) {
  return (
    <View style={styles.numRow}>
      <Text style={[styles.numLabel, big && styles.numLabelBig]}>{label}</Text>
      {editing ? (
        <View style={styles.numInputWrap}>
          <TextInput
            style={styles.numInput}
            value={String(round(value))}
            keyboardType="decimal-pad"
            onChangeText={(t) => onChange(parseNum(t))}
          />
          <Text style={styles.numUnit}>{unit}</Text>
        </View>
      ) : (
        <Text style={[styles.numValue, big && styles.numValueBig]}>
          {round(value)} <Text style={styles.numUnit}>{unit}</Text>
        </Text>
      )}
    </View>
  );
}

function typeColor(type: string): string {
  if (type === 'run') return colors.teal;
  if (type === 'gym') return colors.primary;
  if (type === 'cardio') return colors.blue;
  return colors.border;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.heading,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  statusLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.subtitle,
    fontWeight: '700',
  },
  skipNote: {
    color: colors.textTertiary,
    fontSize: fontSize.body,
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.title,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: spacing.sm,
  },
  subHeading: {
    color: colors.textSecondary,
    fontSize: fontSize.caption,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  numRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  numLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.body,
    fontWeight: '600',
  },
  numLabelBig: {
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '800',
  },
  numValue: {
    color: colors.textPrimary,
    fontSize: fontSize.body,
    fontWeight: '700',
  },
  numValueBig: {
    fontSize: fontSize.title,
    fontWeight: '800',
  },
  numUnit: {
    color: colors.textTertiary,
    fontSize: fontSize.caption,
    fontWeight: '700',
  },
  numInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    minWidth: 110,
    justifyContent: 'flex-end',
  },
  numInput: {
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '800',
    paddingVertical: spacing.sm,
    textAlign: 'right',
    minWidth: 56,
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    fontSize: fontSize.body,
    fontWeight: '700',
  },
  inputTight: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    color: colors.textPrimary,
    fontSize: fontSize.body,
    fontWeight: '600',
  },
  detailInput: {
    marginTop: 4,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  phaseEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  weeksInput: {
    width: 52,
    textAlign: 'center',
  },
  weeksUnit: {
    color: colors.textTertiary,
    fontSize: fontSize.caption,
    fontWeight: '700',
  },
  phaseSpacer: {
    marginTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.lg,
  },
  phaseName: {
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '800',
  },
  phaseWeeks: {
    color: colors.textTertiary,
    fontSize: fontSize.caption,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  sessionDay: {
    width: 36,
    paddingTop: 2,
    color: colors.textTertiary,
    fontSize: fontSize.caption,
    fontWeight: '800',
  },
  sessionDot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    marginTop: 6,
  },
  sessionTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.body,
    fontWeight: '700',
  },
  sessionDetail: {
    color: colors.textSecondary,
    fontSize: fontSize.caption,
    fontWeight: '600',
    marginTop: 1,
  },
  rationale: {
    color: colors.textTertiary,
    fontSize: fontSize.caption,
    fontWeight: '600',
    marginTop: spacing.md,
    lineHeight: 17,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  secondaryButton: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '800',
  },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  primaryText: {
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.7,
  },
});
