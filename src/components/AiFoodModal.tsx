import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { estimateFood, MAX_FOOD_DESCRIPTION } from '../api/estimateFood';
import { FoodDetailSource } from '../api/usda';
import { colors, fontSize, radius, spacing } from '../theme';
import { FoodDetailSheet } from './FoodDetailSheet';

/**
 * AI logging: describe a food/meal in plain text, Gemini estimates the
 * nutrition, and the estimate opens in the detail sheet to review/edit before
 * logging against `day`. Estimates are editable in-session (the `resolved`/`ai`
 * path), so the user can correct anything before saving.
 */
export function AiFoodModal({
  visible,
  day,
  onClose,
  onLogged,
}: {
  visible: boolean;
  day: string;
  onClose: () => void;
  onLogged?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [estimating, setEstimating] = useState(false);
  const [detail, setDetail] = useState<FoodDetailSource | null>(null);

  useEffect(() => {
    if (visible) {
      setText('');
      setEstimating(false);
      setDetail(null);
    }
  }, [visible]);

  const estimate = async () => {
    const description = text.trim();
    if (!description) return;
    setEstimating(true);
    try {
      const result = await estimateFood(description);
      if (!result.ok) {
        Alert.alert("Couldn't estimate", result.reason);
        return;
      }
      const est = result.food;
      setDetail({
        kind: 'resolved',
        source: 'ai',
        refId: '',
        food: {
          fdcId: 0,
          description: est.description || description,
          brand: est.brand || undefined,
          basis: 'AI estimate',
          calories: est.calories,
          protein: est.protein,
          carbs: est.carbs,
          fat: est.fat,
          micros: est.micros,
        },
      });
    } catch {
      Alert.alert("Couldn't estimate", 'Please try again or rephrase your description.');
    } finally {
      setEstimating(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}>
          {/* Surface-colored extension that runs down behind the keyboard, so
              there's no dark gap between the sheet and the keyboard's edges. */}
          <View pointerEvents="none" style={styles.keyboardFiller} />
          <View style={styles.handle} />
          <Text style={styles.title}>Describe your food</Text>
          <Text style={styles.subtitle}>
            e.g. "two scrambled eggs with toast and butter"
          </Text>

          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="What did you eat?"
            placeholderTextColor={colors.textTertiary}
            multiline
            autoFocus
            editable={!estimating}
            maxLength={MAX_FOOD_DESCRIPTION}
          />
          <Text style={styles.counter}>
            {text.length} / {MAX_FOOD_DESCRIPTION}
          </Text>

          <Pressable
            style={[styles.button, (!text.trim() || estimating) && styles.buttonDisabled]}
            onPress={estimate}
            disabled={!text.trim() || estimating}
          >
            {estimating ? (
              <ActivityIndicator color={colors.textPrimary} />
            ) : (
              <>
                <Ionicons name="sparkles" size={18} color={colors.textPrimary} />
                <Text style={styles.buttonText}>Estimate nutrition</Text>
              </>
            )}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>

      {detail && (
        <FoodDetailSheet
          detail={detail}
          day={day}
          onClose={() => setDetail(null)} // back to the description box
          onLogged={() => {
            onLogged?.();
            onClose();
          }}
        />
      )}
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
  },
  subtitle: {
    color: colors.textTertiary,
    fontSize: fontSize.caption,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.lg,
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '600',
    minHeight: 88,
    textAlignVertical: 'top',
  },
  counter: {
    color: colors.textTertiary,
    fontSize: fontSize.caption,
    fontWeight: '600',
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    marginTop: spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '700',
  },
});
