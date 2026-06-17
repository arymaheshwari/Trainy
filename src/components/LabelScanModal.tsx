import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { scanLabel } from '../api/scanLabel';
import { FoodDetailSource } from '../api/usda';
import { colors, fontSize, radius, spacing } from '../theme';
import { FoodDetailSheet } from './FoodDetailSheet';

/**
 * Track by scanning a Nutrition Facts label: take/pick a photo of the label,
 * the scanner extracts the values, and the result opens in the detail sheet to
 * review/fix and set a portion before logging against `day`.
 */
export function LabelScanModal({
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
  const [scanning, setScanning] = useState(false);
  const [detail, setDetail] = useState<FoodDetailSource | null>(null);

  useEffect(() => {
    if (visible) {
      setScanning(false);
      setDetail(null);
    }
  }, [visible]);

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
      setDetail({
        kind: 'resolved',
        source: 'label',
        refId: '',
        food: {
          fdcId: 0,
          description: label.description || 'Scanned label',
          brand: label.brand || undefined,
          basis: 'per serving',
          calories: label.calories,
          protein: label.protein,
          carbs: label.carbs,
          fat: label.fat,
          micros: label.micros,
        },
      });
    } catch {
      Alert.alert("Couldn't read the label", 'Please try again with a clearer photo.');
    } finally {
      setScanning(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>Scan a label</Text>
          <Text style={styles.subtitle}>
            Snap a Nutrition Facts label — you can fix any values and set the portion before logging.
          </Text>

          {scanning ? (
            <View style={styles.analyzing}>
              <ActivityIndicator color={colors.orange} />
              <Text style={styles.analyzingText}>Reading label…</Text>
            </View>
          ) : (
            <View style={styles.buttons}>
              <Pressable style={styles.button} onPress={() => pickAndScan('camera')}>
                <Ionicons name="camera" size={24} color={colors.textPrimary} />
                <Text style={styles.buttonText}>Take photo</Text>
              </Pressable>
              <Pressable style={styles.button} onPress={() => pickAndScan('library')}>
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
          onClose={() => setDetail(null)} // back to the scan options
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
