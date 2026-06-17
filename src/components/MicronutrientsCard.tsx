import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';

import { Micronutrient, MicronutrientGroup } from '../api/nutrition';
import { colors, fontSize, radius, spacing } from '../theme';

// Enable smooth expand/collapse animations on Android.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * Micronutrients grouped into collapsible categories (carbs, minerals,
 * vitamins, …). Each category can be minimized independently; first one starts
 * open. Bars turn amber near the goal and red once exceeded.
 */
export function MicronutrientsCard({ groups }: { groups: MicronutrientGroup[] }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Micronutrients</Text>
      {groups.map((group, i) => (
        <CategorySection key={group.title} group={group} defaultOpen={i === 0} last={i === groups.length - 1} />
      ))}
    </View>
  );
}

function CategorySection({
  group,
  defaultOpen,
  last,
}: {
  group: MicronutrientGroup;
  defaultOpen: boolean;
  last: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((o) => !o);
  };

  return (
    <View style={[styles.section, last && styles.sectionLast]}>
      <Pressable style={styles.sectionHeader} onPress={toggle}>
        <Text style={styles.sectionTitle}>{group.title}</Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textTertiary}
        />
      </Pressable>

      {open && (
        <View style={styles.list}>
          {group.items.map((micro) => (
            <MicroBar key={micro.label} micro={micro} />
          ))}
        </View>
      )}
    </View>
  );
}

function MicroBar({ micro }: { micro: Micronutrient }) {
  const ratio = micro.amount / micro.goal;
  const progress = Math.min(ratio, 1);
  const color = ratio > 1 ? colors.red : ratio >= 0.9 ? colors.amber : colors.teal;

  return (
    <View style={styles.row}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{micro.label}</Text>
        <Text style={styles.value}>
          {micro.amount.toLocaleString()} / {micro.goal.toLocaleString()} {micro.unit}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xxl,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize.title,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: spacing.sm,
  },
  section: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sectionLast: {
    borderBottomWidth: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '700',
  },
  list: {
    gap: spacing.lg,
    paddingBottom: spacing.lg,
  },
  row: {
    gap: spacing.sm,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  label: {
    color: colors.textSecondary,
    fontSize: fontSize.body,
    fontWeight: '600',
  },
  value: {
    color: colors.textTertiary,
    fontSize: fontSize.caption,
    fontWeight: '600',
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
