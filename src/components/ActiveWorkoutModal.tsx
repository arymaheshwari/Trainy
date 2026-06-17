import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
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

import { ensureHistoryLoaded, getLastSetsSync, recordExerciseSets } from '../api/workouts/history';
import { Routine } from '../api/workouts/routines';
import { addWorkout } from '../api/workouts/workoutLog';
import { colors, fontSize, radius, spacing } from '../theme';

const WORKOUT_ACCENT = colors.teal;

interface SetDraft {
  id: string;
  weight: string;
  reps: string;
  /** Last session's numbers for this set, shown as input placeholders. */
  prevWeight?: number;
  prevReps?: number;
}

interface ExerciseDraft {
  exerciseId: string;
  name: string;
  /** True for exercises the user added mid-workout (name is editable). */
  custom: boolean;
  sets: SetDraft[];
}

let setSeq = 0;
function newSet(prev?: { weight: number; reps: number }): SetDraft {
  setSeq += 1;
  return { id: `s${setSeq}`, weight: '', reps: '', prevWeight: prev?.weight, prevReps: prev?.reps };
}

let exSeq = 0;
function newExercise(): ExerciseDraft {
  exSeq += 1;
  return { exerciseId: `x${exSeq}`, name: '', custom: true, sets: [newSet()] };
}

