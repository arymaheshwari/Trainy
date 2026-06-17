import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { saveGoalsFromDiet } from '../api/nutrition/goals';
import { ensurePlanLoaded, getPlanSync, savePlan } from '../api/plan';
import { ensureProfileLoaded, getProfileSync, Profile } from '../api/profile';
import { GoalCard, Plan } from '../components/GoalCard';
import { NutritionGoalsModal } from '../components/NutritionGoalsModal';
import { GenerationInput, PlanGenerationModal } from '../components/PlanGenerationModal';
import {
  EMPTY_GYM,
  EMPTY_RUNNING,
  GymGoals,
  PlanModal,
  RunningGoals,
} from '../components/PlanModal';
import { WeeklyGoalsCards } from '../components/WeeklyGoalsCards';
import { TAB_BAR_HEIGHT } from '../navigation/constants';
import { colors, fontSize, radius, spacing } from '../theme';

/** Progress page: the headline goal plus this week's goals hit and left. */
export function ProgressScreen() {
  const insets = useSafeAreaInsets();
  // No plan yet — the user creates one via the plan modal.
  const [plan, setPlan] = useState<Plan | null>(null);
  const [running, setRunning] = useState<RunningGoals>(EMPTY_RUNNING);
  const [gym, setGym] = useState<GymGoals>(EMPTY_GYM);
  const [planModalVisible, setPlanModalVisible] = useState(false);
  const [genInput, setGenInput] = useState<GenerationInput | null>(null);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [profile, setProfile] = useState<Profile>(getProfileSync());

  // Load persisted profile + plan on mount.
  useEffect(() => {
    Promise.all([ensureProfileLoaded(), ensurePlanLoaded()]).then(() => {
      setProfile({ ...getProfileSync() });
      const stored = getPlanSync();
      if (stored.weight) setPlan(stored.weight);
      if (stored.running) setRunning(stored.running);
      if (stored.gym) setGym(stored.gym);
    });
  }, []);

  // All three goals set → persist them and hand off to plan generation.
  const handleComplete = (nextPlan: Plan, nextRunning: RunningGoals, nextGym: GymGoals) => {
    setPlan(nextPlan);
    setRunning(nextRunning);
    setGym(nextGym);
    savePlan({ weight: nextPlan, running: nextRunning, gym: nextGym });
    setGenInput({
      plan: nextPlan,
      running: nextRunning,
      gym: nextGym,
      currentWeightKg: profile.weightKg,
      heightCm: profile.heightCm,
    });
  };

  const openPlan = () => {
    // Pick up any weight/height the user has since entered in their profile.
    setProfile({ ...getProfileSync() });
    setPlanModalVisible(true);
  };

  const hasPlan = plan != null;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + TAB_BAR_HEIGHT + spacing.xxl },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.titleRow}>
        <Text style={styles.title}>Progress</Text>
        <View style={styles.headerActions}>
          <Pressable
            style={({ pressed }) => [styles.iconButton, pressed && styles.planButtonPressed]}
            onPress={() => setGoalsOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Manually edit goals"
          >
            <Ionicons name="create-outline" size={18} color={colors.primary} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.aiButton, pressed && styles.planButtonPressed]}
            onPress={openPlan}
            accessibilityRole="button"
            accessibilityLabel={hasPlan ? 'Edit AI plan' : 'Make an AI plan'}
          >
            <Ionicons name="sparkles" size={18} color={colors.textPrimary} />
          </Pressable>
        </View>
      </View>

      <GoalCard plan={plan} weightUnit={profile.weightUnit} onPress={openPlan} />
      <WeeklyGoalsCards />

      <PlanModal
        visible={planModalVisible}
        mode={hasPlan ? 'edit' : 'create'}
        plan={plan}
        running={running}
        gym={gym}
        currentWeightKg={profile.weightKg}
        heightCm={profile.heightCm}
        weightUnit={profile.weightUnit}
        onClose={() => {
          setPlanModalVisible(false);
          // A unit switch in the modal updates the global setting — reflect it.
          setProfile({ ...getProfileSync() });
        }}
        onComplete={handleComplete}
      />

      <PlanGenerationModal
        visible={genInput != null}
        input={genInput}
        onClose={() => setGenInput(null)}
        onSave={(diet, program) => {
          // Plan is ready — persist it, and make the diet the app's nutrition goals.
          savePlan({ diet, program });
          if (diet) saveGoalsFromDiet(diet);
          setGenInput(null);
        }}
      />

      <NutritionGoalsModal visible={goalsOpen} onClose={() => setGoalsOpen(false)} />
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
  titleRow: {
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124, 92, 255, 0.15)',
  },
  // AI plan button — solid accent circle (echoes the Nutrition AI lookup).
  aiButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  planButtonPressed: {
    opacity: 0.7,
  },
});
