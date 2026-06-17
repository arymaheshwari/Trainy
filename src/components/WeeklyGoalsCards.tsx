import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fontSize, radius, spacing } from '../theme';

type GoalCategory = 'gym' | 'macro' | 'micro';

interface WeeklyGoal {
  label: string;
  category: GoalCategory;
  current: number;
  target: number;
  unit: string;
  /** When true, `target` is a ceiling — going over it is a violation (e.g. sugar). */
  isLimit?: boolean;
}

// Placeholder weekly goals — these will be derived from real gym + nutrition
// data later (sessions completed, macros, key micros, limits exceeded, etc.).
const GOALS: WeeklyGoal[] = [
  { label: 'Gym sessions', category: 'gym', current: 3, target: 4, unit: 'sessions' },
  { label: 'Protein', category: 'macro', current: 1050, target: 1050, unit: 'g' },
  { label: 'Fiber', category: 'micro', current: 210, target: 210, unit: 'g' },
  { label: 'Carbs', category: 'macro', current: 1400, target: 1400, unit: 'g' },
  { label: 'Hydration', category: 'micro', current: 4, target: 7, unit: 'L' },
  { label: 'Vitamin D', category: 'micro', current: 1, target: 7, unit: 'days' },
  { label: 'Omega-3', category: 'micro', current: 0, target: 3, unit: 'days' },
  { label: 'Sugar limit', category: 'macro', current: 210, target: 175, unit: 'g', isLimit: true },
];

/** Whether a goal is met for the week (a limit is met while at/under target). */
function isHit(g: WeeklyGoal): boolean {
  return g.isLimit ? g.current <= g.target : g.current >= g.target;
}

/** Whether a ceiling goal has been exceeded (a violation). */
function isOver(g: WeeklyGoal): boolean {
  return !!g.isLimit && g.current > g.target;
}

/** Fraction toward target (or of the ceiling used, for limits). */
function progress(g: WeeklyGoal): number {
  return g.target > 0 ? g.current / g.target : 0;
}

/**
 * Priority order for missed goals: over-limit violations first (most over =
 * highest), then the goals furthest from being hit ("not hit at all") ahead of
 * the ones that were almost there.
 */
function byPriority(a: WeeklyGoal, b: WeeklyGoal): number {
  const aOver = isOver(a);
  const bOver = isOver(b);
  if (aOver !== bOver) return aOver ? -1 : 1;
  if (aOver && bOver) return progress(b) - progress(a);
  return progress(a) - progress(b);
}

const CARD_PREVIEW = 3;

/** Two cards side by side: goals hit this week and goals left this week. */
export function WeeklyGoalsCards() {
  const [open, setOpen] = useState<null | 'hit' | 'left'>(null);

  const hit = GOALS.filter(isHit);
  // Goals not yet met, sorted by priority (worst offenders on top).
  const left = GOALS.filter((g) => !isHit(g)).sort(byPriority);

  return (
    <>
      <View style={styles.row}>
        <SummaryCard
          accent={colors.teal}
          icon="checkmark-circle"
          title="Goals Hit"
          goals={hit}
          onPress={() => setOpen('hit')}
        />
        <SummaryCard
          accent={colors.amber}
          icon="ellipse-outline"
          title="Goals Left"
          goals={left}
          onPress={() => setOpen('left')}
        />
      </View>

      <GoalsModal
        visible={open === 'hit'}
        title="Goals Hit"
        subtitle="This week"
        accent={colors.teal}
        goals={hit}
        onClose={() => setOpen(null)}
      />
      <GoalsModal
        visible={open === 'left'}
        title="Goals Left"
        subtitle="This week · highest priority first"
        accent={colors.amber}
        goals={left}
        onClose={() => setOpen(null)}
      />
    </>
  );
}

