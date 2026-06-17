import { ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeartRateCard } from '../components/HeartRateCard';
import { NutritionCard } from '../components/NutritionCard';
import { SleepCard } from '../components/SleepCard';
import { StepsCard } from '../components/StepsCard';
import { WorkoutsCard } from '../components/WorkoutsCard';
import { TAB_BAR_HEIGHT } from '../navigation/constants';
import { colors, fontSize, spacing } from '../theme';

/** The all-in-one dashboard: every health metric at a glance. */
export function SummaryScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + TAB_BAR_HEIGHT + spacing.xxl },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Summary</Text>
      <StepsCard />
      <SleepCard />
      <NutritionCard />
      <HeartRateCard />
      <WorkoutsCard />
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
  title: {
    color: colors.textPrimary,
    fontSize: fontSize.display,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: spacing.xs,
  },
});
