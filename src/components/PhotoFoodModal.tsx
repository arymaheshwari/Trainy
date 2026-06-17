import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { estimateFoodPhoto } from '../api/estimateFood';
import { FoodDetailSource } from '../api/usda';
import { colors, fontSize, radius, spacing } from '../theme';
import { FoodDetailSheet } from './FoodDetailSheet';

/**
 * Add food by photo: take or pick a picture of the meal, Gemini vision
 * estimates the nutrition, and the estimate opens in the detail sheet to
 * review/edit before logging against `day`.
 */
export function PhotoFoodModal({
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
  const [estimating, setEstimating] = useState(false);
  const [detail, setDetail] = useState<FoodDetailSource | null>(null);

  useEffect(() => {
    if (visible) {
      setEstimating(false);
      setDetail(null);
    }
  }, [visible]);

  const pickAndEstimate = async (source: 'camera' | 'library') => {
    try {
      const options: ImagePicker.ImagePickerOptions = { base64: true, quality: 0.6, allowsEditing: true };
      let result: ImagePicker.ImagePickerResult;
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Camera access needed', 'Enable camera access to photograph food.');
          return;
        }
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        result = await ImagePicker.launchImageLibraryAsync(options);
      }

      const asset = result.canceled ? null : result.assets[0];
      if (!asset?.base64) return;

      setEstimating(true);
      const r = await estimateFoodPhoto(asset.base64, asset.mimeType ?? 'image/jpeg');
      if (!r.ok) {
        Alert.alert("Couldn't estimate", r.reason);
        return;
      }
      const est = r.food;
      setDetail({
        kind: 'resolved',
        source: 'ai',
        refId: '',
        food: {
          fdcId: 0,
          description: est.description || 'Photographed food',
          brand: est.brand || undefined,
          basis: 'AI estimate from photo',
          calories: est.calories,
          protein: est.protein,
          carbs: est.carbs,
          fat: est.fat,
          micros: est.micros,
        },
      });
    } catch {
      Alert.alert("Couldn't estimate", 'Please try again with a clearer photo.');
    } finally {
      setEstimating(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>Add by photo</Text>
          <Text style={styles.subtitle}>Snap your meal and we'll estimate it.</Text>

          {estimating ? (
            <View style={styles.analyzing}>
              <ActivityIndicator color={colors.orange} />
              <Text style={styles.analyzingText}>Analyzing your food…</Text>
            </View>
          ) : (
            <View style={styles.buttons}>
              <Pressable style={styles.button} onPress={() => pickAndEstimate('camera')}>
                <Ionicons name="camera" size={24} color={colors.textPrimary} />
                <Text style={styles.buttonText}>Take photo</Text>
              </Pressable>
              <Pressable style={styles.button} onPress={() => pickAndEstimate('library')}>
                <Ionicons name="images-outline" size={24} color={colors.textPrimary} />
                <Text style={styles.buttonText}>Choose from library</Text>
              </Pressable>
            </View>
          )}
        </Pressable>
      </Pressable>

      {detail && (
        <FoodDetailSheet
          detail={detail}
          day={day}
          onClose={() => setDetail(null)} // back to the photo options
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
  buttons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    paddingVertical: spacing.xl,
  },
  buttonText: {
    color: colors.textPrimary,
    fontSize: fontSize.body,
    fontWeight: '700',
    textAlign: 'center',
  },
  analyzing: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxxl,
  },
  analyzingText: {
    color: colors.textSecondary,
    fontSize: fontSize.body,
    fontWeight: '600',
  },
});
