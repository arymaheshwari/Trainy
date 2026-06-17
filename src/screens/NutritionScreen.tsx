import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { buildDaySummary, NutritionSummary } from '../api/nutrition';
import { ensureGoalsLoaded } from '../api/nutrition/goals';
import {
  dayKey,
  dayKeyOffset,
  ensureLogLoaded,
  getDayEntriesSync,
  getLoggedDaysSync,
  LogEntry,
  removeLogEntry,
} from '../api/nutrition/dailyLog';
import { addWater, ensureWaterLoaded, GLASS_ML } from '../api/nutrition/waterLog';
import { AddFoodMenu } from '../components/AddFoodMenu';
import { AiFoodModal } from '../components/AiFoodModal';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';
import { CalendarModal } from '../components/CalendarModal';
import { CalorieSummaryCard } from '../components/CalorieSummaryCard';
import { FoodSearchModal } from '../components/FoodSearchModal';
import { LoggedFoodsCard } from '../components/LoggedFoodsCard';
import { MicronutrientsCard } from '../components/MicronutrientsCard';
import { NutritionGoalsModal } from '../components/NutritionGoalsModal';
import { PantryModal } from '../components/PantryModal';
import { PhotoFoodModal } from '../components/PhotoFoodModal';
import { WaterCard } from '../components/WaterCard';
import { WhatCanIMakeModal } from '../components/WhatCanIMakeModal';
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

/** Nutrition tracker: log and review any day's calories, macros, and micros. */
export function NutritionScreen() {
  const insets = useSafeAreaInsets();
  const [selectedDay, setSelectedDay] = useState(dayKey());
  const [nutrition, setNutrition] = useState<NutritionSummary | null>(null);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [markedDays, setMarkedDays] = useState<Set<string>>(new Set());

  const [menuOpen, setMenuOpen] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [makeOpen, setMakeOpen] = useState(false);
  const [pantryOpen, setPantryOpen] = useState(false);

  const refresh = useCallback(async () => {
    await Promise.all([ensureLogLoaded(), ensureWaterLoaded(), ensureGoalsLoaded()]);
    setNutrition(buildDaySummary(selectedDay));
    setEntries(getDayEntriesSync(selectedDay));
    setMarkedDays(new Set(getLoggedDaysSync()));
  }, [selectedDay]);

  // Re-pull on focus so goal changes (e.g. a new diet plan) show immediately.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

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
        <Text style={styles.title}>Nutrition</Text>
        <View style={styles.headerActions}>
          <Pressable
            style={styles.addButton}
            onPress={() => setGoalsOpen(true)}
            hitSlop={8}
            accessibilityLabel="Edit goals"
          >
            <Ionicons name="create-outline" size={22} color={colors.textPrimary} />
          </Pressable>
          <Pressable style={styles.addButton} onPress={() => setMenuOpen(true)} hitSlop={8}>
            <Ionicons name="add" size={26} color={colors.textPrimary} />
          </Pressable>
        </View>
      </View>

      <View style={styles.pillRow}>
        <Pressable style={styles.dayPill} onPress={() => setCalendarOpen(true)}>
          <Ionicons name="calendar-outline" size={18} color={colors.textPrimary} />
          <Text style={styles.dayPillText}>{dayLabel(selectedDay)}</Text>
          <Ionicons name="chevron-down" size={16} color={colors.textTertiary} />
        </Pressable>
        <Pressable style={styles.dayPill} onPress={() => setPantryOpen(true)}>
          <Ionicons name="basket-outline" size={18} color={colors.teal} />
          <Text style={styles.dayPillText}>My Pantry</Text>
        </Pressable>
      </View>

      <CalorieSummaryCard nutrition={nutrition} />
      {nutrition && (
        <>
          <WaterCard
            waterMl={nutrition.waterMl}
            waterGoalMl={nutrition.waterGoalMl}
            onAdd={() => addWater(GLASS_ML, selectedDay).then(refresh)}
            onRemove={() => addWater(-GLASS_ML, selectedDay).then(refresh)}
          />
          <Pressable style={styles.makeButton} onPress={() => setMakeOpen(true)}>
            <View style={styles.makeIcon}>
              <Ionicons name="restaurant-outline" size={18} color={colors.orange} />
            </View>
            <Text style={styles.makeText}>What can I make?</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </Pressable>
          <LoggedFoodsCard
            entries={entries}
            onRemove={(id) => removeLogEntry(selectedDay, id).then(refresh)}
          />
          <MicronutrientsCard groups={nutrition.microGroups} />
        </>
      )}

      <AddFoodMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onSelect={(method) => {
          if (method === 'search') setSearchOpen(true);
          else if (method === 'barcode') setScannerOpen(true);
          else if (method === 'ai') setAiOpen(true);
          else if (method === 'photo') setPhotoOpen(true);
        }}
      />
      <FoodSearchModal
        visible={searchOpen}
        day={selectedDay}
        onClose={() => setSearchOpen(false)}
        onLogged={refresh}
      />
      <BarcodeScannerModal
        visible={scannerOpen}
        day={selectedDay}
        onClose={() => setScannerOpen(false)}
        onLogged={refresh}
      />
      <AiFoodModal
        visible={aiOpen}
        day={selectedDay}
        onClose={() => setAiOpen(false)}
        onLogged={refresh}
      />
      <PhotoFoodModal
        visible={photoOpen}
        day={selectedDay}
        onClose={() => setPhotoOpen(false)}
        onLogged={refresh}
      />
      <CalendarModal
        visible={calendarOpen}
        selectedDay={selectedDay}
        markedDays={markedDays}
        minDay={MIN_DAY}
        onSelect={setSelectedDay}
        onClose={() => setCalendarOpen(false)}
      />
      <WhatCanIMakeModal
        visible={makeOpen}
        onClose={() => setMakeOpen(false)}
        onEditPantry={() => {
          setMakeOpen(false);
          setPantryOpen(true);
        }}
      />
      <PantryModal visible={pantryOpen} onClose={() => setPantryOpen(false)} />
      <NutritionGoalsModal
        visible={goalsOpen}
        onClose={() => setGoalsOpen(false)}
        onSaved={refresh}
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize.display,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  dayPillText: {
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '700',
  },
  makeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  makeIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255, 122, 89, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  makeText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '700',
  },
});
