import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeartRateCard } from '../components/HeartRateCard';
import { NutritionCard } from '../components/NutritionCard';
import { ProfileModal } from '../components/ProfileModal';
import { SleepCard } from '../components/SleepCard';
import { StepsCard } from '../components/StepsCard';
import { WorkoutsCard } from '../components/WorkoutsCard';
import { TAB_BAR_HEIGHT } from '../navigation/constants';
import { colors, fontSize, radius, spacing } from '../theme';

/** The all-in-one dashboard: every health metric at a glance. */
export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [profileVisible, setProfileVisible] = useState(false);

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
        <Text style={styles.title}>Home</Text>
        <Pressable
          style={({ pressed }) => [styles.userButton, pressed && styles.userButtonPressed]}
          onPress={() => setProfileVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Profile"
        >
          <Ionicons name="person-circle-outline" size={32} color={colors.textSecondary} />
        </Pressable>
      </View>
      <StepsCard />
      <SleepCard />
      <NutritionCard />
      <HeartRateCard />
      <WorkoutsCard />

      <ProfileModal visible={profileVisible} onClose={() => setProfileVisible(false)} />
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
  userButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userButtonPressed: {
    opacity: 0.6,
  },
});
