import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { dayKey } from '../api/nutrition/dailyLog';
import { colors, fontSize, radius, spacing } from '../theme';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const pad = (n: number) => String(n).padStart(2, '0');
const keyFor = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/**
 * Month-grid date picker. Lets the user jump to any day within the retention
 * window to view that day's log. Future days and days before `minDay` are
 * disabled; days that have logged entries show a dot.
 */
export function CalendarModal({
  visible,
  selectedDay,
  markedDays,
  minDay,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selectedDay: string;
  /** Days (YYYY-MM-DD) that have logged entries — shown with a dot. */
  markedDays: Set<string>;
  /** Earliest selectable day (retention floor). */
  minDay: string;
  onSelect: (day: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const today = dayKey();

  const [year, setYear] = useState(0);
  const [month, setMonth] = useState(0); // 0-11

  // Open on the selected day's month each time.
  useEffect(() => {
    if (!visible) return;
    const [y, m] = selectedDay.split('-').map(Number);
    setYear(y);
    setMonth(m - 1);
  }, [visible, selectedDay]);

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  // Disable month navigation outside the allowed range.
  const monthStart = keyFor(year, month, 1);
  const monthEnd = keyFor(year, month, daysInMonth);
  const canPrev = monthStart > minDay;
  const canNext = monthEnd < today;

  const step = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { marginBottom: insets.bottom + spacing.xl }]}>
          <View style={styles.header}>
            <Pressable onPress={() => canPrev && step(-1)} hitSlop={8} disabled={!canPrev}>
              <Ionicons name="chevron-back" size={22} color={canPrev ? colors.textPrimary : colors.border} />
            </Pressable>
            <Text style={styles.monthLabel}>
              {MONTHS[month]} {year}
            </Text>
            <Pressable onPress={() => canNext && step(1)} hitSlop={8} disabled={!canNext}>
              <Ionicons name="chevron-forward" size={22} color={canNext ? colors.textPrimary : colors.border} />
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAYS.map((w, i) => (
              <Text key={i} style={styles.weekday}>
                {w}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((d, i) => {
              if (d === null) return <View key={`b${i}`} style={styles.cell} />;
              const k = keyFor(year, month, d);
              const disabled = k > today || k < minDay;
              const isSelected = k === selectedDay;
              const isToday = k === today;
              return (
                <Pressable
                  key={k}
                  style={styles.cell}
                  disabled={disabled}
                  onPress={() => {
                    onSelect(k);
                    onClose();
                  }}
                >
                  <View style={[styles.dayCircle, isSelected && styles.daySelected, isToday && !isSelected && styles.dayToday]}>
                    <Text
                      style={[
                        styles.dayText,
                        disabled && styles.dayDisabled,
                        isSelected && styles.daySelectedText,
                      ]}
                    >
                      {d}
                    </Text>
                  </View>
                  {markedDays.has(k) && !isSelected && <View style={styles.dot} />}
                </Pressable>
              );
            })}
          </View>

          <Pressable
            style={styles.todayButton}
            onPress={() => {
              onSelect(today);
              onClose();
            }}
          >
            <Text style={styles.todayButtonText}>Jump to today</Text>
          </Pressable>
        </Pressable>
      </Pressable>
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
    borderRadius: radius.xl,
    marginHorizontal: spacing.lg,
    padding: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  monthLabel: {
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '800',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    color: colors.textTertiary,
    fontSize: fontSize.caption,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daySelected: {
    backgroundColor: colors.orange,
  },
  dayToday: {
    borderWidth: 1,
    borderColor: colors.orange,
  },
  dayText: {
    color: colors.textPrimary,
    fontSize: fontSize.body,
    fontWeight: '600',
  },
  daySelectedText: {
    color: colors.textPrimary,
    fontWeight: '800',
  },
  dayDisabled: {
    color: colors.border,
  },
  dot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.teal,
  },
  todayButton: {
    marginTop: spacing.lg,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  todayButtonText: {
    color: colors.primary,
    fontSize: fontSize.body,
    fontWeight: '700',
  },
});
