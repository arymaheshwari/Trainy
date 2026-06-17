import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { FoodMicro } from '../api/usda';
import { colors, fontSize, radius, spacing } from '../theme';

export interface LabelValue {
  description: string;
  brand: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  micros: FoodMicro[];
  /** Saved serving stats (undefined when left blank). */
  servingGrams?: number;
  cupGrams?: number;
}

export interface LabelInitial {
  description?: string;
  brand?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  micros: FoodMicro[];
  servingGrams?: number;
  cupGrams?: number;
}

const toNum = (s: string) => {
  const n = parseFloat(s);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

/** Optional positive number — blank stays undefined (so it doesn't become 0). */
const toOptNum = (s: string): number | undefined => {
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

const numOrEmpty = (n?: number) => (n != null ? String(n) : '');

/**
 * Reusable editor for a food's nutrition label: name/brand (optional), the four
 * headline numbers, and a collapsible micronutrients section. Used both for
 * editing an existing food and creating a custom one.
 */
export function LabelForm({
  initial,
  showNameFields,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: LabelInitial;
  showNameFields: boolean;
  submitLabel: string;
  onSubmit: (value: LabelValue) => void;
  onCancel: () => void;
}) {
  const [description, setDescription] = useState(initial.description ?? '');
  const [brand, setBrand] = useState(initial.brand ?? '');
  const [calories, setCalories] = useState(String(initial.calories));
  const [protein, setProtein] = useState(String(initial.protein));
  const [carbs, setCarbs] = useState(String(initial.carbs));
  const [fat, setFat] = useState(String(initial.fat));
  const [microValues, setMicroValues] = useState(initial.micros.map((m) => String(m.amount)));
  const [servingGrams, setServingGrams] = useState(numOrEmpty(initial.servingGrams));
  const [cupGrams, setCupGrams] = useState(numOrEmpty(initial.cupGrams));
  const [microsOpen, setMicrosOpen] = useState(false);

  const canSubmit = !showNameFields || description.trim().length > 0;

  const toggleMicros = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMicrosOpen((o) => !o);
  };

  const submit = () => {
    onSubmit({
      description: description.trim(),
      brand: brand.trim(),
      calories: toNum(calories),
      protein: toNum(protein),
      carbs: toNum(carbs),
      fat: toNum(fat),
      micros: initial.micros.map((m, i) => ({ ...m, amount: toNum(microValues[i]) })),
      servingGrams: toOptNum(servingGrams),
      cupGrams: toOptNum(cupGrams),
    });
  };

  return (
    <View style={styles.form}>
      {showNameFields && (
        <>
          <TextField label="Name" value={description} onChangeText={setDescription} text />
          <TextField label="Brand (optional)" value={brand} onChangeText={setBrand} text />
        </>
      )}

      <NumField label="Calories (kcal)" value={calories} onChangeText={setCalories} />
      <NumField label="Protein (g)" value={protein} onChangeText={setProtein} />
      <NumField label="Carbs (g)" value={carbs} onChangeText={setCarbs} />
      <NumField label="Fat (g)" value={fat} onChangeText={setFat} />

      <Text style={styles.sectionNote}>
        Serving stats (optional) — enables g / oz / cup portions
      </Text>
      <NumField label="Serving size (g)" value={servingGrams} onChangeText={setServingGrams} />
      <NumField label="Grams per cup" value={cupGrams} onChangeText={setCupGrams} />

      <Pressable style={styles.microsHeader} onPress={toggleMicros}>
        <Text style={styles.microsTitle}>Micronutrients</Text>
        <Ionicons
          name={microsOpen ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textTertiary}
        />
      </Pressable>

      {microsOpen && (
        <View style={styles.microsList}>
          {initial.micros.map((m, i) => (
            <NumField
              key={m.label}
              label={`${m.label} (${m.unit})`}
              value={microValues[i]}
              onChangeText={(t) =>
                setMicroValues((prev) => prev.map((v, idx) => (idx === i ? t : v)))
              }
            />
          ))}
        </View>
      )}

      <View style={styles.actions}>
        <Pressable style={[styles.button, styles.cancelButton]} onPress={onCancel}>
          <Text style={styles.cancelLabel}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.saveButton, !canSubmit && styles.buttonDisabled]}
          onPress={submit}
          disabled={!canSubmit}
        >
          <Text style={styles.saveLabel}>{submitLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function NumField({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.numInput}
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        selectTextOnFocus
      />
    </View>
  );
}

function TextField({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  text: true;
}) {
  return (
    <View style={styles.textField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.textInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor={colors.textTertiary}
        autoCapitalize="words"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.body,
    fontWeight: '600',
    flexShrink: 1,
  },
  numInput: {
    width: 110,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '700',
    textAlign: 'right',
  },
  textField: {
    gap: spacing.xs,
  },
  textInput: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '600',
  },
  sectionNote: {
    color: colors.textTertiary,
    fontSize: fontSize.caption,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  microsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  microsTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '700',
  },
  microsList: {
    gap: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  button: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  cancelButton: {
    backgroundColor: colors.surfaceElevated,
  },
  cancelLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.subtitle,
    fontWeight: '700',
  },
  saveButton: {
    backgroundColor: colors.primary,
  },
  saveLabel: {
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '700',
  },
});