function SummaryCard({
  accent,
  icon,
  title,
  goals,
  onPress,
}: {
  accent: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  goals: WeeklyGoal[];
  onPress: () => void;
}) {
  const preview = goals.slice(0, CARD_PREVIEW);
  const extra = goals.length - preview.length;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${goals.length} this week`}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.iconBadge, { backgroundColor: accent + '26' }]}>
          <Ionicons name={icon} size={18} color={accent} />
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
      </View>
      <Text style={[styles.count, { color: accent }]}>{goals.length}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.weekLabel}>This week</Text>

      <View style={styles.list}>
        {preview.map((goal, i) => (
          <GoalDotRow key={i} goal={goal} />
        ))}
        {extra > 0 && <Text style={styles.more}>+{extra} more</Text>}
      </View>
    </Pressable>
  );
}

/** Compact row used on the cards: just a status dot and the label. */
function GoalDotRow({ goal }: { goal: WeeklyGoal }) {
  const over = isOver(goal);
  const dotColor = isHit(goal) ? colors.teal : over ? colors.red : colors.textTertiary;

  return (
    <View style={styles.dotRow}>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={[styles.dotLabel, over && { color: colors.red }]} numberOfLines={1}>
        {goal.label}
      </Text>
    </View>
  );
}

/** Full-list bottom sheet opened by tapping a card. */
function GoalsModal({
  visible,
  title,
  subtitle,
  accent,
  goals,
  onClose,
}: {
  visible: boolean;
  title: string;
  subtitle: string;
  accent: string;
  goals: WeeklyGoal[];
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}>
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>{title}</Text>
              <Text style={styles.sheetSubtitle}>{subtitle}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={styles.closeButton}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          {goals.length === 0 ? (
            <Text style={styles.empty}>Nothing here yet</Text>
          ) : (
            <ScrollView
              style={styles.sheetScroll}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {goals.map((goal, i) => (
                <GoalDetailRow key={i} goal={goal} accent={accent} />
              ))}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const CATEGORY_ICONS: Record<GoalCategory, keyof typeof Ionicons.glyphMap> = {
  gym: 'barbell',
  macro: 'flame',
  micro: 'leaf',
};

/** Detailed row in the modal: icon, label, value, and a progress bar. */
function GoalDetailRow({ goal, accent }: { goal: WeeklyGoal; accent: string }) {
  const over = isOver(goal);
  const hit = isHit(goal);
  const pct = Math.min(Math.max(progress(goal), 0), 1);
  const barColor = over ? colors.red : hit ? colors.teal : accent;

  const valueText = over
    ? `${goal.current} / ${goal.target} ${goal.unit} · over`
    : `${goal.current} / ${goal.target} ${goal.unit}`;

  return (
    <View style={styles.detailRow}>
      <View style={[styles.detailIcon, { backgroundColor: barColor + '26' }]}>
        <Ionicons name={CATEGORY_ICONS[goal.category]} size={18} color={barColor} />
      </View>
      <View style={styles.detailBody}>
        <View style={styles.detailTop}>
          <Text style={styles.detailLabel} numberOfLines={1}>
            {goal.label}
          </Text>
          <Text style={[styles.detailValue, over && { color: colors.red }]}>{valueText}</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: barColor }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  cardPressed: {
    opacity: 0.7,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: {
    fontSize: fontSize.display,
    fontWeight: '800',
    letterSpacing: -1,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '700',
    marginTop: 2,
  },
  weekLabel: {
    color: colors.textTertiary,
    fontSize: fontSize.caption,
    fontWeight: '600',
    marginTop: 1,
  },
  list: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  dotRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: radius.pill,
    marginRight: spacing.sm,
  },
  dotLabel: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: fontSize.body,
    fontWeight: '600',
  },
  more: {
    color: colors.textTertiary,
    fontSize: fontSize.caption,
    fontWeight: '700',
    marginTop: 2,
  },

  // Modal
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    maxHeight: '80%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  sheetTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.title,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  sheetSubtitle: {
    color: colors.textTertiary,
    fontSize: fontSize.caption,
    fontWeight: '600',
    marginTop: 2,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetScroll: {
    flexGrow: 0,
  },
  empty: {
    color: colors.textTertiary,
    fontSize: fontSize.subtitle,
    fontWeight: '600',
    paddingVertical: spacing.xl,
    textAlign: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  detailIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  detailBody: {
    flex: 1,
  },
  detailTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  detailLabel: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '700',
    marginRight: spacing.sm,
  },
  detailValue: {
    color: colors.textSecondary,
    fontSize: fontSize.caption,
    fontWeight: '700',
  },
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
  },
});
