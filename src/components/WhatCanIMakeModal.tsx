import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

import { ensurePantryLoaded, getPantrySync } from '../api/nutrition/pantry';
import { fetchMealIdeas, MAX_MEAL_NOTE, MealIdea, MealType } from '../api/mealIdeas';
import { colors, fontSize, radius, spacing } from '../theme';

const MEALS: { key: MealType; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
];

/**
 * "What can I make?" — pick a meal, add an optional preference note, and get 5
 * AI meal ideas based on the user's pantry (assuming basic staples are present).
 */
export function WhatCanIMakeModal({
  visible,
  onClose,
  onEditPantry,
}: {
  visible: boolean;
  onClose: () => void;
  onEditPantry?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [meal, setMeal] = useState<MealType>('breakfast');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [ideas, setIdeas] = useState<MealIdea[] | null>(null);

  useEffect(() => {
    if (visible) {
      setMeal('breakfast');
      setNote('');
      setLoading(false);
      setIdeas(null);
    }
  }, [visible]);

  const submit = async () => {
    setLoading(true);
    try {
      await ensurePantryLoaded();
      const pantry = getPantrySync().map((p) => p.name);
      const result = await fetchMealIdeas({ meal, note: note.trim(), pantry });
      if (result.ok) setIdeas(result.ideas);
      else Alert.alert('No ideas', result.reason);
    } catch {
      Alert.alert("Couldn't get ideas", 'Please try again in a moment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}>
          <View pointerEvents="none" style={styles.keyboardFiller} />
          <View style={styles.handle} />

          <Text style={styles.title}>What can I make?</Text>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {ideas ? (
              <>
                {ideas.map((idea, i) => (
                  <View key={i} style={styles.idea}>
                    <Text style={styles.ideaName}>{idea.name}</Text>
                    <Text style={styles.ideaDesc}>{idea.description}</Text>
                    {idea.ingredients.length > 0 && (
                      <Text style={styles.ideaIngredients}>Uses: {idea.ingredients.join(', ')}</Text>
                    )}
                  </View>
                ))}
                <Pressable style={styles.secondaryButton} onPress={() => setIdeas(null)}>
                  <Text style={styles.secondaryText}>Start over</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.sectionLabel}>Meal</Text>
                <View style={styles.mealRow}>
                  {MEALS.map((m) => {
                    const selected = meal === m.key;
                    return (
                      <Pressable
                        key={m.key}
                        style={[styles.mealChip, selected && styles.mealChipSelected]}
                        onPress={() => setMeal(m.key)}
                      >
                        <Text style={[styles.mealChipText, selected && styles.mealChipTextSelected]}>
                          {m.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Pressable style={styles.pantryRow} onPress={onEditPantry}>
                  <View style={styles.pantryLeft}>
                    <View style={styles.pantryIcon}>
                      <Ionicons name="basket-outline" size={18} color={colors.teal} />
                    </View>
                    <Text style={styles.pantryLabel}>Edit pantry</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                </Pressable>

                <Text style={styles.sectionLabel}>Anything specific? (optional)</Text>
                <TextInput
                  style={styles.input}
                  value={note}
                  onChangeText={setNote}
                  placeholder="e.g. use up the spinach, high-protein, quick…"
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  maxLength={MAX_MEAL_NOTE}
                />
                <Text style={styles.counter}>
                  {note.length} / {MAX_MEAL_NOTE}
                </Text>

                <Pressable
                  style={[styles.submit, loading && styles.submitDisabled]}
                  onPress={submit}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.textPrimary} />
                  ) : (
                    <>
                      <Ionicons name="sparkles" size={18} color={colors.textPrimary} />
                      <Text style={styles.submitText}>Find meal ideas</Text>
                    </>
                  )}
                </Pressable>
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
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
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    marginBottom: spacing.lg,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize.title,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.body,
    fontWeight: '600',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  mealRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  mealChip: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  mealChipSelected: {
    backgroundColor: colors.orange,
  },
  mealChipText: {
    color: colors.textSecondary,
    fontSize: fontSize.body,
    fontWeight: '700',
  },
  mealChipTextSelected: {
    color: colors.textPrimary,
  },
  pantryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  pantryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  pantryIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(0, 194, 168, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pantryLabel: {
    color: colors.textPrimary,
    fontSize: fontSize.body,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing.lg,
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '600',
    minHeight: 72,
    textAlignVertical: 'top',
  },
  counter: {
    color: colors.textTertiary,
    fontSize: fontSize.caption,
    fontWeight: '600',
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  submit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    marginTop: spacing.xl,
  },
  submitDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '700',
  },
  idea: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  ideaName: {
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '800',
  },
  ideaDesc: {
    color: colors.textSecondary,
    fontSize: fontSize.body,
    fontWeight: '500',
    marginTop: spacing.xs,
  },
  ideaIngredients: {
    color: colors.textTertiary,
    fontSize: fontSize.caption,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    marginTop: spacing.md,
  },
  secondaryText: {
    color: colors.primary,
    fontSize: fontSize.subtitle,
    fontWeight: '700',
  },
});
