import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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

import { addLogEntry } from '../api/nutrition/dailyLog';
import {
  formatPortion,
  PORTION_UNITS,
  PortionUnit,
  portionToServings,
  unitAvailable,
  unitLabel,
} from '../api/nutrition/portions';
import {
  DEFAULT_MICROS,
  ensureCustomFoodsLoaded,
  getCustomFoodDetailSync,
  updateCustomFood,
} from '../api/nutrition/customFoods';
import { foodKey, setOverride } from '../api/nutrition/overrides';
import { FoodDetail, FoodDetailSource, FoodSource, getFoodDetail } from '../api/usda';
import { colors, fontSize, radius, spacing } from '../theme';
import { LabelForm, LabelValue } from './LabelForm';

/**
 * Detail view for one food from any origin (USDA, custom, barcode, AI). USDA
 * values can be off, so the label — including micros — is editable: USDA edits
 * persist as overrides, custom edits update the stored food, and `resolved`
 * foods (barcode/AI) are edited in-session only. "Add to log" records the food
 * against `day` (the day being viewed).
 */
export function FoodDetailSheet({
  detail,
  day,
  onClose,
  onLogged,
}: {
  detail: FoodDetailSource;
  /** Day key ("YYYY-MM-DD") the food is logged against. */
  day: string;
  onClose: () => void;
  onLogged?: () => void;
}) {
  const insets = useSafeAreaInsets();

  // NOTE: drag-to-dismiss (pull the sheet down to close) was attempted but
  // didn't behave reliably alongside the ScrollView, so it was reverted.
  // Revisit with react-native-gesture-handler. For now: scroll to browse,
  // tap the dimmed area to close. See plans/nutrition-tracker.md.
  const [food, setFood] = useState<FoodDetail | null>(null);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [portionAmount, setPortionAmount] = useState('1');
  const [portionUnit, setPortionUnit] = useState<PortionUnit>('serving');

  useEffect(() => {
    const controller = new AbortController();
    setFood(null);
    setError(false);
    setEditing(false);
    setPortionAmount('1');
    setPortionUnit('serving');

    const load = async (): Promise<FoodDetail | null> => {
      if (detail.kind === 'usda') return getFoodDetail(detail.fdcId, controller.signal);
      if (detail.kind === 'resolved') return detail.food;
      await ensureCustomFoodsLoaded();
      return getCustomFoodDetailSync(detail.customId) ?? null;
    };

    load()
      .then((f) => (f ? setFood(f) : setError(true)))
      .catch((e) => {
        if (e.name !== 'AbortError') setError(true);
      });
    return () => controller.abort();
  }, [detail]);

  const handleSave = async (next: LabelValue) => {
    if (!food) return;
    const fields = {
      calories: next.calories,
      protein: next.protein,
      carbs: next.carbs,
      fat: next.fat,
      micros: next.micros,
      servingGrams: next.servingGrams,
      cupGrams: next.cupGrams,
    };
    if (detail.kind === 'usda') {
      await setOverride(foodKey({ fdcId: detail.fdcId }), fields);
      setFood({ ...food, ...fields, isEdited: true });
    } else if (detail.kind === 'custom') {
      await updateCustomFood(detail.customId, fields);
      setFood({ ...food, ...fields });
    } else {
      // Resolved (barcode/AI): no persistence store — edit in-session only.
      setFood({ ...food, ...fields });
    }
    setEditing(false);
  };

  const handleReset = async () => {
    if (detail.kind !== 'usda') return;
    await setOverride(foodKey({ fdcId: detail.fdcId }), null);
    const fresh = await getFoodDetail(detail.fdcId);
    setFood(fresh);
    setEditing(false);
  };

  // Identity used when writing this food to the day log.
  const logIdentity: { source: FoodSource; refId: string } =
    detail.kind === 'usda'
      ? { source: 'usda', refId: String(detail.fdcId) }
      : detail.kind === 'custom'
        ? { source: 'custom', refId: detail.customId }
        : { source: detail.source, refId: detail.refId };

  // Foods with no micros still get the standard set to fill in when editing.
  const microsForEdit = food && food.micros.length > 0 ? food.micros : DEFAULT_MICROS;

  // Portion → servings multiplier for the chosen amount/unit.
  const amountNum = parseFloat(portionAmount);
  const multiplier = food
    ? portionToServings(Number.isFinite(amountNum) ? amountNum : -1, portionUnit, food)
    : null;
  const canAdd = multiplier != null && multiplier > 0;
  const portionCalories = food && multiplier != null ? Math.round(food.calories * multiplier) : null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}>
          <View pointerEvents="none" style={styles.keyboardFiller} />
          <View style={styles.dragArea}>
            <View style={styles.handle} />
          </View>

          {error ? (
            <Text style={styles.error}>Couldn't load this food. Please try again.</Text>
          ) : !food ? (
            <ActivityIndicator color={colors.orange} style={styles.loader} />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.name}>{food.description}</Text>
              {!!food.brand && <Text style={styles.brand}>{food.brand}</Text>}
              <View style={styles.basisRow}>
                <Text style={styles.basis}>{food.basis}</Text>
                {food.isEdited && (
                  <View style={styles.editedBadge}>
                    <Ionicons name="create" size={11} color={colors.amber} />
                    <Text style={styles.editedText}>Edited</Text>
                  </View>
                )}
              </View>

              {editing ? (
                <LabelForm
                  initial={{
                    calories: food.calories,
                    protein: food.protein,
                    carbs: food.carbs,
                    fat: food.fat,
                    micros: microsForEdit,
                    servingGrams: food.servingGrams,
                    cupGrams: food.cupGrams,
                  }}
                  showNameFields={false}
                  submitLabel="Save label"
                  onSubmit={handleSave}
                  onCancel={() => setEditing(false)}
                />
              ) : (
                <>
                  <View style={styles.calorieRow}>
                    <Text style={styles.calorieValue}>{food.calories.toLocaleString()}</Text>
                    <Text style={styles.calorieUnit}>kcal</Text>
                  </View>

                  <View style={styles.macros}>
                    <Macro label="Protein" value={food.protein} color={colors.teal} />
                    <Macro label="Fat" value={food.fat} color={colors.red} />
                    <Macro label="Carbs" value={food.carbs} color={colors.amber} />
                  </View>

                  <View style={styles.editRow}>
                    <Pressable style={styles.editButton} onPress={() => setEditing(true)}>
                      <Ionicons name="create-outline" size={18} color={colors.textSecondary} />
                      <Text style={styles.editLabel}>Edit label</Text>
                    </Pressable>
                    {food.isEdited && (
                      <Pressable style={styles.editButton} onPress={handleReset}>
                        <Ionicons name="refresh-outline" size={18} color={colors.textSecondary} />
                        <Text style={styles.editLabel}>Reset</Text>
                      </Pressable>
                    )}
                  </View>

                  {food.micros.length > 0 && (
                    <View style={styles.micros}>
                      {food.micros.map((m) => (
                        <View key={m.label} style={styles.microRow}>
                          <Text style={styles.microLabel}>{m.label}</Text>
                          <Text style={styles.microValue}>
                            {m.amount.toLocaleString()} {m.unit}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={styles.portion}>
                    <Text style={styles.portionTitle}>Portion</Text>
                    <View style={styles.unitRow}>
                      {PORTION_UNITS.map((u) => {
                        const avail = unitAvailable(u, food);
                        const selected = portionUnit === u;
                        return (
                          <Pressable
                            key={u}
                            disabled={!avail}
                            onPress={() => setPortionUnit(u)}
                            style={[
                              styles.unitChip,
                              selected && styles.unitChipSelected,
                              !avail && styles.unitChipDisabled,
                            ]}
                          >
                            <Text style={[styles.unitChipText, selected && styles.unitChipTextSelected]}>
                              {unitLabel(u)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <View style={styles.amountRow}>
                      <TextInput
                        style={styles.amountInput}
                        value={portionAmount}
                        onChangeText={setPortionAmount}
                        keyboardType="decimal-pad"
                        selectTextOnFocus
                      />
                      <Text style={styles.amountPreview}>
                        {portionCalories != null ? `${portionCalories.toLocaleString()} kcal` : '—'}
                      </Text>
                    </View>
                    {!unitAvailable('g', food) && (
                      <Text style={styles.portionHint}>
                        Add a serving size (Edit label) to log by g / oz / cup.
                      </Text>
                    )}
                  </View>

                  <Pressable
                    style={[styles.addButton, !canAdd && styles.addButtonDisabled]}
                    disabled={!canAdd}
                    onPress={async () => {
                      if (multiplier == null) return;
                      await addLogEntry(
                        {
                          ...logIdentity,
                          description: food.description,
                          brand: food.brand,
                          quantity: multiplier,
                          portion: { amount: amountNum, unit: portionUnit },
                          calories: food.calories,
                          protein: food.protein,
                          carbs: food.carbs,
                          fat: food.fat,
                          micros: food.micros,
                        },
                        day,
                      );
                      onLogged?.();
                      onClose();
                    }}
                  >
                    <Ionicons name="add" size={20} color={colors.textPrimary} />
                    <Text style={styles.addLabel}>
                      Add {formatPortion(canAdd ? amountNum : 0, portionUnit)} to log
                    </Text>
                  </Pressable>
                </>
              )}
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Macro({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.macro}>
      <View style={[styles.macroDot, { backgroundColor: color }]} />
      <Text style={styles.macroValue}>{value}g</Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
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
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.xxl,
    maxHeight: '85%',
  },
  keyboardFiller: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '100%',
    height: 1000,
    backgroundColor: colors.surface,
  },
  dragArea: {
    alignItems: 'center',
    paddingTop: spacing.xs,
    paddingBottom: spacing.lg,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
  loader: {
    marginVertical: spacing.xxxl,
  },
  error: {
    color: colors.textSecondary,
    fontSize: fontSize.body,
    textAlign: 'center',
    marginVertical: spacing.xxxl,
  },
  name: {
    color: colors.textPrimary,
    fontSize: fontSize.title,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  brand: {
    color: colors.textSecondary,
    fontSize: fontSize.body,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  basisRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  basis: {
    color: colors.textTertiary,
    fontSize: fontSize.caption,
    fontWeight: '600',
  },
  editedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255, 176, 32, 0.15)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  editedText: {
    color: colors.amber,
    fontSize: fontSize.caption,
    fontWeight: '700',
  },
  calorieRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: spacing.lg,
  },
  calorieValue: {
    color: colors.textPrimary,
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1,
  },
  calorieUnit: {
    color: colors.textTertiary,
    fontSize: fontSize.subtitle,
    fontWeight: '700',
    marginLeft: spacing.sm,
    marginBottom: 7,
  },
  macros: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.xl,
  },
  macro: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  macroDot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    marginBottom: spacing.sm,
  },
  macroValue: {
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '800',
  },
  macroLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.caption,
    fontWeight: '600',
    marginTop: 2,
  },
  editRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  editLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.body,
    fontWeight: '600',
  },
  micros: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  microRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  microLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.body,
    fontWeight: '600',
  },
  microValue: {
    color: colors.textPrimary,
    fontSize: fontSize.body,
    fontWeight: '700',
  },
  portion: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  portionTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '700',
  },
  unitRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  unitChip: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  unitChipSelected: {
    backgroundColor: colors.orange,
  },
  unitChipDisabled: {
    opacity: 0.3,
  },
  unitChipText: {
    color: colors.textSecondary,
    fontSize: fontSize.body,
    fontWeight: '700',
  },
  unitChipTextSelected: {
    color: colors.textPrimary,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  amountInput: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '800',
  },
  amountPreview: {
    color: colors.textSecondary,
    fontSize: fontSize.subtitle,
    fontWeight: '700',
  },
  portionHint: {
    color: colors.textTertiary,
    fontSize: fontSize.caption,
    fontWeight: '600',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    marginTop: spacing.xxl,
  },
  addButtonDisabled: {
    opacity: 0.4,
  },
  addLabel: {
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '700',
  },
});
