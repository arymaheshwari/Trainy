import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
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
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { addCustomFood, DEFAULT_MICROS } from '../api/nutrition/customFoods';
import { scanLabel } from '../api/scanLabel';
import { FoodMicro } from '../api/usda';
import { colors, fontSize, radius, spacing } from '../theme';
import { LabelForm, LabelInitial } from './LabelForm';

/**
 * Form for adding a food that isn't in USDA. Either fill it in manually or
 * "Scan label" — snap/choose a photo of the Nutrition Facts panel, which is
 * sent to our backend (Gemini) and used to prefill the form. Scanned values are
 * never saved automatically; the user reviews/edits and then taps Save.
 */
export function CreateFoodModal({
  visible,
  initialName,
  onClose,
  onCreated,
}: {
  visible: boolean;
  /** Prefill the name with the user's current search text. */
  initialName?: string;
  onClose: () => void;
  onCreated?: (customId: string) => void;
}) {
  const insets = useSafeAreaInsets();

  // NOTE: drag-to-dismiss was attempted here too but reverted — see the note in
  // FoodDetailSheet and plans/nutrition-tracker.md. For now: tap outside to close.
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState<LabelInitial | null>(null);
  // Bumped whenever prefilled values change, to remount LabelForm with them.
  const [formKey, setFormKey] = useState(0);

  // Reset scan state each time the modal opens/closes.
  useEffect(() => {
    setScanned(null);
    setScanning(false);
    setFormKey((k) => k + 1);
  }, [visible]);

  const initial: LabelInitial = scanned ?? {
    description: initialName?.trim(),
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    micros: DEFAULT_MICROS,
  };

  const pickAndScan = async (source: 'camera' | 'library') => {
    try {
      const options: ImagePicker.ImagePickerOptions = { base64: true, quality: 0.6, allowsEditing: true };
      let result: ImagePicker.ImagePickerResult;
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Camera access needed', 'Enable camera access to scan a label.');
          return;
        }
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        result = await ImagePicker.launchImageLibraryAsync(options);
      }

      const asset = result.canceled ? null : result.assets[0];
      if (!asset?.base64) return;

      setScanning(true);
      const label = await scanLabel(asset.base64, asset.mimeType ?? 'image/jpeg');
      setScanned({
        description: label.description || initialName?.trim() || '',
        brand: label.brand || '',
        calories: label.calories,
        protein: label.protein,
        carbs: label.carbs,
        fat: label.fat,
        micros: mergeMicros(label.micros),
      });
      setFormKey((k) => k + 1);
    } catch {
      Alert.alert("Couldn't read the label", 'Enter the values manually instead.');
    } finally {
      setScanning(false);
    }
  };

  const onScanPress = () => {
    Alert.alert('Scan label', 'Take a photo or choose one from your library.', [
      { text: 'Take photo', onPress: () => pickAndScan('camera') },
      { text: 'Choose from library', onPress: () => pickAndScan('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
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
          <View style={styles.dragArea}>
            <View style={styles.handle} />
          </View>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Add a food</Text>

            <Pressable style={styles.scanButton} onPress={onScanPress} disabled={scanning}>
              {scanning ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <>
                  <Ionicons name="scan-outline" size={20} color={colors.primary} />
                  <Text style={styles.scanLabel}>Scan label</Text>
                </>
              )}
            </Pressable>
            <Text style={styles.scanHint}>
              {scanning ? 'Reading label…' : 'Autofills the fields below — review before saving.'}
            </Text>

            <LabelForm
              key={formKey}
              initial={initial}
              showNameFields
              submitLabel="Save food"
              onCancel={onClose}
              onSubmit={async (value) => {
                const food = await addCustomFood({
                  description: value.description,
                  brand: value.brand || undefined,
                  calories: value.calories,
                  protein: value.protein,
                  carbs: value.carbs,
                  fat: value.fat,
                  micros: value.micros,
                  servingGrams: value.servingGrams,
                  cupGrams: value.cupGrams,
                });
                onCreated?.(food.id);
                onClose();
              }}
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Overlay scanned micro amounts onto the standard set, keeping any extras. */
function mergeMicros(scanned: FoodMicro[]): FoodMicro[] {
  const byLabel = new Map(scanned.map((m) => [m.label.toLowerCase(), m]));
  const merged = DEFAULT_MICROS.map((d) => {
    const match = byLabel.get(d.label.toLowerCase());
    return match ? { ...d, amount: match.amount } : d;
  });
  const known = new Set(DEFAULT_MICROS.map((d) => d.label.toLowerCase()));
  for (const m of scanned) {
    if (!known.has(m.label.toLowerCase())) merged.push(m);
  }
  return merged;
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
    maxHeight: '88%',
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
  title: {
    color: colors.textPrimary,
    fontSize: fontSize.title,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    marginTop: spacing.lg,
  },
  scanLabel: {
    color: colors.primary,
    fontSize: fontSize.subtitle,
    fontWeight: '700',
  },
  scanHint: {
    color: colors.textTertiary,
    fontSize: fontSize.caption,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
