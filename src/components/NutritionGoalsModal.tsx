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

import {
  ensureGoalsLoaded,
  getEffectiveGoals,
  MICRO_LAYOUT,
  NutritionGoals,
  saveGoals,
} from '../api/nutrition/goals';
import { colors, fontSize, radius, spacing } from '../theme';

const round = (n: number) => Math.round(n);
const parseNum = (t: string) => {
  const n = parseFloat(t);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

const MACRO_ROWS: { key: keyof Omit<NutritionGoals, 'micros'>; label: string; unit: string }[] = [
  { key: 'calories', label: 'Calories', unit: 'kcal' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'carbs', label: 'Carbs', unit: 'g' },
  { key: 'fat', label: 'Fat', unit: 'g' },
  { key: 'waterMl', label: 'Water', unit: 'ml' },
];

/** Manual editor for the daily nutrition goals. Persists to the shared store. */
export function NutritionGoalsModal({
  visible,
  onClose,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [goals, setGoals] = useState<NutritionGoals | null>(null);

  useEffect(() => {
    if (!visible) return;
    ensureGoalsLoaded().then(() => {
      const g = getEffectiveGoals();
      setGoals({ ...g, micros: { ...g.micros } });
    });
  }, [visible]);

  const setMacro = (k: keyof Omit<NutritionGoals, 'micros'>, v: number) =>
    setGoals((g) => (g ? { ...g, [k]: v } : g));
  const setMicro = (label: string, v: number) =>
    setGoals((g) => (g ? { ...g, micros: { ...g.micros, [label]: v } } : g));

  const save = () => {
    if (goals) saveGoals(goals);
    onSaved?.();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <Text style={styles.headerTitle}>Edit goals</Text>
          <Pressable onPress={onClose} hitSlop={8} style={styles.closeButton} accessibilityLabel="Close">
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {goals &&
            (() => {
              const macroKcal = round(goals.protein * 4 + goals.carbs * 4 + goals.fat * 9);
              const matches = Math.abs(macroKcal - goals.calories) <= 25;
              return (
                <>
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Daily targets</Text>
                    {MACRO_ROWS.map((r) => (
                      <NumRow
                        key={r.key}
                        label={r.label}
                        unit={r.unit}
                        value={goals[r.key]}
                        onChange={(v) => setMacro(r.key, v)}
                      />
                    ))}
                    <Pressable
                      style={styles.calcRow}
                      disabled={matches}
                      onPress={() => setMacro('calories', macroKcal)}
                    >
                      <Text style={styles.calcLabel}>Macros add up to</Text>
                      <Text style={[styles.calcValue, { color: matches ? colors.teal : colors.amber }]}>
                        {macroKcal} kcal{matches ? '' : ' · tap to match'}
                      </Text>
                    </Pressable>
                  </View>

                  <Text style={styles.fdaNote}>
                    Micro targets — FDA Daily Values shown as a healthy daily reference.
                  </Text>

                  {MICRO_LAYOUT.map((group) => (
                    <View key={group.title} style={styles.card}>
                      <Text style={styles.cardTitle}>{group.title}</Text>
                      {group.items.map((it) => (
                        <NumRow
                          key={it.label}
                          label={it.label}
                          unit={it.unit}
                          value={goals.micros[it.label] ?? 0}
                          onChange={(v) => setMicro(it.label, v)}
                          hint={`FDA ${it.fda} ${it.unit}`}
                        />
                      ))}
                    </View>
                  ))}
                </>
              );
            })()}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Pressable style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]} onPress={save}>
            <Text style={styles.saveText}>Save goals</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function NumRow({
  label,
  unit,
  value,
  onChange,
  hint,
}: {
  label: string;
  unit: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <View style={styles.numRow}>
      <View style={styles.numLabelWrap}>
        <Text style={styles.numLabel}>{label}</Text>
        {hint ? <Text style={styles.numHint}>{hint}</Text> : null}
      </View>
      <View style={styles.numInputWrap}>
        <TextInput
          style={styles.numInput}
          value={String(round(value))}
          keyboardType="decimal-pad"
          onChangeText={(t) => onChange(parseNum(t))}
        />
        <Text style={styles.numUnit}>{unit}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.heading,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  cardTitle: {
    color: colors.textSecondary,
    fontSize: fontSize.caption,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  numRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  numLabelWrap: {
    flex: 1,
    paddingRight: spacing.md,
  },
  numLabel: {
    color: colors.textPrimary,
    fontSize: fontSize.body,
    fontWeight: '600',
  },
  numHint: {
    color: colors.textTertiary,
    fontSize: fontSize.caption,
    fontWeight: '600',
    marginTop: 1,
  },
  calcRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
  },
  calcLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.body,
    fontWeight: '600',
  },
  calcValue: {
    fontSize: fontSize.body,
    fontWeight: '800',
  },
  fdaNote: {
    color: colors.textTertiary,
    fontSize: fontSize.caption,
    fontWeight: '600',
    paddingHorizontal: spacing.xs,
  },
  numInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    minWidth: 110,
    justifyContent: 'flex-end',
  },
  numInput: {
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '800',
    paddingVertical: spacing.sm,
    textAlign: 'right',
    minWidth: 56,
  },
  numUnit: {
    color: colors.textTertiary,
    fontSize: fontSize.caption,
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  saveText: {
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.7,
  },
});
