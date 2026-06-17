import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  deleteRoutine,
  ensureRoutinesLoaded,
  getRoutinesSync,
  Routine,
} from '../api/workouts/routines';
import { CreateRoutineModal } from '../components/CreateRoutineModal';
import { RoutineActionsMenu } from '../components/RoutineActionsMenu';
import { RoutineCard } from '../components/RoutineCard';
import { StartWorkoutCard } from '../components/StartWorkoutCard';
import { TAB_BAR_HEIGHT } from '../navigation/constants';
import { colors, fontSize, radius, spacing } from '../theme';

/** Sample routine shown until the user saves their own, so the list isn't empty. */
const PLACEHOLDER_ROUTINE: Routine = {
  id: 'placeholder',
  name: 'Push Day',
  createdAt: 0,
  exercises: [
    { id: 'p1', name: 'Bench Press', sets: 4 },
    { id: 'p2', name: 'Overhead Press', sets: 3 },
    { id: 'p3', name: 'Incline Dumbbell Press', sets: 3 },
    { id: 'p4', name: 'Tricep Pushdown', sets: 3 },
    { id: 'p5', name: 'Lateral Raise', sets: 3 },
  ],
};

/** Workout tracker: start sessions and review training history. */
export function WorkoutScreen() {
  const insets = useSafeAreaInsets();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editorRoutine, setEditorRoutine] = useState<Routine | undefined>(undefined);
  const [menuRoutine, setMenuRoutine] = useState<Routine | null>(null);

  const refresh = useCallback(async () => {
    await ensureRoutinesLoaded();
    setRoutines([...getRoutinesSync()]);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const hasRoutines = routines.length > 0;
  const displayedRoutines = hasRoutines ? routines : [PLACEHOLDER_ROUTINE];

  const openCreate = () => {
    setEditorRoutine(undefined);
    setEditorVisible(true);
  };

  const openEdit = () => {
    setEditorRoutine(menuRoutine ?? undefined);
    setMenuRoutine(null);
    setEditorVisible(true);
  };

  const confirmDelete = () => {
    const routine = menuRoutine;
    if (!routine) return;
    setMenuRoutine(null);
    Alert.alert('Delete routine', `Delete "${routine.name}"? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteRoutine(routine.id).then(refresh),
      },
    ]);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + spacing.md,
          paddingBottom: insets.bottom + TAB_BAR_HEIGHT + spacing.xxl,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Workout</Text>
      </View>

      <StartWorkoutCard />

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Routines</Text>
          <Pressable style={styles.addButton} onPress={openCreate} hitSlop={8}>
            <Ionicons name="add" size={22} color={colors.textPrimary} />
          </Pressable>
        </View>
        <View style={styles.list}>
          {displayedRoutines.map((routine) => (
            <RoutineCard
              key={routine.id}
              routine={routine}
              onEdit={hasRoutines ? () => setMenuRoutine(routine) : undefined}
            />
          ))}
        </View>
      </View>

      <CreateRoutineModal
        visible={editorVisible}
        routine={editorRoutine}
        onClose={() => setEditorVisible(false)}
        onSaved={refresh}
      />
      <RoutineActionsMenu
        routine={menuRoutine}
        onEdit={openEdit}
        onDelete={confirmDelete}
        onClose={() => setMenuRoutine(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize.display,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  section: {
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.title,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    gap: spacing.md,
  },
});