/** Positive number, or 0 when blank/invalid. */
function toNum(s: string): number {
  const n = parseFloat(s);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function isCompleted(set: SetDraft): boolean {
  return set.weight.trim() !== '' && toNum(set.reps) > 0;
}

/** Build the editable session from a routine, seeding placeholders from history. */
function buildExercises(routine: Routine): ExerciseDraft[] {
  return routine.exercises.map((exercise) => {
    const prev = getLastSetsSync(exercise.name);
    const count = exercise.sets ?? prev?.length ?? 1;
    const sets = Array.from({ length: Math.max(count, 1) }, (_, i) => newSet(prev?.[i]));
    return { exerciseId: exercise.id, name: exercise.name, custom: false, sets };
  });
}

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/**
 * Full-screen active workout session. Shows a running timer, live sets-completed
 * and total-volume stats, and each exercise's sets as editable weight × reps
 * inputs. Weight/reps inputs hint the previous session's numbers. On finish the
 * completed sets are saved to history.
 *
 * Pass a `routine` to prefill its exercises, or omit it for an empty workout the
 * user builds by adding exercises themselves.
 */
export function ActiveWorkoutModal({
  visible,
  routine,
  onClose,
  onFinished,
}: {
  visible: boolean;
  routine: Routine | null;
  onClose: () => void;
  onFinished?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [exercises, setExercises] = useState<ExerciseDraft[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);

  // Build the session (with history-based placeholders) when it opens. An empty
  // workout (no routine) starts with no exercises for the user to add.
  useEffect(() => {
    if (!visible) return;
    let active = true;
    ensureHistoryLoaded().then(() => {
      if (!active) return;
      setExercises(routine ? buildExercises(routine) : []);
      startRef.current = Date.now();
      setElapsed(0);
    });
    return () => {
      active = false;
    };
  }, [visible, routine]);

  // Tick the timer once a second while open.
  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => setElapsed(Date.now() - startRef.current), 1000);
    return () => clearInterval(id);
  }, [visible]);

  const { completedSets, volume } = useMemo(() => {
    let completed = 0;
    let vol = 0;
    for (const exercise of exercises) {
      for (const set of exercise.sets) {
        if (isCompleted(set)) {
          completed += 1;
          vol += toNum(set.weight) * toNum(set.reps);
        }
      }
    }
    return { completedSets: completed, volume: vol };
  }, [exercises]);

  const updateSet = (exerciseId: string, setId: string, patch: Partial<SetDraft>) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.exerciseId === exerciseId
          ? { ...ex, sets: ex.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) }
          : ex,
      ),
    );
  };

  const addSet = (exerciseId: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.exerciseId !== exerciseId) return ex;
        const prevSets = getLastSetsSync(ex.name);
        return { ...ex, sets: [...ex.sets, newSet(prevSets?.[ex.sets.length])] };
      }),
    );
  };

  const removeSet = (exerciseId: string, setId: string) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.exerciseId === exerciseId
          ? { ...ex, sets: ex.sets.filter((s) => s.id !== setId) }
          : ex,
      ),
    );
  };

  const addExercise = () => setExercises((prev) => [...prev, newExercise()]);

  const removeExercise = (exerciseId: string) => {
    setExercises((prev) => prev.filter((ex) => ex.exerciseId !== exerciseId));
  };

  // Renaming a custom exercise re-pulls its previous-session hints by name.
  const renameExercise = (exerciseId: string, name: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.exerciseId !== exerciseId) return ex;
        const prevSets = getLastSetsSync(name);
        return {
          ...ex,
          name,
          sets: ex.sets.map((s, i) => ({
            ...s,
            prevWeight: prevSets?.[i]?.weight,
            prevReps: prevSets?.[i]?.reps,
          })),
        };
      }),
    );
  };

  const finish = async () => {
    // Keep only named exercises that have at least one completed set.
    const logged = exercises
      .filter((ex) => ex.name.trim() !== '')
      .map((ex) => ({
        name: ex.name.trim(),
        sets: ex.sets
          .filter(isCompleted)
          .map((s) => ({ weight: toNum(s.weight), reps: toNum(s.reps) })),
      }))
      .filter((ex) => ex.sets.length > 0);

    await recordExerciseSets(logged);

    if (logged.length > 0) {
      await addWorkout({
        name: routine?.name ?? 'Empty Workout',
        durationSec: Math.max(0, Math.round((Date.now() - startRef.current) / 1000)),
        exercises: logged,
        totalSets: completedSets,
        totalVolume: Math.round(volume),
      });
    }

    onFinished?.();
    onClose();
  };

  const requestClose = () => {
    if (completedSets > 0) {
      Alert.alert('Discard workout?', 'Your logged sets will not be saved.', [
        { text: 'Keep going', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: onClose },
      ]);
    } else {
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={requestClose}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable style={styles.closeButton} onPress={requestClose} hitSlop={8}>
            <Ionicons name="chevron-down" size={24} color={colors.textPrimary} />
          </Pressable>
          <Pressable style={styles.finishButton} onPress={finish}>
            <Text style={styles.finishLabel}>Finish</Text>
          </Pressable>
        </View>

        <View style={styles.stats}>
          <Stat label="Time" value={formatElapsed(elapsed)} accent />
          <View style={styles.statDivider} />
          <Stat label="Sets" value={String(completedSets)} />
          <View style={styles.statDivider} />
          <Stat label="Volume" value={`${Math.round(volume).toLocaleString()} lbs`} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.routineName}>{routine?.name ?? 'Empty Workout'}</Text>

          {exercises.map((exercise) => (
            <View key={exercise.exerciseId} style={styles.exerciseCard}>
              <View style={styles.exerciseHeader}>
                {exercise.custom ? (
                  <TextInput
                    style={[styles.exerciseName, styles.exerciseNameInput]}
                    value={exercise.name}
                    onChangeText={(t) => renameExercise(exercise.exerciseId, t)}
                    placeholder="Exercise name"
                    placeholderTextColor={colors.textTertiary}
                    autoCapitalize="words"
                  />
                ) : (
                  <Text style={styles.exerciseName}>{exercise.name}</Text>
                )}
                <Pressable
                  style={styles.removeExercise}
                  onPress={() => removeExercise(exercise.exerciseId)}
                  hitSlop={8}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.textTertiary} />
                </Pressable>
              </View>

              <View style={styles.columns}>
                <Text style={[styles.colLabel, styles.colSet]}>Set</Text>
                <Text style={[styles.colLabel, styles.colInput]}>Weight (lbs)</Text>
                <Text style={[styles.colLabel, styles.colInput]}>Reps</Text>
                <View style={styles.colRemove} />
              </View>

              {exercise.sets.map((set, i) => (
                <View key={set.id} style={styles.setRow}>
                  <Text style={[styles.colSet, styles.setIndex]}>{i + 1}</Text>
                  <TextInput
                    style={[styles.input, styles.colInput, isCompleted(set) && styles.inputDone]}
                    value={set.weight}
                    onChangeText={(t) => updateSet(exercise.exerciseId, set.id, { weight: t })}
                    placeholder={set.prevWeight != null ? String(set.prevWeight) : '0'}
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="decimal-pad"
                    selectTextOnFocus
                  />
                  <TextInput
                    style={[styles.input, styles.colInput, isCompleted(set) && styles.inputDone]}
                    value={set.reps}
                    onChangeText={(t) => updateSet(exercise.exerciseId, set.id, { reps: t })}
                    placeholder={set.prevReps != null ? String(set.prevReps) : '0'}
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="number-pad"
                    selectTextOnFocus
                  />
                  <Pressable
                    style={styles.colRemove}
                    onPress={() => removeSet(exercise.exerciseId, set.id)}
                    hitSlop={8}
                  >
                    <Ionicons name="close" size={18} color={colors.textTertiary} />
                  </Pressable>
                </View>
              ))}

              <Pressable style={styles.addSet} onPress={() => addSet(exercise.exerciseId)}>
                <Ionicons name="add" size={18} color={WORKOUT_ACCENT} />
                <Text style={styles.addSetLabel}>Add set</Text>
              </Pressable>
            </View>
          ))}

          <Pressable style={styles.addExercise} onPress={addExercise}>
            <Ionicons name="add" size={20} color={WORKOUT_ACCENT} />
            <Text style={styles.addExerciseLabel}>Add exercise</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, accent && styles.statValueAccent]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishButton: {
    backgroundColor: WORKOUT_ACCENT,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  finishLabel: {
    color: colors.background,
    fontSize: fontSize.subtitle,
    fontWeight: '800',
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.xl,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    marginBottom: spacing.lg,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: fontSize.title,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  statValueAccent: {
    color: WORKOUT_ACCENT,
  },
  statLabel: {
    color: colors.textTertiary,
    fontSize: fontSize.caption,
    fontWeight: '600',
    marginTop: 2,
  },
  content: {
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  routineName: {
    color: colors.textPrimary,
    fontSize: fontSize.heading,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  exerciseCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  exerciseName: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '700',
  },
  exerciseNameInput: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  removeExercise: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  columns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  colLabel: {
    color: colors.textTertiary,
    fontSize: fontSize.caption,
    fontWeight: '700',
    textAlign: 'center',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  colSet: {
    width: 32,
    textAlign: 'center',
  },
  colInput: {
    flex: 1,
  },
  colRemove: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setIndex: {
    color: colors.textSecondary,
    fontSize: fontSize.subtitle,
    fontWeight: '700',
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '700',
    textAlign: 'center',
  },
  inputDone: {
    borderWidth: 1,
    borderColor: WORKOUT_ACCENT,
  },
  addSet: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  addSetLabel: {
    color: WORKOUT_ACCENT,
    fontSize: fontSize.body,
    fontWeight: '700',
  },
  addExercise: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
  },
  addExerciseLabel: {
    color: WORKOUT_ACCENT,
    fontSize: fontSize.subtitle,
    fontWeight: '700',
  },
});
