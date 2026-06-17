import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
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

import { addRoutine, Routine, updateRoutine } from '../api/workouts/routines';
import { colors, fontSize, radius, spacing } from '../theme';

const WORKOUT_ACCENT = colors.teal;

interface ExerciseDraft {
  /** Local-only key for list rendering; the stored id is generated on save. */
  key: string;
  name: string;
  sets: string;
}

let draftSeq = 0;
function newDraft(name = '', sets = ''): ExerciseDraft {
  draftSeq += 1;
  return { key: `d${draftSeq}`, name, sets };
}

/** Build the initial draft rows for a routine being edited (or one empty row). */
function draftsFor(routine?: Routine): ExerciseDraft[] {
  if (!routine || routine.exercises.length === 0) return [newDraft()];
  return routine.exercises.map((e) => newDraft(e.name, e.sets != null ? String(e.sets) : ''));
}

/** Positive integer, or undefined when blank/invalid (so it doesn't become 0). */
function toOptInt(s: string): number | undefined {
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * Bottom-sheet form for creating or editing a workout routine: a name plus a
 * list of exercises (name + optional planned sets). Saves to local storage.
 * Pass `routine` to edit an existing one; omit it to create a new one.
 */
export function CreateRoutineModal({
  visible,
  routine,
  onClose,
  onSaved,
}: {
  visible: boolean;
  routine?: Routine;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const editing = routine != null;
  const [name, setName] = useState('');
  const [exercises, setExercises] = useState<ExerciseDraft[]>([newDraft()]);

  // Reset the form to the routine being edited (or blank) each time it opens.
  useEffect(() => {
    if (visible) {
      setName(routine?.name ?? '');
      setExercises(draftsFor(routine));
    }
  }, [visible, routine]);

  const namedExercises = exercises.filter((e) => e.name.trim().length > 0);
  const canSubmit = name.trim().length > 0 && namedExercises.length > 0;

  const updateExercise = (key: string, patch: Partial<ExerciseDraft>) => {
    setExercises((prev) => prev.map((e) => (e.key === key ? { ...e, ...patch } : e)));
  };

  const addExercise = () => setExercises((prev) => [...prev, newDraft()]);

  const removeExercise = (key: string) => {
    setExercises((prev) => (prev.length > 1 ? prev.filter((e) => e.key !== key) : prev));
  };

  const save = async () => {
    if (!canSubmit) return;
    const payload = {
      name: name.trim(),
      exercises: namedExercises.map((e, i) => ({
        id: `e${i}_${e.key}`,
        name: e.name.trim(),
        sets: toOptInt(e.sets),
      })),
    };
    if (editing) {
      await updateRoutine(routine.id, payload);
    } else {
      await addRoutine(payload);
    }
    onSaved?.();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}>
          <View pointerEvents="none" style={styles.keyboardFiller} />
          <View style={styles.dragArea}>
            <View style={styles.handle} />
          </View>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>{editing ? 'Edit routine' : 'New routine'}</Text>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Routine name</Text>
              <TextInput
                style={styles.textInput}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Push Day"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="words"
              />
            </View>

            <Text style={styles.sectionTitle}>Exercises</Text>
            <View style={styles.exerciseList}>
              {exercises.map((exercise, i) => (
                <View key={exercise.key} style={styles.exerciseRow}>
                  <TextInput
                    style={styles.exerciseNameInput}
                    value={exercise.name}
                    onChangeText={(t) => updateExercise(exercise.key, { name: t })}
                    placeholder={`Exercise ${i + 1}`}
                    placeholderTextColor={colors.textTertiary}
                    autoCapitalize="words"
                  />
                  <TextInput
                    style={styles.setsInput}
                    value={exercise.sets}
                    onChangeText={(t) => updateExercise(exercise.key, { sets: t })}
                    placeholder="Sets"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="number-pad"
                  />
                  <Pressable
                    style={[styles.removeButton, exercises.length === 1 && styles.removeDisabled]}
                    onPress={() => removeExercise(exercise.key)}
                    disabled={exercises.length === 1}
                    hitSlop={8}
                  >
                    <Ionicons name="close" size={20} color={colors.textTertiary} />
                  </Pressable>
                </View>
              ))}
            </View>

            <Pressable style={styles.addExercise} onPress={addExercise}>
              <Ionicons name="add" size={20} color={WORKOUT_ACCENT} />
              <Text style={styles.addExerciseLabel}>Add exercise</Text>
            </Pressable>

            <View style={styles.actions}>
              <Pressable style={[styles.button, styles.cancelButton]} onPress={onClose}>
                <Text style={styles.cancelLabel}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.button, styles.saveButton, !canSubmit && styles.buttonDisabled]}
                onPress={save}
                disabled={!canSubmit}
              >
                <Text style={styles.saveLabel}>{editing ? 'Save changes' : 'Save routine'}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.xxl,
    maxHeight: '88%',
  },
  keyboardFiller: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '100%',
    height: 1000,
    backgroundColor: colors.surface,
  },
  dragArea: {
    alignItems: 'center',
    paddingTop: spacing.xs,
    paddingBottom: spacing.lg,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize.title,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  field: {
    gap: spacing.xs,
    marginTop: spacing.lg,
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.body,
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '600',
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '700',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  exerciseList: {
    gap: spacing.sm,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  exerciseNameInput: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '600',
  },
  setsInput: {
    width: 64,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '700',
    textAlign: 'center',
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeDisabled: {
    opacity: 0.3,
  },
  addExercise: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    marginTop: spacing.md,
  },
  addExerciseLabel: {
    color: WORKOUT_ACCENT,
    fontSize: fontSize.subtitle,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  button: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  cancelButton: {
    backgroundColor: colors.surfaceElevated,
  },
  cancelLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.subtitle,
    fontWeight: '700',
  },
  saveButton: {
    backgroundColor: WORKOUT_ACCENT,
  },
  saveLabel: {
    color: colors.background,
    fontSize: fontSize.subtitle,
    fontWeight: '800',
  },
});
