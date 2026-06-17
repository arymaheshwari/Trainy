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
import {
  dayKey,
  dayKeyOffset,
  ensureWorkoutLogLoaded,
  getLoggedWorkoutDaysSync,
  getWorkoutsForDaySync,
  removeWorkout,
  WorkoutLogEntry,
} from '../api/workouts/workoutLog';
import { ActiveWorkoutModal } from '../components/ActiveWorkoutModal';
import { CalendarModal } from '../components/CalendarModal';
import { CreateRoutineModal } from '../components/CreateRoutineModal';
import { LoggedWorkoutCard } from '../components/LoggedWorkoutCard';
import { RoutineActionsMenu } from '../components/RoutineActionsMenu';
import { RoutineCard } from '../components/RoutineCard';
import { StartWorkoutCard } from '../components/StartWorkoutCard';
import { TAB_BAR_HEIGHT } from '../navigation/constants';
import { colors, fontSize, radius, spacing } from '../theme';

const MIN_DAY = dayKeyOffset(-365);

/** Human label for a day pill: "Today" / "Yesterday" / "Mon, Jun 16". */
function dayLabel(day: string): string {
  if (day === dayKey()) return 'Today';
  if (day === dayKeyOffset(-1)) return 'Yesterday';
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** Workout tracker: start sessions and review training history. */
export function WorkoutScreen() {
  const insets = useSafeAreaInsets();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editorRoutine, setEditorRoutine] = useState<Routine | undefined>(undefined);
  const [menuRoutine, setMenuRoutine] = useState<Routine | null>(null);
  const [workoutOpen, setWorkoutOpen] = useState(false);
  const [activeRoutine, setActiveRoutine] = useState<Routine | null>(null);

  const [selectedDay, setSelectedDay] = useState(dayKey());
  const [dayWorkouts, setDayWorkouts] = useState<WorkoutLogEntry[]>([]);
  const [markedDays, setMarkedDays] = useState<Set<string>>(new Set());
  const [calendarOpen, setCalendarOpen] = useState(false);

  const refresh = useCallback(async () => {
    await Promise.all([ensureRoutinesLoaded(), ensureWorkoutLogLoaded()]);
    setRoutines([...getRoutinesSync()]);
    setDayWorkouts(getWorkoutsForDaySync(selectedDay));
    setMarkedDays(new Set(getLoggedWorkoutDaysSync()));
  }, [selectedDay]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const openCreate = () => {
    setEditorRoutine(undefined);
    setEditorVisible(true);
  };

  const openEdit = () => {
    setEditorRoutine(menuRoutine ?? undefined);
    setMenuRoutine(null);
    setEditorVisible(true);
  };

  const startEmpty = () => {
    setActiveRoutine(null);
    setWorkoutOpen(true);
  };

  const startRoutine = (routine: Routine) => {
    setActiveRoutine(routine);
    setWorkoutOpen(true);
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

      <StartWorkoutCard onPress={startEmpty} />

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Routines</Text>
          <Pressable style={styles.addButton} onPress={openCreate} hitSlop={8}>
            <Ionicons name="add" size={22} color={colors.textPrimary} />
          </Pressable>
        </View>
        {routines.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No routines yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap + to save a workout you can start anytime.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {routines.map((routine) => (
              <RoutineCard
                key={routine.id}
                routine={routine}
                onStart={() => startRoutine(routine)}
                onEdit={() => setMenuRoutine(routine)}
              />
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>History</Text>
          <Pressable style={styles.dayPill} onPress={() => setCalendarOpen(true)}>
            <Ionicons name="calendar-outline" size={16} color={colors.textPrimary} />
            <Text style={styles.dayPillText}>{dayLabel(selectedDay)}</Text>
            <Ionicons name="chevron-down" size={14} color={colors.textTertiary} />
          </Pressable>
        </View>
        {dayWorkouts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No workouts logged</Text>
            <Text style={styles.emptySubtitle}>Finished workouts for this day show up here.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {dayWorkouts.map((workout) => (
              <LoggedWorkoutCard
                key={workout.id}
                workout={workout}
                onRemove={() => removeWorkout(selectedDay, workout.id).then(refresh)}
              />
            ))}
          </View>
        )}
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
      <ActiveWorkoutModal
        visible={workoutOpen}
        routine={activeRoutine}
        onFinished={() => {
          setSelectedDay(dayKey());
          refresh();
        }}
        onClose={() => setWorkoutOpen(false)}
      />
      <CalendarModal
        visible={calendarOpen}
        selectedDay={selectedDay}
        markedDays={markedDays}
        minDay={MIN_DAY}
        accent={colors.teal}
        onSelect={setSelectedDay}
        onClose={() => setCalendarOpen(false)}
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
  dayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  dayPillText: {
    color: colors.textPrimary,
    fontSize: fontSize.body,
    fontWeight: '700',
  },
  list: {
    gap: spacing.md,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: colors.textSecondary,
    fontSize: fontSize.body,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
